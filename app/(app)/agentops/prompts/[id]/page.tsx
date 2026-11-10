import type { Metadata } from "next"
import { Suspense } from "react"

import { RecordSkeleton } from "@/components/shared/skeletons"
import { PromptRecord } from "@/features/agentops/prompts/prompt-record"
import { getPrompt } from "@/lib/data/prompts"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: getPrompt(id)?.name ?? id }
}

/**
 * The record itself is a client component reading the shared prompt store, so
 * prompts and versions created in this session resolve and promotions move
 * the header. Unknown ids render the not-found card inside the client view.
 */
export default async function PromptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <PromptRecord id={id} />
    </Suspense>
  )
}
