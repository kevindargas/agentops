import type { Metadata } from "next"
import Link from "next/link"
import {
  ClipboardCheckIcon,
  ClockIcon,
  CoinsIcon,
  FlaskConicalIcon,
  MessageSquareIcon,
  RouteIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react"

import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentGraph } from "@/features/agentops/agent-graph"
import { fmtCost, fmtMs, fmtTokens } from "@/features/agentops/format"
import { AgentChip, ModelChip, ScoreBar } from "@/features/agentops/shared"
import { TraceWaterfall } from "@/features/agentops/trace-waterfall"
import {
  getDeployedAgent,
  getExperiment,
  getTrace,
  reviewItems,
} from "@/lib/data"
import { formatDateTime, timeAgo } from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function TracePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const trace = getTrace(id)
  if (!trace)
    return (
      <RecordNotFound
        number={id}
        backHref="/agentops/traces"
        backLabel="traces"
      />
    )
  const agent = getDeployedAgent(trace.agentId)
  const review = reviewItems.find((r) => r.traceId === trace.id)
  const experiment = trace.experimentId
    ? getExperiment(trace.experimentId)
    : undefined
  const llm = trace.spans.filter((s) => s.type === "llm")
  const visited = trace.spans
    .map((s) => agent?.graph.find((n) => n.label === s.name)?.id)
    .filter((x): x is string => Boolean(x))

  return (
    <>
      <RecordHeader
        number={trace.id}
        title={trace.userQuery}
        backHref="/agentops/traces"
        backLabel="traces"
        editable={false}
        badges={
          <>
            <StateBadge state={trace.status} />
            {trace.userFeedback === "down" && (
              <Badge
                variant="outline"
                className="gap-1 border-destructive/30 text-danger-text"
              >
                <ThumbsDownIcon className="size-3" /> Thumbs-down
              </Badge>
            )}
            {trace.userFeedback === "up" && (
              <Badge
                variant="outline"
                className="gap-1 border-success/30 text-success-text"
              >
                <ThumbsUpIcon className="size-3" /> Thumbs-up
              </Badge>
            )}
            {trace.flags.map((f) => (
              <Badge
                key={f}
                variant="outline"
                className="border-warning/40 bg-warning/10 text-warning-text"
              >
                {f}
              </Badge>
            ))}
          </>
        }
        meta={
          <>
            <MetaItem label="Agent" icon={<RouteIcon />}>
              {agent && <AgentChip agentId={agent.id} size="sm" />}
            </MetaItem>
            <MetaItem label="Started" icon={<ClockIcon />}>
              {timeAgo(trace.startedAt)}
            </MetaItem>
            <MetaItem
              label="Duration"
              icon={<ClockIcon />}
              tone={
                agent && trace.durationMs > agent.metrics.p95Ms
                  ? "warning"
                  : "default"
              }
            >
              {fmtMs(trace.durationMs)}
            </MetaItem>
            <MetaItem label="Cost" icon={<CoinsIcon />}>
              {fmtCost(trace.cost, 3)} ·{" "}
              {fmtTokens(trace.tokensIn + trace.tokensOut)} tokens
            </MetaItem>
            <MetaItem label="Channel" icon={<MessageSquareIcon />}>
              {trace.channel}
            </MetaItem>
          </>
        }
        actions={
          <>
            {review ? (
              <Button
                variant="outline"
                render={<Link href="/agentops/reviews" />}
              >
                <ClipboardCheckIcon /> In review queue · {review.status}
              </Button>
            ) : (
              <Button variant="outline">
                <ClipboardCheckIcon /> Send to review
              </Button>
            )}
            {experiment && (
              <Button
                render={
                  <Link href={`/agentops/experiments?open=${experiment.id}`} />
                }
              >
                <FlaskConicalIcon /> Variant {trace.variant}
              </Button>
            )}
          </>
        }
        overflow={[
          {
            label: "Replay with current prompt",
            message: "Replay queued — results land in the Traces tab",
          },
          {
            label: "Add to eval set",
            message: `Added to ${agent?.evalDataset ?? "the eval set"}`,
          },
          { label: "Copy trace JSON", message: "Trace JSON copied" },
        ]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection title="Evaluator scores" size="sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <ScoreBar
                    value={trace.evals.grounded}
                    max={1}
                    thresholds={{ good: 85, ok: 70 }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Grounded
                  </p>
                </div>
                <div>
                  <ScoreBar
                    value={trace.evals.helpful}
                    max={1}
                    thresholds={{ good: 85, ok: 70 }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Helpful
                  </p>
                </div>
                <div>
                  <ScoreBar
                    value={trace.evals.safe}
                    max={1}
                    thresholds={{ good: 99, ok: 90 }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Safe</p>
                </div>
              </div>
            </RecordSection>
            <RecordSection title="Run" size="sm">
              <DetailList
                variant="rows"
                dense
                items={[
                  {
                    label: "Model",
                    value: (
                      <ModelChip modelId={trace.modelId} className="text-xs" />
                    ),
                  },
                  { label: "Version", value: trace.version, mono: true },
                  {
                    label: "Session",
                    value: trace.sessionId,
                    mono: true,
                    copyable: true,
                  },
                  { label: "Started", value: formatDateTime(trace.startedAt) },
                  {
                    label: "LLM calls",
                    value: `${llm.length} · ${fmtTokens(trace.tokensIn)} in / ${fmtTokens(trace.tokensOut)} out`,
                  },
                  {
                    label: "Experiment",
                    value: experiment ? (
                      <Link
                        href={`/agentops/experiments?open=${experiment.id}`}
                        className="hover:underline"
                      >
                        {experiment.name}
                      </Link>
                    ) : (
                      "—"
                    ),
                    wide: true,
                  },
                ]}
              />
            </RecordSection>
            {agent && (
              <RecordSection title="Path through graph" size="sm">
                <AgentGraph
                  nodes={agent.graph}
                  activeIds={visited}
                  className="gap-x-0"
                />
              </RecordSection>
            )}
          </>
        }
      >
        <RecordSection title="Conversation" icon={<MessageSquareIcon />}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                User
              </span>
              <p className="max-w-[48rem] rounded-2xl rounded-tr-md bg-muted px-4 py-3 text-sm leading-relaxed">
                {trace.userQuery}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {agent?.name ?? "Agent"}
              </span>
              <p
                className={`max-w-[48rem] rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${trace.status === "Failed" ? "border-destructive/30 bg-destructive/5" : "bg-background"}`}
              >
                {trace.finalAnswer}
              </p>
            </div>
          </div>
        </RecordSection>

        <RecordSection
          title="Spans"
          description={`${trace.spans.length} spans · ${fmtMs(trace.durationMs)} total`}
          icon={<RouteIcon />}
        >
          <TraceWaterfall spans={trace.spans} totalMs={trace.durationMs} />
        </RecordSection>
      </RecordLayout>
    </>
  )
}
