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
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Badge } from "@/components/ui/badge"
import {
  CasesGrid,
  ScoreDistribution,
} from "@/features/agentops/evals/cases-grid"
import {
  fmtCost,
  fmtDuration,
  fmtMs,
  formatEvalScore,
  triggerHint,
} from "@/features/agentops/evals/format"
import { RunActions } from "@/features/agentops/evals/run-actions"
import {
  ChangeBadge,
  DeltaValue,
  PromptChip,
  RunStatusBadge,
} from "@/features/agentops/evals/shared"
import { AgentChip, ModelChip, ScoreBar } from "@/features/agentops/shared"
import { getDeployedAgent } from "@/lib/data"
import {
  getDataset,
  getEvalCases,
  getEvalRun,
  getEvaluator,
  getReleaseGate,
} from "@/lib/data/evals"
import { formatDateTime, timeAgo } from "@/lib/format"

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
        backLabel="eval runs"
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
        backLabel="eval runs"
        editable={false}
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
            label: "Export results",
            message: "Export started — CSV with every case and score",
          },
          {
            label: "Cancel run",
            message: inFlight ? "Run cancelled" : "Run already finished",
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
                      : fmtDuration(run.durationMs),
                  },
                  {
                    label: "Cost",
                    value: fmtCost(run.cost),
                    hint:
                      run.cases && !inFlight
                        ? `${fmtCost(run.cost / run.cases, 3)} per case`
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
                    { label: "Timeout", value: fmtMs(p.timeoutMs) },
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
                        <span className="shrink-0 text-[11px] text-muted-foreground">
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Composite"
                value={<ScoreBar value={run.composite} />}
                delta={<DeltaValue value={run.delta} />}
                hint={
                  baseline ? `baseline ${baseline.composite}` : "no baseline"
                }
              />
              <SummaryCard
                label="Pass rate"
                value={
                  <span className="text-2xl font-semibold tabular-nums">
                    {run.passRate}%
                  </span>
                }
                delta={
                  baseline ? (
                    <DeltaValue
                      value={run.passRate - baseline.passRate}
                      unit="pt"
                    />
                  ) : undefined
                }
                hint={`${run.passed} passed · ${run.failed} failed`}
              />
              <SummaryCard
                label="Regressions"
                value={
                  <span
                    className={
                      run.regressions
                        ? "text-2xl font-semibold text-danger-text tabular-nums"
                        : "text-2xl font-semibold tabular-nums"
                    }
                  >
                    {run.regressions}
                  </span>
                }
                hint="passed on baseline, fail now"
              />
              <SummaryCard
                label="Improvements"
                value={
                  <span
                    className={
                      run.improvements
                        ? "text-2xl font-semibold text-success-text tabular-nums"
                        : "text-2xl font-semibold tabular-nums"
                    }
                  >
                    {run.improvements}
                  </span>
                }
                hint="failed on baseline, pass now"
              />
            </div>

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
                    <div
                      key={e}
                      className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {ev.name}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {ev.measures} · {ev.scale}
                          </span>
                        </span>
                        <DeltaValue value={d} unit="pt" />
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <ScoreBar
                          value={v}
                          max={1}
                          thresholds={{ good: 85, ok: 70 }}
                          className="flex-1"
                          label={`${ev.name} ${formatEvalScore(v, ev.scale)}`}
                        />
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {formatEvalScore(v, ev.scale)}
                          {b !== undefined &&
                            ` · was ${formatEvalScore(b, ev.scale)}`}
                        </span>
                      </div>
                    </div>
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

function SummaryCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string
  value: React.ReactNode
  delta?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {delta}
      </div>
      <div className="flex items-center gap-1">{value}</div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
