/**
 * Schedules & triggers: when and why agents run on their own.
 *
 * Includes a tiny cron parser (`describeCron`, `nextRun`, `occurrences`) so
 * next-run times and the weekly calendar are computed deterministically from
 * the demo clock. Seed 7951. Record ids: schedules `sch-…`, triggers `trg-…`,
 * runs `run-…`.
 */

import { agentTraces, deployedAgents, driftSignals } from "./agentops"
import { budgets } from "./costs"
import { evalRuns } from "./evals"
import { changeFreezeWindows, changes } from "./itsm"
import { chance, createRng, int, NOW, pick, weighted } from "./seed"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type ConcurrencyPolicy = "Forbid" | "Allow" | "Replace"
export type RunStatus = "Succeeded" | "Failed" | "Running" | "Skipped"
export type RunSource = "schedule" | "trigger"

export interface RetryPolicy {
  attempts: number
  backoff: "none" | "fixed" | "exponential"
  delaySec: number
}

export interface Notifications {
  slack?: string
  email?: string[]
  pagerduty?: string
}

export interface Schedule {
  id: string
  name: string
  description: string
  agentId: string
  cron: string
  timezone: string
  enabled: boolean
  lastRun?: { at: string; status: RunStatus; durationMs: number }
  avgDurationMs: number
  concurrency: ConcurrencyPolicy
  retry: RetryPolicy
  budgetPerRunUsd: number
  ownerId: string
  parameters: Record<string, unknown>
  notifications: Notifications
  /** Durations (ms) of the last 14 runs, oldest first. */
  history: number[]
}

export type TriggerSource =
  | "Webhook"
  | "Slack mention"
  | "Email inbox"
  | "Queue"
  | "Record event"
  | "Drift signal"
  | "Budget threshold"
  | "Eval failure"
  | "Git push"

export type TriggerAction = "Run agent" | "Open review" | "Notify"
export type TriggerStatus = "Active" | "Paused" | "Error"
export type SecretStatus = "Valid" | "Rotating" | "Missing"

export interface TriggerDelivery {
  id: string
  at: string
  statusCode: number
  latencyMs: number
  runId?: string
}

export interface Trigger {
  id: string
  name: string
  source: TriggerSource
  /** Queue flavour or integration name shown under the source. */
  sourceDetail?: string
  /** Filter expression evaluated against the event. */
  condition: string
  agentId: string
  action: TriggerAction
  fired24h: number
  lastFired?: string
  /** 0 to 100 */
  failureRate: number
  status: TriggerStatus
  secret?: { kind: "HMAC-SHA256" | "Bearer token"; status: SecretStatus }
  samplePayload: Record<string, unknown>
  deliveries: TriggerDelivery[]
  ownerId: string
}

export interface ScheduledRun {
  id: string
  source: RunSource
  sourceId: string
  sourceName: string
  agentId: string
  startedAt: string
  durationMs: number
  status: RunStatus
  itemsProcessed: number
  cost: number
  traceId?: string
  error?: string
}

export interface FreezeWindow {
  id: string
  name: string
  /** ISO start/end, UTC. */
  start: string
  end: string
  scope: string
  reason: string
}

/* -------------------------------------------------------------------------- */
/* Cron helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Fixed UTC offsets (minutes) for the zones used in mock data, early November. */
const tzOffsets: Record<string, number> = {
  UTC: 0,
  "Europe/London": 0,
  "Europe/Berlin": 60,
  "America/New_York": -300,
  "America/Los_Angeles": -480,
  "Asia/Kolkata": 330,
  "Asia/Tokyo": 540,
  "Australia/Sydney": 660,
}

export const timezones = Object.keys(tzOffsets)

export function tzOffsetMinutes(tz: string) {
  return tzOffsets[tz] ?? 0
}

interface CronField {
  values: Set<number>
  any: boolean
  /** Original step for star-slash-N fields so descriptions can say "every N". */
  step?: number
}

function parseField(raw: string, min: number, max: number): CronField {
  const values = new Set<number>()
  if (raw === "*") {
    for (let i = min; i <= max; i++) values.add(i)
    return { values, any: true }
  }
  let step: number | undefined
  for (const part of raw.split(",")) {
    const [range, stepRaw] = part.split("/")
    const s = stepRaw ? Number(stepRaw) : 1
    if (stepRaw && range === "*") step = s
    let lo = min
    let hi = max
    if (range !== "*") {
      const [a, b] = range.split("-").map(Number)
      lo = a
      hi = b ?? a
    }
    for (let i = lo; i <= hi; i += s) values.add(i)
  }
  return { values, any: false, step }
}

interface Cron {
  minute: CronField
  hour: CronField
  dom: CronField
  month: CronField
  dow: CronField
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`Invalid cron expression: ${expr}`)
  const [m, h, dom, mon, dow] = parts
  const dowField = parseField(dow.replace(/7/g, "0"), 0, 6)
  return {
    minute: parseField(m, 0, 59),
    hour: parseField(h, 0, 23),
    dom: parseField(dom, 1, 31),
    month: parseField(mon, 1, 12),
    dow: dowField,
  }
}

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const pad2 = (n: number) => String(n).padStart(2, "0")

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("")
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/**
 * Humanise the cron patterns used in this product. Falls back to the raw
 * expression for anything it does not understand.
 */
export function describeCron(expr: string): string {
  let c: Cron
  try {
    c = parseCron(expr)
  } catch {
    return expr
  }
  const minutes = [...c.minute.values].sort((a, b) => a - b)
  const hours = [...c.hour.values].sort((a, b) => a - b)
  const dows = [...c.dow.values].sort((a, b) => a - b)
  const doms = [...c.dom.values].sort((a, b) => a - b)

  // Every N minutes / every hour / every N hours.
  if (c.hour.any && c.dom.any && c.month.any && c.dow.any) {
    if (c.minute.any) return "Every minute"
    if (c.minute.step) return `Every ${c.minute.step} minutes`
    if (minutes.length === 1 && minutes[0] === 0) return "Every hour"
    if (minutes.length === 1) return `Every hour at :${pad2(minutes[0])}`
  }
  if (
    c.hour.step &&
    c.dom.any &&
    c.month.any &&
    c.dow.any &&
    minutes.length === 1
  )
    return `Every ${c.hour.step} hours${minutes[0] ? ` at :${pad2(minutes[0])}` : ""}`

  if (minutes.length !== 1 || !c.month.any) return expr
  const times = joinList(hours.map((h) => `${pad2(h)}:${pad2(minutes[0])}`))

  // Day-of-month schedules.
  if (!c.dom.any && c.dow.any) {
    if (doms.length === 1)
      return `On the ${ordinal(doms[0])} of every month at ${times}`
    return expr
  }
  if (!c.dom.any) return expr

  // Day-of-week schedules.
  if (c.dow.any) return `Every day at ${times}`
  const key = dows.join(",")
  if (key === "1,2,3,4,5") return `Weekdays at ${times}`
  if (key === "0,6") return `Weekends at ${times}`
  return `Every ${joinList(dows.map((d) => dayNames[d]))} at ${times}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Next occurrence strictly after `from`, evaluated in `timezone` and returned
 * as a UTC ISO string. Deterministic and allocation-light: unmatched fields
 * skip ahead a day / an hour instead of stepping minute by minute.
 */
export function nextRun(
  expr: string,
  from: Date = NOW,
  timezone = "UTC"
): string {
  const c = parseCron(expr)
  const offset = tzOffsetMinutes(timezone) * MINUTE
  // Work in "wall clock as UTC" space, then shift back.
  let t = Math.floor((from.getTime() + offset) / MINUTE) * MINUTE + MINUTE
  for (let guard = 0; guard < 100_000; guard++) {
    const d = new Date(t)
    if (!c.month.values.has(d.getUTCMonth() + 1)) {
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
      continue
    }
    if (!c.dom.values.has(d.getUTCDate()) || !c.dow.values.has(d.getUTCDay())) {
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
      continue
    }
    if (!c.hour.values.has(d.getUTCHours())) {
      t = Math.floor(t / HOUR) * HOUR + HOUR
      continue
    }
    if (!c.minute.values.has(d.getUTCMinutes())) {
      t += MINUTE
      continue
    }
    return new Date(t - offset).toISOString()
  }
  throw new Error(`No occurrence found for ${expr}`)
}

/** All occurrences in (start, end], capped so every-minute crons cannot run away. */
export function occurrences(
  expr: string,
  start: Date,
  end: Date,
  timezone = "UTC",
  limit = 400
): string[] {
  const out: string[] = []
  let cursor = start
  while (out.length < limit) {
    const next = nextRun(expr, cursor, timezone)
    if (new Date(next).getTime() > end.getTime()) break
    out.push(next)
    cursor = new Date(next)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Freeze windows                                                              */
/* -------------------------------------------------------------------------- */

export const freezeWindows: FreezeWindow[] = [
  {
    id: "frz-001",
    name: "Model provider maintenance",
    start: "2026-11-04T01:00:00Z",
    end: "2026-11-04T03:00:00Z",
    scope: "OpenAI-backed agents paused; runs are skipped, not queued",
    reason: "Announced provider maintenance window.",
  },
  {
    id: "frz-002",
    name: "Payments platform maintenance",
    start: "2026-11-07T22:00:00Z",
    end: "2026-11-08T04:00:00Z",
    scope: "No production deploys · schedules touching Payments APIs skipped",
    reason: "Database failover rehearsal for the Payments platform.",
  },
  // Change freezes come from the change calendar's list (lib/data/itsm.ts).
  ...changeFreezeWindows.map<FreezeWindow>((w) => ({
    id: w.id,
    name: w.name,
    start: w.start,
    end: w.end,
    scope:
      w.id === "frz-004"
        ? "No production deploys · finance agents read-only"
        : "No production deploys",
    reason: w.reason,
  })),
]

export function freezeAt(iso: string) {
  return freezeWindows.find((f) => iso >= f.start && iso < f.end)
}

/* -------------------------------------------------------------------------- */
/* Schedules                                                                   */
/* -------------------------------------------------------------------------- */

const rng = createRng(7951)

type ScheduleSeed = Omit<Schedule, "lastRun" | "history" | "avgDurationMs"> & {
  avgDurationMs: number
}

const scheduleSeeds: ScheduleSeed[] = [
  {
    id: "sch-001",
    name: "Nightly KB curation",
    description:
      "Reads yesterday's resolved incidents, drafts or updates knowledge articles and queues them for review.",
    agentId: "agt-kb-curator",
    cron: "0 2 * * *",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 41 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 2, backoff: "exponential", delaySec: 300 },
    budgetPerRunUsd: 12,
    ownerId: "u-002",
    parameters: {
      lookbackHours: 24,
      minIncidentsPerTopic: 3,
      publish: false,
      reviewQueue: "kb-review",
    },
    notifications: { slack: "#kb-curation", email: ["kb-team@acme.io"] },
  },
  {
    id: "sch-002",
    name: "Hourly alert sweep",
    description:
      "Correlates open alerts into incidents and closes alerts that have cleared.",
    agentId: "agt-alert-correlator",
    cron: "0 * * * *",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 4.2 * MINUTE,
    concurrency: "Replace",
    retry: { attempts: 1, backoff: "fixed", delaySec: 60 },
    budgetPerRunUsd: 1.5,
    ownerId: "u-018",
    parameters: { window: "PT1H", minSeverity: "Minor", autoClose: true },
    notifications: { slack: "#noc", pagerduty: "P-AGENTOPS-NOC" },
  },
  {
    id: "sch-003",
    name: "Weekly cost report",
    description:
      "Summarises fleet spend by agent and model and posts the digest to Finance.",
    agentId: "agt-ops-analyst",
    cron: "0 7 * * 1",
    timezone: "Europe/Berlin",
    enabled: true,
    avgDurationMs: 9 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 3, backoff: "exponential", delaySec: 120 },
    budgetPerRunUsd: 4,
    ownerId: "u-001",
    parameters: { period: "P7D", groupBy: ["agent", "model"], currency: "USD" },
    notifications: { slack: "#agentops-finance", email: ["finops@acme.io"] },
  },
  {
    id: "sch-004",
    name: "Daily eval regression · Triage",
    description:
      "Runs the support-triage golden set against the production version and flags regressions.",
    agentId: "agt-support-triage",
    cron: "30 5 * * *",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 27 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 1, backoff: "none", delaySec: 0 },
    budgetPerRunUsd: 25,
    ownerId: "u-002",
    parameters: { dataset: "support-golden-v7", threshold: 85, sample: 400 },
    notifications: { slack: "#triage-quality" },
  },
  {
    id: "sch-005",
    name: "Stale ticket nudge",
    description:
      "Finds helpdesk tickets waiting on the requester for 3+ days and sends a friendly reminder.",
    agentId: "agt-it-helpdesk",
    cron: "0 9,15 * * 1-5",
    timezone: "America/New_York",
    enabled: true,
    avgDurationMs: 6 * MINUTE,
    concurrency: "Allow",
    retry: { attempts: 2, backoff: "fixed", delaySec: 300 },
    budgetPerRunUsd: 2,
    ownerId: "u-020",
    parameters: { staleAfterDays: 3, maxNudges: 2, channel: "email" },
    notifications: { email: ["servicedesk@acme.io"] },
  },
  {
    id: "sch-006",
    name: "Pre-CAB change scoring",
    description:
      "Scores every change on this week's CAB agenda and attaches a risk memo.",
    agentId: "agt-change-risk",
    cron: "0 6 * * 4",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 14 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 2, backoff: "exponential", delaySec: 180 },
    budgetPerRunUsd: 8,
    ownerId: "u-004",
    parameters: { agenda: "next-cab", includeStandard: false },
    notifications: { slack: "#change-management", email: ["cab@acme.io"] },
  },
  {
    id: "sch-007",
    name: "Policy drift scan",
    description:
      "Compares answers against the latest HR policy documents and opens review items where they diverge.",
    agentId: "agt-hr-answers",
    cron: "0 3 * * 0",
    timezone: "Europe/Berlin",
    enabled: true,
    avgDurationMs: 33 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 1, backoff: "none", delaySec: 0 },
    budgetPerRunUsd: 3,
    ownerId: "u-007",
    parameters: { sources: ["hr-policies", "benefits"], sample: 250 },
    notifications: { slack: "#hr-ai", email: ["people-ops@acme.io"] },
  },
  {
    id: "sch-008",
    name: "Month-start spend digest",
    description:
      "Narrates last month's spend by cost center for Finance leadership.",
    agentId: "agt-finance-copilot",
    cron: "0 6 1 * *",
    timezone: "UTC",
    // The target agent is paused, so the digest must not fire.
    enabled: false,
    avgDurationMs: 11 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 3, backoff: "exponential", delaySec: 600 },
    budgetPerRunUsd: 6,
    ownerId: "u-016",
    parameters: { period: "P1M", entities: ["sem-spend", "sem-cost-center"] },
    notifications: { email: ["finance-leads@acme.io"] },
  },
  {
    id: "sch-009",
    name: "Incident correlation sweep",
    description:
      "Short-interval sweep that links new alerts to open incidents before they page anyone.",
    agentId: "agt-alert-correlator",
    cron: "*/15 * * * *",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 48_000,
    concurrency: "Forbid",
    retry: { attempts: 0, backoff: "none", delaySec: 0 },
    budgetPerRunUsd: 0.4,
    ownerId: "u-018",
    parameters: { window: "PT15M", linkOnly: true },
    notifications: {},
  },
  {
    id: "sch-010",
    name: "Morning triage warm-up",
    description:
      "Pre-classifies overnight conversations so the first shift starts with a sorted queue.",
    agentId: "agt-support-triage",
    cron: "45 7 * * 1-5",
    timezone: "Europe/Berlin",
    enabled: true,
    avgDurationMs: 7 * MINUTE,
    concurrency: "Replace",
    retry: { attempts: 1, backoff: "fixed", delaySec: 120 },
    budgetPerRunUsd: 1,
    ownerId: "u-002",
    parameters: { queues: ["web", "email"], draftReplies: true },
    notifications: { slack: "#service-desk" },
  },
  {
    id: "sch-011",
    name: "Golden-set refresh · Helpdesk",
    description:
      "Samples reviewed conversations from the week into the helpdesk evaluation set.",
    agentId: "agt-it-helpdesk",
    cron: "0 1 * * 6",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 19 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 1, backoff: "none", delaySec: 0 },
    budgetPerRunUsd: 18,
    ownerId: "u-020",
    parameters: { dataset: "helpdesk-golden-v4", sample: 120, dedupe: true },
    notifications: { slack: "#helpdesk-quality" },
  },
  {
    id: "sch-012",
    name: "Semantic layer verification",
    description:
      "Re-runs the verified metric definitions and reports any drift in results.",
    agentId: "agt-ops-analyst",
    cron: "0 */6 * * *",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 16 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 2, backoff: "exponential", delaySec: 300 },
    budgetPerRunUsd: 2.5,
    ownerId: "u-001",
    parameters: { status: ["Verified"], tolerancePct: 1 },
    notifications: { slack: "#semantic-layer" },
  },
  {
    id: "sch-013",
    name: "Knowledge gap report",
    description:
      "Lists questions the fleet could not answer from the knowledge base and suggests articles.",
    agentId: "agt-kb-curator",
    cron: "0 8 * * 1,4",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 12 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 2, backoff: "fixed", delaySec: 300 },
    budgetPerRunUsd: 5,
    ownerId: "u-002",
    parameters: { lookbackDays: 3, minOccurrences: 5 },
    notifications: { slack: "#kb-curation" },
  },
  {
    id: "sch-014",
    name: "Daily eval regression · Helpdesk",
    description:
      "Runs the helpdesk golden set against production and the running experiment variant.",
    agentId: "agt-it-helpdesk",
    cron: "0 4 * * *",
    timezone: "UTC",
    enabled: true,
    avgDurationMs: 22 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 1, backoff: "none", delaySec: 0 },
    budgetPerRunUsd: 20,
    ownerId: "u-020",
    parameters: {
      dataset: "helpdesk-golden-v4",
      threshold: 85,
      variants: ["A", "B"],
    },
    notifications: { slack: "#helpdesk-quality" },
  },
  {
    id: "sch-015",
    name: "Shadow traffic replay",
    description:
      "Replays the last four hours of production alerts against the shadow version.",
    agentId: "agt-alert-correlator",
    cron: "0 */4 * * *",
    timezone: "UTC",
    enabled: false,
    avgDurationMs: 25 * MINUTE,
    concurrency: "Allow",
    retry: { attempts: 0, backoff: "none", delaySec: 0 },
    budgetPerRunUsd: 3,
    ownerId: "u-018",
    parameters: { target: "shadow", window: "PT4H" },
    notifications: {},
  },
  {
    id: "sch-016",
    name: "Leave balance reconciliation",
    description:
      "Checks leave balances quoted in answers against the HRIS and flags mismatches.",
    agentId: "agt-hr-answers",
    cron: "0 22 * * 5",
    timezone: "Asia/Tokyo",
    enabled: true,
    avgDurationMs: 8 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 2, backoff: "fixed", delaySec: 600 },
    budgetPerRunUsd: 2,
    ownerId: "u-007",
    parameters: { region: "APAC", source: "workday" },
    notifications: { email: ["people-ops-apac@acme.io"] },
  },
  {
    id: "sch-017",
    name: "Vendor spend anomaly check",
    description:
      "Looks for unusual vendor invoices in the last 24 hours. Disabled until the agent reaches production.",
    agentId: "agt-finance-copilot",
    cron: "30 6 * * 1-5",
    timezone: "UTC",
    enabled: false,
    avgDurationMs: 5 * MINUTE,
    concurrency: "Forbid",
    retry: { attempts: 1, backoff: "fixed", delaySec: 300 },
    budgetPerRunUsd: 4,
    ownerId: "u-016",
    parameters: { zThreshold: 3, vendors: "all" },
    notifications: { slack: "#finance-ops" },
  },
]

const failureMessages = [
  "Budget exceeded: run reached the per-run cap before finishing",
  "Tool timeout: search_knowledge did not respond within 30s",
  "Upstream 429 from the model provider after 3 retries",
  "Eval gate below threshold (82.1 < 85): regression flagged",
  "Semantic layer query failed: entity sem-vendor is deprecated",
  "Output schema validation failed on 14 of 220 items",
]

const tracesByAgent = agentTraces.reduce<Record<string, string[]>>((acc, t) => {
  ;(acc[t.agentId] ??= []).push(t.id)
  return acc
}, {})

function traceFor(agentId: string) {
  const list = tracesByAgent[agentId]
  return list?.length ? list[int(rng, 0, list.length - 1)] : undefined
}

const runs_: ScheduledRun[] = []
let runSeq = 0
const runId = () => `run-${(0x5a000 + ++runSeq * 613).toString(16)}`

function jitter(ms: number) {
  return Math.round(ms * (0.75 + rng() * 0.5))
}

export const schedules: Schedule[] = scheduleSeeds.map((s) => {
  const history = Array.from({ length: 14 }, () => jitter(s.avgDurationMs))
  // Past occurrences in the last 7 days (schedules that were disabled still
  // show a trail so the sheet has something to say).
  const since = new Date(NOW.getTime() - 7 * DAY)
  const occ = occurrences(s.cron, since, NOW, s.timezone)
  const keep = Math.min(occ.length, occ.length > 20 ? 8 : int(rng, 3, 7))
  const recent = occ.slice(-keep)
  let lastRun: Schedule["lastRun"]
  recent.forEach((at, i) => {
    const frozen = freezeAt(at)
    const status: RunStatus = frozen
      ? "Skipped"
      : weighted(rng, [
          ["Succeeded", 84],
          ["Failed", 9],
          ["Skipped", 7],
        ])
    const durationMs =
      status === "Skipped"
        ? 0
        : status === "Failed"
          ? jitter(s.avgDurationMs * 0.6)
          : jitter(s.avgDurationMs)
    const items =
      status === "Skipped"
        ? 0
        : int(rng, 8, 420) * (s.avgDurationMs > 20 * MINUTE ? 3 : 1)
    const run: ScheduledRun = {
      id: runId(),
      source: "schedule",
      sourceId: s.id,
      sourceName: s.name,
      agentId: s.agentId,
      startedAt: at,
      durationMs,
      status,
      itemsProcessed: items,
      cost:
        status === "Skipped"
          ? 0
          : Math.round(s.budgetPerRunUsd * (0.35 + rng() * 0.6) * 100) / 100,
      traceId: status === "Skipped" ? undefined : traceFor(s.agentId),
      error:
        status === "Failed"
          ? pick(rng, failureMessages)
          : status === "Skipped"
            ? frozen
              ? `Skipped: inside ${frozen.name} window`
              : `Skipped: previous run still active (${s.concurrency})`
            : undefined,
    }
    if (s.enabled || i < recent.length - 2) runs_.push(run)
    if (i === recent.length - 1) lastRun = { at, status, durationMs }
  })
  return { ...s, lastRun, history }
})

export function getSchedule(id: string) {
  return schedules.find((s) => s.id === id)
}

/* -------------------------------------------------------------------------- */
/* Triggers                                                                    */
/* -------------------------------------------------------------------------- */

type TriggerSeed = Omit<Trigger, "deliveries" | "lastFired">

/* ---- sample payloads built from real records ------------------------------ */

function criticalDriftPayload() {
  const s =
    driftSignals.find(
      (d) =>
        d.severity === "Critical" &&
        d.state === "Open" &&
        deployedAgents.find((a) => a.id === d.agentId)?.team === "Service Desk"
    ) ?? driftSignals[0]
  return {
    signal: s.id,
    agent: s.agentId,
    kind: s.kind,
    severity: s.severity,
    metric: s.metric,
    baseline: s.baseline,
    current: s.current,
  }
}

function budgetOverrunPayload(agentId: string, budgetId: string) {
  const agent = deployedAgents.find((a) => a.id === agentId)
  const budget = budgets.find((b) => b.id === budgetId)
  return {
    agent: agentId,
    budget: budgetId,
    cost: { today: agent?.metrics.costPerDay ?? 0 },
    limit: { daily: budget?.limit ?? 0 },
  }
}

function evalFailurePayload(agentId: string) {
  const run =
    evalRuns.find((r) => r.agentId === agentId && r.status === "Failed") ??
    evalRuns.find((r) => r.agentId === agentId)
  return {
    eval: {
      runId: run?.id ?? null,
      dataset: run?.datasetId ?? null,
      score: run?.composite ?? null,
    },
    gate: { threshold: 85 },
  }
}

function highRiskChangePayload() {
  const c =
    changes.find(
      (x) =>
        x.state === "Assess" && (x.risk === "High" || x.risk === "Very High")
    ) ??
    changes.find((x) => x.risk === "High" || x.risk === "Very High") ??
    changes[0]
  return {
    event: "change.updated",
    number: c.number,
    state: c.state,
    risk: c.risk,
  }
}

const triggerSeeds: TriggerSeed[] = [
  {
    id: "trg-001",
    name: "Prompt repo pull request",
    source: "Webhook",
    sourceDetail: "GitHub",
    condition: 'action == "opened" && repository == "agentops/prompts"',
    agentId: "agt-change-risk",
    action: "Run agent",
    fired24h: 6,
    failureRate: 0,
    status: "Active",
    secret: { kind: "HMAC-SHA256", status: "Valid" },
    ownerId: "u-004",
    samplePayload: {
      action: "opened",
      repository: "agentops/prompts",
      pull_request: {
        number: 418,
        title: "triage: tighten citation rule",
        author: "dramirez",
      },
    },
  },
  {
    id: "trg-002",
    name: "Helpdesk Slack mention",
    source: "Slack mention",
    sourceDetail: "#it-help",
    condition: 'channel == "#it-help" && mentions("@helpdesk")',
    agentId: "agt-it-helpdesk",
    action: "Run agent",
    fired24h: 142,
    failureRate: 1.4,
    status: "Active",
    secret: { kind: "Bearer token", status: "Valid" },
    ownerId: "u-020",
    samplePayload: {
      channel: "#it-help",
      user: "U04KX…",
      text: "@helpdesk my VPN keeps disconnecting every 10 minutes",
      ts: "1793106000.000200",
    },
  },
  {
    id: "trg-003",
    name: "Support inbox",
    source: "Email inbox",
    sourceDetail: "support@acme.io",
    condition: 'to == "support@acme.io" && !is_auto_reply && !spam_score > 0.8',
    agentId: "agt-support-triage",
    action: "Run agent",
    fired24h: 318,
    failureRate: 0.6,
    status: "Active",
    ownerId: "u-002",
    samplePayload: {
      from: "jane.doe@customer.example",
      to: "support@acme.io",
      subject: "Checkout failing with 5xx since this morning",
      is_auto_reply: false,
      spam_score: 0.02,
    },
  },
  {
    id: "trg-004",
    name: "Critical alert queue",
    source: "Queue",
    sourceDetail: "SQS · alerts-critical",
    condition:
      'queue == "alerts-critical" && severity in ["Critical", "Major"]',
    agentId: "agt-alert-correlator",
    action: "Run agent",
    fired24h: 57,
    failureRate: 3.5,
    status: "Active",
    ownerId: "u-018",
    samplePayload: {
      queue: "alerts-critical",
      severity: "Critical",
      ci: "ci-004",
      ciName: "Payments API",
      metric: "http_5xx_rate",
      value: 4.8,
    },
  },
  {
    id: "trg-005",
    name: "P1 incident created",
    source: "Record event",
    sourceDetail: "incident.created",
    condition: 'event == "incident.created" && priority == 1',
    agentId: "agt-alert-correlator",
    action: "Run agent",
    fired24h: 2,
    failureRate: 0,
    status: "Active",
    ownerId: "u-002",
    samplePayload: {
      event: "incident.created",
      number: "INC0010078",
      priority: 1,
      shortDescription: "Payments API returning 5xx for EU customers",
    },
  },
  {
    id: "trg-006",
    name: "Critical drift on Service Desk agents",
    source: "Drift signal",
    condition: 'severity == "Critical" && agent.team == "Service Desk"',
    agentId: "agt-support-triage",
    action: "Open review",
    fired24h: 1,
    failureRate: 0,
    status: "Active",
    ownerId: "u-002",
    samplePayload: criticalDriftPayload(),
  },
  {
    id: "trg-007",
    name: "Daily budget overrun",
    source: "Budget threshold",
    condition: "cost.today > budget.daily * 1.2",
    agentId: "agt-ops-analyst",
    action: "Notify",
    fired24h: 1,
    failureRate: 0,
    status: "Active",
    ownerId: "u-001",
    samplePayload: budgetOverrunPayload("agt-ops-analyst", "bud-004"),
  },
  {
    id: "trg-008",
    name: "Eval gate failure",
    source: "Eval failure",
    condition: "eval.score < gate.threshold",
    agentId: "agt-kb-curator",
    action: "Open review",
    fired24h: 3,
    failureRate: 41.7,
    status: "Error",
    ownerId: "u-002",
    samplePayload: evalFailurePayload("agt-kb-curator"),
  },
  {
    id: "trg-009",
    name: "Prompt push to main",
    source: "Git push",
    sourceDetail: "GitHub",
    condition: 'ref == "refs/heads/main" && any(paths, "prompts/**")',
    agentId: "agt-kb-curator",
    action: "Run agent",
    fired24h: 4,
    failureRate: 0,
    status: "Active",
    secret: { kind: "HMAC-SHA256", status: "Rotating" },
    ownerId: "u-002",
    samplePayload: {
      ref: "refs/heads/main",
      after: "9f3c1e2",
      paths: ["prompts/kb-curator/p-15.md"],
      pusher: "aokafor",
    },
  },
  {
    id: "trg-010",
    name: "HR policy updated",
    source: "Queue",
    sourceDetail: "Kafka · hr.policy.updated",
    condition: 'topic == "hr.policy.updated"',
    agentId: "agt-hr-answers",
    action: "Run agent",
    fired24h: 0,
    failureRate: 0,
    status: "Paused",
    ownerId: "u-007",
    samplePayload: {
      topic: "hr.policy.updated",
      policy: "parental-leave",
      version: 12,
      region: "EU",
    },
  },
  {
    id: "trg-011",
    name: "PagerDuty incident triggered",
    source: "Webhook",
    sourceDetail: "PagerDuty",
    condition: 'event.event_type == "incident.triggered" && urgency == "high"',
    agentId: "agt-alert-correlator",
    action: "Run agent",
    fired24h: 9,
    failureRate: 11.1,
    status: "Active",
    secret: { kind: "HMAC-SHA256", status: "Missing" },
    ownerId: "u-018",
    samplePayload: {
      event: { event_type: "incident.triggered", id: "Q1ABCD" },
      urgency: "high",
      service: "payments-api",
    },
  },
  {
    id: "trg-012",
    name: "High-risk change entered Assess",
    source: "Record event",
    sourceDetail: "change.updated",
    condition:
      'change.state == "Assess" && change.risk in ["High", "Very High"]',
    agentId: "agt-change-risk",
    action: "Run agent",
    fired24h: 5,
    failureRate: 0,
    status: "Active",
    ownerId: "u-004",
    samplePayload: highRiskChangePayload(),
  },
  {
    id: "trg-013",
    name: "Finance Slack mention",
    source: "Slack mention",
    sourceDetail: "#finance-ops",
    condition: 'channel == "#finance-ops" && mentions("@finance-copilot")',
    agentId: "agt-finance-copilot",
    action: "Run agent",
    fired24h: 0,
    failureRate: 0,
    status: "Paused",
    secret: { kind: "Bearer token", status: "Valid" },
    ownerId: "u-016",
    samplePayload: {
      channel: "#finance-ops",
      text: "@finance-copilot what did we spend on AWS in October?",
    },
  },
]

const triggers_: Trigger[] = triggerSeeds.map((t) => {
  const n = t.status === "Paused" ? int(rng, 2, 4) : int(rng, 7, 12)
  const spanHours = t.status === "Paused" ? 24 * 9 : 24
  const deliveries: TriggerDelivery[] = Array.from({ length: n }, (_, i) => {
    const at = new Date(
      NOW.getTime() - ((i + 0.4 + rng() * 0.5) / n) * spanHours * HOUR
    ).toISOString()
    const failed = chance(rng, t.failureRate / 100)
    const statusCode = failed
      ? pick(
          rng,
          t.secret?.status === "Missing" ? [401, 401, 500] : [500, 429, 502]
        )
      : pick(rng, [200, 200, 202])
    const delivery: TriggerDelivery = {
      id: `${t.id}-d${i + 1}`,
      at,
      statusCode,
      latencyMs: failed ? int(rng, 1200, 9000) : int(rng, 80, 900),
    }
    if (!failed && t.action === "Run agent" && t.status !== "Paused" && i < 6) {
      const run: ScheduledRun = {
        id: runId(),
        source: "trigger",
        sourceId: t.id,
        sourceName: t.name,
        agentId: t.agentId,
        startedAt: at,
        durationMs: int(rng, 4_000, 95_000),
        status: chance(rng, 0.9) ? "Succeeded" : "Failed",
        itemsProcessed: int(rng, 1, 12),
        cost: Math.round(rng() * 0.9 * 100) / 100,
        traceId: traceFor(t.agentId),
      }
      if (run.status === "Failed") run.error = pick(rng, failureMessages)
      runs_.push(run)
      delivery.runId = run.id
    }
    return delivery
  }).sort((a, b) => b.at.localeCompare(a.at))
  return {
    ...t,
    lastFired:
      t.fired24h > 0 || t.status === "Paused" ? deliveries[0]?.at : undefined,
    deliveries,
  }
})

export function getTrigger(id: string) {
  return triggers.find((t) => t.id === id)
}

/* -------------------------------------------------------------------------- */
/* Runs                                                                        */
/* -------------------------------------------------------------------------- */

// One in-flight run so the "Running" state is visible.
runs_.push({
  id: runId(),
  source: "trigger",
  sourceId: "trg-009",
  sourceName: "Prompt push to main",
  agentId: "agt-kb-curator",
  startedAt: new Date(NOW.getTime() - 6 * MINUTE).toISOString(),
  durationMs: 6 * MINUTE,
  status: "Running",
  itemsProcessed: 37,
  cost: 1.12,
})

export const scheduledRuns: ScheduledRun[] = runs_
  .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  .slice(0, 100)

const keptRuns = new Set(scheduledRuns.map((r) => r.id))

/** Triggers with deliveries that only link to runs still in `scheduledRuns`. */
export const triggers: Trigger[] = triggers_.map((t) => ({
  ...t,
  deliveries: t.deliveries.map((d) =>
    d.runId && !keptRuns.has(d.runId) ? { ...d, runId: undefined } : d
  ),
}))

export const runStatuses: RunStatus[] = [
  "Succeeded",
  "Failed",
  "Running",
  "Skipped",
]

export const triggerSources: TriggerSource[] = [
  "Webhook",
  "Slack mention",
  "Email inbox",
  "Queue",
  "Record event",
  "Drift signal",
  "Budget threshold",
  "Eval failure",
  "Git push",
]
