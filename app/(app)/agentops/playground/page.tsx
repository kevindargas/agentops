import type { Metadata } from "next"
import { Suspense } from "react"
import { SlidersHorizontalIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Playground } from "@/features/agentops/playground/playground"

export const metadata: Metadata = { title: "Playground" }

export default function PlaygroundPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agent Operations"
        icon={<SlidersHorizontalIcon />}
        title="Playground"
        description="Tune generation parameters against a deployed agent, run scripted probes, compare two configurations side by side and promote the winner as a prompt version or an experiment."
      />
      <Suspense fallback={<PlaygroundSkeleton />}>
        <Playground />
      </Suspense>
    </>
  )
}

function PlaygroundSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Skeleton className="h-[32rem] rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
