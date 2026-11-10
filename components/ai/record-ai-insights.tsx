"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { MessageResponse } from "@/components/ai-elements/message"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StateBadge } from "@/components/shared/status-badge"
import { autonomyMeta } from "@/lib/ai/agents"
import {
  planResponse,
  recordInsights,
  starterPrompts,
  type AssistantContext,
} from "@/lib/ai/assistant"
import { timeAgo } from "@/lib/format"
import { AgentAvatar } from "./agent-card"
import { useAi } from "./ai-provider"
import { ConfidenceMeter } from "./proposal-card"

export interface InsightChip {
  label: string
  value: string
  tone?: "default" | "good" | "warn"
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

/**
 * Contextual AI card for record pages: streams a summary locally, lists similar
 * records and the suggested next step, and hands deeper questions to the docked
 * assistant with the record as context.
 */
export function RecordAiInsights({
  context,
  chips,
  prompts,
  className,
}: {
  context: AssistantContext
  chips: InsightChip[]
  prompts: string[]
  className?: string
}) {
  const { ask, agents } = useAi()
  const [summary, setSummary] = React.useState<string | null>(null)
  const [streaming, setStreaming] = React.useState(false)
  const triage = agents.find((a) => a.id === "triage")
  const insights = recordInsights(context)

  async function generate() {
    const run = planResponse("summarize", context)
    const text = run.steps.find((s) => s.kind === "text")
    if (!text || text.kind !== "text") return
    setStreaming(true)
    setSummary("")
    const chunks = text.markdown.match(/\S+\s*/g) ?? [text.markdown]
    let acc = ""
    for (const c of chunks) {
      acc += c
      await new Promise((r) => setTimeout(r, 12))
      setSummary(acc)
    }
    setStreaming(false)
  }

  return (
    <Card
      className={cn(
        "@container/insights gap-4 border-brand/20 bg-linear-to-br from-brand/6 via-transparent to-transparent",
        className
      )}
    >
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2">
          <AgentAvatar agentId="triage" size="sm" muted={!triage?.enabled} />
          AI insights
          <Badge
            variant="outline"
            className="h-4 px-1 text-[9px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Scripted
          </Badge>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-1.5">
          {triage?.enabled ? (
            <>
              <span>{triage.name}</span>
              <span aria-hidden>·</span>
              <span>{autonomyMeta[triage.autonomy].label}</span>
              <span aria-hidden>·</span>
              <span>reviewed {timeAgo(triage.lastRun)}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning-text">
              <TriangleAlertIcon className="size-3" /> Triage agent is paused —
              insights may be stale
            </span>
          )}
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant={summary ? "ghost" : "outline"}
            onClick={generate}
            disabled={streaming}
          >
            {summary ? (
              <RefreshCwIcon />
            ) : (
              <SparklesIcon className="text-brand" />
            )}{" "}
            {summary ? "Regenerate" : "Summarize"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Badge
              key={c.label}
              variant="outline"
              className={cn(
                "gap-1 bg-background/60",
                c.tone === "good" &&
                  "border-success/30 bg-success/10 text-success-text",
                c.tone === "warn" &&
                  "border-warning/40 bg-warning/10 text-warning-text"
              )}
            >
              {c.tone === "good" && <CheckCircle2Icon />}
              {c.tone === "warn" && <TriangleAlertIcon />}
              <span className="font-normal opacity-80">{c.label}</span>{" "}
              {c.value}
            </Badge>
          ))}
        </div>

        <div className="rounded-lg border bg-background/70 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <SectionLabel>Summary</SectionLabel>
            {summary && !streaming && (
              <Button
                size="xs"
                variant="ghost"
                className="-my-1 h-6 text-muted-foreground"
                onClick={() => ask(starterPrompts(context)[0])}
              >
                Continue in Assist <ArrowRightIcon />
              </Button>
            )}
          </div>
          {summary === null ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Generate a plain-language summary of what is known, who is
              affected and the suggested next step. Nothing is written to the
              record until you choose to.
            </p>
          ) : summary === "" ? (
            <Shimmer className="text-sm">
              Reading work notes and related records…
            </Shimmer>
          ) : (
            <MessageResponse className="text-sm leading-relaxed">
              {summary}
            </MessageResponse>
          )}
        </div>

        <div className="grid gap-3 @md/insights:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border bg-background/70 p-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Similar records</SectionLabel>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {insights.similar.length}
              </span>
            </div>
            {insights.similar.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No closely matching records in the last 90 days.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {insights.similar.map(({ source, state, meta }) => (
                  <li
                    key={source.id}
                    className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={source.href}
                      className="group/sim min-w-0 flex-1 leading-tight"
                    >
                      <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-foreground/80 group-hover/sim:text-foreground">
                        {source.id}
                        <ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover/sim:opacity-60" />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {source.title} · {meta}
                      </span>
                    </Link>
                    <StateBadge
                      state={state}
                      className="h-[18px] shrink-0 px-1.5 text-[10px]"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border bg-background/70 p-3">
            <SectionLabel>Suggested next action</SectionLabel>
            <div className="flex-1">
              <p className="text-sm leading-snug font-medium">
                {insights.nextAction.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {insights.nextAction.description}
              </p>
            </div>
            <ConfidenceMeter value={insights.confidence} />
            {insights.signals.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {insights.signals.map((s) => (
                  <span
                    key={s}
                    className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <MessageSquareTextIcon className="size-3.5 text-muted-foreground" />
          {prompts.map((p) => (
            <Button
              key={p}
              size="xs"
              variant="outline"
              className="rounded-full border-dashed bg-background/60 hover:border-brand/40 hover:bg-brand/5"
              onClick={() => ask(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
