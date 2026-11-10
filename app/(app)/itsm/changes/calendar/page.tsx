import type { Metadata } from "next"
import Link from "next/link"
import { ListIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { ChangeCalendar } from "@/features/changes/change-calendar"

export const metadata: Metadata = { title: "Change calendar" }

export default function ChangeCalendarPage() {
  return (
    <>
      <PageHeader
        title="Change calendar"
        description="Planned implementation windows across all assignment groups. Spot conflicts and freeze windows before authorizing a change."
        actions={
          <>
            <Button variant="outline" render={<Link href="/itsm/changes" />}>
              <ListIcon /> List view
            </Button>
            <Button render={<Link href="/itsm/changes?new=1" />}>
              <PlusIcon /> New change
            </Button>
          </>
        }
      />
      <ChangeCalendar />
    </>
  )
}
