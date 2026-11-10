import type { Metadata } from "next"
import { BotIcon, GitForkIcon, WavesIcon, ZapIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { AgentsTable } from "@/features/agentops/agents-table"
import { RegisterAgentButton } from "@/features/agentops/register-agent-button"
import { deployedAgents } from "@/lib/data"
import { formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Agents" }

export default function AgentsPage() {
  const prod = deployedAgents.filter((a) => a.environment === "production")
  const langgraph = deployedAgents.filter(
    (a) => a.framework === "LangGraph"
  ).length
  const drifting = deployedAgents.filter(
    (a) => a.health === "Drifting" || a.health === "Degraded"
  ).length
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        title="Agents"
        description="Deployed agents with their graph, model, tools, owner and live health. Click an agent for versions, traces, evaluations and recommendations."
        actions={<RegisterAgentButton />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Deployed"
          value={deployedAgents.length}
          icon={<BotIcon />}
          hint={`${prod.length} production · ${deployedAgents.length - prod.length} staging`}
        />
        <StatCard
          label="LangGraph"
          value={langgraph}
          icon={<GitForkIcon />}
          hint={`${deployedAgents.filter((a) => a.framework === "LangChain").length} LangChain · ${deployedAgents.filter((a) => a.framework === "Custom").length} custom`}
        />
        <StatCard
          label="Requests · 24h"
          value={formatNumber(
            prod.reduce((s, a) => s + a.metrics.requests24h, 0),
            true
          )}
          icon={<ZapIcon />}
          hint="Across production agents"
        />
        <StatCard
          label="Needs attention"
          value={drifting}
          upIsGood={false}
          icon={<WavesIcon />}
          hint="Drifting or degraded"
        />
      </div>
      <AgentsTable />
    </>
  )
}
