import { Suspense } from "react"
import type { Metadata } from "next"
import { WrenchIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { ToolsRegistry } from "@/features/agentops/tools/tools-registry"

export const metadata: Metadata = { title: "Tools & MCP Servers" }

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<WrenchIcon />}
        title="Tools & MCP Servers"
        description="Every capability an agent can call: where it comes from, how risky it is, who may call it and how it is performing. Policies here bound the blast radius of a bad turn — the prompt does not."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-5">
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        <ToolsRegistry />
      </Suspense>
    </>
  )
}
