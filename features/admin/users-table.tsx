"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import {
  MoreHorizontalIcon,
  UserCheckIcon,
  UserMinusIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { initials, type Role } from "@/lib/data/users"
import { InviteUserSheet } from "./user-actions"
import {
  groupCountOf,
  groupsStore,
  roles,
  rolesOf,
  statusOf,
  userStatuses,
  usersStore,
  type AdminUser,
} from "./users-store"

const col = createColumnHelper<DataTableFeatures, AdminUser>()

type RowActions = {
  onDeactivate: (ids: string[], clear?: () => void) => void
  onReactivate: (user: AdminUser) => void
  onEditRoles: (user: AdminUser) => void
  onAddToGroup: (ids: string[], clear?: () => void) => void
}

const plural = (n: number) => `${n} user${n === 1 ? "" : "s"}`

function buildColumns(actions: RowActions) {
  return col.columns([
    selectColumn<AdminUser>(),
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
                <Badge variant="outline" className="h-4 shrink-0 px-1 text-3xs">
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
      meta: {
        width: "w-36",
        label: "Department",
        skeleton: "w-20 rounded-full",
      },
    }),
    col.accessor("location", {
      header: "Location",
      cell: ({ getValue }) => <TruncatedText muted>{getValue()}</TruncatedText>,
      enableSorting: false,
      meta: { width: "w-40 max-w-48", skeleton: "w-24" },
    }),
    col.accessor((row) => rolesOf(row).join(" "), {
      id: "roles",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Roles"
          hint="Platform roles; derived from department until edited"
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {rolesOf(row.original).map((r) => (
            <Badge key={r} variant="outline" className="font-mono text-3xs">
              {r}
            </Badge>
          ))}
        </div>
      ),
      enableSorting: false,
      meta: { width: "w-40", skeleton: "w-24 rounded-full" },
    }),
    col.accessor((row) => groupCountOf(row), {
      id: "groups",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Groups"
          hint="Groups the user manages or belongs to"
        />
      ),
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
      meta: { width: "w-20", numeric: true, label: "Groups", skeleton: "w-6" },
    }),
    col.accessor((row) => statusOf(row), {
      id: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ getValue }) => <StateBadge state={getValue()} />,
      meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
    }),
    col.display({
      id: "actions",
      cell: ({ row }) => {
        const u = row.original
        const deactivated = statusOf(u) === "Deactivated"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Actions for ${u.name}`}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => actions.onEditRoles(u)}>
                Edit roles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onAddToGroup([u.id])}>
                Add to group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {deactivated ? (
                <DropdownMenuItem onClick={() => actions.onReactivate(u)}>
                  Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => actions.onDeactivate([u.id])}
                >
                  Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: actionsColumnMeta,
    }),
  ])
}

export function UsersTable() {
  const list = usersStore.use()
  const groups = groupsStore.use()
  const [pendingDeactivate, setPendingDeactivate] = React.useState<{
    ids: string[]
    clear?: () => void
  } | null>(null)
  const [rolesTarget, setRolesTarget] = React.useState<AdminUser | null>(null)
  const [roleDraft, setRoleDraft] = React.useState<Role[]>([])
  const [groupTarget, setGroupTarget] = React.useState<{
    ids: string[]
    clear?: () => void
  } | null>(null)
  const [groupId, setGroupId] = React.useState(groups[0]?.id ?? "")

  const columns = buildColumns({
    onDeactivate: (ids, clear) => setPendingDeactivate({ ids, clear }),
    onReactivate: (u) => {
      usersStore.patch(u.id, { status: "Active" })
      toast.success(`${u.name} reactivated`)
    },
    onEditRoles: (u) => {
      setRolesTarget(u)
      setRoleDraft(rolesOf(u))
    },
    onAddToGroup: (ids, clear) => setGroupTarget({ ids, clear }),
  })

  const facets = React.useMemo<FacetDef<AdminUser>[]>(
    () => [
      {
        id: "department",
        title: "Department",
        options: Array.from(new Set(list.map((u) => u.department)))
          .sort()
          .map((d) => ({ label: d, value: d })),
        getValue: (r) => r.department,
      },
      {
        id: "location",
        title: "Location",
        options: Array.from(new Set(list.map((u) => u.location)))
          .sort()
          .map((l) => ({ label: l, value: l })),
        getValue: (r) => r.location,
      },
      {
        id: "status",
        title: "Status",
        options: userStatuses.map((s) => ({ label: s, value: s })),
        getValue: (r) => statusOf(r),
      },
      {
        id: "role",
        title: "Role",
        options: roles.map((r) => ({ label: r, value: r })),
        getValue: (r) => rolesOf(r),
      },
    ],
    [list]
  )

  function confirmDeactivate() {
    if (!pendingDeactivate) return
    for (const id of pendingDeactivate.ids)
      usersStore.patch(id, { status: "Deactivated" })
    pendingDeactivate.clear?.()
    const names = list.filter((u) => pendingDeactivate.ids.includes(u.id))
    toast(
      names.length === 1
        ? `${names[0].name} deactivated`
        : `${plural(names.length)} deactivated`,
      {
        description:
          "Deactivated users keep their history and no longer receive work.",
      }
    )
    setPendingDeactivate(null)
  }

  function saveRoles() {
    if (!rolesTarget) return
    usersStore.patch(rolesTarget.id, { roleOverride: roleDraft })
    toast.success(`Roles updated for ${rolesTarget.name}`, {
      description: roleDraft.length ? roleDraft.join(", ") : "No roles",
    })
    setRolesTarget(null)
  }

  function addToGroup() {
    if (!groupTarget || !groupId) return
    const group = groups.find((g) => g.id === groupId)
    for (const id of groupTarget.ids)
      usersStore.patch(id, (u) => ({
        ...u,
        extraGroupIds: Array.from(
          new Set([...(u.extraGroupIds ?? []), groupId])
        ),
      }))
    groupsStore.patch(groupId, (g) => ({
      ...g,
      members: g.members + groupTarget.ids.length,
    }))
    groupTarget.clear?.()
    toast.success(
      `${plural(groupTarget.ids.length)} added to ${group?.name ?? "group"}`
    )
    setGroupTarget(null)
  }

  const deactivateNames = pendingDeactivate
    ? list.filter((u) => pendingDeactivate.ids.includes(u.id))
    : []

  return (
    <>
      <DataTable
        columns={columns}
        data={list}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.email} ${r.title} ${r.department} ${r.location} ${rolesOf(r).join(" ")}`
        }
        searchPlaceholder="Search people…"
        facets={facets}
        initialSorting={[{ id: "name", desc: false }]}
        totalLabel="users"
        caption="Users"
        selectionLabel={(n) => (n === 1 ? "user" : "users")}
        toolbar={<InviteUserSheet size="sm" />}
        bulkActions={(rows, clear) => {
          const ids = rows.map((r) => r.original.id)
          return (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGroupTarget({ ids, clear })}
              >
                <UsersIcon /> Add to group
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger-text hover:text-danger-text"
                onClick={() => setPendingDeactivate({ ids, clear })}
              >
                <UserMinusIcon /> Deactivate
              </Button>
            </>
          )
        }}
      />

      <AlertDialog
        open={Boolean(pendingDeactivate)}
        onOpenChange={(o) => !o && setPendingDeactivate(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate{" "}
              {deactivateNames.length === 1
                ? deactivateNames[0].name
                : plural(deactivateNames.length)}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deactivated users cannot sign in and drop out of assignment and
              approval routing. Open work stays assigned until someone reassigns
              it. You can reactivate from the row menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeactivate}
            >
              <UserMinusIcon /> Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(rolesTarget)}
        onOpenChange={(o) => !o && setRolesTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>
              {rolesTarget?.name} · roles apply immediately in this session.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2 sm:grid-cols-2">
            {roles.map((r) => {
              const id = `role-${r}`
              const checked = roleDraft.includes(r)
              return (
                <li key={r} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(c) =>
                      setRoleDraft((prev) =>
                        c ? [...prev, r] : prev.filter((x) => x !== r)
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-mono text-xs">
                    {r}
                  </Label>
                </li>
              )
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveRoles}>
              <UserCheckIcon /> Save roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(groupTarget)}
        onOpenChange={(o) => !o && setGroupTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to group</DialogTitle>
            <DialogDescription>
              {groupTarget ? plural(groupTarget.ids.length) : ""} will be
              counted as members of the selected group.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-to-group">Group</Label>
            <Select
              value={groupId}
              onValueChange={(v) => v && setGroupId(v)}
              items={groups.map((g) => ({ value: g.id, label: g.name }))}
            >
              <SelectTrigger id="add-to-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupTarget(null)}>
              Cancel
            </Button>
            <Button onClick={addToGroup} disabled={!groupId}>
              <UsersIcon /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
