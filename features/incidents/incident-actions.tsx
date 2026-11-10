"use client"

import * as React from "react"
import {
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  PauseIcon,
  RotateCcwIcon,
  StarIcon,
  UserCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Incident } from "@/lib/types"

const resolutionCodes = {
  fixed: "Solved (Permanently)",
  workaround: "Solved (Work Around)",
  remote: "Solved Remotely",
  duplicate: "Duplicate",
  "not-reproducible": "Not Reproducible",
  caller: "Closed by Caller",
} as const

const holdReasons = {
  caller: "Awaiting caller",
  vendor: "Awaiting vendor",
  change: "Awaiting change",
  problem: "Awaiting problem",
} as const

const MIN_NOTES = 20

export function IncidentActions({ incident }: { incident: Incident }) {
  const [resolveOpen, setResolveOpen] = React.useState(false)
  const [holdOpen, setHoldOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [code, setCode] = React.useState<keyof typeof resolutionCodes>("fixed")
  const [notes, setNotes] = React.useState("")
  const [notify, setNotify] = React.useState(true)
  const [touched, setTouched] = React.useState(false)
  const [holdReason, setHoldReason] =
    React.useState<keyof typeof holdReasons>("caller")

  const closed = ["Resolved", "Closed", "Canceled"].includes(incident.state)
  const resolved = incident.state === "Resolved"
  const onHold = incident.state === "On Hold"
  const notesValid = notes.trim().length >= MIN_NOTES

  function openResolve() {
    setNotes("")
    setTouched(false)
    setResolveOpen(true)
  }

  function resolve() {
    if (!notesValid) {
      setTouched(true)
      return
    }
    setResolveOpen(false)
    toast.success(`${incident.number} resolved`, {
      description: `${resolutionCodes[code]}${notify ? " · caller notified by email" : ""}. Auto-closes in 3 days unless reopened.`,
    })
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => toast.success(`${incident.number} assigned to you`)}
        disabled={closed}
      >
        <UserCheckIcon /> Assign to me
      </Button>
      <ButtonGroup>
        {resolved ? (
          <Button
            variant="outline"
            onClick={() =>
              toast(`${incident.number} reopened`, {
                description: "State set back to In Progress.",
              })
            }
          >
            <RotateCcwIcon /> Reopen
          </Button>
        ) : (
          <Button onClick={openResolve} disabled={closed}>
            <CheckIcon /> Resolve
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon"
                variant={resolved ? "outline" : "default"}
                aria-label="More state actions"
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Change state</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem
              disabled={closed || onHold}
              onClick={() => setHoldOpen(true)}
            >
              <PauseIcon /> Put on hold…
            </DropdownMenuItem>
            {onHold && (
              <DropdownMenuItem
                onClick={() =>
                  toast.success(`${incident.number} resumed`, {
                    description: "State set to In Progress.",
                  })
                }
              >
                <RotateCcwIcon /> Resume work
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={closed}
              onClick={() =>
                toast(
                  incident.majorIncident
                    ? "Major incident demoted"
                    : "Major incident proposed — awaiting manager approval"
                )
              }
            >
              <StarIcon />{" "}
              {incident.majorIncident
                ? "Demote major incident"
                : "Propose major incident"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={closed}
              onClick={() => setCancelOpen(true)}
            >
              <BanIcon /> Cancel incident…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve {incident.number}</DialogTitle>
            <DialogDescription>
              Tell the caller what fixed the issue. They have 3 days to reopen
              before the incident closes automatically.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="resolution-code">Resolution code</FieldLabel>
              <Select
                value={code}
                onValueChange={(v) =>
                  v && setCode(v as keyof typeof resolutionCodes)
                }
                items={resolutionCodes}
              >
                <SelectTrigger id="resolution-code" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(resolutionCodes).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {code === "workaround"
                  ? "A workaround keeps the linked problem open for a permanent fix."
                  : code === "duplicate"
                    ? "Link the original incident in the notes so the caller is redirected."
                    : "Drives resolution reporting and knowledge candidates."}
              </FieldDescription>
            </Field>
            <Field data-invalid={touched && !notesValid ? true : undefined}>
              <FieldLabel htmlFor="resolution-notes">
                Resolution notes
              </FieldLabel>
              <Textarea
                id="resolution-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !notesValid ? true : undefined}
                placeholder="What was the cause and what did you do to fix it?"
                className="min-h-28"
                autoFocus
              />
              <div className="flex items-start justify-between gap-3">
                {touched && !notesValid ? (
                  <FieldError>
                    Add at least {MIN_NOTES} characters so the caller
                    understands the fix.
                  </FieldError>
                ) : (
                  <FieldDescription>
                    Shown to the caller in plain language. Avoid internal
                    hostnames and ticket jargon.
                  </FieldDescription>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {notes.trim().length}
                </span>
              </div>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="notify-caller"
                checked={notify}
                onCheckedChange={(v) => setNotify(Boolean(v))}
              />
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor="notify-caller">
                  Notify the caller by email
                </FieldLabel>
                <FieldDescription className="mt-0">
                  Includes the resolution notes and a link to reopen.
                </FieldDescription>
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resolve}>
              <CheckIcon /> Resolve incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Put {incident.number} on hold</DialogTitle>
            <DialogDescription>
              The SLA clock pauses while the incident waits on someone else.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="hold-reason">On hold reason</FieldLabel>
              <Select
                value={holdReason}
                onValueChange={(v) =>
                  v && setHoldReason(v as keyof typeof holdReasons)
                }
                items={holdReasons}
              >
                <SelectTrigger id="hold-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(holdReasons).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {holdReason === "caller"
                  ? "The caller is reminded after 2 days and the incident auto-resolves after 5."
                  : "Resumes automatically when the linked record is updated."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="hold-note">Work note</FieldLabel>
              <Textarea
                id="hold-note"
                placeholder="What are you waiting for?"
                className="min-h-20"
              />
              <FieldDescription>
                Internal only — not visible to the caller.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setHoldOpen(false)
                toast(`${incident.number} placed on hold`, {
                  description: holdReasons[holdReason],
                })
              }}
            >
              <PauseIcon /> Put on hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <BanIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Cancel {incident.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The caller will be told the incident was canceled and the SLA will
              stop. Canceled incidents are excluded from resolution metrics and
              cannot be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep incident</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setCancelOpen(false)
                toast(`${incident.number} canceled`)
              }}
            >
              Cancel incident
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
