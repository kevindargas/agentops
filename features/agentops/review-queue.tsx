"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  CheckIcon,
  FlagIcon,
  PenLineIcon,
  SkipForwardIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { PriorityBadge, StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getDeployedAgent,
  getTrace,
  pendingReviewCount,
} from "@/lib/data/agentops"
import { currentUser } from "@/lib/data/users"
import { formatCost, formatMs, timeAgo } from "@/lib/format"
import type { ReviewItem, ReviewReason, ReviewRubric } from "@/lib/types"
import { AgentChip, ModelChip, ScoreBar } from "./shared"
import { reviewStore } from "./stores"

const reasons: ReviewReason[] = [
  "Low confidence",
  "User thumbs-down",
  "Evaluator flag",
  "Policy match",
  "Random sample",
]
const rubricKeys: { key: keyof ReviewRubric; label: string; hint: string }[] = [
  { key: "accuracy", label: "Accuracy", hint: "Facts and steps are correct" },
  {
    key: "grounding",
    label: "Grounding",
    hint: "Claims trace back to retrieved sources",
  },
  { key: "tone", label: "Tone", hint: "Clear, appropriate for the audience" },
  { key: "safety", label: "Safety", hint: "No PII leak, policy respected" },
]

const rubricMean = (r: ReviewRubric) =>
  (r.accuracy + r.grounding + r.tone + r.safety) / rubricKeys.length

/**
 * Stat row for the Review Queue page. Reads the same store as the queue so
 * approving, flagging or correcting an item moves the numbers immediately.
 */
export function ReviewStats() {
  const items = reviewStore.use()
  const pendingItems = items.filter((r) => r.status === "Pending")
  const done = items.filter((r) => r.status !== "Pending")
  const approved = done.filter((r) => r.status === "Approved").length
  const scored = done
    .map((r) => r.rubric)
    .filter((r): r is ReviewRubric => Boolean(r))
  const avg = scored.length
    ? scored.reduce((s, r) => s + rubricMean(r), 0) / scored.length
    : 0
  return (
    <StatGrid columns={4}>
      <StatCard
        label="Pending"
        value={pendingReviewCount(items)}
        hint={`${pendingItems.filter((r) => r.priority <= 2).length} high priority`}
      />
      <StatCard
        label="Reviewed"
        value={done.length}
        hint={`${approved} approved · ${done.filter((r) => r.status === "Corrected").length} corrected · ${done.filter((r) => r.status === "Flagged").length} flagged`}
      />
      <StatCard
        label="Approval rate"
        value={`${Math.round((approved / Math.max(1, done.length)) * 100)}%`}
        hint="Share of reviewed items approved"
      />
      <StatCard
        label="Avg rubric score"
        value={avg.toFixed(1)}
        unit="/5"
        hint={`Mean of ${rubricKeys.length} criteria on reviewed items`}
      />
    </StatGrid>
  )
}

export function ReviewQueue({
  initialSelectedId,
  agentId,
}: {
  /** `?item=<rev-id>`: open this item first instead of the top-priority one. */
  initialSelectedId?: string
  /** `?agent=<agt-id>`: show only this agent's queue. */
  agentId?: string
}) {
  const items = reviewStore.use()
  const [filter, setFilter] = React.useState<"all" | ReviewReason>("all")
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialSelectedId ?? null
  )
  const [done, setDone] = React.useState(0)

  const scoped = React.useMemo(
    () => (agentId ? items.filter((i) => i.agentId === agentId) : items),
    [items, agentId]
  )
  const pending = React.useMemo(
    () =>
      scoped
        .filter(
          (i) =>
            i.status === "Pending" && (filter === "all" || i.reason === filter)
        )
        .sort(
          (a, b) =>
            a.priority - b.priority || a.created.localeCompare(b.created)
        ),
    [scoped, filter]
  )
  const reviewed = scoped.filter((i) => i.status !== "Pending")
  const selected =
    pending.find((i) => i.id === selectedId) ?? pending[0] ?? null
  const agent = agentId ? getDeployedAgent(agentId) : undefined

  const decide = React.useCallback(
    (
      status: Exclude<ReviewItem["status"], "Pending">,
      rubric: ReviewRubric,
      note: string,
      correction?: string
    ) => {
      if (!selected) return
      const idx = pending.indexOf(selected)
      const previous = selected
      reviewStore.patch(selected.id, {
        status,
        rubric,
        note: note || undefined,
        correction,
        reviewerId: currentUser.id,
      })
      setDone((n) => n + 1)
      setSelectedId(pending[idx + 1]?.id ?? pending[idx - 1]?.id ?? null)
      toast[status === "Flagged" ? "warning" : "success"](
        `${status} · ${selected.traceId}`,
        {
          description:
            status === "Corrected"
              ? "Correction and rubric recorded on the item for this session"
              : status === "Flagged"
                ? "Marked for the agent owner; the note is kept on the item"
                : "Recorded as approved with your rubric",
          action: {
            label: "Undo",
            onClick: () => {
              reviewStore.set((prev) =>
                prev.map((i) => (i.id === previous.id ? previous : i))
              )
              setDone((n) => Math.max(0, n - 1))
              setSelectedId(previous.id)
            },
          },
          duration: 6000,
        }
      )
    },
    [pending, selected]
  )

  const skip = () => {
    if (!selected) return
    const idx = pending.indexOf(selected)
    setSelectedId(pending[(idx + 1) % pending.length]?.id ?? null)
  }

  return (
    <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[22rem_1fr]">
      <aside className="flex max-h-[40vh] min-h-0 flex-col overflow-hidden rounded-xl border bg-card xl:max-h-none">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            Pending
            <CountPill count={pending.length} size="default" label="pending" />
          </p>
          <p className="text-2xs text-muted-foreground tabular-nums">
            {done} reviewed this session · {reviewed.length} total
          </p>
        </div>
        {agent && (
          <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            Showing <AgentChip agentId={agent.id} size="sm" /> only
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto"
              render={<Link href="/agentops/reviews" />}
            >
              All agents
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-1 border-b px-3 py-2">
          {(["all", ...reasons] as const).map((r) => {
            const n = scoped.filter(
              (i) => i.status === "Pending" && (r === "all" || i.reason === r)
            ).length
            return (
              <button
                key={r}
                type="button"
                onClick={() => setFilter(r)}
                aria-pressed={filter === r}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-2xs transition-colors",
                  filter === r
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {r === "all" ? "All" : r}{" "}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {pending.length === 0 ? (
            <EmptyState
              size="sm"
              bare
              title="Queue is clear"
              description={
                filter === "all"
                  ? "Nothing is waiting for review."
                  : "Nothing is waiting for review with this filter."
              }
              action={
                filter !== "all" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilter("all")}
                  >
                    Clear filter
                  </Button>
                ) : undefined
              }
              className="py-12"
            />
          ) : (
            <ul className="divide-y">
              {pending.map((item) => {
                const trace = getTrace(item.traceId)
                const active = selected?.id === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-current={active}
                      className={cn(
                        "flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                        active &&
                          "bg-brand/5 shadow-[inset_3px_0_0_var(--brand)]"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <PriorityBadge priority={item.priority} size="sm" />
                        <span className="truncate text-2xs text-muted-foreground">
                          {item.reason}
                        </span>
                        <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
                          {timeAgo(item.created)}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-sm leading-snug">
                        {trace?.userQuery}
                      </span>
                      <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <span className="truncate">
                          {getDeployedAgent(item.agentId)?.name}
                        </span>
                        {item.assignedToId && (
                          <>
                            <span aria-hidden>·</span>
                            <UserChip userId={item.assignedToId} size="xs" />
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {selected ? (
        <ReviewWorkspace
          key={selected.id}
          item={selected}
          onDecide={decide}
          onSkip={skip}
          position={`${pending.indexOf(selected) + 1} of ${pending.length}`}
        />
      ) : (
        <EmptyState
          icon={<CheckIcon />}
          title="All caught up"
          description="Every sampled answer has a human verdict. New items arrive as agents flag low-confidence or negative-feedback responses."
        />
      )}
    </div>
  )
}

const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return Boolean(
    el &&
    (el.tagName === "TEXTAREA" ||
      el.tagName === "INPUT" ||
      el.isContentEditable)
  )
}

function ReviewWorkspace({
  item,
  onDecide,
  onSkip,
  position,
}: {
  item: ReviewItem
  onDecide: (
    status: Exclude<ReviewItem["status"], "Pending">,
    rubric: ReviewRubric,
    note: string,
    correction?: string
  ) => void
  onSkip: () => void
  position: string
}) {
  const trace = getTrace(item.traceId)
  const agent = getDeployedAgent(item.agentId)
  const [rubric, setRubric] = React.useState<ReviewRubric>({
    accuracy: 0,
    grounding: 0,
    tone: 0,
    safety: 0,
  })
  const [note, setNote] = React.useState("")
  const [correcting, setCorrecting] = React.useState(false)
  const original = trace?.finalAnswer ?? ""
  const [correction, setCorrection] = React.useState(original)
  const complete = Object.values(rubric).every((v) => v > 0)
  const canSaveCorrection = complete && correction.trim() !== original.trim()

  const saveCorrection = () => {
    if (!canSaveCorrection) return
    onDecide("Corrected", rubric, note, correction)
  }
  const cancelCorrection = () => {
    setCorrecting(false)
    setCorrection(original)
  }

  // Page-level shortcuts. Every consumed key calls preventDefault so the
  // global single-key handlers (C quick create, G chords) stand down.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "Escape" && correcting) {
        e.preventDefault()
        setCorrecting(false)
        setCorrection(original)
        return
      }
      if (isEditable(e.target)) return
      const k = e.key.toLowerCase()
      let handled = true
      if (k === "a") {
        if (complete) onDecide("Approved", rubric, note)
      } else if (k === "f") {
        if (complete) onDecide("Flagged", rubric, note)
      } else if (k === "c") setCorrecting(true)
      else if (k === "s") onSkip()
      else if (k === "enter" && correcting) {
        if (canSaveCorrection) onDecide("Corrected", rubric, note, correction)
      } else if (/^[1-5]$/.test(k)) {
        const next = rubricKeys.find((r) => rubric[r.key] === 0)
        if (next) setRubric((prev) => ({ ...prev, [next.key]: Number(k) }))
      } else handled = false
      if (handled) e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    complete,
    rubric,
    note,
    onDecide,
    onSkip,
    correcting,
    correction,
    canSaveCorrection,
    original,
  ])

  if (!trace || !agent) return null
  const retriever = trace.spans.find((s) => s.type === "retriever")

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
      aria-label="Review workspace"
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <AgentChip agentId={agent.id} />
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        <ModelChip
          modelId={trace.modelId}
          className="text-xs text-muted-foreground"
        />
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        <span className="text-xs text-muted-foreground">
          {trace.channel} · {formatMs(trace.durationMs)} ·{" "}
          {formatCost(trace.cost, 3)}
        </span>
        <Badge variant="outline" className="text-muted-foreground">
          {item.reason}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-2xs text-muted-foreground tabular-nums">
            {position}
          </span>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/agentops/traces/${trace.id}`} />}
          >
            Open trace <ArrowUpRightIcon />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_20rem]">
        <ScrollArea className="min-h-0">
          <div className="flex flex-col gap-5 p-4">
            <Turn speaker="user" title="User" body={trace.userQuery} />
            {retriever && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Retrieved context
                </span>{" "}
                · {retriever.output}
                {retriever.attributes && (
                  <span>
                    {" "}
                    · top k {String(retriever.attributes.top_k)} · score
                    threshold {String(retriever.attributes.min_score)}
                  </span>
                )}
              </div>
            )}
            {correcting ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor={`correction-${item.id}`} className="eyebrow">
                    Corrected answer
                  </label>
                  <span className="text-2xs text-muted-foreground">
                    <Kbd className="h-4 min-w-4 text-3xs">Cmd</Kbd>+
                    <Kbd className="h-4 min-w-4 text-3xs">Enter</Kbd> saves ·{" "}
                    <Kbd className="h-4 min-w-4 text-3xs">Esc</Kbd> cancels
                  </span>
                </div>
                <Textarea
                  id={`correction-${item.id}`}
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      saveCorrection()
                    }
                  }}
                  className="min-h-40 text-sm leading-relaxed"
                  aria-label="Corrected answer"
                />
                <p className="text-xs text-muted-foreground">
                  The correction is kept on the review item next to the original
                  answer; in a wired deployment it becomes the preferred answer
                  in {agent.evalDataset}.
                </p>
              </div>
            ) : (
              <Turn
                speaker="assistant"
                title={agent.name}
                body={trace.finalAnswer}
                feedback={trace.userFeedback}
              />
            )}
            {trace.flags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Eyebrow as="span">Flags</Eyebrow>
                {trace.flags.map((f) => (
                  <StateBadge key={f} state={f} tone="warning" size="sm" />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <aside className="flex min-h-0 flex-col border-t bg-muted/20 lg:border-t-0 lg:border-l">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-4">
              <div>
                <Eyebrow className="mb-2">Evaluator scores</Eyebrow>
                <div className="grid grid-cols-3 gap-3">
                  <ScoreBar
                    value={trace.evals.grounded}
                    max={1}
                    thresholds={{ good: 85, ok: 70 }}
                    label="Grounded"
                  />
                  <ScoreBar
                    value={trace.evals.helpful}
                    max={1}
                    thresholds={{ good: 85, ok: 70 }}
                    label="Helpful"
                  />
                  <ScoreBar
                    value={trace.evals.safe}
                    max={1}
                    thresholds={{ good: 99, ok: 90 }}
                    label="Safe"
                  />
                </div>
                <div className="mt-1 grid grid-cols-3 gap-3 text-2xs text-muted-foreground">
                  <span>Grounded</span>
                  <span>Helpful</span>
                  <span>Safe</span>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Eyebrow>Your rubric</Eyebrow>
                  <span className="text-2xs text-muted-foreground">
                    <Kbd className="h-4 min-w-4 text-3xs">1</Kbd> to{" "}
                    <Kbd className="h-4 min-w-4 text-3xs">5</Kbd> scores the
                    next unscored row
                  </span>
                </div>
                {rubricKeys.map((r) => (
                  <div key={r.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="text-2xs text-muted-foreground">
                        {r.hint}
                      </span>
                    </div>
                    <ToggleGroup
                      value={rubric[r.key] ? [String(rubric[r.key])] : []}
                      onValueChange={(v) =>
                        setRubric((prev) => ({
                          ...prev,
                          [r.key]: Number(v[0] ?? 0),
                        }))
                      }
                      className="w-full"
                      aria-label={`${r.label} score`}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <ToggleGroupItem
                          key={n}
                          value={String(n)}
                          size="sm"
                          className="flex-1 text-xs tabular-nums data-pressed:bg-brand data-pressed:text-brand-foreground"
                        >
                          {n}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="review-note" className="eyebrow">
                  Note for the agent owner
                </label>
                <Textarea
                  id="review-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What should change? Cite the retrieved source if the answer ignored it."
                  className="min-h-20 text-sm"
                />
              </div>
            </div>
          </ScrollArea>
          <div className="grid grid-cols-2 gap-2 border-t p-3">
            <Action
              label="Approve"
              k="A"
              disabled={!complete}
              onClick={() => onDecide("Approved", rubric, note)}
              icon={<CheckIcon />}
            />
            <Action
              label="Flag"
              k="F"
              variant="outline"
              disabled={!complete}
              onClick={() => onDecide("Flagged", rubric, note)}
              icon={<FlagIcon />}
            />
            {correcting ? (
              <>
                <Action
                  label="Save correction"
                  k="Enter"
                  variant="secondary"
                  disabled={!canSaveCorrection}
                  disabledHint={
                    !complete
                      ? `Score all ${rubricKeys.length} criteria first`
                      : "Edit the answer before saving"
                  }
                  onClick={saveCorrection}
                  icon={<PenLineIcon />}
                />
                <Action
                  label="Cancel"
                  k="Esc"
                  variant="ghost"
                  onClick={cancelCorrection}
                  icon={<XIcon />}
                />
              </>
            ) : (
              <>
                <Action
                  label="Correct"
                  k="C"
                  variant="secondary"
                  onClick={() => setCorrecting(true)}
                  icon={<PenLineIcon />}
                />
                <Action
                  label="Skip"
                  k="S"
                  variant="ghost"
                  onClick={onSkip}
                  icon={<SkipForwardIcon />}
                />
              </>
            )}
            {!complete && (
              <p className="col-span-2 text-center text-2xs text-muted-foreground">
                Score all {rubricKeys.length} criteria to approve, flag or save
                a correction.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function Turn({
  speaker,
  title,
  body,
  feedback,
}: {
  speaker: "user" | "assistant"
  title: string
  body: string
  feedback?: "up" | "down"
}) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", speaker === "user" && "items-end")}
    >
      <Eyebrow as="span" className="flex items-center gap-1.5">
        {title}
        {feedback === "down" && (
          <ThumbsDownIcon
            className="size-3 text-destructive"
            aria-label="User thumbs-down"
          />
        )}
        {feedback === "up" && (
          <ThumbsUpIcon
            className="size-3 text-success"
            aria-label="User thumbs-up"
          />
        )}
      </Eyebrow>
      <div
        className={cn(
          "max-w-[52rem] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          speaker === "user"
            ? "rounded-tr-md bg-muted"
            : "rounded-tl-md border bg-background"
        )}
      >
        {body}
      </div>
    </div>
  )
}

function Action({
  label,
  k,
  onClick,
  disabled,
  disabledHint,
  variant = "default",
  icon,
}: {
  label: string
  k: string
  onClick: () => void
  disabled?: boolean
  /** Shown in the tooltip while the button is disabled. */
  disabledHint?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  icon: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex min-w-0" />}>
        <Button
          variant={variant}
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="inline-flex items-center gap-1.5">
            {icon} {label}
          </span>
          <Kbd className="h-4 min-w-4 text-3xs">{k}</Kbd>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {disabled && disabledHint ? (
          disabledHint
        ) : (
          <>
            {label} <span className="opacity-70">({k})</span>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
