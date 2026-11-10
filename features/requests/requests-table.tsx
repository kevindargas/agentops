"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { ShoppingBagIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TruncatedText,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { RecordLink } from "@/components/shared/record-link"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { requestStates } from "@/lib/constants"
import { getCatalogItem, requests } from "@/lib/data"
import { NOW } from "@/lib/data/seed"
import { formatCurrency } from "@/lib/format"
import type { Request } from "@/lib/types"

const col = createColumnHelper<DataTableFeatures, Request>()

const columns = col.columns([
  col.accessor("number", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
    cell: ({ getValue }) => (
      <RecordLink number={getValue()} href={`/itsm/requests/${getValue()}`} />
    ),
    enableHiding: false,
    meta: { width: "w-32", label: "Number", skeleton: "w-24" },
  }),
  col.display({
    id: "items",
    header: "Items",
    cell: ({ row }) => {
      const names = row.original.items
        .map((i) => getCatalogItem(i.catalogItemId)?.name ?? "Unknown item")
        .join(", ")
      const tasks = row.original.items.reduce((a, i) => a + i.tasks.length, 0)
      return (
        <TwoLineCell
          primary={names}
          secondary={`${row.original.items.length} item${row.original.items.length > 1 ? "s" : ""} · ${tasks} task${tasks === 1 ? "" : "s"}`}
        />
      )
    },
    meta: { width: "min-w-64 max-w-md", skeleton: "w-56" },
  }),
  col.accessor("requestedForId", {
    id: "requestedFor",
    header: "Requested for",
    cell: ({ getValue }) => <UserChip userId={getValue()} />,
    enableSorting: false,
    meta: { width: "w-44", skeleton: "w-32" },
  }),
  col.accessor("state", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-36", label: "State", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("stage", {
    header: "Stage",
    cell: ({ getValue }) => <TruncatedText muted>{getValue()}</TruncatedText>,
    enableSorting: false,
    meta: { width: "w-40", skeleton: "w-24" },
  }),
  col.accessor("approval", {
    header: "Approval",
    cell: ({ getValue }) => <StateBadge state={getValue()} dot={false} />,
    enableSorting: false,
    meta: { width: "w-36", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("price", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ getValue }) =>
      getValue() === 0 ? (
        <span className="block text-right text-muted-foreground">Free</span>
      ) : (
        <NumericCell value={getValue()} format={(n) => formatCurrency(n)} />
      ),
    meta: { width: "w-24", numeric: true, label: "Price", skeleton: "w-14" },
  }),
  col.accessor("opened", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Opened" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Opened", skeleton: "w-16" },
  }),
  col.accessor("dueDate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Due" />
    ),
    cell: ({ getValue, row }) => {
      const overdue =
        !row.original.state.startsWith("Closed") && new Date(getValue()) < NOW
      return <DateCell value={getValue()} tone={overdue ? "danger" : "muted"} />
    },
    meta: { width: "w-28", label: "Due", skeleton: "w-16" },
  }),
])

const facets: FacetDef<Request>[] = [
  {
    id: "state",
    title: "State",
    options: requestStates.map((s) => ({ label: s, value: s })),
    getValue: (r) => r.state,
  },
  {
    id: "stage",
    title: "Stage",
    options: [
      "Waiting for Approval",
      "Fulfillment",
      "Delivery",
      "Completed",
      "Cancelled",
    ].map((s) => ({ label: s, value: s })),
    getValue: (r) => r.stage,
  },
  {
    id: "category",
    title: "Category",
    options: [
      "Hardware",
      "Software",
      "Access & Accounts",
      "Cloud & Infrastructure",
      "Collaboration",
      "HR Services",
      "Facilities",
    ].map((c) => ({ label: c, value: c })),
    getValue: (r) =>
      getCatalogItem(r.items[0].catalogItemId)?.category ?? "Other",
  },
]

export function RequestsTable() {
  return (
    <DataTable
      columns={columns}
      data={requests}
      getRowId={(r) => r.number}
      getSearchText={(r) =>
        `${r.number} ${r.items.map((i) => `${i.number} ${getCatalogItem(i.catalogItemId)?.name}`).join(" ")}`
      }
      searchPlaceholder="Search requests, RITMs…"
      facets={facets}
      initialSorting={[{ id: "opened", desc: true }]}
      initialColumnVisibility={{ approval: false }}
      rowHref={(r) => `/itsm/requests/${r.number}`}
      totalLabel="requests"
      emptyAction={
        <Button
          size="sm"
          variant="outline"
          render={<Link href="/itsm/catalog" />}
        >
          <ShoppingBagIcon /> Browse catalog
        </Button>
      }
      toolbar={
        <Button size="sm" render={<Link href="/itsm/catalog" />}>
          <ShoppingBagIcon /> Browse catalog
        </Button>
      }
    />
  )
}
