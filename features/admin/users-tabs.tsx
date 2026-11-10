"use client"

import { Suspense } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CountPill } from "@/components/shared/count-pill"
import { TableSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { GroupsGrid } from "./groups-grid"
import { groupsStore, roles, statusOf, usersStore } from "./users-store"
import { UsersTable } from "./users-table"

/** KPI row for Users & Groups, read from the shared stores so invites and new groups move the numbers. */
export function UsersStats() {
  const users = usersStore.use()
  const groups = groupsStore.use()
  const departments = new Set(users.map((u) => u.department)).size
  const managers = new Set(groups.map((g) => g.manager)).size
  const seats = groups.reduce((a, g) => a + g.members, 0)
  const pending = users.filter((u) => statusOf(u) === "Pending").length
  const deactivated = users.filter((u) => statusOf(u) === "Deactivated").length
  return (
    <StatGrid columns={4}>
      <StatCard
        label="Users"
        value={users.length}
        hint={`Across ${departments} departments${pending ? ` · ${pending} pending` : ""}${deactivated ? ` · ${deactivated} deactivated` : ""}`}
      />
      <StatCard
        label="VIPs"
        value={users.filter((u) => u.vip).length}
        hint="Prioritized routing and notifications"
      />
      <StatCard
        label="Assignment groups"
        value={groups.length}
        hint={`${seats} memberships · ${managers} managers`}
      />
      <StatCard
        label="Roles"
        value={roles.length}
        hint={`${roles.slice(0, 4).join(", ")} and ${roles.length - 4} more`}
      />
    </StatGrid>
  )
}

/** Users / Groups tabs with live counts. */
export function UsersTabs() {
  const users = usersStore.use()
  const groups = groupsStore.use()
  return (
    <Tabs defaultValue="users" className="gap-4">
      <TabsList>
        <TabsTrigger value="users">
          Users <CountPill count={users.length} label="users" />
        </TabsTrigger>
        <TabsTrigger value="groups">
          Groups <CountPill count={groups.length} label="groups" />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <Suspense fallback={<TableSkeleton columns={6} />}>
          <UsersTable />
        </Suspense>
      </TabsContent>
      <TabsContent value="groups">
        <GroupsGrid />
      </TabsContent>
    </Tabs>
  )
}
