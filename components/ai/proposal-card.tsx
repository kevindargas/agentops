"use client"

import Link from "next/link"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  CheckIcon,
  ClockIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StateBadge } from "@/components/shared/status-badge"
import { getAgent, type AgentProposal } from "@/lib/ai/agents"
import { timeAgo } from "@/lib/format"
import { AgentAvatar } from "./agent-card"

const impactMeta: Record<
  AgentProposal["impact"],
  { label: string; tone: "muted" | "warning" | "danger" }
> = {
  low: { label: "Low impact", tone: "muted" },
  medium: { label: "Medium impact", tone: "warning" },
  high: { label: "High impact", tone: "danger" },
}

/** Thin confidence bar with a label: green at or above 85%, brand at or above 70%, amber below. */
export function ConfidenceMeter({
  value,
  className,
  compact = false,
}: {
  value: number
  className?: string
  compact?: boolean
}) {
  const pct = Math.round(value * 100)
  const tone = pct >= 85 ? "bg-success" : pct >= 70 ? "bg-brand" : "bg-warning"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!compact && (
        <span className="text-2xs text-muted-foreground">Confidence</span>
      )}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Confidence"
        className={cn(
          "h-1 flex-1 overflow-hidden rounded-full bg-muted",
          compact && "w-12 flex-none"
        )}
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-2xs font-medium tabular-nums">{pct}%</span>
    </div>
  )
}

/** Diff-style rows for a proposed field change. */
export function ProposedChanges({
  diff,
  className,
}: {
  diff: NonNullable<AgentProposal["diff"]>
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border font-mono text-2xs",
        className
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 font-sans text-3xs font-medium tracking-wide text-muted-foreground uppercase">
        Proposed change
        <span className="tabular-nums">
          {diff.length} field{diff.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="divide-y">
        {diff.map((d) => (
          <li
            key={d.field}
            className="grid grid-cols-[minmax(0,5.5rem)_1fr] gap-x-2 px-2.5 py-1.5"
          >
            <span className="truncate pt-px font-sans text-2xs font-medium text-muted-foreground">
              {d.field}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 rounded-sm bg-destructive/8 px-1.5 py-0.5 text-danger-text">
                <MinusIcon className="size-3 shrink-0" />
                <span className="truncate line-through decoration-destructive/40">
                  {d.from}
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-sm bg-success/10 px-1.5 py-0.5 text-success-text">
                <PlusIcon className="size-3 shrink-0" />
                <span className="truncate">{d.to}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProposalCard({
  proposal,
  onDecide,
  compact = false,
}: {
  proposal: AgentProposal
  onDecide: (id: string, d: "approve" | "reject") => void
  compact?: boolean
}) {
  const agent = getAgent(proposal.agentId)
  const impact = impactMeta[proposal.impact]
  const btn = compact ? "xs" : "sm"

  return (
    <article
      className={cn(
        "group/proposal flex flex-col rounded-xl border bg-card transition-shadow hover:shadow-xs",
        compact ? "gap-2.5 p-3" : "gap-3 p-4"
      )}
    >
      <header className="flex items-center gap-2">
        <AgentAvatar agentId={proposal.agentId} size={compact ? "xs" : "sm"} />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-xs leading-none">
          <span className="truncate font-medium">
            {agent?.name ?? "AgentOps Assist"}
          </span>
          <span className="text-muted-foreground">proposed</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums" />
              }
            >
              <ClockIcon className="size-3" /> {timeAgo(proposal.created)}
            </TooltipTrigger>
            <TooltipContent>
              Waiting since {timeAgo(proposal.created)}
            </TooltipContent>
          </Tooltip>
        </div>
        <StateBadge
          state={impact.label}
          tone={impact.tone}
          dot={false}
          className="h-[18px] px-1.5 text-3xs"
        />
      </header>

      <div className="flex flex-col gap-1">
        <h3
          className={cn(
            "leading-snug font-medium",
            compact ? "text-sm" : "text-[15px]"
          )}
        >
          {proposal.action}
        </h3>
        <p
          className={cn(
            "leading-relaxed text-muted-foreground",
            compact ? "line-clamp-2 text-xs" : "text-sm"
          )}
        >
          {proposal.rationale}
        </p>
      </div>

      {proposal.diff && <ProposedChanges diff={proposal.diff} />}

      <ConfidenceMeter value={proposal.confidence} />

      <footer className="flex items-center gap-2 pt-0.5">
        <Link
          href={proposal.recordHref}
          className="inline-flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span className="truncate">{proposal.recordNumber}</span>
          <ArrowUpRightIcon className="size-3 shrink-0 opacity-60" />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size={btn}
            variant="ghost"
            className="text-muted-foreground hover:text-danger-text"
            onClick={() => onDecide(proposal.id, "reject")}
          >
            <XIcon /> Reject
          </Button>
          {!compact && (
            <Button
              size={btn}
              variant="outline"
              render={<Link href={proposal.recordHref} />}
            >
              Review
            </Button>
          )}
          <Button size={btn} onClick={() => onDecide(proposal.id, "approve")}>
            <CheckIcon /> Approve
          </Button>
        </div>
      </footer>
    </article>
  )
}
