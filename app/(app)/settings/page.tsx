import type { Metadata } from "next"
import Link from "next/link"
import { UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import {
  SettingsForm,
  type SettingsSection,
} from "@/features/admin/settings-form"

export const metadata: Metadata = { title: "Settings" }

const validSections = new Set<string>([
  "profile",
  "appearance",
  "notifications",
  "security",
  "platform",
  "danger",
])

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; section?: string }>
}) {
  const { tab, section } = await searchParams
  const requested = section ?? tab
  const initialSection = (
    requested && validSections.has(requested) ? requested : "profile"
  ) as SettingsSection
  return (
    <>
      <PageHeader
        title="Settings"
        description="Personal preferences and platform configuration. Personal changes apply immediately; platform changes are audited."
        actions={
          <Button variant="outline" render={<Link href="/admin/users" />}>
            <UsersIcon /> Users & groups
          </Button>
        }
      />
      <SettingsForm initialSection={initialSection} />
    </>
  )
}
