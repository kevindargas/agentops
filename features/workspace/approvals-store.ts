import { approvals as seed } from "@/lib/data/activity"
import { NOW, daysFromNow } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { createListStore } from "@/lib/store"
import type { Approval, ApprovalState } from "@/lib/types"

/**
 * One client-side list of approval records shared by the approvals inbox
 * (`features/workspace/approvals-list.tsx`, its stat row) and the change
 * record's approval card (`features/changes/change-approval-card.tsx`), so a
 * decision taken in one place is visible in the other. Decisions mutate the
 * row's `state` instead of removing it; the inbox filters on `Requested`.
 */
export const approvalsStore = createListStore<Approval>(seed, (a) => a.id)

export type ApprovalDecision = Extract<ApprovalState, "Approved" | "Rejected">

/** Approvals still waiting on a decision. */
export function pendingApprovals(list: Approval[] = approvalsStore.get()) {
  return list.filter((a) => a.state === "Requested")
}

/** Approvals already decided in this session (newest first). */
export function decidedApprovals(list: Approval[] = approvalsStore.get()) {
  return list.filter((a) => a.state === "Approved" || a.state === "Rejected")
}

/** The approval record for a given change, request or article number, if any. */
export function approvalForRecord(
  recordNumber: string,
  list: Approval[] = approvalsStore.get()
) {
  return list.find((a) => a.recordNumber === recordNumber)
}

/** Record a decision on one or more approvals. */
export function decideApprovals(ids: string[], decision: ApprovalDecision) {
  for (const id of ids) approvalsStore.patch(id, { state: decision })
}

/**
 * Create (or re-open) an approval request for a record so it shows up in the
 * inbox. Used by the change approval card's "Request approval" action.
 */
export function requestApproval(input: {
  recordNumber: string
  recordType: Approval["recordType"]
  shortDescription: string
  requestedById: string
  dueInDays?: number
}) {
  const existing = approvalForRecord(input.recordNumber)
  if (existing) {
    approvalsStore.patch(existing.id, {
      state: "Requested",
      requested: NOW.toISOString(),
      due: daysFromNow(input.dueInDays ?? 2),
    })
    return existing.id
  }
  const id = `apr-${input.recordNumber}`
  approvalsStore.add({
    id,
    recordNumber: input.recordNumber,
    recordType: input.recordType,
    shortDescription: input.shortDescription,
    requestedById: input.requestedById,
    approverId: currentUser.id,
    state: "Requested",
    requested: NOW.toISOString(),
    due: daysFromNow(input.dueInDays ?? 2),
  })
  return id
}
