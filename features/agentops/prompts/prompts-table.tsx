"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { FileTextIcon } from "lucide-react"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { UserChip } from "@/components/shared/user-chip"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import {
  extractVariables,
  latestVersion,
  productionVersion,
  promptLabels,
  promptTypeLabel,
  type Prompt,
  type PromptLabel,
  type PromptType,
} from "@/lib/data/prompts"
import { AgentChip, ModelChip, ScoreBar } from "../shared"
import { allVersions, awaitingReviewByLabel, promptStore } from "./prompt-store"
import { LabelBadge, TypeBadge, VersionTag } from "./shared"

const col = createColumnHelper<DataTableFeatures, Prompt>()

/** Labels worth surfacing in the list, in display order (archived is noise). */
function activeLabels(p: Prompt): PromptLabel[] {
  const present = new Set(p.versions.map((v) => v.label))
  return promptLabels.filter((l) => l !== "archived" && present.has(l))
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prompt" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={row.original.name}
        secondary={
          <span className="font-mono text-2xs">{row.original.slug}</span>
        }
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-64 max-w-sm", label: "Prompt", skeleton: "w-48" },
  }),
  col.accessor("agentId", {
    header: "Agent",
    cell: ({ getValue }) => <AgentChip agentId={getValue()} size="sm" />,
    enableSorting: false,
    meta: { width: "w-44", label: "Agent", skeleton: "w-28" },
  }),
  col.accessor("type", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ getValue }) => <TypeBadge type={getValue()} />,
    meta: { width: "w-36", label: "Type", skeleton: "w-20 rounded-full" },
  }),
  col.accessor((p) => latestVersion(p).number, {
    id: "latest",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Latest"
        hint="Newest version number plus every label present on the prompt except archived"
      />
    ),
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1">
        <VersionTag version={latestVersion(row.original)} />
        {activeLabels(row.original).map((l) => (
          <LabelBadge key={l} label={l} size="sm" />
        ))}
      </span>
    ),
    meta: { width: "w-52", label: "Latest version", skeleton: "w-32" },
  }),
  col.accessor(
    (p) =>
      extractVariables((productionVersion(p) ?? latestVersion(p)).template)
        .length,
    {
      id: "variables",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Variables"
          hint="Distinct {{variable}} placeholders in the production template"
        />
      ),
      cell: ({ getValue }) => <NumericCell value={getValue()} muted />,
      meta: {
        width: "w-24",
        label: "Variables",
        numeric: true,
        skeleton: "w-6",
      },
    }
  ),
  col.accessor((p) => productionVersion(p)?.modelId ?? "", {
    id: "model",
    header: "Model",
    cell: ({ row }) => {
      const v = productionVersion(row.original)
      if (!v) return <span className="text-muted-foreground">None</span>
      return (
        <span className="flex items-center gap-2">
          <ModelChip modelId={v.modelId} className="text-xs" />
          <span className="font-mono text-2xs text-muted-foreground tabular-nums">
            t={v.params.temperature.toFixed(1)}
          </span>
        </span>
      )
    },
    enableSorting: false,
    meta: { width: "w-56", label: "Production model", skeleton: "w-36" },
  }),
  col.accessor((p) => productionVersion(p)?.evalScore ?? 0, {
    id: "eval",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Eval"
        hint="Evaluator composite, 0 to 100, of the production version on the agent's golden set"
      />
    ),
    cell: ({ getValue }) =>
      getValue() ? (
        <ScoreBar value={getValue()} className="min-w-12" />
      ) : (
        <NumericCell value={null} />
      ),
    meta: {
      width: "w-24",
      label: "Eval score",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("updatedAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
  col.accessor((p) => latestVersion(p).authorId, {
    id: "editor",
    header: "Editor",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Last editor", skeleton: "w-24" },
  }),
])

const facets: FacetDef<Prompt>[] = [
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (p) => p.agentId,
  },
  {
    id: "type",
    title: "Type",
    options: (Object.keys(promptTypeLabel) as PromptType[]).map((t) => ({
      value: t,
      label: promptTypeLabel[t],
    })),
    getValue: (p) => p.type,
  },
  {
    id: "label",
    title: "Label",
    options: promptLabels.map((l) => ({ value: l, label: l })),
    getValue: (p) => [...new Set(p.versions.map((v) => v.label))],
  },
]

/** Stat row for the list page, computed from the shared prompt store. */
export function PromptsStats() {
  const prompts = promptStore.use()
  const versions = allVersions(prompts)
  const production = versions.filter((v) => v.label === "production")
  const awaiting = awaitingReviewByLabel(prompts)
  const awaitingTotal = Object.values(awaiting).reduce((a, b) => a + b, 0)
  const awaitingHint =
    awaitingTotal === 0
      ? "no version has review Pending Approval"
      : (Object.entries(awaiting) as [PromptLabel, number][])
          .map(([label, n]) => `${n} ${label}`)
          .join(" · ") + " with review Pending Approval"
  const scored = prompts
    .map((p) => productionVersion(p)?.evalScore ?? null)
    .filter((s): s is number => s !== null)
  const avg = scored.length
    ? scored.reduce((a, b) => a + b, 0) / scored.length
    : 0
  const agents = new Set(prompts.map((p) => p.agentId)).size

  return (
    <StatGrid columns={4}>
      <StatCard
        label="Prompts"
        value={prompts.length}
        hint={`across ${agents} agents`}
      />
      <StatCard
        label="Versions"
        value={versions.length}
        hint={`${production.length} in production`}
      />
      <StatCard
        label="Awaiting review"
        value={awaitingTotal}
        hint={awaitingHint}
      />
      <StatCard
        label="Avg eval score"
        value={avg.toFixed(1)}
        hint="production versions, golden sets"
      />
    </StatGrid>
  )
}

export function PromptsTable({
  agentId,
  toolbar,
}: {
  /** Pre-selects the Agent facet (from `?agent=`). */
  agentId?: string
  toolbar?: React.ReactNode
}) {
  const data = promptStore.use()
  const agentKnown = agentId
    ? deployedAgents.some((a) => a.id === agentId)
    : false
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(p) => p.id}
      getSearchText={(p) =>
        `${p.name} ${p.slug} ${p.description} ${promptTypeLabel[p.type]} ${getDeployedAgent(p.agentId)?.name ?? ""} ${p.versions.map((v) => v.id).join(" ")}`
      }
      searchPlaceholder="Search prompts, slugs or version ids"
      facets={facets}
      initialFacets={agentKnown && agentId ? { agent: [agentId] } : undefined}
      initialSorting={[{ id: "updatedAt", desc: true }]}
      initialColumnVisibility={{ editor: false }}
      rowHref={(p) => `/agentops/prompts/${p.id}`}
      totalLabel="prompts"
      caption="Prompt registry: one row per prompt with its latest version, production model and eval score"
      selectionLabel={(n) => (n === 1 ? "prompt" : "prompts")}
      toolbar={toolbar}
      emptyTitle="No prompts yet"
      emptyMessage="Register a prompt to start tracking versions and evals."
      emptyIcon={<FileTextIcon />}
    />
  )
}
