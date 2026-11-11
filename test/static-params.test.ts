import { describe, expect, it } from "vitest"

import { agentTraces, deployedAgents } from "@/lib/data/agentops"
import { knowledgeArticles } from "@/lib/data/catalog"
import { releases } from "@/lib/data/deployments"
import { evalRuns } from "@/lib/data/evals"
import { changes, incidents, problems, requests } from "@/lib/data/itsm"
import { prompts } from "@/lib/data/prompts"
import { SAMPLE_IDS } from "../scripts/warm-routes.mjs"

import * as agentPage from "@/app/(app)/agentops/agents/[id]/page"
import * as deploymentPage from "@/app/(app)/agentops/deployments/[id]/page"
import * as evalPage from "@/app/(app)/agentops/evals/[id]/page"
import * as promptPage from "@/app/(app)/agentops/prompts/[id]/page"
import * as tracePage from "@/app/(app)/agentops/traces/[id]/page"
import * as changePage from "@/app/(app)/itsm/changes/[number]/page"
import * as incidentPage from "@/app/(app)/itsm/incidents/[number]/page"
import * as knowledgePage from "@/app/(app)/itsm/knowledge/[number]/page"
import * as problemPage from "@/app/(app)/itsm/problems/[number]/page"
import * as requestPage from "@/app/(app)/itsm/requests/[number]/page"

type RecordPage = {
  dynamicParams: boolean
  generateStaticParams: () => Array<Record<string, string>>
}

/**
 * The static export (GitHub Pages) can only ship pages for ids that
 * `generateStaticParams` returns. Every record route must enumerate its whole
 * sample collection and refuse unknown ids, otherwise a deep link that works
 * under `next start` would 404 on Pages.
 */
const routes: Array<{
  route: string
  page: RecordPage
  param: string
  ids: string[]
}> = [
  {
    route: "/agentops/agents",
    page: agentPage,
    param: "id",
    ids: deployedAgents.map((a) => a.id),
  },
  {
    route: "/agentops/traces",
    page: tracePage,
    param: "id",
    ids: agentTraces.map((t) => t.id),
  },
  {
    route: "/agentops/prompts",
    page: promptPage,
    param: "id",
    ids: prompts.map((p) => p.id),
  },
  {
    route: "/agentops/evals",
    page: evalPage,
    param: "id",
    ids: evalRuns.map((r) => r.id),
  },
  {
    route: "/agentops/deployments",
    page: deploymentPage,
    param: "id",
    ids: releases.map((r) => r.id),
  },
  {
    route: "/itsm/incidents",
    page: incidentPage,
    param: "number",
    ids: incidents.map((i) => i.number),
  },
  {
    route: "/itsm/problems",
    page: problemPage,
    param: "number",
    ids: problems.map((p) => p.number),
  },
  {
    route: "/itsm/changes",
    page: changePage,
    param: "number",
    ids: changes.map((c) => c.number),
  },
  {
    route: "/itsm/requests",
    page: requestPage,
    param: "number",
    ids: requests.map((r) => r.number),
  },
  {
    route: "/itsm/knowledge",
    page: knowledgePage,
    param: "number",
    ids: knowledgeArticles.map((k) => k.number),
  },
]

describe("record routes are enumerable for the static export", () => {
  it.each(routes)("$route", ({ route, page, param, ids }) => {
    expect(page.dynamicParams).toBe(false)
    const params = page.generateStaticParams()
    expect(params.map((p) => p[param]).sort()).toEqual([...ids].sort())
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(SAMPLE_IDS[route])
  })
})
