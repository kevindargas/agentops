import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import {
  ControlCenter,
  ControlCenterActions,
} from "@/features/ai/control-center"

export const metadata: Metadata = { title: "Workflow Automations" }

export default function AiPage() {
  return (
    <>
      <PageHeader
        nav="/ai"
        description="Internal workflow agents that work alongside your teams. Set how much each may do on its own, approve what they propose and review their runs; the guardrails here also apply to AgentOps Assist."
        actions={<ControlCenterActions />}
      />
      <ControlCenter />
    </>
  )
}
