import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { StatusDot } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  ModelCatalog,
  ModelCatalogActions,
} from "@/features/ai/model-catalog/model-catalog"
import { fetchCatalog } from "@/lib/ai/openrouter.server"

export const metadata: Metadata = { title: "Model Catalog" }

/**
 * In a static export (GitHub Pages) the OpenRouter fetch runs once during the
 * build, so the page shows a snapshot rather than live data.
 */
const isSnapshot = process.env.STATIC_EXPORT === "1"

export default async function ModelCatalogPage() {
  const { models, fetchedAt, error } = await fetchCatalog()
  return (
    <>
      <PageHeader
        nav="/ai/models"
        meta={
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <StatusDot
              tone={error ? "warning" : "success"}
              label={error ? "Fetch failed" : isSnapshot ? "Snapshot" : "Live"}
            />
            {error ? "Unavailable" : isSnapshot ? "Build snapshot" : "Live"} ·
            OpenRouter
          </Badge>
        }
        description={`Every model reachable through OpenRouter, with context windows, pricing per million tokens and capability flags. Pick one here to use it in AgentOps Assist, or compare it against the curated defaults.${isSnapshot ? " This deployment is a static export, so the list is a snapshot taken when the site was last built." : ""}`}
        actions={<ModelCatalogActions />}
      />
      <ModelCatalog models={models} fetchedAt={fetchedAt} error={error} />
    </>
  )
}
