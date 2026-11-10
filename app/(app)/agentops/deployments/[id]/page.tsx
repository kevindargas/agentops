import type { Metadata } from "next"

import { RecordNotFound } from "@/components/record/record-not-found"
import { ReleaseRecord } from "@/features/agentops/deployments/release-record"
import { getDeployedAgent } from "@/lib/data"
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

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const release = getRelease(id)
  if (!release)
    return (
      <RecordNotFound
        number={id}
        backHref="/agentops/deployments"
        backLabel="deployments"
      />
    )
  return <ReleaseRecord key={release.id} release={release} />
}
