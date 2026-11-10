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
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PriorityBadge } from "@/components/shared/status-badge"
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
import { getDeployedAgent, getTrace, reviewItems as seed } from "@/lib/data"
import { timeAgo } from "@/lib/format"
import type { ReviewItem, ReviewReason, ReviewRubric } from "@/lib/types"
import { AgentChip, fmtCost, fmtMs, ModelChip, ScoreBar } from "./shared"

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

export function ReviewQueue() {
  const [items, setItems] = React.useState<ReviewItem[]>(seed)
  const [filter, setFilter] = React.useState<"all" | ReviewReason>("all")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(0)

  const pending = React.useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.status === "Pending" && (filter === "all" || i.reason === filter)
        )
        .sort(
          (a, b) =>
            a.priority - b.priority || a.created.localeCompare(b.created)
        ),
    [items, filter]
  )
  const reviewed = items.filter((i) => i.status !== "Pending")
  const selected =
    pending.find((i) => i.id === selectedId) ?? pending[0] ?? null

  const decide = React.useCallback(
    (
      status: Exclude<ReviewItem["status"], "Pending">,
      rubric: ReviewRubric,
      note: string,
      correction?: string
    ) => {
      if (!selected) return
      const idx = pending.indexOf(selected)
      setItems((prev) =>
        prev.map((i) =>
          i.id === selected.id
            ? {
                ...i,
                status,
                rubric,
                note: note || undefined,
                correction,
                reviewerId: "u-001",
              }
            : i
        )
      )
      setDone((n) => n + 1)
      setSelectedId(pending[idx + 1]?.id ?? pending[idx - 1]?.id ?? null)
      toast[status === "Flagged" ? "warning" : "success"](
        `${status} · ${selected.traceId}`,
        {
          description:
            status === "Corrected"
              ? "Correction saved to the eval set"
              : status === "Flagged"
                ? "Routed to the agent owner"
                : "Added as a positive example",
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
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">
            Pending{" "}
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
              {pending.length}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {done} reviewed this session · {reviewed.length} total
          </p>
        </div>
        <div className="flex flex-wrap gap-1 border-b px-3 py-2">
          {(["all", ...reasons] as const).map((r) => {
            const n =
              r === "all"
                ? items.filter((i) => i.status === "Pending").length
                : items.filter((i) => i.status === "Pending" && i.reason === r)
                    .length
            return (
              <button
                key={r}
                type="button"
                onClick={() => setFilter(r)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors",
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
              description="Nothing is waiting for review with this filter."
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
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.reason}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(item.created)}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-sm leading-snug">
                        {trace?.userQuery}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
  const [correction, setCorrection] = React.useState(trace?.finalAnswer ?? "")
  const complete = Object.values(rubric).every((v) => v > 0)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "TEXTAREA" ||
          t.tagName === "INPUT" ||
          t.isContentEditable)
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === "a" && complete) onDecide("Approved", rubric, note)
      else if (k === "f" && complete) onDecide("Flagged", rubric, note)
      else if (k === "c") setCorrecting(true)
      else if (k === "s") onSkip()
      else if (/^[1-5]$/.test(k)) {
        const next = rubricKeys.find((r) => rubric[r.key] === 0)
        if (next) setRubric((prev) => ({ ...prev, [next.key]: Number(k) }))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [complete, rubric, note, onDecide, onSkip])

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
          {trace.channel} · {fmtMs(trace.durationMs)} · {fmtCost(trace.cost, 3)}
        </span>
        <Badge variant="outline" className="text-muted-foreground">
          {item.reason}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
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
              <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Retrieved context
                </span>{" "}
                · {retriever.output}
                {retriever.attributes && (
                  <span>
                    {" "}
                    · top_k {String(retriever.attributes.top_k)} · min score{" "}
                    {String(retriever.attributes.min_score)}
                  </span>
                )}
              </div>
            )}
            {correcting ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Corrected answer
                </p>
                <Textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  className="min-h-40 text-sm leading-relaxed"
                  aria-label="Corrected answer"
                />
                <p className="text-xs text-muted-foreground">
                  The correction is stored as the preferred answer in{" "}
                  {agent.evalDataset} and the original is kept for comparison.
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
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Flags
                </span>
                {trace.flags.map((f) => (
                  <Badge
                    key={f}
                    variant="outline"
                    className="border-warning/40 bg-warning/10 text-warning-text"
                  >
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <aside className="flex min-h-0 flex-col border-t bg-muted/20 lg:border-t-0 lg:border-l">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-4">
              <div>
                <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Evaluator scores
                </p>
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
                <div className="mt-1 grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                  <span>Grounded</span>
                  <span>Helpful</span>
                  <span>Safe</span>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Your rubric
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    Press <Kbd className="h-4 min-w-4 text-[10px]">1</Kbd>–
                    <Kbd className="h-4 min-w-4 text-[10px]">5</Kbd>
                  </span>
                </div>
                {rubricKeys.map((r) => (
                  <div key={r.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="text-[11px] text-muted-foreground">
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
                <label
                  htmlFor="review-note"
                  className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                >
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
              <Action
                label="Save correction"
                k="↵"
                variant="secondary"
                disabled={
                  !complete || correction.trim() === trace.finalAnswer.trim()
                }
                onClick={() => onDecide("Corrected", rubric, note, correction)}
                icon={<PenLineIcon />}
              />
            ) : (
              <Action
                label="Correct"
                k="C"
                variant="secondary"
                onClick={() => setCorrecting(true)}
                icon={<PenLineIcon />}
              />
            )}
            <Action
              label="Skip"
              k="S"
              variant="ghost"
              onClick={onSkip}
              icon={<SkipForwardIcon />}
            />
            {!complete && (
              <p className="col-span-2 text-center text-[11px] text-muted-foreground">
                Score all four criteria to approve or flag.
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
      <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
      </span>
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
  variant = "default",
  icon,
}: {
  label: string
  k: string
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "secondary" | "ghost"
  icon: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className="justify-between"
          />
        }
      >
        <span className="inline-flex items-center gap-1.5">
          {icon} {label}
        </span>
        <Kbd className="h-4 min-w-4 text-[10px]">{k}</Kbd>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="opacity-70">({k})</span>
      </TooltipContent>
    </Tooltip>
  )
}
