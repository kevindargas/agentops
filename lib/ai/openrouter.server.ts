import {
  normalizeModel,
  OPENROUTER_MODELS_URL,
  type CatalogResult,
  type RawModel,
} from "./openrouter"

/**
 * Server-only. Cached for an hour via the fetch data cache so the page stays
 * fast and we never hammer the public endpoint. Kept separate from
 * `openrouter.ts` so client components can import the types and formatters
 * without pulling server APIs into the browser bundle.
 */
export async function fetchCatalog(): Promise<CatalogResult> {
  const fetchedAt = new Date().toISOString()
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      next: { revalidate: 3600 },
      headers: { accept: "application/json" },
    })
    if (!res.ok)
      return {
        models: [],
        fetchedAt,
        error: `OpenRouter responded with ${res.status} ${res.statusText}`,
      }
    const json = (await res.json()) as { data?: RawModel[] }
    const models = (json.data ?? [])
      .map(normalizeModel)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { models, fetchedAt }
  } catch (err) {
    return {
      models: [],
      fetchedAt,
      error: err instanceof Error ? err.message : "Could not reach OpenRouter",
    }
  }
}
