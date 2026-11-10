import { Suspense } from "react"
import type { Metadata } from "next"
import {
  CrownIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { UserChip } from "@/components/shared/user-chip"
import { UsersTable } from "@/features/admin/users-table"
import { groups, users } from "@/lib/data"

export const metadata: Metadata = { title: "Users & Groups" }

const groupTypeLabel: Record<(typeof groups)[number]["type"], string> = {
  itil: "ITIL",
  fulfillment: "Fulfillment",
  approval: "Approval",
  hr: "HR",
  cab: "CAB",
}

export default function UsersPage() {
  const departments = new Set(users.map((u) => u.department)).size
  const managers = new Set(groups.map((g) => g.manager)).size
  const seats = groups.reduce((a, g) => a + g.members, 0)
  return (
    <>
      <PageHeader
        title="Users & Groups"
        description="People, assignment groups and roles. Groups route work; roles control what users can see and do."
        actions={
          <>
            <Button variant="outline">
              <UsersRoundIcon /> New group
            </Button>
            <Button>
              <UserPlusIcon /> Invite user
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={users.length}
          icon={<UsersIcon />}
          hint={`Across ${departments} departments`}
        />
        <StatCard
          label="VIPs"
          value={users.filter((u) => u.vip).length}
          icon={<CrownIcon />}
          hint="Prioritized routing and notifications"
        />
        <StatCard
          label="Assignment groups"
          value={groups.length}
          icon={<UsersRoundIcon />}
          hint={`${seats} memberships · ${managers} managers`}
        />
        <StatCard
          label="Roles"
          value={7}
          icon={<ShieldIcon />}
          hint="admin, itil, approver, hr_agent…"
        />
      </div>
      <Tabs defaultValue="users" className="gap-4">
        <TabsList>
          <TabsTrigger value="users">
            Users{" "}
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {users.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="groups">
            Groups{" "}
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {groups.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <UsersTable />
          </Suspense>
        </TabsContent>
        <TabsContent value="groups">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <UsersRoundIcon className="size-4" />
                      </div>
                      <CardTitle className="leading-tight">{g.name}</CardTitle>
                    </div>
                    <Badge variant="secondary">{groupTypeLabel[g.type]}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {g.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between border-t pt-4 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    Manager <UserChip userId={g.manager} size="xs" />
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {g.members} members
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
