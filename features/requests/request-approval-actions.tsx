"use client"

import * as React from "react"
import Link from "next/link"
import {
  BellIcon,
  BellOffIcon,
  CheckIcon,
  CopyIcon,
  PackageIcon,
  ShieldIcon,
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { MetaItem } from "@/components/record/record-header"
import {
  RecordOverflowMenu,
  type RecordOverflowItem,
} from "@/components/record/record-overflow-menu"
import { StateBadge } from "@/components/shared/status-badge"
import { NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import {
  approvalForRecord,
  approvalsStore,
  decideApprovals,
  requestApproval,
  type ApprovalDecision,
} from "@/features/workspace/approvals-store"
import type { ApprovalState, Request } from "@/lib/types"
import {
  nextItemNumber,
  nextRequestNumber,
  requestsStore,
} from "./requests-store"

const approvalTone: Record<
  ApprovalState,
  "success" | "danger" | "warning" | "default"
> = {
  Approved: "success",
  Rejected: "danger",
  Requested: "warning",
  "Not Yet Requested": "default",
}

/** Current request from the client store, falling back to the server copy. */
export function useRequest(fallback: Request) {
  const list = requestsStore.use()
  return list.find((r) => r.number === fallback.number) ?? fallback
}

/** Approval state: the shared approvals store wins over the seeded field. */
export function useRequestApproval(request: Request): ApprovalState {
  const approvals = approvalsStore.use()
  const live = useRequest(request)
  return approvalForRecord(request.number, approvals)?.state ?? live.approval
}

export function RequestBadges({ request }: { request: Request }) {
  const live = useRequest(request)
  return (
    <>
      <StateBadge state={live.state} />
      <StateBadge state={live.stage} dot={false} />
    </>
  )
}

export function RequestApprovalBadge({ request }: { request: Request }) {
  const state = useRequestApproval(request)
  return <StateBadge state={state} />
}

export function RequestApprovalMeta({ request }: { request: Request }) {
  const state = useRequestApproval(request)
  return (
    <MetaItem label="Approval" icon={<ShieldIcon />} tone={approvalTone[state]}>
      {state}
    </MetaItem>
  )
}

export function RequestApprovalActions({
  request: seed,
}: {
  request: Request
}) {
  const request = useRequest(seed)
  const approvals = approvalsStore.use()
  const record = approvalForRecord(request.number, approvals)
  const state = record?.state ?? request.approval
  const [pending, setPending] = React.useState<ApprovalDecision | null>(null)
  const [comment, setComment] = React.useState("")
  const [touched, setTouched] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [following, setFollowing] = React.useState(false)

  const closed = request.state.startsWith("Closed")
  const reasonValid = comment.trim().length >= 10

  const patch = (next: Partial<Request>) =>
    requestsStore.patch(request.number, { ...next, updated: NOW.toISOString() })

  function ensureRecord() {
    return (
      record?.id ??
      requestApproval({
        recordNumber: request.number,
        recordType: "Request",
        shortDescription: `${request.items.length} item(s) requested for ${request.requestedForId}`,
        requestedById: request.requestedById,
        dueInDays: 1,
      })
    )
  }

  function decide() {
    if (!pending) return
    if (pending === "Rejected" && !reasonValid) {
      setTouched(true)
      return
    }
    decideApprovals([ensureRecord()], pending)
    if (pending === "Approved") {
      patch({
        approval: "Approved",
        state: "In Progress",
        stage: "Fulfillment",
      })
      toast.success(`${request.number} approved`, {
        description: "Fulfillment has started and the inbox entry is cleared.",
      })
    } else {
      patch({
        approval: "Rejected",
        state: "Closed Cancelled",
        stage: "Cancelled",
      })
      toast(`${request.number} rejected`, { description: comment.trim() })
    }
    setPending(null)
    setComment("")
    setTouched(false)
  }

  function duplicate() {
    const number = nextRequestNumber()
    let item = Number(nextItemNumber().replace(/^RITM/, ""))
    requestsStore.add({
      ...request,
      number,
      state: "Pending Approval",
      stage: "Waiting for Approval",
      approval: "Not Yet Requested",
      requestedById: currentUser.id,
      opened: NOW.toISOString(),
      updated: NOW.toISOString(),
      items: request.items.map((i) => ({
        ...i,
        number: `RITM${String(item++).padStart(7, "0")}`,
        state: "Pending Approval",
        stage: "Waiting for Approval",
        tasks: [],
      })),
    })
    toast.success(`${number} drafted with the same items`, {
      description: "Listed under Requests as Pending Approval.",
    })
  }

  const overflow: RecordOverflowItem[] = [
    {
      label: "Duplicate request",
      icon: <CopyIcon />,
      onSelect: () => {
        duplicate()
        return false
      },
    },
    {
      label: following ? "Unfollow" : "Follow",
      icon: following ? <BellOffIcon /> : <BellIcon />,
      separatorBefore: true,
      message: following
        ? `You no longer follow ${request.number}`
        : `You now follow ${request.number} in this session`,
      onSelect: () => setFollowing((f) => !f),
    },
    {
      label: "Cancel request",
      destructive: true,
      separatorBefore: true,
      disabled: closed,
      onSelect: () => {
        setCancelOpen(true)
        return false
      },
    },
  ]

  return (
    <>
      {state === "Requested" ? (
        <>
          <Button
            variant="outline"
            onClick={() => {
              setComment("")
              setTouched(false)
              setPending("Rejected")
            }}
          >
            <XIcon /> Reject
          </Button>
          <Button
            onClick={() => {
              setComment("")
              setTouched(false)
              setPending("Approved")
            }}
          >
            <CheckIcon /> Approve
          </Button>
        </>
      ) : (
        <Button variant="outline" render={<Link href="/itsm/catalog" />}>
          <PackageIcon /> Order again
        </Button>
      )}
      <RecordOverflowMenu items={overflow} number={request.number} />

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "Approved" ? "Approve" : "Reject"} {request.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "Approved"
                ? "Fulfillment tasks start immediately and the request leaves the approvals inbox."
                : "The request is closed as cancelled and the requester sees your reason."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field
            data-invalid={
              pending === "Rejected" && touched && !reasonValid
                ? true
                : undefined
            }
          >
            <FieldLabel htmlFor="approval-comment">
              {pending === "Approved" ? "Comment" : "Reason"}
            </FieldLabel>
            <Textarea
              id="approval-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={
                pending === "Rejected" && touched && !reasonValid
                  ? true
                  : undefined
              }
              placeholder={
                pending === "Approved"
                  ? "Optional note for the record"
                  : "Why is this request being rejected?"
              }
              className="min-h-20"
              autoFocus
            />
            {pending === "Rejected" && touched && !reasonValid ? (
              <FieldError>
                Give at least 10 characters so the requester knows what to
                change.
              </FieldError>
            ) : (
              <FieldDescription>
                {pending === "Approved"
                  ? "Kept with the decision in this session."
                  : "Shown in the rejection toast and kept with the decision."}
              </FieldDescription>
            )}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pending === "Rejected" ? "destructive" : "default"}
              onClick={decide}
            >
              {pending === "Approved" ? <CheckIcon /> : <XIcon />}
              {pending === "Approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {request.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Open fulfillment tasks are closed incomplete and the request is
              marked Closed Cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setCancelOpen(false)
                patch({ state: "Closed Cancelled", stage: "Cancelled" })
                toast(`${request.number} cancelled`)
              }}
            >
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
