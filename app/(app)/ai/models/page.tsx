import type { Metadata } from "next"
import Link from "next/link"
import { LayersIcon } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import {
  ModelCatalog,
  ModelCatalogActions,
} from "@/features/ai/model-catalog/model-catalog"
import { fetchCatalog } from "@/lib/ai/openrouter.server"

export const metadata: Metadata = { title: "Model Catalog" }

export default async function ModelCatalogPage() {
  const { models, fetchedAt, error } = await fetchCatalog()
  return (
    <>
      <PageHeader
        eyebrow="AI · Model Catalog"
        icon={<LayersIcon />}
        title="Model Catalog"
        meta={
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <span
              className={
                error
                  ? "size-1.5 rounded-full bg-warning"
                  : "size-1.5 rounded-full bg-success"
              }
            />
            {error ? "Cached" : "Live"} · OpenRouter
          </Badge>
        }
        description="Every model reachable through OpenRouter, with context windows, pricing per million tokens and capability flags. Pick one here to use it in AgentOps Assist, or compare it against the curated defaults."
        breadcrumb={
          <nav className="flex items-center gap-1.5">
            <Link href="/ai">AI Control Center</Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">Model Catalog</span>
          </nav>
        }
        actions={<ModelCatalogActions />}
      />
      <ModelCatalog models={models} fetchedAt={fetchedAt} error={error} />
    </>
  )
}
