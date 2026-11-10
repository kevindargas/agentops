"use client"

import { createColumnHelper } from "@tanstack/react-table"
import {
  MoreHorizontalIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  actionsColumnMeta,
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  selectColumn,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StateBadge } from "@/components/shared/status-badge"
import { groups, initials, users } from "@/lib/data"
import type { User } from "@/lib/types"

const col = createColumnHelper<DataTableFeatures, User>()

const rolesFor = (u: User) =>
  u.id === "u-001"
    ? ["admin", "itil"]
    : u.department === "IT"
      ? ["itil"]
      : u.department === "People"
        ? ["hr_agent"]
        : ["employee"]

const groupCountFor = (u: User) =>
  groups.filter((g) => g.manager === u.id).length ||
  (u.department === "IT" ? 1 : 0)
const statusFor = (u: User) =>
  u.title.startsWith("New Hire") ? "Pending" : "Active"

const columns = col.columns([
  selectColumn<User>(),
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="inline-flex min-w-0 items-center gap-2.5">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-brand/10 text-xs font-medium text-brand">
            {initials(row.original.name)}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium" title={row.original.name}>
              {row.original.name}
            </span>
            {row.original.vip && (
              <Badge
                variant="outline"
                className="h-4 shrink-0 px-1 text-[10px]"
              >
                VIP
              </Badge>
            )}
          </span>
          <span
            className="truncate text-xs text-muted-foreground"
            title={row.original.email}
          >
            {row.original.email}
          </span>
        </span>
      </span>
    ),
    enableHiding: false,
    meta: { width: "min-w-60 max-w-sm", label: "Name", skeleton: "w-48" },
  }),
  col.accessor("title", {
    header: "Title",
    cell: ({ getValue }) => <TruncatedText>{getValue()}</TruncatedText>,
    enableSorting: false,
    meta: { width: "w-48 max-w-56", skeleton: "w-32" },
  }),
  col.accessor("department", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Department" />
    ),
    cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
    meta: { width: "w-36", label: "Department", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("location", {
    header: "Location",
    cell: ({ getValue }) => <TruncatedText muted>{getValue()}</TruncatedText>,
    enableSorting: false,
    meta: { width: "w-40 max-w-48", skeleton: "w-24" },
  }),
  col.accessor((row) => rolesFor(row).join(" "), {
    id: "roles",
    header: "Roles",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {rolesFor(row.original).map((r) => (
          <Badge key={r} variant="outline" className="font-mono text-[10px]">
            {r}
          </Badge>
        ))}
      </div>
    ),
    enableSorting: false,
    meta: { width: "w-40", skeleton: "w-24 rounded-full" },
  }),
  col.accessor((row) => groupCountFor(row), {
    id: "groups",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Groups" />
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} />,
    meta: { width: "w-20", numeric: true, label: "Groups", skeleton: "w-6" },
  }),
  col.accessor((row) => statusFor(row), {
    id: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
    meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
  }),
  col.display({
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for ${row.original.name}`}
              className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => toast(`Impersonating ${row.original.name}`)}
          >
            Impersonate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.success("Password reset email sent")}
          >
            Reset password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast("Role editor opened")}>
            Edit roles
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => toast(`${row.original.name} deactivated`)}
          >
            Deactivate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: actionsColumnMeta,
  }),
])

const facets: FacetDef<User>[] = [
  {
    id: "department",
    title: "Department",
    options: Array.from(new Set(users.map((u) => u.department)))
      .sort()
      .map((d) => ({ label: d, value: d })),
    getValue: (r) => r.department,
  },
  {
    id: "location",
    title: "Location",
    options: Array.from(new Set(users.map((u) => u.location)))
      .sort()
      .map((l) => ({ label: l, value: l })),
    getValue: (r) => r.location,
  },
  {
    id: "status",
    title: "Status",
    options: ["Active", "Pending"].map((s) => ({ label: s, value: s })),
    getValue: (r) => statusFor(r),
  },
]

export function UsersTable() {
  return (
    <DataTable
      columns={columns}
      data={users}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.name} ${r.email} ${r.title} ${r.department} ${r.location}`
      }
      searchPlaceholder="Search people…"
      facets={facets}
      initialSorting={[{ id: "name", desc: false }]}
      totalLabel="users"
      selectionLabel={(n) => (n === 1 ? "user" : "users")}
      toolbar={
        <Button size="sm" onClick={() => toast("Invite dialog opened")}>
          <UserPlusIcon /> Invite user
        </Button>
      }
      bulkActions={(rows, clear) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast("Group picker opened")
              clear()
            }}
          >
            <UsersIcon /> Add to group
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              toast(
                `${rows.length} user${rows.length === 1 ? "" : "s"} deactivated`
              )
              clear()
            }}
          >
            <UserMinusIcon /> Deactivate
          </Button>
        </>
      )}
    />
  )
}
