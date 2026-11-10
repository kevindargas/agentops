import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import {
  ApprovalsList,
  DecisionHistoryButton,
} from "@/features/workspace/approvals-list"
import { ApprovalsStats } from "@/features/workspace/approvals-stats"

export const metadata: Metadata = { title: "Approvals" }

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader
        nav="/approvals"
        description="Changes and requests waiting for your decision. Approving a change schedules it; approving a request starts fulfillment. Decisions are shared with the record pages in this session."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/itsm/changes?view=cab" />}
            >
              <CalendarClockIcon /> CAB agenda
            </Button>
            <DecisionHistoryButton />
          </>
        }
      />
      <ApprovalsStats />
      <ApprovalsList />
    </>
  )
}
