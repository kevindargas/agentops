import type { Metadata } from "next"
import Link from "next/link"
import { ActivityIcon, RouteIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { FleetOverview } from "@/features/agentops/fleet-overview"
import { RegisterAgentButton } from "@/features/agentops/register-agent-button"

export const metadata: Metadata = { title: "Fleet Overview" }

export default function AgentOpsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<ActivityIcon />}
        title="Fleet Overview"
        description="Every deployed agent, treated like a production service: traffic, latency, cost and evaluator quality against a baseline, with drift, experiments and human review feeding back into what ships."
        actions={
          <>
            <Button variant="outline" render={<Link href="/agentops/traces" />}>
              <RouteIcon /> Explore traces
            </Button>
            <RegisterAgentButton />
          </>
        }
      />
      <FleetOverview />
    </>
  )
}
