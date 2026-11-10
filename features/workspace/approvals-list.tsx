"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  BookOpenIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
  GitBranchIcon,
  HistoryIcon,
  PackageIcon,
  ShieldCheckIcon,
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { recordHref } from "@/components/shared/record-link"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import {
  RiskBadge,
  StateBadge,
  toneClasses,
} from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { getCatalogItem } from "@/lib/data/catalog"
import { getChange, getRequest } from "@/lib/data/itsm"
import { NOW } from "@/lib/data/seed"
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
} from "@/lib/format"
import type { Approval, ChangeRisk } from "@/lib/types"
import {
  approvalsStore,
  decidedApprovals,
  decideApprovals,
  pendingApprovals,
  type ApprovalDecision,
} from "./approvals-store"

type Decision = ApprovalDecision
type TypeFilter = "All" | Approval["recordType"]
type SortKey = "due" | "requested" | "risk"

interface EnrichedApproval extends Approval {
  risk: ChangeRisk
  detail: string
  amount?: number
  requestedForId?: string
  window?: string
}

const riskRank: Record<ChangeRisk, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
  "Very High": 3,
}

function enrich(a: Approval): EnrichedApproval {
  if (a.recordType === "Change") {
    const c = getChange(a.recordNumber)
    return {
      ...a,
      risk: c?.risk ?? "Moderate",
      detail: c
        ? `${c.type} change · ${c.category}${c.cabRequired ? " · CAB required" : ""}`
        : "Change",
      window: c
        ? `${formatDateTime(c.plannedStart)} to ${formatDateTime(c.plannedEnd).split(", ")[1] ?? ""}`
        : undefined,
    }
  }
  if (a.recordType === "Knowledge") {
    return { ...a, risk: "Low", detail: "Knowledge article" }
  }
  const r = getRequest(a.recordNumber)
  const names =
    r?.items.map(
      (i) => getCatalogItem(i.catalogItemId)?.name ?? i.catalogItemId
    ) ?? []
  return {
    ...a,
    shortDescription: names.length ? names.join(", ") : a.shortDescription,
    risk: (r?.price ?? 0) >= 1500 ? "Moderate" : "Low",
    detail: r
      ? `${r.items.length} item${r.items.length === 1 ? "" : "s"} · ${r.stage}`
      : "Request",
    amount: r?.price,
    requestedForId: r?.requestedForId,
  }
}

const typeIcon: Record<Approval["recordType"], React.ReactNode> = {
  Change: <GitBranchIcon className="size-5" />,
  Request: <PackageIcon className="size-5" />,
  Knowledge: <BookOpenIcon className="size-5" />,
}

const typeTint: Record<Approval["recordType"], string> = {
  Change: toneClasses.info.soft,
  Request: toneClasses.progress.soft,
  Knowledge: toneClasses.muted.soft,
}

export function ApprovalsList() {
  const all = approvalsStore.use()
  const items = React.useMemo(() => pendingApprovals(all).map(enrich), [all])
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [type, setType] = React.useState<TypeFilter>("All")
  const [sort, setSort] = React.useState<SortKey>("due")
  const [pending, setPending] = React.useState<{
    ids: string[]
    decision: Decision
  } | null>(null)
  const [comment, setComment] = React.useState("")

  const visible = items
    .filter((a) => type === "All" || a.recordType === type)
    .sort((a, b) =>
      sort === "due"
        ? a.due.localeCompare(b.due)
        : sort === "requested"
          ? b.requested.localeCompare(a.requested)
          : riskRank[b.risk] - riskRank[a.risk]
    )

  const visibleIds = visible.map((a) => a.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = visibleIds.some((id) => selected.has(id))
  const selectedVisible = visibleIds.filter((id) => selected.has(id))

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      visibleIds.forEach((id) => (checked ? next.add(id) : next.delete(id)))
      return next
    })
  }

  function confirm() {
    if (!pending) return
    const { ids, decision } = pending
    const affected = items.filter((a) => ids.includes(a.id))
    decideApprovals(ids, decision)
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setPending(null)
    setComment("")
    const label =
      affected.length === 1
        ? affected[0].recordNumber
        : `${affected.length} records`
    if (decision === "Approved")
      toast.success(`${label} approved`, {
        description:
          "Recorded in this session. The record page shows the same decision.",
      })
    else
      toast(`${label} rejected`, {
        description: comment.trim()
          ? "Recorded in this session with your comment."
          : "Recorded in this session.",
      })
  }

  const counts = {
    All: items.length,
    Change: items.filter((a) => a.recordType === "Change").length,
    Request: items.filter((a) => a.recordType === "Request").length,
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheckIcon />}
        title="No pending approvals"
        description="You are all caught up. New approval requests will appear here as soon as they are routed to you."
        action={
          <Button variant="outline" size="sm" render={<Link href="/my-work" />}>
            Back to My Work
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          multiple={false}
          value={[type]}
          onValueChange={(v) => setType((v[0] as TypeFilter) ?? "All")}
          variant="outline"
          className="*:data-[slot=toggle-group-item]:rounded-full!"
        >
          {(["All", "Change", "Request"] as const).map((t) => (
            <ToggleGroupItem
              key={t}
              value={t}
              size="sm"
              className="gap-1.5 px-3"
            >
              {t === "Change" && <GitBranchIcon className="size-3.5" />}
              {t === "Request" && <PackageIcon className="size-3.5" />}
              {t === "All" ? "All" : `${t}s`}
              <CountPill count={counts[t]} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
            <Checkbox
              id="approvals-select-all"
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={(c) => toggleAll(c === true)}
              aria-label="Select all visible approvals"
            />
            <label
              htmlFor="approvals-select-all"
              className="cursor-pointer text-muted-foreground"
            >
              Select all
            </label>
          </div>
          <Select
            value={sort}
            onValueChange={(v) => setSort((v as SortKey) ?? "due")}
            items={{
              due: "Due soonest",
              requested: "Newest first",
              risk: "Highest risk",
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-40"
              aria-label="Sort approvals"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="due">Due soonest</SelectItem>
              <SelectItem value="requested">Newest first</SelectItem>
              <SelectItem value="risk">Highest risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedVisible.length > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-raised backdrop-blur supports-backdrop-filter:bg-card/80">
          <span className="text-sm font-medium tabular-nums">
            {selectedVisible.length} selected
          </span>
          <span className="text-xs text-muted-foreground">
            {
              selectedVisible.filter(
                (id) => items.find((a) => a.id === id)?.recordType === "Change"
              ).length
            }{" "}
            changes ·{" "}
            {
              selectedVisible.filter(
                (id) => items.find((a) => a.id === id)?.recordType === "Request"
              ).length
            }{" "}
            requests
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPending({ ids: selectedVisible, decision: "Rejected" })
              }
            >
              <XIcon /> Reject
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setPending({ ids: selectedVisible, decision: "Approved" })
              }
            >
              <CheckCheckIcon /> Approve {selectedVisible.length}
            </Button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<ShieldCheckIcon />}
          title={`No ${type.toLowerCase()} approvals pending`}
          description="Switch the filter to see other record types."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              selected={selected.has(a.id)}
              onSelect={(c) => toggle(a.id, c)}
              onDecide={(d) => setPending({ ids: [a.id], decision: d })}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.decision === "Approved" ? "Approve" : "Reject"}{" "}
              {pending && pending.ids.length > 1
                ? `${pending.ids.length} records`
                : items.find((a) => a.id === pending?.ids[0])?.recordNumber}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.decision === "Approved"
                ? "The approval is marked Approved for this session and the change or request record shows the same decision."
                : "The approval is marked Rejected for this session. Your comment stays with the decision in the history sheet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && pending.ids.length > 1 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg border bg-muted/40 p-2 text-xs">
              {pending.ids.map((id) => {
                const a = items.find((x) => x.id === id)
                if (!a) return null
                return (
                  <li key={id} className="flex items-center gap-2 px-1 py-1">
                    <span className="font-mono">{a.recordNumber}</span>
                    <span className="truncate text-muted-foreground">
                      {a.shortDescription}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <Label htmlFor="approval-comment" className="sr-only">
            {pending?.decision === "Approved"
              ? "Comment"
              : "Reason for rejection"}
          </Label>
          <Textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              pending?.decision === "Approved"
                ? "Optional comment for the record"
                : "Reason for rejection"
            }
            className="min-h-20"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                pending?.decision === "Rejected" ? "destructive" : "default"
              }
              onClick={confirm}
            >
              {pending?.decision === "Approved" ? <CheckIcon /> : <XIcon />}
              {pending?.decision === "Approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ApprovalCard({
  approval: a,
  selected,
  onSelect,
  onDecide,
}: {
  approval: EnrichedApproval
  selected: boolean
  onSelect: (checked: boolean) => void
  onDecide: (d: Decision) => void
}) {
  const hoursLeft = (new Date(a.due).getTime() - NOW.getTime()) / 3_600_000
  const overdue = hoursLeft < 0
  const urgent = !overdue && hoursLeft < 36
  return (
    <Card
      className={cn(
        "lift py-4",
        selected && "border-brand/50 ring-2 ring-brand/20"
      )}
    >
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onSelect(c === true)}
            aria-label={`Select ${a.recordNumber}`}
            className="mt-2.5"
          />
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              typeTint[a.recordType]
            )}
          >
            {typeIcon[a.recordType]}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{a.recordType}</Badge>
            <Link
              href={recordHref(a.recordNumber)}
              className="font-mono text-xs font-medium underline-offset-4 hover:underline"
            >
              {a.recordNumber}
            </Link>
            <span className="text-xs text-muted-foreground">
              requested {timeAgo(a.requested)}
            </span>
          </div>
          <div>
            <p className="truncate font-medium">{a.shortDescription}</p>
            <p className="text-xs text-muted-foreground">{a.detail}</p>
          </div>
          <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Requested by">
              <UserChip
                userId={a.requestedById}
                size="xs"
                className="[&_span]:text-xs"
              />
            </Meta>
            {a.requestedForId && a.requestedForId !== a.requestedById ? (
              <Meta label="Requested for">
                <UserChip
                  userId={a.requestedForId}
                  size="xs"
                  className="[&_span]:text-xs"
                />
              </Meta>
            ) : a.window ? (
              <Meta label="Planned window">
                <span className="tabular-nums">{a.window}</span>
              </Meta>
            ) : null}
            <Meta label="Risk">
              <span className="flex items-center gap-2">
                <RiskBadge risk={a.risk} className="h-5" />
                {a.amount !== undefined && (
                  <span className="font-medium tabular-nums">
                    {a.amount === 0 ? "No cost" : formatCurrency(a.amount)}
                  </span>
                )}
              </span>
            </Meta>
            <Meta label="Due">
              <span
                className={cn(
                  "inline-flex items-center gap-1 tabular-nums",
                  overdue
                    ? "font-medium text-danger-text"
                    : urgent
                      ? "font-medium text-warning-text"
                      : ""
                )}
              >
                <ClockIcon className="size-3.5" />
                {formatDate(a.due, { year: undefined })}
                <span className="font-normal text-muted-foreground">
                  ·{" "}
                  {overdue
                    ? "overdue"
                    : hoursLeft < 48
                      ? `${Math.round(hoursLeft)}h left`
                      : `${Math.round(hoursLeft / 24)}d left`}
                </span>
              </span>
            </Meta>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 md:flex-col md:items-stretch">
          <Button size="sm" onClick={() => onDecide("Approved")}>
            <CheckIcon /> Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDecide("Rejected")}
          >
            <XIcon /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

/**
 * Header action listing every approval decided in this session, read from the
 * shared approvals store (so decisions taken on a change or request record
 * appear here too).
 */
export function DecisionHistoryButton() {
  const all = approvalsStore.use()
  const decided = decidedApprovals(all).sort((a, b) =>
    b.requested.localeCompare(a.requested)
  )
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        <HistoryIcon /> Decision history
        {decided.length > 0 && <CountPill count={decided.length} />}
      </SheetTrigger>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Decision history</SheetTitle>
          <SheetDescription>
            Approvals decided in this session. Reloading the page restores the
            seeded inbox.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {decided.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<HistoryIcon />}
              title="No decisions yet"
              description="Approve or reject something and it will be listed here."
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {decided.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{a.recordType}</Badge>
                      <Link
                        href={recordHref(a.recordNumber)}
                        className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                      >
                        {a.recordNumber}
                      </Link>
                    </div>
                    <p className="truncate text-sm">{a.shortDescription}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested by{" "}
                      <UserChip
                        userId={a.requestedById}
                        size="xs"
                        className="[&_span]:text-xs"
                      />{" "}
                      · requested {timeAgo(a.requested)}
                    </p>
                  </div>
                  <StateBadge state={a.state} />
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
        <SheetFooterActions />
      </SheetContent>
    </Sheet>
  )
}
