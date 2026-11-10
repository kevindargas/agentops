import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import {
  ControlCenter,
  ControlCenterActions,
} from "@/features/ai/control-center"

export const metadata: Metadata = { title: "AI Control Center" }

export default function AiPage() {
  return (
    <>
      <PageHeader
        title="AI Control Center"
        description="Autonomous agents work alongside your teams. Set how much they may do on their own, approve what they propose, and audit every action they take."
        actions={<ControlCenterActions />}
      />
      <ControlCenter />
    </>
  )
}
