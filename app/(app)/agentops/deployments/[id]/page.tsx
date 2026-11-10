import type { Metadata } from "next"

import { ReleaseRecord } from "@/features/agentops/deployments/release-record"
import { getDeployedAgent } from "@/lib/data/agentops"
import { getRelease } from "@/lib/data/deployments"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const release = getRelease(id)
  if (!release) return { title: id }
  const agent = getDeployedAgent(release.agentId)
  return { title: `${release.id} · ${agent?.name ?? ""} ${release.version}` }
}

/**
 * Seeded releases render from the data module; releases drafted in this
 * session exist only in the client release store, so the record component
 * resolves the id itself and shows the not-found state when neither has it.
 */
export default async function ReleasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ReleaseRecord key={id} id={id} initial={getRelease(id)} />
}
