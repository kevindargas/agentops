/**
 * Pre-compiles every route so `next dev` has them ready. Run it in a second
 * terminal after `pnpm dev` (or `pnpm dev:warm`, which starts both).
 * Turbopack compiles on demand, so the first visit to a route is what feels
 * slow; this moves that cost to the background. The route list is derived
 * from `app/(app)/**\/page.tsx` (see `scripts/warm-routes.mjs`).
 */
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { collectRoutes, warmRoutes } from "./warm-routes.mjs"

const base = process.env.WARM_BASE ?? "http://localhost:3000"
const appDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "(app)"
)
const routes = warmRoutes(appDir)
const { skipped } = collectRoutes(appDir)
for (const route of skipped) {
  console.log(`skip ${route} (no sample id in scripts/warm-routes.mjs)`)
}

const until = Date.now() + 120_000
while (Date.now() < until) {
  try {
    await fetch(base, { redirect: "manual" })
    break
  } catch {
    await new Promise((r) => setTimeout(r, 1000))
  }
}

const concurrency = Number(process.env.WARM_CONCURRENCY ?? 2)
const queue = [...routes]
const started = Date.now()
async function worker() {
  while (queue.length) {
    const route = queue.shift()
    const t0 = Date.now()
    try {
      const res = await fetch(base + route, {
        headers: { accept: "text/html" },
      })
      console.log(
        `${res.status} ${route.padEnd(40)} ${((Date.now() - t0) / 1000).toFixed(1)}s`
      )
    } catch (err) {
      console.log(
        `ERR ${route.padEnd(40)} ${err instanceof Error ? err.message : err}`
      )
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
console.log(
  `\nWarmed ${routes.length} routes in ${((Date.now() - started) / 1000).toFixed(0)}s`
)
