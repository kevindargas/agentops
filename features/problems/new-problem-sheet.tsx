"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "cn"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { setQueryParam } from "@/hooks/use-query-param"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { PriorityBadge } from "@/components/shared/status-badge"
import { priorityLabels } from "@/lib/constants"
import { configurationItems } from "@/lib/data/cmdb"
import { NOW } from "@/lib/data/seed"
import { groups } from "@/lib/data/users"
import type { Priority, Problem } from "@/lib/types"
import { nextProblemNumber, problemsStore } from "./problems-store"

const priorities = [1, 2, 3, 4, 5] as Priority[]

/**
 * Create sheet for problems. Opens from `?new=1` (quick create, command menu
 * and the list header) and appends the record to `problemsStore`, so the table
 * shows it immediately.
 */
export function NewProblemSheet() {
  const params = useSearchParams()
  const [openState, setOpenState] = React.useState<boolean | null>(null)
  const open = openState ?? params.get("new") === "1"
  const setOpen = (next: boolean) => setOpenState(next)
  const [priority, setPriority] = React.useState<Priority>(3)
  const [knownError, setKnownError] = React.useState(false)
  const [shortDescription, setShortDescription] = React.useState("")
  const [dirty, setDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)

  function reset() {
    setPriority(3)
    setKnownError(false)
    setShortDescription("")
    setDirty(false)
  }

  function leave() {
    setOpen(false)
    reset()
    if (params.get("new")) setQueryParam("new", null)
  }

  function close(next: boolean) {
    if (!next && dirty) {
      setDiscardOpen(true)
      return
    }
    if (next) setOpen(true)
    else leave()
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const number = nextProblemNumber()
    const now = NOW.toISOString()
    const ciId = String(data.get("ci") ?? "")
    const workaround = String(data.get("workaround") ?? "").trim()
    const problem: Problem = {
      number,
      shortDescription: shortDescription.trim(),
      state: "New",
      priority,
      assignmentGroupId: String(data.get("group") || "g-sd"),
      ciId: ciId || undefined,
      relatedIncidents: 0,
      knownError: knownError && workaround.length > 0,
      workaround: workaround || undefined,
      opened: now,
      updated: now,
    }
    problemsStore.add(problem)
    toast.success(`Problem ${number} created`, {
      description: `P${priority} · ${problem.shortDescription}`,
    })
    setDirty(false)
    leave()
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New problem
      </Button>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        <form
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="flex h-full min-h-0 flex-col"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>New problem</SheetTitle>
            <SheetDescription>
              Open a problem to track the root cause behind recurring incidents.
              Link incidents from the record once it exists.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup className="gap-6">
              <FieldSet>
                <FieldLegend variant="label">What keeps happening</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="prb-short">Short description</FieldLabel>
                  <Input
                    id="prb-short"
                    name="shortDescription"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="e.g. Intermittent 502s from the API gateway after deploys"
                    maxLength={160}
                    required
                    autoFocus
                  />
                  <div className="flex items-start justify-between gap-3">
                    <FieldDescription>
                      Name the symptom, not the suspected cause.
                    </FieldDescription>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {shortDescription.length}/160
                    </span>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="prb-ci">Affected service</FieldLabel>
                  <Select
                    name="ci"
                    items={configurationItems.map((ci) => ({
                      value: ci.id,
                      label: ci.name,
                    }))}
                  >
                    <SelectTrigger id="prb-ci" className="w-full">
                      <SelectValue placeholder="Select a service or system" />
                    </SelectTrigger>
                    <SelectContent>
                      {configurationItems.map((ci) => (
                        <SelectItem key={ci.id} value={ci.id}>
                          {ci.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Optional. Changes on the same service show up on the problem
                    record.
                  </FieldDescription>
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Priority and routing</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="prb-priority">Priority</FieldLabel>
                    <Select
                      value={String(priority)}
                      onValueChange={(v) =>
                        v && setPriority(Number(v) as Priority)
                      }
                      items={priorities.map((p) => ({
                        value: String(p),
                        label: `P${p} · ${priorityLabels[p]}`,
                      }))}
                    >
                      <SelectTrigger id="prb-priority" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            P{p} · {priorityLabels[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="prb-group">
                      Assignment group
                    </FieldLabel>
                    <Select
                      name="group"
                      defaultValue="g-sd"
                      items={groups
                        .filter((g) => g.type === "itil")
                        .map((g) => ({ value: g.id, label: g.name }))}
                    >
                      <SelectTrigger id="prb-group" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groups
                          .filter((g) => g.type === "itil")
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Priority drives the order on the problems list; it does not
                    carry a resolution SLA.
                  </p>
                  <PriorityBadge priority={priority} short />
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Workaround</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="prb-workaround">
                    Workaround (optional)
                  </FieldLabel>
                  <Textarea
                    id="prb-workaround"
                    name="workaround"
                    placeholder="Steps the Service Desk can apply until the permanent fix ships."
                    className="min-h-20"
                  />
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="prb-known-error"
                    checked={knownError}
                    onCheckedChange={(c) => {
                      setKnownError(c === true)
                      setDirty(true)
                    }}
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="prb-known-error">
                      Publish as known error
                    </FieldLabel>
                    <FieldDescription>
                      Requires a workaround. Known errors show a bookmark on the
                      list and feed the Knowledge module.
                    </FieldDescription>
                  </div>
                </Field>
              </FieldSet>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            tertiary={
              <span className="text-xs text-muted-foreground">
                {dirty ? "Unsaved draft" : "Nothing entered yet"}
              </span>
            }
            primary={
              <Button type="submit">
                <PlusIcon /> Create problem
              </Button>
            }
          />
        </form>
      </SheetContent>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this problem?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved details. They will be lost if you close the form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                leave()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
