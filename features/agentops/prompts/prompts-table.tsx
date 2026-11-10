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
import { UserChip } from "@/components/shared/user-chip"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  extractVariables,
  latestVersion,
  productionVersion,
  promptLabels,
  prompts,
  promptTypeLabel,
  type Prompt,
  type PromptLabel,
  type PromptType,
} from "@/lib/data/prompts"
import { AgentChip, ModelChip, ScoreBar } from "../shared"
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
          <span className="font-mono text-[11px]">{row.original.slug}</span>
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
      <DataTableColumnHeader column={column} title="Latest" />
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
        <DataTableColumnHeader column={column} title="Vars" />
      ),
      cell: ({ getValue }) => <NumericCell value={getValue()} muted />,
      meta: {
        width: "w-16",
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
      if (!v) return <span className="text-muted-foreground">—</span>
      return (
        <span className="flex items-center gap-2">
          <ModelChip modelId={v.modelId} className="text-xs" />
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
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
      <DataTableColumnHeader column={column} title="Eval" />
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

export function PromptsTable({
  agentId,
  toolbar,
}: {
  agentId?: string
  toolbar?: React.ReactNode
}) {
  const data = agentId ? prompts.filter((p) => p.agentId === agentId) : prompts
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(p) => p.id}
      getSearchText={(p) =>
        `${p.name} ${p.slug} ${p.description} ${promptTypeLabel[p.type]} ${getDeployedAgent(p.agentId)?.name ?? ""} ${p.versions.map((v) => v.id).join(" ")}`
      }
      searchPlaceholder="Search prompts, slugs or version ids…"
      facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
      initialSorting={[{ id: "updatedAt", desc: true }]}
      initialColumnVisibility={{ editor: false }}
      rowHref={(p) => `/agentops/prompts/${p.id}`}
      totalLabel="prompts"
      selectionLabel={(n) => (n === 1 ? "prompt" : "prompts")}
      toolbar={toolbar}
      emptyTitle="No prompts yet"
      emptyMessage="Register a prompt to start tracking versions and evals."
      emptyIcon={<FileTextIcon />}
    />
  )
}
