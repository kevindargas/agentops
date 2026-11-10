"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDashedIcon,
  ClockIcon,
  SendIcon,
  ShieldIcon,
  XCircleIcon,
  XIcon,
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import type { ApprovalState, Change } from "@/lib/types"

type ApproverStatus = "approved" | "rejected" | "pending" | "idle"

const approverMeta: Record<
  ApproverStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  approved: {
    label: "Approved",
    icon: <CheckCircle2Icon />,
    className: "text-success-text",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircleIcon />,
    className: "text-destructive",
  },
  pending: {
    label: "Pending",
    icon: <ClockIcon />,
    className: "text-warning-text",
  },
  idle: {
    label: "Not requested",
    icon: <CircleDashedIcon />,
    className: "text-muted-foreground",
  },
}

export function ChangeApprovalCard({ change }: { change: Change }) {
  const [state, setState] = React.useState<ApprovalState>(change.approval)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [touched, setTouched] = React.useState(false)

  const approvers: { id: string; role: string }[] = change.cabRequired
    ? [
        { id: "u-004", role: "Change manager" },
        { id: "u-001", role: "CAB chair" },
        { id: "u-009", role: "Security" },
      ]
    : [{ id: "u-004", role: "Change manager" }]

  function statusFor(index: number): ApproverStatus {
    if (state === "Approved") return "approved"
    if (state === "Rejected") return index === 0 ? "rejected" : "idle"
    if (state === "Requested")
      return index === 0 && approvers.length > 1 ? "approved" : "pending"
    return "idle"
  }
  const statuses = approvers.map((_, i) => statusFor(i))
  const approvedCount = statuses.filter((s) => s === "approved").length
  const reasonValid = reason.trim().length >= 10

  function reject() {
    if (!reasonValid) {
      setTouched(true)
      return
    }
    setState("Rejected")
    setRejectOpen(false)
    toast(`${change.number} rejected`, { description: reason.trim() })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldIcon className="size-4 text-muted-foreground" /> Approval
        </CardTitle>
        <CardDescription>
          {change.cabRequired
            ? "Requires Change Advisory Board authorization"
            : change.type === "Standard"
              ? "Pre-approved standard change"
              : "Requires change manager approval"}
        </CardDescription>
        <CardAction>
          <StateBadge state={state} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              {approvedCount} of {approvers.length} approved
            </span>
            {change.cabRequired && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarClockIcon className="size-3.5" /> CAB Thu 09:00 UTC
              </span>
            )}
          </div>
          <div className="flex gap-1" aria-hidden>
            {statuses.map((s, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  s === "approved"
                    ? "bg-success"
                    : s === "rejected"
                      ? "bg-destructive"
                      : s === "pending"
                        ? "bg-warning/60"
                        : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        <ul className="flex flex-col divide-y">
          {approvers.map((a, i) => {
            const meta = approverMeta[statuses[i]]
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <UserChip userId={a.id} size="xs" />
                  <span className="pl-7 text-[11px] text-muted-foreground">
                    {a.role}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 text-xs font-medium [&_svg]:size-3.5",
                    meta.className
                  )}
                >
                  {meta.icon}
                  {meta.label}
                </span>
              </li>
            )
          })}
        </ul>

        {state === "Requested" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                setState("Approved")
                toast.success(`${change.number} approved`, {
                  description: "The implementer has been notified.",
                })
              }}
            >
              <CheckIcon /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReason("")
                setTouched(false)
                setRejectOpen(true)
              }}
            >
              <XIcon /> Reject
            </Button>
          </div>
        )}
        {state === "Not Yet Requested" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setState("Requested")
              toast("Approval requested", {
                description: change.cabRequired
                  ? "Added to the next CAB agenda."
                  : "Sent to the change manager.",
              })
            }}
          >
            <SendIcon /> Request approval
          </Button>
        )}
        {state === "Approved" && (
          <p className="text-xs text-muted-foreground">
            Approved — the change can be scheduled within the maintenance
            window.
          </p>
        )}
        {state === "Rejected" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Rejected. Address the feedback in the plans and re-request
              approval.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setState("Requested")
                toast("Approval re-requested")
              }}
            >
              <SendIcon /> Re-request approval
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {change.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The requester will see your reason and the change will leave the
              CAB agenda until it is re-requested.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={touched && !reasonValid ? true : undefined}>
            <FieldLabel htmlFor="reject-reason">Reason</FieldLabel>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !reasonValid ? true : undefined}
              placeholder="e.g. Backout plan does not cover the database migration"
              className="min-h-20"
              autoFocus
            />
            {touched && !reasonValid ? (
              <FieldError>
                Give at least 10 characters so the requester knows what to fix.
              </FieldError>
            ) : (
              <FieldDescription>
                Posted as a work note on the change.
              </FieldDescription>
            )}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={reject}>
              <XIcon /> Reject change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
