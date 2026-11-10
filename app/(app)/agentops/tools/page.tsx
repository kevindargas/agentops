import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { ToolsRegistry } from "@/features/agentops/tools/tools-registry"

export const metadata: Metadata = { title: "Tools & MCP" }

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/tools"
        description="Every capability an agent can call, the MCP servers that supply them and the per-agent permission matrix: where a tool comes from, how risky it is, who may call it and how it is performing. Policies here bound the blast radius of a bad turn; the prompt does not."
      />
      <Suspense fallback={<TableSkeleton columns={8} />}>
        <ToolsRegistry />
      </Suspense>
    </>
  )
}
