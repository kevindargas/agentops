"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  CheckCircle2Icon,
  CheckIcon,
  ClipboardListIcon,
  ShieldAlertIcon,
  ZapIcon,
} from "lucide-react"

import { ChartCard } from "@/components/charts/chart-card"
import {
  DataTable,
  DataTableColumnHeader,
  EmptyValue,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { toneClasses, type Tone } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDate } from "@/lib/format"
import {
  effortLabel,
  maturityLevelHint,
  maturityLevelLabel,
  maturityTargetLabel,
  statusLabel,
} from "@/lib/readiness/labels"
import { effortOrder, evaluateAssessment } from "@/lib/readiness/scoring"
import {
  controlStatuses,
  maturityLevels,
  type ControlEval,
  type ControlStatus,
  type DomainDef,
  type Effort,
} from "@/lib/readiness/types"
import { CoverageRadar, DomainHeatmap } from "./coverage-radar"
import {
  ControlStatusBadge,
  DomainChip,
  EffortBadge,
  GateBadge,
  MaturityBadge,
  RequiredBadge,
  RiskDots,
  useReadiness,
} from "./shared"

const NO_COMPARE = "none"

export function ResultsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { assessment, snapshots, controlSet, result } = useReadiness()
  const [compareId, setCompareId] = React.useState(NO_COMPARE)

  const snapshot = snapshots.find((s) => s.id === compareId)
  const compareResult = React.useMemo(
    () =>
      snapshot ? evaluateAssessment(snapshot.assessment, controlSet) : null,
    [snapshot, controlSet]
  )

  if (!assessment || !result) {
    return (
      <EmptyState
        icon={<ClipboardListIcon />}
        title="No assessment yet"
        description="Complete the Setup tab to profile your system, then answer the controls to see results here."
      />
    )
  }

  const blockers = result.blockers.length
  const overdue = result.reviews.filter((r) => r.review?.overdue).length
  const target = maturityTargetLabel[assessment.target]
  const domainById = new Map(controlSet.domains.map((d) => [d.id, d]))
  const snapshotItems = [
    { value: NO_COMPARE, label: "No comparison" },
    ...snapshots.map((s) => ({
      value: s.id,
      label: `${s.label} · ${formatDate(s.takenAt)}`,
    })),
  ]

  return (
    <div id="readiness-report" className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
        <StatCard
          size="sm"
          label="Overall coverage"
          value={result.overall}
          unit="/100"
          hint={`${result.counts.applicable} applicable controls`}
          className="print:break-inside-avoid"
        />
        <StatCard
          size="sm"
          label="Maturity level"
          value={<MaturityBadge level={result.maturity} />}
          hint={maturityLevelHint[result.maturity]}
          className="print:break-inside-avoid"
        />
        <StatCard
          size="sm"
          label="Release blockers"
          value={
            <span className={cn(blockers > 0 && "text-danger-text")}>
              {blockers}
            </span>
          }
          hint="must close before go-live"
          className="print:break-inside-avoid"
        />
        <StatCard
          size="sm"
          label="Open gaps"
          value={result.gaps.length}
          hint="applicable controls not yet in place"
          className="print:break-inside-avoid"
        />
        <StatCard
          size="sm"
          label="Reviews overdue"
          value={
            <span className={cn(overdue > 0 && "text-warning-text")}>
              {overdue}
            </span>
          }
          hint="cadence passed since last review"
          className="print:break-inside-avoid"
        />
        <StatCard
          size="sm"
          label="Hidden controls"
          value={result.counts.hidden}
          hint="not applicable to this profile"
          className="print:break-inside-avoid"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        <ChartCard
          title="Coverage by domain"
          description="Weighted coverage per domain, 0–100."
          className="print:break-inside-avoid"
          action={
            snapshots.length > 0 ? (
              <Select
                value={compareId}
                onValueChange={(v) => setCompareId(v ?? NO_COMPARE)}
                items={snapshotItems}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Compare with snapshot"
                  className="max-w-56 print:hidden"
                >
                  <SelectValue placeholder="Compare with snapshot" />
                </SelectTrigger>
                <SelectContent align="end">
                  {snapshotItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        >
          <CoverageRadar
            domains={result.domains}
            compare={compareResult?.domains}
            compareLabel={snapshot?.label}
          />
        </ChartCard>
        <ChartCard
          title="Domain heatmap"
          description="Score, controls in place and required controls met per domain."
          className="print:break-inside-avoid"
        >
          <DomainHeatmap domains={result.domains} />
        </ChartCard>
      </div>

      <Section
        title="Maturity ladder"
        description={`Target stage: ${target}. Level is derived from the overall score and verified required controls.`}
        className="print:break-inside-avoid"
      >
        <MaturityLadder current={result.maturity} />
        <StatusDistribution counts={result.counts} />
      </Section>

      <Section
        title="Release gate"
        count={blockers}
        description={
          blockers > 0
            ? `${blockers} ${blockers === 1 ? "blocker" : "blockers"} · required gate controls not yet in place for ${target}`
            : `Every required gate control for ${target} is in place or verified.`
        }
        className="print:break-inside-avoid"
      >
        {blockers === 0 ? (
          <EmptyState
            size="sm"
            icon={<CheckCircle2Icon className="text-success" />}
            title={`Gate is clear for ${target}`}
            description="No required gate control is missing. Keep evidence current so the gate stays green."
          />
        ) : (
          <BlockerList
            blockers={result.blockers}
            domainById={domainById}
            onOpen={onOpen}
          />
        )}
      </Section>

      <Section
        title="Prioritized gaps"
        count={result.gaps.length}
        description="Applicable controls not yet in place, ordered by severity (risk × missing credit × stage weight)."
      >
        <GapsTable
          gaps={result.gaps}
          domains={controlSet.domains}
          domainById={domainById}
          onOpen={onOpen}
        />
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Maturity ladder + status distribution                                     */
/* ------------------------------------------------------------------------ */

function MaturityLadder({
  current,
}: {
  current: (typeof maturityLevels)[number]
}) {
  const currentIndex = maturityLevels.indexOf(current)
  return (
    <ol
      className="grid gap-2 sm:grid-cols-4"
      aria-label={`Maturity ladder, current level ${maturityLevelLabel[current]}`}
    >
      {maturityLevels.map((level, i) => {
        const active = i === currentIndex
        const reached = i < currentIndex
        return (
          <li
            key={level}
            aria-current={active ? "step" : undefined}
            className={cn(
              "relative flex flex-col gap-1.5 rounded-lg border p-3",
              active
                ? "border-brand/40 bg-brand/5 ring-1 ring-brand/30"
                : reached
                  ? "border-border bg-card"
                  : "border-dashed border-border bg-transparent"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                  active
                    ? "bg-brand text-brand-foreground"
                    : reached
                      ? "bg-success text-white"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {reached ? (
                  <CheckIcon className="size-3" strokeWidth={2.5} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  !active && !reached && "text-muted-foreground"
                )}
              >
                {maturityLevelLabel[level]}
              </span>
              {active && (
                <span className="ml-auto text-[10px] font-semibold tracking-wide text-brand uppercase">
                  Current
                </span>
              )}
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              {maturityLevelHint[level]}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

const statusTone: Record<ControlStatus, Tone> = {
  none: "muted",
  planned: "info",
  partial: "warning",
  "in-place": "success",
  verified: "success",
}

function StatusDistribution({
  counts,
}: {
  counts: Record<ControlStatus, number> & { applicable: number }
}) {
  const total = counts.applicable
  const segments = controlStatuses.filter((s) => counts[s] > 0)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Status distribution</span>
        <span className="tabular-nums">{total} applicable controls</span>
      </div>
      {total === 0 ? (
        <div className="h-6 rounded-md bg-muted" aria-hidden />
      ) : (
        <div
          className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md"
          role="img"
          aria-label={controlStatuses
            .map((s) => `${statusLabel[s]}: ${counts[s]}`)
            .join(", ")}
        >
          {segments.map((s) => {
            const tone = statusTone[s]
            const pct = (counts[s] / total) * 100
            return (
              <Tooltip key={s}>
                <TooltipTrigger
                  render={
                    <div
                      className={cn(
                        "flex min-w-6 items-center justify-center gap-1 text-[11px] font-semibold tabular-nums",
                        s === "verified"
                          ? "bg-success text-white"
                          : s === "in-place"
                            ? "bg-success/70 text-white"
                            : toneClasses[tone].soft
                      )}
                      style={{ flexGrow: pct, flexBasis: 0 }}
                    />
                  }
                >
                  {s === "verified" && (
                    <CheckIcon className="size-3" strokeWidth={2.5} />
                  )}
                  {counts[s]}
                </TooltipTrigger>
                <TooltipContent>
                  {statusLabel[s]} · {counts[s]} ({Math.round(pct)}%)
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {controlStatuses.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "inline-block size-2 rounded-xs",
                s === "verified"
                  ? "bg-success"
                  : s === "in-place"
                    ? "bg-success/70"
                    : toneClasses[statusTone[s]].dot
              )}
            />
            {statusLabel[s]}{" "}
            <span className="font-medium text-foreground tabular-nums">
              {counts[s]}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Release gate                                                              */
/* ------------------------------------------------------------------------ */

function BlockerList({
  blockers,
  domainById,
  onOpen,
}: {
  blockers: ControlEval[]
  domainById: Map<string, DomainDef>
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            <th className="pl-4">Control</th>
            <th>Domain</th>
            <th>Status</th>
            <th>Owner</th>
            <th className="text-right!">Severity</th>
            <th className="pr-4">Effort</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {blockers.map((b) => {
            const domain = domainById.get(b.control.domain)
            return (
              <tr
                key={b.control.id}
                tabIndex={0}
                onClick={() => onOpen(b.control.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onOpen(b.control.id)
                  }
                }}
                className="cursor-pointer transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
              >
                <td className="px-3 py-2 pl-4">
                  <div className="flex items-start gap-2">
                    <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <TwoLineCell
                      primary={
                        <>
                          <span className="font-mono text-xs text-muted-foreground">
                            {b.control.id}
                          </span>{" "}
                          {b.control.title}
                        </>
                      }
                      title={b.control.title}
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  {domain ? <DomainChip domain={domain} short /> : null}
                </td>
                <td className="px-3 py-2">
                  <ControlStatusBadge status={b.response.status} size="sm" />
                </td>
                <td className="px-3 py-2">
                  <UserChip userId={b.response.ownerId} size="xs" />
                </td>
                <td className="px-3 py-2 text-right">
                  <NumericCell
                    value={b.severity}
                    className="font-medium text-danger-text"
                  />
                </td>
                <td className="px-3 py-2 pr-4">
                  <EffortBadge effort={b.control.effort} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Prioritized gaps table                                                    */
/* ------------------------------------------------------------------------ */

interface GapRow extends ControlEval {
  rank: number
  domainDef?: DomainDef
}

const col = createColumnHelper<DataTableFeatures, GapRow>()

const efforts: Effort[] = ["low", "medium", "high"]

const columns = col.columns([
  col.accessor("rank", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} className="text-muted-foreground" />
    ),
    enableHiding: false,
    meta: { width: "w-12", label: "Rank", numeric: true, skeleton: "w-6" },
  }),
  col.accessor((r) => r.control.title, {
    id: "control",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Control" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={
          <>
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.control.id}
            </span>{" "}
            {row.original.control.title}
          </>
        }
        secondary={row.original.control.what}
        title={row.original.control.title}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-72 max-w-md", label: "Control", skeleton: "w-56" },
  }),
  col.accessor((r) => r.control.domain, {
    id: "domain",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Domain" />
    ),
    cell: ({ row }) =>
      row.original.domainDef ? (
        <DomainChip domain={row.original.domainDef} short />
      ) : (
        <EmptyValue />
      ),
    meta: { width: "w-32", label: "Domain", skeleton: "w-20" },
  }),
  col.accessor((r) => controlStatuses.indexOf(r.response.status), {
    id: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <ControlStatusBadge status={row.original.response.status} size="sm" />
    ),
    meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("severity", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Severity" />
    ),
    cell: ({ getValue }) => {
      const v = getValue()
      return (
        <span className="flex items-center justify-end gap-2">
          <span
            aria-hidden
            className="h-1.5 w-12 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn(
                "block h-full rounded-full",
                v >= 70
                  ? "bg-destructive"
                  : v >= 40
                    ? "bg-warning"
                    : "bg-muted-foreground/60"
              )}
              style={{ width: `${v}%` }}
            />
          </span>
          <NumericCell
            value={v}
            className={cn(
              "w-7 font-medium",
              v >= 70
                ? "text-danger-text"
                : v >= 40
                  ? "text-warning-text"
                  : "text-foreground"
            )}
          />
        </span>
      )
    },
    meta: { width: "w-32", label: "Severity", numeric: true, skeleton: "w-16" },
  }),
  col.accessor((r) => r.control.risk, {
    id: "risk",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Risk" />
    ),
    cell: ({ row }) => <RiskDots risk={row.original.control.risk} />,
    meta: { width: "w-20", label: "Risk", skeleton: "w-12" },
  }),
  col.accessor((r) => effortOrder[r.control.effort], {
    id: "effort",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Effort" />
    ),
    cell: ({ row }) => <EffortBadge effort={row.original.control.effort} />,
    meta: { width: "w-28", label: "Effort", skeleton: "w-16 rounded-full" },
  }),
  col.accessor((r) => (r.required ? 1 : 0), {
    id: "required",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Required" />
    ),
    cell: ({ row }) =>
      row.original.required ? <RequiredBadge /> : <EmptyValue />,
    meta: { width: "w-24", label: "Required", skeleton: "w-14 rounded-full" },
  }),
  col.accessor((r) => (r.control.gate ? 1 : 0), {
    id: "gate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gate" />
    ),
    cell: ({ row }) =>
      row.original.control.gate ? <GateBadge /> : <EmptyValue />,
    meta: { width: "w-20", label: "Gate", skeleton: "w-12 rounded-full" },
  }),
  col.accessor((r) => r.response.ownerId ?? "", {
    id: "owner",
    header: "Owner",
    cell: ({ row }) => (
      <UserChip userId={row.original.response.ownerId} size="xs" />
    ),
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
])

function GapsTable({
  gaps,
  domains,
  domainById,
  onOpen,
}: {
  gaps: ControlEval[]
  domains: DomainDef[]
  domainById: Map<string, DomainDef>
  onOpen: (id: string) => void
}) {
  const [quickWins, setQuickWins] = React.useState(false)

  const rows = React.useMemo<GapRow[]>(
    () =>
      gaps.map((g, i) => ({
        ...g,
        rank: i + 1,
        domainDef: domainById.get(g.control.domain),
      })),
    [gaps, domainById]
  )
  const visible = quickWins
    ? rows.filter((r) => r.control.effort === "low" && r.severity >= 40)
    : rows

  const facets: FacetDef<GapRow>[] = React.useMemo(
    () => [
      {
        id: "domain",
        title: "Domain",
        options: domains.map((d) => ({ value: d.id, label: d.short })),
        getValue: (r) => r.control.domain,
      },
      {
        id: "status",
        title: "Status",
        options: controlStatuses.map((s) => ({
          value: s,
          label: statusLabel[s],
        })),
        getValue: (r) => r.response.status,
      },
      {
        id: "effort",
        title: "Effort",
        options: efforts.map((e) => ({ value: e, label: effortLabel[e] })),
        getValue: (r) => r.control.effort,
      },
    ],
    [domains]
  )

  return (
    <DataTable
      columns={columns}
      data={visible}
      getRowId={(r) => r.control.id}
      getSearchText={(r) =>
        `${r.control.id} ${r.control.title} ${r.control.what} ${r.control.domain}`
      }
      searchPlaceholder="Search gaps…"
      facets={facets}
      initialSorting={[{ id: "severity", desc: true }]}
      onRowClick={(r) => onOpen(r.control.id)}
      totalLabel="gaps"
      selectionLabel={(n) => (n === 1 ? "gap" : "gaps")}
      emptyIcon={<CheckCircle2Icon />}
      emptyTitle={quickWins ? "No quick wins left" : "No open gaps"}
      emptyMessage={
        quickWins
          ? "No low-effort control with severity 40 or higher remains open."
          : "Every applicable control is in place or verified."
      }
      density="compact"
      toolbar={
        <Toggle
          size="sm"
          variant="outline"
          pressed={quickWins}
          onPressedChange={setQuickWins}
          aria-label="Show quick wins only"
          className="print:hidden"
        >
          <ZapIcon data-icon="inline-start" />
          Quick wins
        </Toggle>
      }
    />
  )
}
