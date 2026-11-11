import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { SettingsView } from "@/features/admin/settings-view"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        nav="/settings"
        description="Personal preferences and platform configuration. Personal changes apply immediately; platform changes are audited."
        actions={
          <Button variant="outline" render={<Link href="/admin/users" />}>
            <UsersIcon /> Users & Groups
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton toolbar={false} />}>
        <SettingsView />
      </Suspense>
    </>
  )
}
