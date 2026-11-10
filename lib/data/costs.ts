/**
 * Costs & budgets — FinOps view over the agent fleet. Daily series are derived
 * from the deployed agents' current run-rate so the numbers agree with the
 * fleet overview; everything is deterministic and anchored to NOW.
 */

import { deployedAgents } from "./agentops"
import { createRng, daysAgo, NOW } from "./seed"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface CostDay {
  /** ISO date at midnight UTC. */
  date: string
  /** Short label, e.g. "Oct 7". */
  name: string
  cost: number
  requests: number
  tokensIn: number
  tokensOut: number
  tokensCached: number
  /** USD saved by cache reads versus paying full input price. */
  cachedSavings: number
  byAgent: Record<string, number>
  byProvider: Record<string, number>
}

export type BudgetPeriod = "daily" | "monthly"
export type BudgetScopeKind = "team" | "agent" | "project"
export type BudgetAction =
  "Alert only" | "Throttle" | "Downgrade model" | "Pause agent"
export type BudgetStatus = "On track" | "At risk" | "Exceeded"

export interface BudgetScope {
  kind: BudgetScopeKind
  /** Agent id for agent scopes; team name for team scopes; project slug otherwise. */
  id: string
  label: string
}

export interface Budget {
  id: string
  name: string
  scope: BudgetScope
  period: BudgetPeriod
  limit: number
  /** Spent in the current period (today, or month to date). */
  spent: number
  /** Linear projection to the end of the period. */
  projected: number
  /** Alert thresholds, % of limit. */
  thresholds: number[]
  onBreach: BudgetAction
  ownerId: string
  status: BudgetStatus
  /** Last 30 days of daily spend for the scope. */
  history: { name: string; spent: number }[]
  updated: string
}

export interface AgentCost {
  agentId: string
  team: string
  modelId: string
  requests: number
  tokensIn: number
  tokensOut: number
  tokensCached: number
  cost: number
  costPerRequest: number
  /** % change in cost versus the previous 7 days. */
  deltaPct: number
  /** Share of fleet cost, 0–100. */
  share: number
}

export type SavingsKind =
  "route" | "caching" | "output-tokens" | "batch" | "commitment"

export interface SavingsOpportunity {
  id: string
  title: string
  summary: string
  agentId: string
  kind: SavingsKind
  estimatedMonthlySavings: number
  effort: "low" | "medium"
  /** Related model recommendation, when one exists. */
  recommendationId?: string
  status: "Open" | "Applied" | "Dismissed"
}

/* -------------------------------------------------------------------------- */
/* Model pricing (USD per 1M tokens)                                           */
/* -------------------------------------------------------------------------- */

export const modelPricing: Record<
  string,
  { input: number; output: number; cachedInput: number }
> = {
  "anthropic/claude-fable-5.1": { input: 15, output: 75, cachedInput: 1.5 },
  "anthropic/claude-sonnet-5.5": { input: 3, output: 15, cachedInput: 0.3 },
  "anthropic/claude-haiku-5.5": { input: 0.8, output: 4, cachedInput: 0.08 },
  "openai/gpt-5.5": { input: 10, output: 40, cachedInput: 1 },
  "openai/gpt-5.4-mini": { input: 0.4, output: 1.6, cachedInput: 0.04 },
  "google/gemini-3.1-pro-preview": { input: 2, output: 12, cachedInput: 0.5 },
  "google/gemini-3-flash-preview": {
    input: 0.3,
    output: 2.5,
    cachedInput: 0.03,
  },
  "deepseek/deepseek-v3.2": { input: 0.27, output: 1.1, cachedInput: 0.07 },
  "x-ai/grok-4.7": { input: 3, output: 15, cachedInput: 0.75 },
}

/* -------------------------------------------------------------------------- */
/* Daily series                                                                */
/* -------------------------------------------------------------------------- */

const r = createRng(7651)
const DAYS = 30

/** How each agent's traffic is split across gateway providers. */
const providerMix: Record<string, Record<string, number>> = {
  "agt-support-triage": { "prv-anthropic": 0.85, "prv-bedrock": 0.15 },
  "agt-it-helpdesk": { "prv-openai": 0.6, "prv-azure": 0.4 },
  "agt-ops-analyst": { "prv-anthropic": 1 },
  "agt-change-risk": { "prv-anthropic": 0.7, "prv-bedrock": 0.3 },
  "agt-hr-answers": { "prv-vertex": 0.92, "prv-azure": 0.08 },
  "agt-alert-correlator": { "prv-openrouter": 0.8, "prv-vllm": 0.2 },
  "agt-kb-curator": { "prv-anthropic": 0.5, "prv-bedrock": 0.5 },
  "agt-finance-copilot": { "prv-azure": 1 },
}

/** Share of input tokens served from cache per agent. */
const cacheShare: Record<string, number> = {
  "agt-support-triage": 0.38,
  "agt-it-helpdesk": 0.06,
  "agt-ops-analyst": 0.22,
  "agt-change-risk": 0.31,
  "agt-hr-answers": 0.44,
  "agt-alert-correlator": 0.12,
  "agt-kb-curator": 0.18,
  "agt-finance-copilot": 0,
}

/** Week-over-week drift per agent so "top mover" has a story. */
const agentDrift: Record<string, number> = {
  "agt-ops-analyst": 0.028,
  "agt-it-helpdesk": 0.006,
  "agt-hr-answers": -0.004,
  "agt-alert-correlator": 0.012,
}

const dayStart = (offset: number) => {
  const d = new Date(NOW)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - offset)
  return d
}
const shortDay = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

/** Staging/eval project spend that is not tied to a production agent. */
const projectDaily: Record<string, number[]> = {
  "finance-copilot-evals": Array.from({ length: DAYS }, (_, i) =>
    i >= DAYS - 5 ? Math.round((96 + (r() - 0.5) * 30) * 100) / 100 : 0
  ),
  "q4-model-migration": Array.from(
    { length: DAYS },
    () => Math.round((42 + (r() - 0.5) * 18) * 100) / 100
  ),
}

export const costDaily: CostDay[] = Array.from({ length: DAYS }, (_, i) => {
  const offset = DAYS - 1 - i
  const date = dayStart(offset)
  const dow = date.getUTCDay()
  const weekend = dow === 0 || dow === 6
  const byAgent: Record<string, number> = {}
  const byProvider: Record<string, number> = {}
  let cost = 0,
    requests = 0,
    tokensIn = 0,
    tokensOut = 0,
    tokensCached = 0,
    cachedSavings = 0

  for (const a of deployedAgents) {
    if (a.metrics.costPerDay === 0) continue
    // Today is partial: the fleet clock sits mid-afternoon.
    const partial = offset === 0 ? 0.62 : 1
    const drift = 1 + (agentDrift[a.id] ?? 0) * (i - (DAYS - 1))
    const seasonal = weekend ? 0.55 : 1
    const noise = 1 + (r() - 0.5) * 0.16
    const factor = partial * seasonal * noise * drift
    const c = Math.round(a.metrics.costPerDay * factor * 100) / 100
    const req = Math.round(a.metrics.requests24h * factor)
    const tokens = Math.round(a.metrics.tokens24h * factor)
    const cached = Math.round(tokens * 0.8 * (cacheShare[a.id] ?? 0))
    const inTok = Math.round(tokens * 0.8) - cached
    const outTok = tokens - inTok - cached
    const price = modelPricing[a.modelId]
    const saved = price
      ? (cached / 1_000_000) * (price.input - price.cachedInput)
      : 0

    byAgent[a.id] = c
    for (const [pid, share] of Object.entries(providerMix[a.id] ?? {}))
      byProvider[pid] =
        Math.round(((byProvider[pid] ?? 0) + c * share) * 100) / 100
    cost += c
    requests += req
    tokensIn += inTok
    tokensOut += outTok
    tokensCached += cached
    cachedSavings += saved
  }

  return {
    date: date.toISOString(),
    name: shortDay(date),
    cost: Math.round(cost * 100) / 100,
    requests,
    tokensIn,
    tokensOut,
    tokensCached,
    cachedSavings: Math.round(cachedSavings * 100) / 100,
    byAgent,
    byProvider,
  }
})

/* -------------------------------------------------------------------------- */
/* Derived aggregates                                                          */
/* -------------------------------------------------------------------------- */

const sumBy = (rows: CostDay[], pick: (d: CostDay) => number) =>
  rows.reduce((s, d) => s + pick(d), 0)

const last7 = costDaily.slice(-7)
const prev7 = costDaily.slice(-14, -7)

const agentTokens = (agentId: string, rows: CostDay[]) => {
  const a = deployedAgents.find((x) => x.id === agentId)
  if (!a) return { requests: 0, tokensIn: 0, tokensOut: 0, tokensCached: 0 }
  const cost = sumBy(rows, (d) => d.byAgent[agentId] ?? 0)
  // Scale the agent's steady-state token mix by its realised spend.
  const ratio = a.metrics.costPerDay ? cost / a.metrics.costPerDay : 0
  const tokens = Math.round(a.metrics.tokens24h * ratio)
  const cached = Math.round(tokens * 0.8 * (cacheShare[agentId] ?? 0))
  const tokensIn = Math.round(tokens * 0.8) - cached
  return {
    requests: Math.round(a.metrics.requests24h * ratio),
    tokensIn,
    tokensOut: tokens - tokensIn - cached,
    tokensCached: cached,
  }
}

const fleet7 = sumBy(last7, (d) => d.cost)

/** Per-agent allocation for the last 7 days with week-over-week delta. */
export const costByAgent: AgentCost[] = deployedAgents
  .filter((a) => a.metrics.costPerDay > 0)
  .map((a) => {
    const cost = sumBy(last7, (d) => d.byAgent[a.id] ?? 0)
    const prev = sumBy(prev7, (d) => d.byAgent[a.id] ?? 0)
    const t = agentTokens(a.id, last7)
    return {
      agentId: a.id,
      team: a.team,
      modelId: a.modelId,
      requests: t.requests,
      tokensIn: t.tokensIn,
      tokensOut: t.tokensOut,
      tokensCached: t.tokensCached,
      cost: Math.round(cost * 100) / 100,
      costPerRequest: t.requests ? cost / t.requests : 0,
      deltaPct: prev ? ((cost - prev) / prev) * 100 : 0,
      share: fleet7 ? (cost / fleet7) * 100 : 0,
    }
  })
  .sort((a, b) => b.cost - a.cost)

/* -------------------------------------------------------------------------- */
/* Budgets                                                                     */
/* -------------------------------------------------------------------------- */

const daysInMonth = new Date(
  Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 0)
).getUTCDate()
const dayOfMonth = NOW.getUTCDate()
/** Fraction of today already elapsed on the demo clock. */
const todayFraction = (NOW.getUTCHours() * 60 + NOW.getUTCMinutes()) / (24 * 60)

const scopeDaily = (scope: BudgetScope) =>
  costDaily.map((d, i) => ({
    name: d.name,
    spent:
      scope.kind === "agent"
        ? (d.byAgent[scope.id] ?? 0)
        : scope.kind === "team"
          ? deployedAgents
              .filter((a) => a.team === scope.id)
              .reduce((s, a) => s + (d.byAgent[a.id] ?? 0), 0)
          : (projectDaily[scope.id]?.[i] ?? 0),
  }))

function budget(
  id: string,
  name: string,
  scope: BudgetScope,
  period: BudgetPeriod,
  limit: number,
  thresholds: number[],
  onBreach: BudgetAction,
  ownerId: string,
  updatedDays: number
): Budget {
  const history = scopeDaily(scope).map((h) => ({
    name: h.name,
    spent: Math.round(h.spent * 100) / 100,
  }))
  const mtd = history.slice(-dayOfMonth)
  const spent =
    period === "daily"
      ? history[history.length - 1].spent
      : Math.round(mtd.reduce((s, h) => s + h.spent, 0) * 100) / 100
  const projected =
    period === "daily"
      ? spent / Math.max(0.2, todayFraction)
      : (spent / Math.max(1, dayOfMonth - 1 + todayFraction)) * daysInMonth
  const status: BudgetStatus =
    spent >= limit
      ? "Exceeded"
      : projected >= limit * 0.9
        ? "At risk"
        : "On track"
  return {
    id,
    name,
    scope,
    period,
    limit,
    spent,
    projected: Math.round(projected * 100) / 100,
    thresholds,
    onBreach,
    ownerId,
    status,
    history,
    updated: daysAgo(updatedDays),
  }
}

const team = (name: string): BudgetScope => ({
  kind: "team",
  id: name,
  label: name,
})
const agent = (id: string): BudgetScope => ({
  kind: "agent",
  id,
  label: deployedAgents.find((a) => a.id === id)?.name ?? id,
})
const project = (id: string, label: string): BudgetScope => ({
  kind: "project",
  id,
  label,
})

export const budgets: Budget[] = [
  budget(
    "bud-001",
    "Platform · monthly",
    team("Platform"),
    "monthly",
    4200,
    [50, 80, 100],
    "Downgrade model",
    "u-001",
    6
  ),
  budget(
    "bud-002",
    "Service Desk · monthly",
    team("Service Desk"),
    "monthly",
    11_000,
    [50, 80, 100],
    "Alert only",
    "u-002",
    14
  ),
  budget(
    "bud-003",
    "Support Triage · daily cap",
    agent("agt-support-triage"),
    "daily",
    180,
    [80, 100],
    "Throttle",
    "u-003",
    3
  ),
  budget(
    "bud-004",
    "Ops Analyst · daily cap",
    agent("agt-ops-analyst"),
    "daily",
    90,
    [50, 80, 100],
    "Downgrade model",
    "u-001",
    1
  ),
  budget(
    "bud-005",
    "IT Helpdesk Copilot · monthly",
    agent("agt-it-helpdesk"),
    "monthly",
    3400,
    [50, 80, 100],
    "Alert only",
    "u-005",
    20
  ),
  budget(
    "bud-006",
    "HR Answers · monthly",
    agent("agt-hr-answers"),
    "monthly",
    800,
    [80, 100],
    "Alert only",
    "u-009",
    9
  ),
  budget(
    "bud-007",
    "People Ops · monthly",
    team("People Ops"),
    "monthly",
    1000,
    [50, 80, 100],
    "Throttle",
    "u-007",
    30
  ),
  budget(
    "bud-008",
    "Alert Correlator · daily cap",
    agent("agt-alert-correlator"),
    "daily",
    6,
    [80, 100],
    "Throttle",
    "u-011",
    2
  ),
  budget(
    "bud-009",
    "Site Reliability · monthly",
    team("Site Reliability"),
    "monthly",
    400,
    [50, 80, 100],
    "Alert only",
    "u-011",
    30
  ),
  budget(
    "bud-010",
    "Change Management · monthly",
    team("Change Management"),
    "monthly",
    2400,
    [50, 80, 100],
    "Alert only",
    "u-004",
    30
  ),
  budget(
    "bud-011",
    "Finance Copilot evals",
    project("finance-copilot-evals", "Finance Copilot evals"),
    "monthly",
    400,
    [50, 80, 100],
    "Pause agent",
    "u-012",
    1
  ),
  budget(
    "bud-012",
    "Q4 model migration",
    project("q4-model-migration", "Q4 model migration"),
    "monthly",
    1500,
    [50, 80, 100],
    "Alert only",
    "u-001",
    11
  ),
  budget(
    "bud-013",
    "Knowledge Curator · monthly",
    agent("agt-kb-curator"),
    "monthly",
    900,
    [50, 80, 100],
    "Downgrade model",
    "u-002",
    17
  ),
]

export function getBudget(id: string) {
  return budgets.find((b) => b.id === id)
}

/* -------------------------------------------------------------------------- */
/* Savings opportunities                                                       */
/* -------------------------------------------------------------------------- */

export const savingsOpportunities: SavingsOpportunity[] = [
  {
    id: "sav-001",
    title: "Route low-complexity intents on Support Triage to Haiku 5.5",
    summary:
      "41% of triage traffic is password resets and status lookups. Shadow evals show Haiku matches Sonnet quality on those intents.",
    agentId: "agt-support-triage",
    kind: "route",
    estimatedMonthlySavings: 1840,
    effort: "low",
    recommendationId: "rec-002",
    status: "Open",
  },
  {
    id: "sav-002",
    title: "Enable prompt caching for IT Helpdesk Copilot",
    summary:
      "The 18K-token system prompt and tool schema are static. Only 6% of input tokens hit the cache today versus 38% on Support Triage.",
    agentId: "agt-it-helpdesk",
    kind: "caching",
    estimatedMonthlySavings: 960,
    effort: "low",
    status: "Open",
  },
  {
    id: "sav-003",
    title: "Cap Ops Analyst max output tokens at 4,096",
    summary:
      "p95 completion length is 2,900 tokens; the 8,192 cap only matters for 1.2% of runs and output tokens are 5x input price on Fable.",
    agentId: "agt-ops-analyst",
    kind: "output-tokens",
    estimatedMonthlySavings: 610,
    effort: "low",
    recommendationId: "rec-005",
    status: "Open",
  },
  {
    id: "sav-004",
    title: "Move Knowledge Curator nightly runs to the Batch API",
    summary:
      "Article drafting runs on a schedule with no latency requirement. Batch pricing is 50% off and the queue clears in under 4 hours.",
    agentId: "agt-kb-curator",
    kind: "batch",
    estimatedMonthlySavings: 380,
    effort: "medium",
    status: "Open",
  },
  {
    id: "sav-005",
    title: "Shift IT Helpdesk weights toward the Azure commitment",
    summary:
      "The Azure reservation is 54% consumed with 7 weeks left. Moving the split from 60/40 to 30/70 uses prepaid capacity before it expires.",
    agentId: "agt-it-helpdesk",
    kind: "commitment",
    estimatedMonthlySavings: 290,
    effort: "low",
    status: "Open",
  },
  {
    id: "sav-006",
    title: "Return Alert Correlator to the vLLM cluster once healthy",
    summary:
      "While the on-prem cluster is disconnected, 100% of correlation traffic falls through to OpenRouter at 3.4x the marginal cost.",
    agentId: "agt-alert-correlator",
    kind: "route",
    estimatedMonthlySavings: 210,
    effort: "medium",
    status: "Open",
  },
]

/* -------------------------------------------------------------------------- */
/* Fleet-level helpers                                                         */
/* -------------------------------------------------------------------------- */

/** Linear end-of-month forecast from the trailing 14 full days. */
export function forecastMonthEnd() {
  const mtd = costDaily.slice(-dayOfMonth).reduce((s, d) => s + d.cost, 0)
  const trailing = costDaily.slice(-15, -1)
  const avg = trailing.reduce((s, d) => s + d.cost, 0) / trailing.length
  const remainingDays = daysInMonth - dayOfMonth + (1 - todayFraction)
  return Math.round(mtd + avg * remainingDays)
}

export const monthlyBudgetTotal = budgets
  .filter((b) => b.period === "monthly" && b.scope.kind === "team")
  .reduce((s, b) => s + b.limit, 0)

export const monthToDateSpend = costDaily
  .slice(-dayOfMonth)
  .reduce((s, d) => s + d.cost, 0)
