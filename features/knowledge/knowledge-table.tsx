"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { PlusIcon, ThumbsUpIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { knowledgeArticles } from "@/lib/data"
import { formatNumber } from "@/lib/format"
import type { KnowledgeArticle } from "@/lib/types"

const col = createColumnHelper<DataTableFeatures, KnowledgeArticle>()

const helpfulPct = (a: KnowledgeArticle) => {
  const total = a.helpful + a.notHelpful
  return total === 0 ? 0 : Math.round((a.helpful / total) * 100)
}

const columns = col.columns([
  col.accessor("number", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
    cell: ({ getValue }) => (
      <RecordLink number={getValue()} href={`/itsm/knowledge/${getValue()}`} />
    ),
    enableHiding: false,
    meta: { width: "w-28", label: "Number", skeleton: "w-20" },
  }),
  col.accessor("title", {
    header: "Title",
    cell: ({ getValue, row }) => (
      <TwoLineCell primary={getValue()} secondary={row.original.summary} />
    ),
    enableSorting: false,
    meta: { width: "min-w-72 max-w-xl", skeleton: "w-72" },
  }),
  col.accessor("knowledgeBase", {
    header: "Knowledge base",
    cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
    enableSorting: false,
    meta: { width: "w-36", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("state", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-32", label: "State", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("views", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Views" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatNumber(n, true)} />
    ),
    meta: { width: "w-20", numeric: true, label: "Views", skeleton: "w-10" },
  }),
  col.accessor((row) => helpfulPct(row), {
    id: "helpful",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Helpful" />
    ),
    cell: ({ getValue, row }) => (
      <span
        className="inline-flex items-center justify-end gap-1 tabular-nums"
        title={`${row.original.helpful} helpful · ${row.original.notHelpful} not helpful`}
      >
        <ThumbsUpIcon className="size-3 text-muted-foreground" aria-hidden />{" "}
        {getValue()}%
      </span>
    ),
    meta: { width: "w-24", numeric: true, label: "Helpful", skeleton: "w-12" },
  }),
  col.accessor("authorId", {
    id: "author",
    header: "Author",
    cell: ({ getValue }) => <UserChip userId={getValue()} />,
    enableSorting: false,
    meta: { width: "w-44", skeleton: "w-32" },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
])

const facets: FacetDef<KnowledgeArticle>[] = [
  {
    id: "kb",
    title: "Knowledge base",
    options: ["IT", "HR", "Facilities", "Security"].map((k) => ({
      label: k,
      value: k,
    })),
    getValue: (r) => r.knowledgeBase,
  },
  {
    id: "state",
    title: "State",
    options: ["Draft", "Review", "Published", "Retired"].map((s) => ({
      label: s,
      value: s,
    })),
    getValue: (r) => r.state,
  },
]

export function KnowledgeTable() {
  return (
    <DataTable
      columns={columns}
      data={knowledgeArticles}
      getRowId={(r) => r.number}
      getSearchText={(r) =>
        `${r.number} ${r.title} ${r.summary} ${r.tags.join(" ")}`
      }
      searchPlaceholder="Search articles…"
      facets={facets}
      initialSorting={[{ id: "views", desc: true }]}
      rowHref={(r) => `/itsm/knowledge/${r.number}`}
      totalLabel="articles"
      toolbar={
        <Button
          size="sm"
          onClick={() => toast.success("Draft KB0010481 created")}
        >
          <PlusIcon /> New article
        </Button>
      }
    />
  )
}
