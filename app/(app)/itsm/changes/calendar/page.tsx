import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ListIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { ChangeCalendar } from "@/features/changes/change-calendar"
import { NewChangeSheet } from "@/features/changes/new-change-sheet"

export const metadata: Metadata = { title: "Change Calendar" }

export default function ChangeCalendarPage() {
  return (
    <>
      <PageHeader
        nav="/itsm/changes/calendar"
        title="Change Calendar"
        description="Planned implementation windows across all assignment groups. Spot conflicts and freeze windows before authorizing a change."
        actions={
          <>
            <Button variant="outline" render={<Link href="/itsm/changes" />}>
              <ListIcon /> List view
            </Button>
            <Suspense fallback={<Skeleton className="h-8 w-32" />}>
              <NewChangeSheet />
            </Suspense>
          </>
        }
      />
      <ChangeCalendar />
    </>
  )
}
