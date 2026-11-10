import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { Playground } from "@/features/agentops/playground/playground"
import { PlaygroundSkeleton } from "@/features/agentops/playground/playground-skeleton"

export const metadata: Metadata = { title: "Playground" }

export default function PlaygroundPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/playground"
        description="Tune generation parameters against a deployed agent, run scripted probes, compare two configurations side by side and save the winner as a prompt version. Deep links: ?agent=<agt-id> picks the agent, ?pv=<p-N> the prompt version."
      />
      <Suspense fallback={<PlaygroundSkeleton />}>
        <Playground />
      </Suspense>
    </>
  )
}
