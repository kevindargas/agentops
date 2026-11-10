import type { Metadata } from "next"
import Link from "next/link"
import {
  CalendarClockIcon,
  GitBranchIcon,
  HistoryIcon,
  PackageIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ApprovalsList } from "@/features/workspace/approvals-list"
import { approvals, getChange, NOW } from "@/lib/data"

export const metadata: Metadata = { title: "Approvals" }

export default function ApprovalsPage() {
  const changeApprovals = approvals.filter((a) => a.recordType === "Change")
  const requestApprovals = approvals.filter((a) => a.recordType === "Request")
  const dueSoon = approvals.filter(
    (a) => new Date(a.due).getTime() - NOW.getTime() < 36 * 3_600_000
  ).length
  const highRisk = changeApprovals.filter((a) => {
    const risk = getChange(a.recordNumber)?.risk
    return risk === "High" || risk === "Very High"
  }).length
  return (
    <>
      <PageHeader
        title="Approvals"
        description={`${approvals.length} record${approvals.length === 1 ? " is" : "s are"} waiting for your decision. Approving a change schedules it; approving a request starts fulfillment.`}
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/itsm/changes?view=cab" />}
            >
              <CalendarClockIcon /> CAB agenda
            </Button>
            <Button variant="outline">
              <HistoryIcon /> Decision history
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending"
          value={approvals.length}
          icon={<ShieldCheckIcon />}
          hint="Routed to you as approver"
        />
        <StatCard
          label="Due within 36h"
          value={dueSoon}
          upIsGood={false}
          icon={<CalendarClockIcon />}
          hint="Decide soon to keep work moving"
        />
        <StatCard
          label="Changes"
          value={changeApprovals.length}
          icon={<GitBranchIcon />}
          hint={`${highRisk} high or very high risk`}
        />
        <StatCard
          label="Requests"
          value={requestApprovals.length}
          icon={<PackageIcon />}
          hint="Catalog items awaiting manager approval"
        />
      </div>
      <ApprovalsList />
    </>
  )
}
