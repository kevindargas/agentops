import {
  normalizeModel,
  OPENROUTER_MODELS_URL,
  type CatalogResult,
  type RawModel,
} from "./openrouter"

/** Give up on OpenRouter after this long so a slow endpoint cannot stall a build or a request. */
export const CATALOG_FETCH_TIMEOUT_MS = 10_000

/** True when `next build` runs with `STATIC_EXPORT=1` (see `next.config.ts`). */
const isStaticExport = process.env.STATIC_EXPORT === "1"

/**
 * Server-only. In server mode the response sits in the fetch data cache for
 * an hour so the page stays fast and we never hammer the public endpoint. In
 * a static export there is no runtime and ISR is unsupported, so the fetch
 * runs once during the build and the page ships that snapshot; `revalidate`
 * is left out because the export build rejects it. Either way a failure
 * degrades to an empty catalog with the error message. Kept separate from
 * `openrouter.ts` so client components can import the types and formatters
 * without pulling server APIs into the browser bundle.
 */
export async function fetchCatalog(): Promise<CatalogResult> {
  const fetchedAt = new Date().toISOString()
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      ...(isStaticExport ? {} : { next: { revalidate: 3600 } }),
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
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
