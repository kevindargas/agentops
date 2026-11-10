/**
 * Derives the warm-up route list from the file system so it can never go
 * stale: every `page.tsx` under `app/(app)` becomes a route. Dynamic
 * segments (`[id]`, `[number]`) are substituted with a known sample id per
 * parent route; segments without a sample are skipped.
 */
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/** One real record id per dynamic route; `scripts/warm.test.ts` checks they exist. */
export const SAMPLE_IDS = {
  "/agentops/agents": "agt-it-helpdesk",
  "/agentops/traces": "tr_4ad77e",
  "/agentops/prompts": "prm-support-system",
  "/agentops/evals": "ev-2145",
  "/agentops/deployments": "rel-1021",
  "/itsm/incidents": "INC0010078",
  "/itsm/changes": "CHG0031101",
  "/itsm/problems": "PRB0040001",
  "/itsm/requests": "REQ0020336",
  "/itsm/knowledge": "KB0010231",
}

/** Route path for a page directory relative to the app root. */
function toRoute(relativeDir) {
  const segments = relativeDir
    .split("/")
    .filter(Boolean)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
  return "/" + segments.join("/")
}

/**
 * Walks `appDir` and returns `{ staticRoutes, dynamicRoutes, skipped }`.
 * `dynamicRoutes` already carry the sample id; `skipped` lists dynamic
 * routes with no sample so the test can flag them.
 */
export function collectRoutes(appDir) {
  const staticRoutes = []
  const dynamicRoutes = []
  const skipped = []

  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full, rel ? `${rel}/${entry}` : entry)
      } else if (entry === "page.tsx") {
        const route = toRoute(rel)
        const dynamic = route.match(/^(.*)\/\[[^\]]+\]$/)
        if (!dynamic) {
          staticRoutes.push(route)
        } else {
          const parent = dynamic[1]
          const id = SAMPLE_IDS[parent]
          if (id) dynamicRoutes.push(`${parent}/${id}`)
          else skipped.push(route)
        }
      }
    }
  }
  walk(appDir, "")
  staticRoutes.sort()
  dynamicRoutes.sort()
  return { staticRoutes, dynamicRoutes, skipped }
}

export function warmRoutes(appDir) {
  const { staticRoutes, dynamicRoutes } = collectRoutes(appDir)
  return [...staticRoutes, ...dynamicRoutes]
}
