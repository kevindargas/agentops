import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRightIcon,
  BotIcon,
  DatabaseIcon,
  GitCompareArrowsIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "lucide-react"

import { ChartCard } from "@/components/charts/chart-card"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import {
  CasesGrid,
  ScoreDistribution,
} from "@/features/agentops/evals/cases-grid"
import { formatEvalScore, triggerHint } from "@/features/agentops/evals/format"
import { RunActions } from "@/features/agentops/evals/run-actions"
import {
  ChangeBadge,
  DeltaValue,
  PromptChip,
  RunStatusBadge,
} from "@/features/agentops/evals/shared"
import { AgentChip, ModelChip, ScoreBar } from "@/features/agentops/shared"
import { getDeployedAgent } from "@/lib/data/agentops"
import {
  evalRuns,
  getDataset,
  getEvalCases,
  getEvalRun,
  getEvaluator,
  getReleaseGate,
} from "@/lib/data/evals"
import {
  formatCost,
  formatDateTime,
  formatDurationMs,
  formatMs,
  timeAgo,
} from "@/lib/format"

/**
 * Every sample record is prerendered at build time so the static export has a
 * page per id; anything else is a 404. The server build gets the same list.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return evalRuns.map((run) => ({ id: run.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function EvalRunPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const run = getEvalRun(id)
  if (!run)
    return (
      <RecordNotFound
        number={id}
        backHref="/agentops/evals"
        backLabel="Evals"
      />
    )
  const agent = getDeployedAgent(run.agentId)
  const dataset = getDataset(run.datasetId)
  const baseline = run.baselineRunId ? getEvalRun(run.baselineRunId) : undefined
  const gate = getReleaseGate(run.agentId)
  const cases = getEvalCases(run.id)
  const inFlight = run.status === "Running" || run.status === "Queued"
  const p = agent?.params

  return (
    <>
      <RecordHeader
        number={run.id}
        title={`${agent?.name ?? run.agentId} · ${dataset?.name ?? run.datasetId}`}
        backHref="/agentops/evals"
        backLabel="Evals"
        description={
          run.note ??
          `${run.trigger} run of the deployed configuration against ${dataset?.name ?? run.datasetId}.`
        }
        badges={
          <>
            <RunStatusBadge status={run.status} />
            <Badge variant="outline" className="text-muted-foreground">
              {run.trigger}
            </Badge>
            {run.regressions > 0 && (
              <StateBadge
                state={`${run.regressions} ${run.regressions === 1 ? "regression" : "regressions"}`}
                tone="danger"
                size="sm"
              />
            )}
          </>
        }
        meta={
          <>
            <MetaItem label="Agent" icon={<BotIcon />}>
              <AgentChip agentId={run.agentId} size="sm" />
            </MetaItem>
            <MetaItem label="Prompt">
              <PromptChip version={run.promptVersion} />
            </MetaItem>
            <MetaItem label="Model">
              <ModelChip modelId={run.modelId} className="text-xs" />
            </MetaItem>
            <MetaItem
              label="Dataset"
              icon={<DatabaseIcon />}
              href={`/agentops/evals?tab=datasets&dataset=${run.datasetId}`}
            >
              <span className="font-mono">
                {dataset?.name ?? run.datasetId}
              </span>
            </MetaItem>
            <MetaItem
              label="Baseline"
              icon={<GitCompareArrowsIcon />}
              href={baseline ? `/agentops/evals/${baseline.id}` : undefined}
            >
              {baseline ? (
                <span className="font-mono">{baseline.id}</span>
              ) : (
                "none"
              )}
            </MetaItem>
            {gate && (
              <MetaItem
                label="Gate"
                icon={<ShieldCheckIcon />}
                href="/agentops/evals?tab=gates"
                tone={
                  gate.status === "Passed"
                    ? "success"
                    : gate.enforced
                      ? "danger"
                      : "warning"
                }
              >
                {gate.status}
                {!gate.enforced && " · advisory"}
              </MetaItem>
            )}
          </>
        }
        actions={<RunActions run={run} />}
        overflow={[
          {
            label: "Open dataset",
            icon: <DatabaseIcon />,
            href: `/agentops/evals?tab=datasets&dataset=${run.datasetId}`,
          },
          {
            label: "Show in runs list",
            href: `/agentops/evals?run=${run.id}`,
          },
        ]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection title="Run" size="sm">
              <DetailList
                variant="rows"
                dense
                items={[
                  {
                    label: "Trigger",
                    value: run.trigger,
                    hint: triggerHint[run.trigger],
                  },
                  {
                    label: "Started",
                    value: formatDateTime(run.started),
                    hint: timeAgo(run.started),
                  },
                  {
                    label: "Duration",
                    value: inFlight
                      ? "in progress"
                      : formatDurationMs(run.durationMs),
                  },
                  {
                    label: "Cost",
                    value: formatCost(run.cost),
                    hint:
                      run.cases && !inFlight
                        ? `${formatCost(run.cost / run.cases, 3)} per case`
                        : undefined,
                  },
                  {
                    label: "Started by",
                    value: <UserChip userId={run.byId} size="xs" />,
                  },
                  {
                    label: "Cases",
                    value: `${run.cases} of ${dataset?.cases ?? run.cases}`,
                    hint: dataset
                      ? `Sampled from ${dataset.name} ${dataset.version}`
                      : undefined,
                  },
                ]}
              />
            </RecordSection>
            {p && (
              <RecordSection title="Model parameters" size="sm">
                <DetailList
                  variant="rows"
                  dense
                  items={[
                    { label: "Temperature", value: p.temperature.toFixed(1) },
                    { label: "Top-p", value: p.topP.toFixed(2) },
                    {
                      label: "Max output",
                      value: `${p.maxOutputTokens.toLocaleString("en-US")} tokens`,
                    },
                    { label: "Reasoning", value: p.reasoningEffort },
                    { label: "Tool choice", value: p.toolChoice },
                    {
                      label: "Response",
                      value:
                        p.responseFormat === "json_schema"
                          ? "JSON schema"
                          : "Text",
                    },
                    { label: "Max tool calls", value: String(p.maxToolCalls) },
                    { label: "Timeout", value: formatMs(p.timeoutMs) },
                  ]}
                />
              </RecordSection>
            )}
            {dataset && (
              <RecordSection
                title="Evaluators"
                size="sm"
                count={run.evaluatorIds.length}
              >
                <ul className="flex flex-col gap-1.5">
                  {run.evaluatorIds.map((e) => {
                    const ev = getEvaluator(e)
                    return ev ? (
                      <li
                        key={e}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{ev.name}</span>
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          {ev.type}
                        </span>
                      </li>
                    ) : null
                  })}
                </ul>
              </RecordSection>
            )}
          </>
        }
      >
        {inFlight ? (
          <EmptyState
            icon={<ZapIcon />}
            title={
              run.status === "Queued"
                ? "Waiting for a worker"
                : "Run in progress"
            }
            description={`${run.cases} cases from ${dataset?.name ?? run.datasetId} are ${run.status === "Queued" ? "queued" : "being scored"}. Results stream in here as evaluators finish.`}
            action={
              <Link
                href="/agentops/evals"
                className="inline-flex items-center gap-1 text-sm hover:underline"
              >
                Back to runs <ArrowUpRightIcon className="size-3.5" />
              </Link>
            }
          />
        ) : (
          <>
            <StatGrid columns={4}>
              <StatCard
                label="Composite"
                value={<ScoreBar value={run.composite} />}
                hint={
                  <span className="flex items-center gap-2">
                    <DeltaValue value={run.delta} />
                    {baseline
                      ? `baseline ${baseline.composite}`
                      : "no baseline"}
                  </span>
                }
              />
              <StatCard
                label="Pass rate"
                value={run.passRate}
                unit="%"
                hint={
                  <span className="flex items-center gap-2">
                    {baseline && (
                      <DeltaValue
                        value={run.passRate - baseline.passRate}
                        unit="pt"
                      />
                    )}
                    {run.passed} passed · {run.failed} failed
                  </span>
                }
              />
              <StatCard
                label="Regressions"
                value={run.regressions}
                className={
                  run.regressions
                    ? "[&_[data-slot=card-title]]:text-danger-text"
                    : undefined
                }
                hint="passed on baseline, fail now"
              />
              <StatCard
                label="Improvements"
                value={run.improvements}
                className={
                  run.improvements
                    ? "[&_[data-slot=card-title]]:text-success-text"
                    : undefined
                }
                hint="failed on baseline, pass now"
              />
            </StatGrid>

            <RecordSection
              title="Scores by evaluator"
              description={
                baseline
                  ? `Mean score per evaluator with the change against ${baseline.id}`
                  : "Mean score per evaluator"
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {run.evaluatorIds.map((e) => {
                  const ev = getEvaluator(e)
                  const v = run.scores[e]
                  if (!ev || v === undefined) return null
                  const b = baseline?.scores[e]
                  const d = b === undefined ? null : Math.round((v - b) * 100)
                  return (
                    <MetricTile
                      key={e}
                      label={ev.name}
                      value={formatEvalScore(v, ev.scale)}
                      delta={d ?? undefined}
                      deltaUnit="pt"
                      hint={
                        <span className="flex flex-col gap-1.5">
                          <ScoreBar
                            value={v}
                            max={1}
                            thresholds={{ good: 85, ok: 70 }}
                            label={`${ev.name} ${formatEvalScore(v, ev.scale)}`}
                          />
                          <span>
                            {ev.measures} · {ev.scale}
                            {b !== undefined &&
                              ` · was ${formatEvalScore(b, ev.scale)}`}
                          </span>
                        </span>
                      }
                    />
                  )
                })}
              </div>
            </RecordSection>

            <ChartCard
              title="Score distribution"
              description="Cases per score bin for every graded evaluator (pass/fail evaluators excluded)"
            >
              <ScoreDistribution run={run} cases={cases} />
            </ChartCard>

            <RecordSection
              title="Test cases"
              description="Expected vs actual output with every evaluator's score. Regressions are cases that passed on the baseline and fail now."
              count={cases.length}
              action={
                run.regressions > 0 ? (
                  <ChangeBadge change="regression" size="default" />
                ) : undefined
              }
              contentClassName="-mx-2 sm:mx-0"
            >
              <CasesGrid run={run} cases={cases} />
            </RecordSection>
          </>
        )}
      </RecordLayout>
    </>
  )
}
