"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { RocketIcon } from "lucide-react"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { UserChip } from "@/components/shared/user-chip"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import {
  releaseEnvironments,
  releaseStages,
  releaseStrategies,
  type Release,
} from "@/lib/data/deployments"
import { NotInDemoButton } from "../evals/shared"
import { AgentChip } from "../shared"
import {
  ChangeChips,
  EnvironmentBadge,
  EvalGateChip,
  HealthDeltas,
  StageBadge,
  TrafficBar,
  VersionChip,
  environmentLabel,
  strategyLabel,
} from "./shared"
import { releaseStore } from "./store"

const col = createColumnHelper<DataTableFeatures, Release>()

const stageOrder = Object.fromEntries(releaseStages.map((s, i) => [s, i]))

const columns = col.columns([
  col.accessor("id", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Release" />
    ),
    cell: ({ getValue }) => (
      <RecordLink
        number={getValue()}
        href={`/agentops/deployments/${getValue()}`}
      />
    ),
    enableHiding: false,
    meta: { width: "w-24", label: "Release", skeleton: "w-16" },
  }),
  col.accessor("agentId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agent" />
    ),
    cell: ({ getValue }) => <AgentChip agentId={getValue()} />,
    sortFn: (a, b) =>
      (getDeployedAgent(a.original.agentId)?.name ?? "").localeCompare(
        getDeployedAgent(b.original.agentId)?.name ?? ""
      ),
    meta: { width: "w-44", label: "Agent", skeleton: "w-28" },
  }),
  col.accessor("version", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Version" />
    ),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        <VersionChip version={row.original.version} />
        <EnvironmentBadge environment={row.original.environment} />
      </span>
    ),
    meta: { width: "w-40", label: "Version", skeleton: "w-20" },
  }),
  col.accessor((r) => r.summary, {
    id: "changes",
    header: "What changed",
    cell: ({ row }) => <ChangeChips changes={row.original.changes} max={2} />,
    enableSorting: false,
    meta: {
      width: "min-w-64 max-w-md",
      label: "What changed",
      skeleton: "w-48",
    },
  }),
  col.accessor("strategy", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Strategy"
        hint="How traffic moves to the new version: canary steps, blue-green cut-over, mirrored shadow traffic or a direct switch."
      />
    ),
    cell: ({ row }) => (
      <TruncatedText className="text-xs" muted>
        {strategyLabel(row.original.strategy, row.original.steps)}
      </TruncatedText>
    ),
    meta: { width: "w-40", label: "Strategy", skeleton: "w-24" },
  }),
  col.accessor("stage", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stage" />
    ),
    cell: ({ getValue }) => <StageBadge stage={getValue()} />,
    sortFn: (a, b) =>
      stageOrder[a.original.stage] - stageOrder[b.original.stage],
    meta: { width: "w-36", label: "Stage", skeleton: "w-24 rounded-full" },
  }),
  col.accessor((r) => r.evalGate?.status ?? "", {
    id: "evalGate",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Eval gate"
        hint="Result of the golden-set eval run the release is gated on: composite score against the threshold, plus the reason when it failed."
      />
    ),
    cell: ({ row }) => <EvalGateChip gate={row.original.evalGate} />,
    enableSorting: false,
    meta: { width: "w-36", label: "Eval gate", skeleton: "w-16" },
  }),
  col.accessor("traffic", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Traffic" />
    ),
    cell: ({ row }) => (
      <TrafficBar
        value={row.original.traffic}
        steps={row.original.steps}
        stage={row.original.stage}
      />
    ),
    meta: { width: "w-32", label: "Traffic", skeleton: "w-20" },
  }),
  col.accessor((r) => r.health.qualityDelta, {
    id: "health",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Health vs baseline"
        hint="Error-rate delta in percentage points (red above +0.2) and composite quality delta (red below -0.5) during the rollout."
      />
    ),
    cell: ({ row }) => <HealthDeltas release={row.original} />,
    enableSorting: false,
    meta: { width: "w-36", label: "Health", skeleton: "w-20" },
  }),
  col.accessor("deployedById", {
    header: "Deployed by",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Deployed by", skeleton: "w-24" },
  }),
  col.accessor((r) => r.deployedAt ?? r.createdAt, {
    id: "when",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="When" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "When", skeleton: "w-16" },
  }),
])

const facets: FacetDef<Release>[] = [
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
  {
    id: "stage",
    title: "Stage",
    options: releaseStages.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.stage,
  },
  {
    id: "strategy",
    title: "Strategy",
    options: releaseStrategies.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.strategy,
  },
  {
    id: "environment",
    title: "Environment",
    options: releaseEnvironments.map((e) => ({
      value: e,
      label: environmentLabel[e],
    })),
    getValue: (r) => r.environment,
  },
]

export function ReleasesTable({
  agentId,
  initialFacets,
}: {
  agentId?: string
  initialFacets?: Record<string, string[]>
}) {
  const releases = releaseStore.use()
  const data = agentId
    ? releases.filter((r) => r.agentId === agentId)
    : releases
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.id} ${r.version} ${r.summary} ${r.stage} ${r.strategy} ${getDeployedAgent(r.agentId)?.name ?? ""}`
      }
      searchPlaceholder="Search releases…"
      facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
      initialFacets={initialFacets}
      initialSorting={[{ id: "when", desc: true }]}
      initialColumnVisibility={{ deployedById: false }}
      rowHref={(r) => `/agentops/deployments/${r.id}`}
      totalLabel="releases"
      caption="Releases with agent, version, changes, strategy, stage, eval gate, traffic and health"
      selectionLabel={(n) => (n === 1 ? "release" : "releases")}
      emptyTitle="No releases"
      emptyMessage="Releases appear here when a passed eval run is promoted or staging is promoted from the Environments tab."
      emptyIcon={<RocketIcon />}
      toolbar={
        <NotInDemoButton reason="Releases are drafted from a passed eval run (Promote to production) or from the Environments tab (Promote to prod); there is no blank release form.">
          <RocketIcon /> New release
        </NotInDemoButton>
      }
    />
  )
}

/** Compact link list used by other records (e.g. the agent page). */
export function ReleaseLinks({ releases }: { releases: Release[] }) {
  return (
    <ul className="flex flex-col divide-y text-sm">
      {releases.map((r) => (
        <li key={r.id} className="flex items-center gap-2 py-2">
          <Link
            href={`/agentops/deployments/${r.id}`}
            className="font-mono text-xs hover:underline"
          >
            {r.id}
          </Link>
          <VersionChip version={r.version} />
          <StageBadge stage={r.stage} size="sm" className="ml-auto" />
        </li>
      ))}
    </ul>
  )
}
