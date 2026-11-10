import type { Metadata } from "next"
import Link from "next/link"
import {
  ClockIcon,
  CoinsIcon,
  GitCommitHorizontalIcon,
  MessageSquareIcon,
  RadioIcon,
  RouteIcon,
  ShieldAlertIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react"

import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import { StateBadge } from "@/components/shared/status-badge"
import { AgentGraph } from "@/features/agentops/agent-graph"
import {
  AgentChip,
  BoundHitFlag,
  ModelChip,
  OutcomeBadge,
  ScoreBar,
} from "@/features/agentops/shared"
import { TraceActions } from "@/features/agentops/trace-actions"
import { TraceWaterfall } from "@/features/agentops/trace-waterfall"
import { getDeployedAgent, getExperiment, getTrace } from "@/lib/data/agentops"
import { getGuardrail, guardrailViolations } from "@/lib/data/guardrails"
import { getPromptForAgent } from "@/lib/data/prompts"
import {
  formatCost,
  formatDateTime,
  formatMs,
  formatTokens,
  timeAgo,
} from "@/lib/format"

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
  const experiment = trace.experimentId
    ? getExperiment(trace.experimentId)
    : undefined
  const llm = trace.spans.filter((s) => s.type === "llm")
  const prompt = getPromptForAgent(trace.agentId)
  const promptHref = prompt
    ? `/agentops/prompts/${prompt.id}`
    : "/agentops/prompts"
  const toolVersions = Object.entries(trace.lineage.toolSchemaVersions ?? {})
  const visited = trace.spans
    .map((s) => agent?.graph.find((n) => n.label === s.name)?.id)
    .filter((x): x is string => Boolean(x))
  const violations = guardrailViolations.filter((v) => v.traceId === trace.id)
  const none = <span className="text-muted-foreground">None</span>

  return (
    <>
      <RecordHeader
        number={trace.id}
        title={trace.userQuery}
        backHref={`/agentops/traces?agent=${trace.agentId}`}
        backLabel="traces"
        badges={
          <>
            <StateBadge state={trace.status} />
            <OutcomeBadge outcome={trace.outcome} />
            {trace.boundHit && <BoundHitFlag bound={trace.boundHit} />}
            {trace.userFeedback === "down" && (
              <StateBadge
                state="Thumbs-down"
                tone="danger"
                icon={<ThumbsDownIcon className="size-3" />}
              />
            )}
            {trace.userFeedback === "up" && (
              <StateBadge
                state="Thumbs-up"
                tone="success"
                icon={<ThumbsUpIcon className="size-3" />}
              />
            )}
            {trace.flags.map((f) => (
              <StateBadge key={f} state={f} tone="warning" />
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
              {formatMs(trace.durationMs)}
            </MetaItem>
            <MetaItem label="Cost" icon={<CoinsIcon />}>
              {formatCost(trace.cost, 3)} ·{" "}
              {formatTokens(trace.tokensIn + trace.tokensOut)} tokens
            </MetaItem>
            <MetaItem label="Channel" icon={<MessageSquareIcon />}>
              {trace.channel}
            </MetaItem>
          </>
        }
        actions={
          <TraceActions
            trace={trace}
            experimentId={experiment?.id}
            evalDataset={agent?.evalDataset}
            promptId={prompt?.id}
          />
        }
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
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Grounded
                  </p>
                </div>
                <div>
                  <ScoreBar
                    value={trace.evals.helpful}
                    max={1}
                    thresholds={{ good: 85, ok: 70 }}
                  />
                  <p className="mt-1 text-2xs text-muted-foreground">Helpful</p>
                </div>
                <div>
                  <ScoreBar
                    value={trace.evals.safe}
                    max={1}
                    thresholds={{ good: 99, ok: 90 }}
                  />
                  <p className="mt-1 text-2xs text-muted-foreground">Safe</p>
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
                  {
                    label: "Version",
                    value: (
                      <Link
                        href={`/agentops/deployments?agent=${trace.agentId}`}
                        className="font-mono hover:underline"
                      >
                        {trace.version}
                      </Link>
                    ),
                    hint: "Opens the agent's releases",
                  },
                  {
                    label: "Session",
                    value: trace.sessionId,
                    mono: true,
                    copyable: true,
                  },
                  { label: "Started", value: formatDateTime(trace.startedAt) },
                  {
                    label: "LLM calls",
                    value: `${llm.length} · ${formatTokens(trace.tokensIn)} in / ${formatTokens(trace.tokensOut)} out`,
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
                      none
                    ),
                    wide: true,
                  },
                ]}
              />
            </RecordSection>
            <RecordSection
              title="Lineage"
              description="Exact versions needed to reproduce this run"
              size="sm"
              icon={<GitCommitHorizontalIcon />}
            >
              <DetailList
                variant="rows"
                dense
                items={[
                  {
                    label: "Code",
                    value: trace.lineage.codeSha.slice(0, 7),
                    mono: true,
                    copyable: true,
                    copyValue: trace.lineage.codeSha,
                    hint: "Git SHA of the agent build",
                  },
                  {
                    label: "Prompt",
                    value: (
                      <Link
                        href={promptHref}
                        className="font-mono hover:underline"
                      >
                        {trace.lineage.promptVersion}
                      </Link>
                    ),
                  },
                  {
                    label: "Params",
                    value: trace.lineage.paramsHash,
                    mono: true,
                    copyable: true,
                    hint: "Hash of the ModelParams used for this run",
                  },
                  {
                    label: "Index build",
                    value: trace.lineage.indexBuildId ?? none,
                    mono: Boolean(trace.lineage.indexBuildId),
                  },
                  {
                    label: "Policy",
                    value: (
                      <Link
                        href="/agentops/guardrails?tab=policies"
                        className="font-mono hover:underline"
                      >
                        {trace.lineage.policyVersion}
                      </Link>
                    ),
                  },
                  ...(toolVersions.length
                    ? [
                        {
                          label: "Tool schemas",
                          value: (
                            <span className="flex flex-wrap gap-1">
                              {toolVersions.map(([tool, v]) => (
                                <Link
                                  key={tool}
                                  href={`/agentops/tools?tool=${tool}`}
                                  className="rounded-sm bg-muted px-1 py-0.5 font-mono text-2xs hover:underline"
                                >
                                  {tool}@{v}
                                </Link>
                              ))}
                            </span>
                          ),
                          wide: true,
                        },
                      ]
                    : []),
                ]}
              />
            </RecordSection>
            {violations.length > 0 && (
              <RecordSection
                title="Guardrail violations"
                count={violations.length}
                size="sm"
                icon={<ShieldAlertIcon />}
              >
                <ul className="flex flex-col gap-2">
                  {violations.map((v) => (
                    <li key={v.id} className="flex flex-col gap-1 text-sm">
                      <span className="flex items-center justify-between gap-2">
                        <Link
                          href={`/agentops/guardrails?policy=${v.policyId}&tab=violations`}
                          className="truncate font-medium hover:underline"
                        >
                          {getGuardrail(v.policyId)?.name ?? v.policyId}
                        </Link>
                        <span className="flex shrink-0 items-center gap-1">
                          <StateBadge state={v.action} size="sm" />
                          <StateBadge state={v.verdict} size="sm" />
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {v.severity} · {v.snippet}
                      </span>
                    </li>
                  ))}
                </ul>
              </RecordSection>
            )}
            {trace.streaming && (
              <RecordSection title="Streaming" size="sm" icon={<RadioIcon />}>
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Time to first token"
                    value={formatMs(trace.streaming.ttftMs)}
                    tone={trace.streaming.ttftMs > 1500 ? "warning" : undefined}
                  />
                  <MetricTile
                    label="Throughput"
                    value={trace.streaming.tokensPerSec}
                    unit="tok/s"
                  />
                  <MetricTile
                    label="Client"
                    value={
                      trace.streaming.disconnected
                        ? "Disconnected"
                        : "Connected"
                    }
                    tone={trace.streaming.disconnected ? "danger" : undefined}
                  />
                  <MetricTile
                    label="Stream"
                    value={trace.streaming.truncated ? "Truncated" : "Complete"}
                    tone={trace.streaming.truncated ? "warning" : undefined}
                  />
                </div>
              </RecordSection>
            )}
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
              <Eyebrow as="span">User</Eyebrow>
              <p className="max-w-[48rem] rounded-2xl rounded-tr-md bg-muted px-4 py-3 text-sm leading-relaxed">
                {trace.userQuery}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Eyebrow as="span">{agent?.name ?? "Agent"}</Eyebrow>
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
          description={`${trace.spans.length} spans · ${formatMs(trace.durationMs)} total`}
          icon={<RouteIcon />}
        >
          <TraceWaterfall spans={trace.spans} totalMs={trace.durationMs} />
        </RecordSection>
      </RecordLayout>
    </>
  )
}
