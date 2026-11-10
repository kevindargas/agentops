import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { UserActions } from "@/features/admin/user-actions"
import { UsersStats, UsersTabs } from "@/features/admin/users-tabs"

export const metadata: Metadata = { title: "Users & Groups" }

export default function UsersPage() {
  return (
    <>
      <PageHeader
        nav="/admin/users"
        description="People, assignment groups and roles. Groups route work; roles control what users can see and do."
        actions={<UserActions />}
      />
      <UsersStats />
      <UsersTabs />
    </>
  )
}
