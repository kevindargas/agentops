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
import { MetaItem } from "@/components/record/record-header"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { cabSchedule } from "@/lib/constants"
import { nextCab } from "@/lib/data/itsm"
import { NOW } from "@/lib/data/seed"
import { currentUser, getGroup } from "@/lib/data/users"
import { formatDateTime } from "@/lib/format"
import {
  approvalForRecord,
  approvalsStore,
  decideApprovals,
  requestApproval,
} from "@/features/workspace/approvals-store"
import type { ApprovalState, Change } from "@/lib/types"
import { changesStore } from "./changes-store"

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
    className: "text-danger-text",
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

const approvalTone: Record<
  ApprovalState,
  "success" | "danger" | "warning" | "default"
> = {
  Approved: "success",
  Rejected: "danger",
  Requested: "warning",
  "Not Yet Requested": "default",
}

/**
 * Approval state for a change: the shared approvals store wins (so a decision
 * taken on /approvals shows here and vice versa); the seeded change field is
 * the fallback for changes that never had an approval record.
 */
export function useChangeApproval(change: Change): ApprovalState {
  const approvals = approvalsStore.use()
  const live = changesStore.use().find((c) => c.number === change.number)
  return (
    approvalForRecord(change.number, approvals)?.state ??
    live?.approval ??
    change.approval
  )
}

/** Header meta chip that follows the shared approvals store. */
export function ChangeApprovalMeta({ change }: { change: Change }) {
  const state = useChangeApproval(change)
  return (
    <MetaItem label="Approval" icon={<ShieldIcon />} tone={approvalTone[state]}>
      {state}
    </MetaItem>
  )
}

export function ChangeApprovalCard({ change }: { change: Change }) {
  const approvals = approvalsStore.use()
  const record = approvalForRecord(change.number, approvals)
  const state = useChangeApproval(change)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [touched, setTouched] = React.useState(false)

  const changeManager =
    getGroup("g-cab")?.manager ?? getGroup(change.assignmentGroupId)?.manager
  const securityLead = getGroup("g-sec")?.manager
  const approvers: { id: string; role: string }[] = [
    ...(changeManager ? [{ id: changeManager, role: "Change manager" }] : []),
    ...(change.cabRequired
      ? [
          { id: currentUser.id, role: "CAB chair" },
          ...(securityLead ? [{ id: securityLead, role: "Security" }] : []),
        ]
      : []),
  ]

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

  function syncChange(next: ApprovalState) {
    changesStore.patch(change.number, (c) => ({
      ...c,
      approval: next,
      state:
        next === "Approved" && ["Assess", "Authorize"].includes(c.state)
          ? "Scheduled"
          : c.state,
      updated: NOW.toISOString(),
    }))
  }

  function ensureRecord() {
    return (
      record?.id ??
      requestApproval({
        recordNumber: change.number,
        recordType: "Change",
        shortDescription: change.shortDescription,
        requestedById: change.requestedById,
      })
    )
  }

  function approve() {
    decideApprovals([ensureRecord()], "Approved")
    syncChange("Approved")
    toast.success(`${change.number} approved`, {
      description:
        "Recorded in this session and cleared from the approvals inbox. The change is now Scheduled.",
    })
  }

  function reject() {
    if (!reasonValid) {
      setTouched(true)
      return
    }
    decideApprovals([ensureRecord()], "Rejected")
    syncChange("Rejected")
    setRejectOpen(false)
    toast(`${change.number} rejected`, { description: reason.trim() })
  }

  function request(re = false) {
    requestApproval({
      recordNumber: change.number,
      recordType: "Change",
      shortDescription: change.shortDescription,
      requestedById: change.requestedById,
    })
    syncChange("Requested")
    toast(re ? "Approval re-requested" : "Approval requested", {
      description: change.cabRequired
        ? `Added to the approvals inbox and the CAB agenda for ${formatDateTime(nextCab().toISOString())}.`
        : "Added to the approvals inbox for the change manager.",
    })
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
              <span
                className="inline-flex items-center gap-1 text-muted-foreground"
                title={`Next CAB ${formatDateTime(nextCab().toISOString())}`}
              >
                <CalendarClockIcon className="size-3.5" /> CAB{" "}
                {cabSchedule.label}
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
                  <span className="pl-7 text-2xs text-muted-foreground">
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
            <Button size="sm" className="flex-1" onClick={approve}>
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
          <Button size="sm" variant="outline" onClick={() => request()}>
            <SendIcon /> Request approval
          </Button>
        )}
        {state === "Approved" && (
          <p className="text-xs text-muted-foreground">
            Approved. The change can be scheduled within the maintenance window.
          </p>
        )}
        {state === "Rejected" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Rejected. Address the feedback in the plans and re-request
              approval.
            </p>
            <Button size="sm" variant="outline" onClick={() => request(true)}>
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
              The change leaves the approvals inbox and the CAB agenda until it
              is re-requested. Your reason is kept with the decision.
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
              <FieldDescription>Shown in the rejection toast.</FieldDescription>
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
