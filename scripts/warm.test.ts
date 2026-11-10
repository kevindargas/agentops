import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { deployedAgents, agentTraces } from "@/lib/data/agentops"
import { knowledgeArticles } from "@/lib/data/catalog"
import { releases } from "@/lib/data/deployments"
import { evalRuns } from "@/lib/data/evals"
import { changes, incidents, problems, requests } from "@/lib/data/itsm"
import { prompts } from "@/lib/data/prompts"
import { SAMPLE_IDS, collectRoutes, warmRoutes } from "./warm-routes.mjs"

const APP_DIR = join(process.cwd(), "app", "(app)")

describe("scripts/warm", () => {
  const { staticRoutes, dynamicRoutes, skipped } = collectRoutes(APP_DIR)

  it("maps every static route to a page.tsx", () => {
    expect(staticRoutes.length).toBeGreaterThan(30)
    for (const route of staticRoutes) {
      const page = join(
        APP_DIR,
        ...route.split("/").filter(Boolean),
        "page.tsx"
      )
      expect(existsSync(page), route).toBe(true)
    }
    expect(staticRoutes).toContain("/dashboard")
    expect(staticRoutes).toContain("/agentops/readiness")
    expect(staticRoutes).not.toContain("/cmdb")
  })

  it("has a sample id for every dynamic segment", () => {
    expect(skipped).toEqual([])
    expect(dynamicRoutes.length).toBe(Object.keys(SAMPLE_IDS).length)
  })

  it("uses sample ids that exist in the data modules", () => {
    const ids: Record<string, Set<string>> = {
      "/agentops/agents": new Set(deployedAgents.map((a) => a.id)),
      "/agentops/traces": new Set(agentTraces.map((t) => t.id)),
      "/agentops/prompts": new Set(prompts.map((p) => p.id)),
      "/agentops/evals": new Set(evalRuns.map((r) => r.id)),
      "/agentops/deployments": new Set(releases.map((r) => r.id)),
      "/itsm/incidents": new Set(incidents.map((i) => i.number)),
      "/itsm/changes": new Set(changes.map((c) => c.number)),
      "/itsm/problems": new Set(problems.map((p) => p.number)),
      "/itsm/requests": new Set(requests.map((r) => r.number)),
      "/itsm/knowledge": new Set(knowledgeArticles.map((k) => k.number)),
    }
    for (const [parent, id] of Object.entries(SAMPLE_IDS)) {
      expect(ids[parent], parent).toBeDefined()
      expect(ids[parent].has(id), `${parent}/${id}`).toBe(true)
    }
  })

  it("warms static routes before record routes", () => {
    const all = warmRoutes(APP_DIR)
    expect(all.slice(0, staticRoutes.length)).toEqual(staticRoutes)
    expect(all.slice(staticRoutes.length)).toEqual(dynamicRoutes)
  })
})
