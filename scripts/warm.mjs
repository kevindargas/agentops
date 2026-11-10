/**
 * Pre-compiles the routes you are likely to open so `next dev` has them ready.
 * Run it in a second terminal after `pnpm dev` (or `pnpm dev:warm`, which
 * starts both). Turbopack compiles on demand, so the first visit to a route
 * is what feels slow; this moves that cost to the background.
 */
const base = process.env.WARM_BASE ?? "http://localhost:3000"
const routes = [
  "/dashboard",
  "/agentops",
  "/agentops/agents",
  "/agentops/agents/agt-it-helpdesk",
  "/agentops/traces",
  "/agentops/reviews",
  "/agentops/drift",
  "/agentops/experiments",
  "/agentops/recommendations",
  "/agentops/semantic-layer",
  "/ai",
  "/ai/models",
  "/itsm/incidents",
  "/itsm/incidents/INC0010048",
  "/itsm/changes",
  "/itsm/changes/calendar",
  "/itsm/problems",
  "/itsm/knowledge",
  "/cmdb",
  "/itom/health",
  "/itom/alerts",
  "/hr/cases",
  "/employee-center",
  "/settings",
]

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
        `${res.status} ${route.padEnd(36)} ${((Date.now() - t0) / 1000).toFixed(1)}s`
      )
    } catch (err) {
      console.log(
        `ERR ${route.padEnd(36)} ${err instanceof Error ? err.message : err}`
      )
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
console.log(
  `\nWarmed ${routes.length} routes in ${((Date.now() - started) / 1000).toFixed(0)}s`
)
