/**
 * Scripted assistant engine. Produces a deterministic "run" (reasoning, tool
 * calls, response, follow-ups) for a prompt + page context. Swap this module
 * for a real model/agent backend; the UI only consumes AssistantRun.
 */
import { priorityLabels } from "@/lib/constants"
import {
  changes,
  deployedAgents,
  driftSignals,
  experiments,
  getCatalogItem,
  getCi,
  getDeployedAgent,
  getGroup,
  getTrace,
  getUser,
  incidents,
  knowledgeArticles,
  modelRecommendations,
  problems,
  requests,
  reviewItems,
} from "@/lib/data"
import type { Change, DeployedAgent, Incident } from "@/lib/types"
import { proposals } from "./agents"

export interface AssistantContext {
  pathname: string
  recordType?:
    | "incident"
    | "change"
    | "problem"
    | "request"
    | "knowledge"
    | "agent"
    | "trace"
  recordNumber?: string
  title?: string
}

export interface SuggestedAction {
  id: string
  label: string
  description: string
  risk: "low" | "medium" | "high"
  requiresApproval: boolean
}

/** A record the assistant grounded its answer in. Rendered as a citation chip. */
export interface Source {
  id: string
  title: string
  href: string
  kind:
    | "incident"
    | "change"
    | "problem"
    | "knowledge"
    | "alert"
    | "request"
    | "agent"
    | "trace"
    | "drift"
    | "experiment"
}

export type RunStep =
  | { kind: "reasoning"; text: string }
  | {
      kind: "tool"
      name: string
      title: string
      input: Record<string, unknown>
      output: unknown
      durationMs: number
    }
  | { kind: "text"; markdown: string }
  | { kind: "sources"; items: Source[] }
  | { kind: "actions"; actions: SuggestedAction[] }
  | { kind: "suggestions"; items: string[] }

export interface AssistantRun {
  steps: RunStep[]
}

export const recordTypeLabel: Record<
  NonNullable<AssistantContext["recordType"]>,
  string
> = {
  incident: "Incident",
  change: "Change",
  problem: "Problem",
  request: "Request",
  knowledge: "Article",
  agent: "Agent",
  trace: "Trace",
}

function src(kind: Source["kind"], id: string, title: string): Source {
  const href =
    kind === "incident"
      ? `/itsm/incidents/${id}`
      : kind === "change"
        ? `/itsm/changes/${id}`
        : kind === "problem"
          ? `/itsm/problems/${id}`
          : kind === "knowledge"
            ? `/itsm/knowledge/${id}`
            : kind === "alert"
              ? "/itom/alerts"
              : kind === "agent"
                ? `/agentops/agents/${id}`
                : kind === "trace"
                  ? `/agentops/traces/${id}`
                  : kind === "drift"
                    ? "/agentops/drift"
                    : kind === "experiment"
                      ? `/agentops/experiments?open=${id}`
                      : `/itsm/requests/${id}`
  return { id, title, href, kind }
}

/**
 * Compact, deterministic insights for a record page (similar records, the
 * suggested next step and a confidence score). Used by <RecordAiInsights />.
 */
export interface RecordInsights {
  confidence: number
  similar: { source: Source; state: string; meta: string }[]
  nextAction: {
    label: string
    description: string
    risk: SuggestedAction["risk"]
  }
  signals: string[]
}

export function recordInsights(ctx: AssistantContext): RecordInsights {
  if (ctx.recordType === "incident" && ctx.recordNumber) {
    const inc = incidents.find((i) => i.number === ctx.recordNumber)
    if (inc) {
      const similar = incidents
        .filter(
          (i) =>
            i.number !== inc.number &&
            i.category === inc.category &&
            i.subcategory === inc.subcategory
        )
        .slice(0, 3)
        .map((s) => ({
          source: src("incident", s.number, s.shortDescription),
          state: s.state,
          meta: `P${s.priority} · ${getGroup(s.assignmentGroupId)?.name ?? ""}`,
        }))
      const resolved = similar.filter((s) =>
        ["Resolved", "Closed"].includes(s.state)
      ).length
      return {
        confidence: inc.majorIncident ? 0.86 : inc.ciId ? 0.78 : 0.64,
        similar,
        nextAction: inc.majorIncident
          ? {
              label: "Post stakeholder update",
              description:
                "Bridge has been quiet for 20 minutes; the next cadence update is due.",
              risk: "medium",
            }
          : !inc.assignedToId
            ? {
                label: "Assign to on-call engineer",
                description: `${getGroup(inc.assignmentGroupId)?.name ?? "The group"} has capacity; SLA ${inc.slaBreached ? "already breached" : "is still on track"}.`,
                risk: "medium",
              }
            : resolved > 0
              ? {
                  label: `Apply fix from ${similar.find((s) => ["Resolved", "Closed"].includes(s.state))?.source.id}`,
                  description:
                    "Same category and symptom; the resolution notes match this caller's description.",
                  risk: "low",
                }
              : {
                  label: "Capture troubleshooting in a work note",
                  description:
                    "No work note in the last 2 hours; the caller has not been updated.",
                  risk: "low",
                },
        signals: [
          inc.slaBreached ? "SLA breached" : "SLA on track",
          inc.ciId ? "CI linked" : "No CI linked",
          inc.problemId ? `Linked to ${inc.problemId}` : "No problem record",
          `${resolved} of ${similar.length} similar resolved`,
        ],
      }
    }
  }
  if (ctx.recordType === "change" && ctx.recordNumber) {
    const chg = changes.find((c) => c.number === ctx.recordNumber)
    if (chg) {
      const similar = changes
        .filter((c) => c.number !== chg.number && c.category === chg.category)
        .slice(0, 3)
        .map((s) => ({
          source: src("change", s.number, s.shortDescription),
          state: s.state,
          meta: `${s.type} · ${s.risk} risk`,
        }))
      return {
        confidence: 0.81,
        similar,
        nextAction: chg.cabRequired
          ? {
              label: "Draft CAB notes",
              description:
                "Summarize blast radius, backout plan and test evidence for the board.",
              risk: "low",
            }
          : {
              label: "Add backout validation step",
              description:
                "Similar changes failed 1 of 4 times; the backout plan has no verification step.",
              risk: "low",
            },
        signals: [
          `${chg.risk} risk`,
          chg.cabRequired ? "CAB required" : "Standard approval",
          `${similar.length} similar changes`,
        ],
      }
    }
  }
  return {
    confidence: 0.6,
    similar: [],
    nextAction: {
      label: "Summarize this record",
      description: "Generate a plain-language summary and suggested next step.",
      risk: "low",
    },
    signals: [],
  }
}

export function contextFromPathname(pathname: string): AssistantContext {
  const seg = pathname.split("/").filter(Boolean)
  const last = seg[seg.length - 1] ?? ""
  if (seg[1] === "incidents" && last.startsWith("INC")) {
    const inc = incidents.find((i) => i.number === last)
    return {
      pathname,
      recordType: "incident",
      recordNumber: last,
      title: inc?.shortDescription,
    }
  }
  if (seg[1] === "changes" && last.startsWith("CHG"))
    return {
      pathname,
      recordType: "change",
      recordNumber: last,
      title: changes.find((c) => c.number === last)?.shortDescription,
    }
  if (seg[1] === "problems" && last.startsWith("PRB"))
    return {
      pathname,
      recordType: "problem",
      recordNumber: last,
      title: problems.find((p) => p.number === last)?.shortDescription,
    }
  if (seg[1] === "requests" && last.startsWith("REQ"))
    return {
      pathname,
      recordType: "request",
      recordNumber: last,
      title: `Request ${last}`,
    }
  if (seg[1] === "knowledge" && last.startsWith("KB"))
    return {
      pathname,
      recordType: "knowledge",
      recordNumber: last,
      title: knowledgeArticles.find((k) => k.number === last)?.title,
    }
  if (seg[0] === "agentops" && seg[1] === "agents" && last.startsWith("agt-"))
    return {
      pathname,
      recordType: "agent",
      recordNumber: last,
      title: getDeployedAgent(last)?.name,
    }
  if (seg[0] === "agentops" && seg[1] === "traces" && last.startsWith("tr_"))
    return {
      pathname,
      recordType: "trace",
      recordNumber: last,
      title: getTrace(last)?.userQuery,
    }
  return { pathname }
}

export function starterPrompts(ctx: AssistantContext): string[] {
  switch (ctx.recordType) {
    case "incident":
      return [
        "Summarize this incident",
        "Draft a customer update",
        "Find similar incidents",
        "What's the likely root cause?",
      ]
    case "change":
      return [
        "Assess the risk of this change",
        "What services are impacted?",
        "Draft CAB notes",
        "Check for schedule conflicts",
      ]
    case "problem":
      return [
        "Summarize the investigation so far",
        "Suggest a root cause hypothesis",
        "Draft a known error article",
      ]
    case "request":
      return [
        "Where is this request stuck?",
        "Summarize the items and approvals",
        "Draft an update for the requester",
      ]
    case "knowledge":
      return [
        "Is this article still accurate?",
        "Summarize this article",
        "Which incidents could this article resolve?",
      ]
    case "agent":
      return [
        "How is this agent doing?",
        "Why is quality drifting?",
        "Should we change the model?",
      ]
    case "trace":
      return [
        "Explain this trace",
        "Why was this answer flagged?",
        "Where did the time go?",
      ]
    default:
      return [
        "What needs my attention today?",
        "Which agents are over budget?",
        "Why did Support Triage's quality drop this week?",
        "Show me the latest prompt version for the helpdesk agent",
        "Which changes are scheduled this week?",
        "Summarize service health",
      ]
  }
}

function fmtInc(i: Incident) {
  return `| ${i.number} | ${i.shortDescription} | P${i.priority} | ${i.state} | ${getGroup(i.assignmentGroupId)?.name ?? ""} |`
}

const openStates = ["New", "In Progress", "On Hold"]

function weekAvg(values: number[]) {
  return values.reduce((s, v) => s + v, 0) / Math.max(1, values.length)
}

/** Deployed agent named in a prompt ("helpdesk", "Support Triage"…), if any. */
function agentFromPrompt(q: string) {
  const byName = deployedAgents.find((a) => q.includes(a.name.toLowerCase()))
  if (byName) return byName
  return deployedAgents.find((a) =>
    a.name
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length > 3 && w !== "copilot" && q.includes(w))
  )
}

export function planResponse(
  prompt: string,
  ctx: AssistantContext
): AssistantRun {
  const q = prompt.toLowerCase()
  const has = (...words: string[]) => words.some((w) => q.includes(w))

  // ---- Incident context -------------------------------------------------
  if (ctx.recordType === "incident" && ctx.recordNumber) {
    const inc = incidents.find((i) => i.number === ctx.recordNumber)
    if (inc) {
      const ci = getCi(inc.ciId)
      const similar = incidents
        .filter(
          (i) =>
            i.number !== inc.number &&
            i.category === inc.category &&
            i.subcategory === inc.subcategory
        )
        .slice(0, 5)
      const kb = knowledgeArticles
        .filter(
          (k) =>
            k.state === "Published" &&
            k.knowledgeBase ===
              (inc.category === "Security" ? "Security" : "IT")
        )
        .slice(0, 2)

      if (has("summar", "overview", "tl;dr", "brief")) {
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Reading ${inc.number}, its work notes and the linked CI ${ci?.name ?? "(none)"}. Checking related problem and change records to build a timeline.`,
            },
            {
              kind: "tool",
              name: "read_incident",
              title: "Read incident",
              input: { number: inc.number, include: ["work_notes", "related"] },
              output: {
                state: inc.state,
                priority: `P${inc.priority}`,
                opened: inc.opened,
                ci: ci?.name,
                problem: inc.problemId ?? null,
                change: inc.changeId ?? null,
                workNotes: 5,
              },
              durationMs: 420,
            },
            {
              kind: "text",
              markdown: `**Summary of ${inc.number}**\n\n${inc.shortDescription}. Reported via ${inc.channel.toLowerCase()} by ${getUser(inc.callerId)?.name ?? "a user"}; currently **${inc.state}** at **P${inc.priority} · ${priorityLabels[inc.priority]}** with ${getGroup(inc.assignmentGroupId)?.name}${inc.assignedToId ? ` (${getUser(inc.assignedToId)?.name})` : " (unassigned)"}.\n\n**What we know**\n- Affected CI: ${ci ? `${ci.name} (${ci.class}, ${ci.environment})` : "not linked yet"}\n- ${inc.problemId ? `Linked to problem **${inc.problemId}**` : "No problem record linked"}${inc.changeId ? `; related change **${inc.changeId}**` : ""}\n- ${inc.majorIncident ? "Declared a **major incident**: bridge is active" : "Not a major incident"}\n- SLA ${inc.slaBreached ? "has **breached**" : "is on track"}\n\n**Suggested next step**\n${inc.majorIncident ? "Confirm rollback of the 14:05 deploy and post a stakeholder update." : inc.assignedToId ? "Capture troubleshooting results in a work note and update the caller." : "Assign to an engineer in the group and acknowledge the caller."}`,
            },
            {
              kind: "sources",
              items: [
                src("incident", inc.number, inc.shortDescription),
                ...(inc.problemId
                  ? [src("problem", inc.problemId, "Linked problem")]
                  : []),
                ...(inc.changeId
                  ? [src("change", inc.changeId, "Related change")]
                  : []),
              ],
            },
            {
              kind: "actions",
              actions: [
                {
                  id: "post-note",
                  label: "Post summary as work note",
                  description: "Adds this summary to the activity stream",
                  risk: "low",
                  requiresApproval: false,
                },
                {
                  id: "notify",
                  label: "Send caller update",
                  description: "Email the caller a plain-language status",
                  risk: "medium",
                  requiresApproval: true,
                },
              ],
            },
            {
              kind: "suggestions",
              items: [
                "Draft a customer update",
                "Find similar incidents",
                "What's the likely root cause?",
              ],
            },
          ],
        }
      }
      if (has("similar", "duplicate", "related", "seen this before")) {
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Searching incidents in ${inc.category} › ${inc.subcategory} and incidents on ${ci?.name ?? "the same CI"} from the last 90 days. Ranking by text similarity and shared CI.`,
            },
            {
              kind: "tool",
              name: "search_incidents",
              title: "Search similar incidents",
              input: {
                category: inc.category,
                subcategory: inc.subcategory,
                ci: ci?.id,
                window: "90d",
              },
              output: similar.map((s) => ({
                number: s.number,
                state: s.state,
                priority: `P${s.priority}`,
                similarity:
                  0.71 + (parseInt(s.number.slice(-2), 10) % 20) / 100,
              })),
              durationMs: 680,
            },
            {
              kind: "text",
              markdown: `I found **${similar.length} similar incidents**:\n\n| Number | Short description | Priority | State | Group |\n|---|---|---|---|---|\n${similar.map(fmtInc).join("\n")}\n\n${similar.some((s) => s.state === "Resolved" || s.state === "Closed") ? `**${similar.filter((s) => ["Resolved", "Closed"].includes(s.state)).length}** of these were resolved. The most common resolution was *re-authentication and re-registering the device*, which also appears in ${kb[0]?.number ?? "a knowledge article"}.` : "None are resolved yet; this may be a recurring issue worth a problem record."}`,
            },
            {
              kind: "sources",
              items: [
                ...similar
                  .slice(0, 3)
                  .map((s) => src("incident", s.number, s.shortDescription)),
                ...kb
                  .slice(0, 1)
                  .map((k) => src("knowledge", k.number, k.title)),
              ],
            },
            {
              kind: "actions",
              actions: [
                {
                  id: "link-problem",
                  label: inc.problemId
                    ? "Attach similar incidents to problem"
                    : "Create problem from these incidents",
                  description:
                    "Groups the recurring incidents under one root-cause investigation",
                  risk: "medium",
                  requiresApproval: true,
                },
                {
                  id: "apply-fix",
                  label: `Apply resolution from ${similar[0]?.number ?? "similar incident"}`,
                  description: "Copies the resolution notes into a work note",
                  risk: "low",
                  requiresApproval: false,
                },
              ],
            },
            {
              kind: "suggestions",
              items: ["Summarize this incident", "Draft a customer update"],
            },
          ],
        }
      }
      if (has("root cause", "rca", "why", "cause")) {
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Correlating the incident timeline with alerts and changes on ${ci?.name ?? "the affected CI"} and its upstream dependencies. Looking for a change window overlapping the first alert.`,
            },
            {
              kind: "tool",
              name: "search_alerts",
              title: "Correlate alerts",
              input: { ci: ci?.id, since: inc.opened },
              output: inc.majorIncident
                ? [
                    {
                      alert: "ALT0060001",
                      metric: "http.5xx.rate",
                      severity: "Critical",
                    },
                    {
                      alert: "ALT0060002",
                      metric: "pod.crashloop",
                      severity: "Critical",
                    },
                    {
                      alert: "ALT0060003",
                      metric: "container.memory.usage",
                      severity: "Major",
                    },
                  ]
                : [
                    {
                      alert: "ALT0060010",
                      metric: "ntp.offset",
                      severity: "Warning",
                    },
                  ],
              durationMs: 540,
            },
            {
              kind: "tool",
              name: "search_changes",
              title: "Find overlapping changes",
              input: { ci: ci?.id, window: "±24h" },
              output: inc.changeId
                ? [
                    {
                      number: inc.changeId,
                      type: "Emergency",
                      state: "Implement",
                    },
                  ]
                : [],
              durationMs: 310,
            },
            {
              kind: "text",
              markdown: inc.majorIncident
                ? `**Most likely root cause (confidence 0.86)**\n\n\`payments-svc v2.14.0\`, deployed at **14:05 UTC**, leaks memory in its retry handler. Pods hit their memory limit (**92%** → OOMKilled) and crash-loop, which surfaces as 5xx on the Payments API.\n\n**Evidence**\n1. Memory alert fired 11 minutes after the deploy, before the 5xx alert.\n2. Crash-loop restarts correlate 1:1 with error-rate spikes.\n3. Hotfix **${inc.changeId}** targets exactly this handler.\n\n**Recommendation:** complete the rollback to v2.13.2, then let the hotfix go through an expedited CAB.`
                : `**Hypothesis (confidence 0.62)**\n\nThe symptoms point to a configuration drift on **${ci?.name ?? "the affected CI"}** rather than a code change; no deployment overlaps the incident window and only a low-severity alert fired.\n\n**Next diagnostic steps**\n1. Compare current config with the last known-good baseline.\n2. Check whether other callers in ${getUser(inc.callerId)?.location ?? "the same location"} are affected.\n3. If confirmed, open a problem record and document the workaround.`,
            },
            {
              kind: "sources",
              items: [
                ...(inc.majorIncident
                  ? [
                      src(
                        "alert",
                        "ALT0060001",
                        "http.5xx.rate on payments-svc"
                      ),
                      src(
                        "alert",
                        "ALT0060002",
                        "pod.crashloop on payments-svc"
                      ),
                    ]
                  : [src("alert", "ALT0060010", "ntp.offset warning")]),
                ...(inc.changeId
                  ? [src("change", inc.changeId, "Overlapping change")]
                  : []),
              ],
            },
            {
              kind: "actions",
              actions: [
                {
                  id: "create-problem",
                  label: "Create problem record",
                  description: "Pre-filled with this hypothesis and evidence",
                  risk: "medium",
                  requiresApproval: true,
                },
                {
                  id: "post-rca",
                  label: "Add RCA note",
                  description: "Posts the analysis as a work note",
                  risk: "low",
                  requiresApproval: false,
                },
              ],
            },
            {
              kind: "suggestions",
              items: ["Draft a customer update", "Find similar incidents"],
            },
          ],
        }
      }
      // default for incident: customer update
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Drafting a plain-language update for ${getUser(inc.callerId)?.name ?? "the caller"} based on the latest work notes. Avoiding internal jargon and committing only to the next update time, not a fix time.`,
          },
          {
            kind: "tool",
            name: "read_work_notes",
            title: "Read latest work notes",
            input: { number: inc.number, limit: 3 },
            output: { notes: 3, lastUpdate: inc.updated },
            durationMs: 260,
          },
          {
            kind: "text",
            markdown: `**Draft customer update**\n\n> Hi ${getUser(inc.callerId)?.name.split(" ")[0] ?? "there"},\n>\n> We're actively working on **${inc.shortDescription.toLowerCase()}** (${inc.number}). Our ${getGroup(inc.assignmentGroupId)?.name} team has identified the affected component and ${inc.majorIncident ? "is rolling back a recent change" : "is applying a fix"}.\n>\n> ${inc.majorIncident ? "We expect service to recover within the next 30 minutes" : "We'll confirm once the fix is in place"} and will send the next update by **${new Date(new Date(inc.updated).getTime() + 3_600_000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC**.\n>\n> Thanks for your patience.\n\nTone: reassuring, no blame, one clear commitment.`,
          },
          {
            kind: "sources",
            items: [src("incident", inc.number, inc.shortDescription)],
          },
          {
            kind: "actions",
            actions: [
              {
                id: "send-update",
                label: "Send to caller",
                description:
                  "Posts as an additional comment and emails the caller",
                risk: "medium",
                requiresApproval: true,
              },
              {
                id: "copy",
                label: "Copy to clipboard",
                description: "Copy the draft to paste elsewhere",
                risk: "low",
                requiresApproval: false,
              },
            ],
          },
          {
            kind: "suggestions",
            items: [
              "Make it shorter",
              "Summarize this incident",
              "What's the likely root cause?",
            ],
          },
        ],
      }
    }
  }

  // ---- Change context ---------------------------------------------------
  if (ctx.recordType === "change" && ctx.recordNumber) {
    const chg = changes.find((c) => c.number === ctx.recordNumber) as
      Change | undefined
    if (chg) {
      const ci = getCi(chg.ciId)
      const openOnCi = incidents.filter(
        (i) => i.ciId === chg.ciId && openStates.includes(i.state)
      ).length
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Scoring ${chg.number}: blast radius from service dependencies, open incidents on ${ci?.name ?? "the CI"}, outcomes of past similar changes and conflicts in the maintenance window.`,
          },
          {
            kind: "tool",
            name: "search_services",
            title: "Compute blast radius",
            input: { ci: ci?.id, depth: 2 },
            output: {
              upstreamServices: ci?.class === "Business Service" ? 0 : 2,
              tier1: ci?.businessCriticality === "1 - Most Critical" ? 1 : 0,
              openIncidents: openOnCi,
            },
            durationMs: 510,
          },
          {
            kind: "tool",
            name: "read_change_history",
            title: "Past similar changes",
            input: { category: chg.category, ci: ci?.id },
            output: {
              total: 4,
              successful: 3,
              backedOut: 1,
              lastFailure: "CHG0030988: DNS cutover left stale cache",
            },
            durationMs: 390,
          },
          {
            kind: "text",
            markdown: `**Risk assessment for ${chg.number}**, current rating **${chg.risk}**\n\n| Factor | Finding | Weight |\n|---|---|---|\n| Blast radius | ${ci ? `${ci.name} supports ${ci.businessCriticality.startsWith("1") ? "tier-1" : "non-critical"} services` : "No CI linked"} | ${ci?.businessCriticality.startsWith("1") ? "High" : "Low"} |\n| Open incidents on CI | ${openOnCi} open | ${openOnCi > 0 ? "Medium" : "Low"} |\n| History | 3 of 4 similar changes succeeded | Medium |\n| Window | ${new Date(chg.plannedStart).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })} evening, inside the standard window | Low |\n\n**Recommendation:** ${chg.risk === "Low" ? "keep as **Low** risk; standard approval is sufficient." : "treat as **" + (openOnCi > 0 ? "High" : chg.risk) + "** risk and require CAB review. Add an explicit backout validation step and a 2-hour post-change monitoring period."}`,
          },
          {
            kind: "sources",
            items: [src("change", chg.number, chg.shortDescription)],
          },
          {
            kind: "actions",
            actions: [
              {
                id: "set-risk",
                label: "Apply recommended risk",
                description: "Updates the risk field and CAB flag",
                risk: "medium",
                requiresApproval: true,
              },
              {
                id: "cab-notes",
                label: "Draft CAB notes",
                description: "Adds the assessment to the change's work notes",
                risk: "low",
                requiresApproval: false,
              },
            ],
          },
          {
            kind: "suggestions",
            items: [
              "What services are impacted?",
              "Check for schedule conflicts",
            ],
          },
        ],
      }
    }
  }

  // ---- Problem context --------------------------------------------------
  if (ctx.recordType === "problem" && ctx.recordNumber) {
    const prb = problems.find((p) => p.number === ctx.recordNumber)
    if (prb) {
      const ci = prb.ciId ? getCi(prb.ciId) : undefined
      const linked = incidents
        .filter((i) => i.problemId === prb.number)
        .slice(0, 5)
      const owner = prb.assignedToId
        ? getUser(prb.assignedToId)?.name
        : undefined
      const group =
        getGroup(prb.assignmentGroupId)?.name ?? "the assigned group"
      if (has("known error", "article", "kb", "draft", "document")) {
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Collecting the workaround and root cause from ${prb.number}, then checking the knowledge base for an existing article before drafting a new one.`,
            },
            {
              kind: "tool",
              name: "search_knowledge",
              title: "Check for existing articles",
              input: { query: prb.shortDescription, base: "IT" },
              output: { matches: 0 },
              durationMs: 420,
            },
            {
              kind: "text",
              markdown: `**Draft known error article**\n\n**Title:** ${prb.shortDescription}\n\n**Symptoms**\n${
                linked.length
                  ? linked
                      .slice(0, 3)
                      .map((i) => `- ${i.shortDescription} (${i.number})`)
                      .join("\n")
                  : "- Reported through the linked incidents"
              }\n\n**Cause**\n${prb.rootCause ?? "Root cause is still under investigation; this article documents the workaround only."}\n\n**Workaround**\n${prb.workaround ?? "No workaround has been confirmed yet. Record one on the problem before publishing."}\n\n**Affected CI:** ${ci ? `${ci.name} (${ci.class})` : "not linked"}`,
            },
            {
              kind: "sources",
              items: [
                src("problem", prb.number, prb.shortDescription),
                ...linked
                  .slice(0, 2)
                  .map((i) => src("incident", i.number, i.shortDescription)),
              ],
            },
            {
              kind: "actions",
              actions: [
                {
                  id: "create-article",
                  label: "Create draft article",
                  description:
                    "Saves this draft to the IT knowledge base for review",
                  risk: "medium",
                  requiresApproval: true,
                },
                {
                  id: "mark-known-error",
                  label: prb.knownError
                    ? "Update known error"
                    : "Mark as known error",
                  description:
                    "Flags the problem so the service desk sees the workaround",
                  risk: "low",
                  requiresApproval: false,
                },
              ],
            },
            {
              kind: "suggestions",
              items: [
                "Summarize the investigation so far",
                "Suggest a root cause hypothesis",
              ],
            },
          ],
        }
      }
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Reading ${prb.number}, its ${prb.relatedIncidents} linked incident${prb.relatedIncidents === 1 ? "" : "s"} and the history of ${ci?.name ?? "the affected CI"} to summarize what has been ruled in and out.`,
          },
          {
            kind: "tool",
            name: "read_problem",
            title: "Read problem & linked incidents",
            input: { number: prb.number, include: ["incidents", "work_notes"] },
            output: {
              state: prb.state,
              priority: `P${prb.priority}`,
              knownError: prb.knownError,
              linkedIncidents: prb.relatedIncidents,
              workaround: Boolean(prb.workaround),
              rootCause: Boolean(prb.rootCause),
            },
            durationMs: 460,
          },
          {
            kind: "text",
            markdown: `**${prb.number} · ${prb.shortDescription}**\n\nCurrently **${prb.state}** at **P${prb.priority}** with ${group}${owner ? ` (${owner})` : ""}. **${prb.relatedIncidents}** incident${prb.relatedIncidents === 1 ? " is" : "s are"} linked${ci ? `, all touching **${ci.name}**` : ""}.\n\n**What we know**\n- ${prb.workaround ? `Workaround in place: ${prb.workaround}` : "No workaround recorded yet"}\n- ${prb.rootCause ? `Root cause identified: ${prb.rootCause}` : "Root cause not yet confirmed"}\n- ${prb.knownError ? "Published as a known error" : "Not yet flagged as a known error"}\n\n**Hypothesis to test next**\n${prb.rootCause ? "Validate the fix in a non-production environment and schedule a change to remove the workaround." : ci ? `Compare the configuration of **${ci.name}** against its last known-good baseline; the linked incidents cluster around the same CI, which points to drift rather than user error.` : "Link the affected CI first; without it, impact analysis and alert correlation cannot narrow the cause."}`,
          },
          {
            kind: "sources",
            items: [
              src("problem", prb.number, prb.shortDescription),
              ...linked
                .slice(0, 2)
                .map((i) => src("incident", i.number, i.shortDescription)),
            ],
          },
          {
            kind: "actions",
            actions: [
              {
                id: "post-summary",
                label: "Post summary as work note",
                description: "Adds this investigation summary to the problem",
                risk: "low",
                requiresApproval: false,
              },
              {
                id: "raise-change",
                label: "Raise a change for the fix",
                description:
                  "Creates a Normal change pre-filled from this problem",
                risk: "medium",
                requiresApproval: true,
              },
            ],
          },
          {
            kind: "suggestions",
            items: [
              "Draft a known error article",
              "Which incidents are linked?",
            ],
          },
        ],
      }
    }
  }

  // ---- Request context --------------------------------------------------
  if (ctx.recordType === "request" && ctx.recordNumber) {
    const req = requests.find((r) => r.number === ctx.recordNumber)
    if (req) {
      const who = getUser(req.requestedForId)?.name ?? "the requester"
      const items = req.items.map(
        (i) =>
          `${getCatalogItem(i.catalogItemId)?.name ?? i.number}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`
      )
      const waitingApproval =
        req.state === "Pending Approval" || req.stage === "Waiting for Approval"
      const stuck = waitingApproval
        ? "waiting on approval"
        : req.state === "Closed Incomplete"
          ? "closed incomplete"
          : req.stage === "Fulfillment"
            ? "in fulfillment"
            : `in ${req.stage.toLowerCase()}`
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Reading ${req.number} with its ${req.items.length} item${req.items.length === 1 ? "" : "s"}, approval state and fulfillment tasks to see what is blocking delivery.`,
          },
          {
            kind: "tool",
            name: "read_request",
            title: "Read request & tasks",
            input: {
              number: req.number,
              include: ["items", "approvals", "tasks"],
            },
            output: {
              state: req.state,
              stage: req.stage,
              approval: req.approval,
              items: items.length,
              due: req.dueDate,
            },
            durationMs: 390,
          },
          {
            kind: "text",
            markdown: `**${req.number}** for ${who} is **${req.state}**, currently ${stuck}.\n\n**Items**\n${items.map((n) => `- ${n}`).join("\n")}\n\n**Status**\n- Approval: **${req.approval}**\n- Stage: **${req.stage}**\n- Due ${new Date(req.dueDate) < new Date(req.updated) ? "**overdue**" : "on track"}\n\n**Suggested next step**\n${waitingApproval ? "Nudge the approver; this request has been waiting longer than the typical approval window." : req.state === "Closed Incomplete" ? "Review the incomplete tasks with the fulfillment group and tell the requester what was not delivered." : "No action needed; fulfillment is progressing."}`,
          },
          {
            kind: "sources",
            items: [src("request", req.number, `Request for ${who}`)],
          },
          {
            kind: "actions",
            actions: [
              {
                id: "remind-approver",
                label: "Send approval reminder",
                description: "Notifies the pending approver with a summary",
                risk: "medium",
                requiresApproval: true,
              },
              {
                id: "update-requester",
                label: "Post update for requester",
                description: "Adds a plain-language status comment",
                risk: "low",
                requiresApproval: false,
              },
            ],
          },
          {
            kind: "suggestions",
            items: [
              "Draft an update for the requester",
              "Summarize the items and approvals",
            ],
          },
        ],
      }
    }
  }

  // ---- Knowledge context ------------------------------------------------
  if (ctx.recordType === "knowledge" && ctx.recordNumber) {
    const art = knowledgeArticles.find((k) => k.number === ctx.recordNumber)
    if (art) {
      const total = art.helpful + art.notHelpful
      const score = total ? Math.round((art.helpful / total) * 100) : null
      const related = incidents
        .filter((i) =>
          art.tags.some((t) =>
            i.shortDescription.toLowerCase().includes(t.toLowerCase())
          )
        )
        .slice(0, 4)
      const stale = score !== null && score < 60
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Reading ${art.number}, its feedback ratio and the incidents that mention its tags to judge whether the content is still accurate.`,
          },
          {
            kind: "tool",
            name: "read_article",
            title: "Read article & feedback",
            input: { number: art.number },
            output: {
              state: art.state,
              views: art.views,
              helpful: art.helpful,
              notHelpful: art.notHelpful,
              updated: art.updated,
              matchingIncidents: related.length,
            },
            durationMs: 350,
          },
          {
            kind: "text",
            markdown: `**${art.number} · ${art.title}**\n\n${art.summary}\n\n**Health**\n- ${art.views.toLocaleString("en-US")} views · ${score === null ? "no feedback yet" : `**${score}%** found it helpful`}\n- ${stale ? "Feedback suggests the steps are **out of date**; review before the next publish cycle." : "Feedback is healthy; no rewrite needed."}\n- **${related.length}** recent incident${related.length === 1 ? "" : "s"} match this article's tags${related.length ? ", so linking it from the service desk could deflect tickets" : ""}.`,
          },
          {
            kind: "sources",
            items: [
              src("knowledge", art.number, art.title),
              ...related
                .slice(0, 3)
                .map((i) => src("incident", i.number, i.shortDescription)),
            ],
          },
          {
            kind: "actions",
            actions: stale
              ? [
                  {
                    id: "flag-review",
                    label: "Flag for review",
                    description:
                      "Assigns the article to its author for a refresh",
                    risk: "low",
                    requiresApproval: false,
                  },
                ]
              : [
                  {
                    id: "attach-article",
                    label: "Attach to matching incidents",
                    description: `Links ${art.number} to ${related.length} open incident${related.length === 1 ? "" : "s"}`,
                    risk: "medium",
                    requiresApproval: true,
                  },
                ],
          },
          {
            kind: "suggestions",
            items: [
              "Summarize this article",
              "Which incidents could this article resolve?",
            ],
          },
        ],
      }
    }
  }

  // ---- Deployed agent context -------------------------------------------
  if (ctx.recordType === "agent" && ctx.recordNumber) {
    const agent = getDeployedAgent(ctx.recordNumber)
    if (agent) {
      const m = agent.metrics
      const drift = driftSignals.filter(
        (d) => d.agentId === agent.id && d.state !== "Resolved"
      )
      const recs = modelRecommendations.filter(
        (r) =>
          r.agentId === agent.id &&
          (r.status === "New" || r.status === "Testing")
      )
      const exp = experiments.find(
        (e) => e.agentId === agent.id && e.status === "Running"
      )
      const pending = reviewItems.filter(
        (r) => r.agentId === agent.id && r.status === "Pending"
      ).length
      const agentSrc = src("agent", agent.id, agent.name)
      if (
        has("model", "switch", "cheaper", "upgrade", "recommend", "change the")
      ) {
        const top = recs[0]
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Comparing ${agent.name}'s current model against shadow evaluations on ${agent.evalDataset}, the running experiment and provider deprecation notices.`,
            },
            {
              kind: "tool",
              name: "read_recommendations",
              title: "Read model recommendations",
              input: { agent: agent.id },
              output: {
                open: recs.length,
                experiment: exp?.id ?? null,
                topConfidence: top?.confidence ?? null,
              },
              durationMs: 380,
            },
            {
              kind: "text",
              markdown: top
                ? `**Recommendation: ${top.title}**\n\n${top.summary}\n\n| Metric | Now | Proposed |\n|---|---|---|\n${top.evidence.map((e) => `| ${e.metric} | ${e.from} | ${e.good ? "**" : ""}${e.to}${e.good ? "**" : ""} |`).join("\n")}\n\nConfidence **${Math.round(top.confidence * 100)}%**${top.savingsPerMonth ? ` · saves about **$${top.savingsPerMonth.toLocaleString("en-US")}/month**` : ""}.${exp ? ` The running experiment **${exp.name}** is at ${Math.round(exp.significance * 100)}% probability that the variant wins; ${exp.significance >= 0.95 ? "it is safe to promote." : "let it reach 95% before promoting."}` : " Start with a 10% A/B split so the change is reversible."}`
                : `**No model change recommended right now.**\n\n${agent.name} runs on **${agent.modelId}** at a quality score of **${m.quality}** with ${m.errorRate.toFixed(1)}% errors and $${m.costPerDay.toFixed(0)}/day. Shadow evaluations of cheaper models have not matched the golden set, and there are no deprecation notices for the current model.`,
            },
            { kind: "sources", items: [agentSrc] },
            {
              kind: "actions",
              actions: top
                ? [
                    {
                      id: "start-ab",
                      label: top.experimentId
                        ? "Open the running experiment"
                        : "Start a 10% A/B test",
                      description:
                        "Reversible rollout with per-session traffic assignment",
                      risk: "low",
                      requiresApproval: false,
                    },
                    {
                      id: "apply-rec",
                      label: "Apply the recommendation",
                      description: `Switch ${agent.name} to ${top.toModelId.split("/").pop()} for 100% of traffic`,
                      risk: "high",
                      requiresApproval: true,
                    },
                  ]
                : [
                    {
                      id: "schedule-eval",
                      label: "Schedule a shadow evaluation",
                      description:
                        "Re-run the golden set against the three cheapest capable models",
                      risk: "low",
                      requiresApproval: false,
                    },
                  ],
            },
            {
              kind: "suggestions",
              items: ["How is this agent doing?", "Why is quality drifting?"],
            },
          ],
        }
      }
      if (has("drift", "quality", "regress", "worse", "degrad", "why")) {
        const top = drift[0]
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Pulling open drift signals for ${agent.name} and correlating them with the quality trend, tool errors and recent deploys (${agent.version} shipped ${new Date(agent.lastDeployed).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}).`,
            },
            {
              kind: "tool",
              name: "read_drift",
              title: "Read drift signals",
              input: { agent: agent.id, window: "14d" },
              output: drift.map((d) => ({
                metric: d.metric,
                severity: d.severity,
                baseline: d.baseline,
                current: d.current,
              })),
              durationMs: 460,
            },
            {
              kind: "text",
              markdown: top
                ? `**${drift.length} open drift signal${drift.length === 1 ? "" : "s"} on ${agent.name}**\n\n${drift.map((d) => `- **${d.metric}** · ${d.severity}: ${d.baseline}${d.unit === "%" ? "%" : ""} → **${d.current}${d.unit === "%" ? "%" : ""}**`).join("\n")}\n\n**Most likely cause**\n${top.explanation}\n\n**What to do**\n${top.kind === "input" ? "Add coverage for the new topic cluster to the retrieval index and re-run the golden set; the quality drop should follow the input shift back down." : top.kind === "tool" ? "Fix or re-route the failing tool first; the cost and latency signals are downstream of the retries." : top.kind === "quality" ? "Check the retrieval hit rate on flagged traces before touching the prompt." : "Review the explanation above and acknowledge the signal if it is expected."}`
                : `**${agent.name} is within baseline.**\n\nQuality is **${m.quality}** (14-day trend ${(agent.qualityTrend.at(-1) ?? agent.qualityTrend[0]) >= agent.qualityTrend[0] ? "flat or rising" : "slightly down"}), input PSI **${agent.driftScore.toFixed(2)}**, thumbs-down **${m.thumbsDownRate.toFixed(1)}%**. No signal has crossed its threshold.`,
            },
            {
              kind: "sources",
              items: [
                agentSrc,
                ...(drift.length
                  ? [
                      {
                        id: "drift",
                        title: "Drift & Quality board",
                        href: "/agentops/drift",
                        kind: "alert" as const,
                      },
                    ]
                  : []),
              ],
            },
            {
              kind: "actions",
              actions: top
                ? [
                    {
                      id: "ack-drift",
                      label: `Acknowledge ${drift.length} signal${drift.length === 1 ? "" : "s"}`,
                      description:
                        "Marks them as being worked on; alerts stay visible",
                      risk: "low",
                      requiresApproval: false,
                    },
                    {
                      id: "sample-review",
                      label: "Sample 50 flagged traces for review",
                      description:
                        "Adds the affected topic cluster to the human review queue",
                      risk: "low",
                      requiresApproval: false,
                    },
                  ]
                : [],
            },
            {
              kind: "suggestions",
              items: [
                "Should we change the model?",
                "How is this agent doing?",
              ],
            },
          ],
        }
      }
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Reading ${agent.name}'s 24-hour metrics, review queue and experiments to build a health summary.`,
          },
          {
            kind: "tool",
            name: "read_agent",
            title: "Read agent metrics",
            input: { agent: agent.id, window: "24h" },
            output: {
              requests: m.requests24h,
              p95Ms: m.p95Ms,
              errorRate: m.errorRate,
              quality: m.quality,
              costPerDay: m.costPerDay,
              health: agent.health,
            },
            durationMs: 400,
          },
          {
            kind: "text",
            markdown: `**${agent.name}** (${agent.framework} · ${agent.version}) is **${agent.health}**.\n\n| | 24h |\n|---|---|\n| Requests | ${m.requests24h.toLocaleString("en-US")} |\n| p50 / p95 | ${(m.p50Ms / 1000).toFixed(1)} s / ${(m.p95Ms / 1000).toFixed(1)} s |\n| Error rate | ${m.errorRate.toFixed(1)}% |\n| Quality | **${m.quality}** |\n| Thumbs-down | ${m.thumbsDownRate.toFixed(1)}% |\n| Cost | $${m.costPerDay.toFixed(0)} |\n\n${drift.length ? `**${drift.length}** open drift signal${drift.length === 1 ? "" : "s"}, ` : "No drift signals, "}${pending} answer${pending === 1 ? "" : "s"} waiting for human review${exp ? `, and **${exp.name}** is running at ${Math.round(exp.significance * 100)}% confidence` : ""}.${recs.length ? ` There ${recs.length === 1 ? "is" : "are"} **${recs.length}** open recommendation${recs.length === 1 ? "" : "s"} worth a look.` : ""}`,
          },
          { kind: "sources", items: [agentSrc] },
          {
            kind: "suggestions",
            items: ["Why is quality drifting?", "Should we change the model?"],
          },
        ],
      }
    }
  }

  // ---- Trace context ----------------------------------------------------
  if (ctx.recordType === "trace" && ctx.recordNumber) {
    const trace = getTrace(ctx.recordNumber)
    if (trace) {
      const agent = getDeployedAgent(trace.agentId)
      const slowest = [...trace.spans]
        .filter((s) => s.parentId)
        .sort((a, b) => b.durationMs - a.durationMs)[0]
      const errored = trace.spans.find((s) => s.status === "error")
      const llmMs = trace.spans
        .filter((s) => s.type === "llm")
        .reduce((n, s) => n + s.durationMs, 0)
      const traceSrc = src("trace", trace.id, trace.userQuery)
      if (has("time", "slow", "latency", "where did")) {
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Breaking the ${(trace.durationMs / 1000).toFixed(1)} s run into spans and comparing each against ${agent?.name ?? "the agent"}'s p95.`,
            },
            {
              kind: "tool",
              name: "read_spans",
              title: "Read spans",
              input: { trace: trace.id },
              output: trace.spans
                .filter((s) => s.parentId)
                .map((s) => ({ span: s.name, ms: s.durationMs, type: s.type })),
              durationMs: 300,
            },
            {
              kind: "text",
              markdown: `**Where the ${(trace.durationMs / 1000).toFixed(1)} s went**\n\n| Span | Type | Duration | Share |\n|---|---|---|---|\n${trace.spans
                .filter((s) => s.parentId)
                .map(
                  (s) =>
                    `| ${s.name} | ${s.type} | ${s.durationMs >= 1000 ? `${(s.durationMs / 1000).toFixed(1)} s` : `${s.durationMs} ms`} | ${Math.round((s.durationMs / trace.durationMs) * 100)}% |`
                )
                .join(
                  "\n"
                )}\n\nModel calls account for **${Math.round((llmMs / trace.durationMs) * 100)}%** of wall time. ${slowest ? `The slowest span is **${slowest.name}** (${(slowest.durationMs / 1000).toFixed(1)} s)${slowest.type === "llm" ? "; a faster model or shorter context would cut it directly." : slowest.type === "tool" ? "; look at the tool's upstream latency before changing the agent." : "."}` : ""}`,
            },
            { kind: "sources", items: [traceSrc] },
            {
              kind: "suggestions",
              items: ["Explain this trace", "Why was this answer flagged?"],
            },
          ],
        }
      }
      if (has("flag", "wrong", "review", "confiden", "ground", "halluc")) {
        return {
          steps: [
            {
              kind: "reasoning",
              text: `Checking evaluator scores, retrieval hits and user feedback on ${trace.id} to explain the flags.`,
            },
            {
              kind: "tool",
              name: "read_evals",
              title: "Read evaluator output",
              input: { trace: trace.id },
              output: {
                ...trace.evals,
                flags: trace.flags,
                feedback: trace.userFeedback ?? null,
              },
              durationMs: 320,
            },
            {
              kind: "text",
              markdown:
                trace.flags.length || trace.userFeedback === "down"
                  ? `**Why ${trace.id} was flagged**\n\n${trace.flags.map((f) => `- **${f}**`).join("\n")}${trace.userFeedback === "down" ? "\n- **User thumbs-down**" : ""}\n\nGrounded **${trace.evals.grounded.toFixed(2)}** · helpful **${trace.evals.helpful.toFixed(2)}** · safe **${trace.evals.safe.toFixed(2)}**.\n\n${trace.evals.grounded < 0.7 ? "The answer makes claims the retrieved context does not support. The retriever returned matches, but the generation step did not cite them, which is the usual pattern when the index lacks a document for the exact question." : trace.evals.safe < 1 ? "The guard node detected personal data in the input. The answer itself is fine, but the trace is retained for a policy review." : "The flag is latency-only; the content passed every evaluator."}`
                  : `**${trace.id} was not flagged.** Grounded ${trace.evals.grounded.toFixed(2)}, helpful ${trace.evals.helpful.toFixed(2)}, safe ${trace.evals.safe.toFixed(2)}; ${trace.status === "Reviewed" ? "a reviewer has already approved it." : "it was sampled at random or not sampled at all."}`,
            },
            { kind: "sources", items: [traceSrc] },
            {
              kind: "actions",
              actions: [
                {
                  id: "to-review",
                  label: "Send to human review",
                  description:
                    "Adds this trace to the review queue with the evaluator notes attached",
                  risk: "low",
                  requiresApproval: false,
                },
              ],
            },
            {
              kind: "suggestions",
              items: ["Explain this trace", "Where did the time go?"],
            },
          ],
        }
      }
      return {
        steps: [
          {
            kind: "reasoning",
            text: `Walking ${trace.spans.length} spans of ${trace.id} in order to narrate what the agent did and why it answered the way it did.`,
          },
          {
            kind: "tool",
            name: "read_trace",
            title: "Read trace",
            input: { trace: trace.id },
            output: {
              agent: agent?.name,
              status: trace.status,
              spans: trace.spans.length,
              durationMs: trace.durationMs,
              cost: trace.cost,
            },
            durationMs: 340,
          },
          {
            kind: "text",
            markdown: `**${agent?.name ?? "The agent"} · ${trace.status}** · ${(trace.durationMs / 1000).toFixed(1)} s · $${trace.cost.toFixed(3)}\n\n${trace.spans
              .filter((s) => s.parentId)
              .map(
                (s, i) =>
                  `${i + 1}. **${s.name}** (${s.type}): ${s.status === "error" ? "**failed**: " + (s.output ?? "error") : s.output ? s.output.slice(0, 90) + (s.output.length > 90 ? "…" : "") : "ok"}`
              )
              .join(
                "\n"
              )}\n\n${errored ? `The run failed at **${errored.name}**; the user received a fallback message and a ticket was opened.` : `The final answer scored **${trace.evals.grounded.toFixed(2)}** on grounding${trace.userFeedback ? ` and the user gave it a thumbs-${trace.userFeedback}` : ""}.`}`,
          },
          {
            kind: "sources",
            items: [
              traceSrc,
              ...(agent ? [src("agent", agent.id, agent.name)] : []),
            ],
          },
          {
            kind: "suggestions",
            items: ["Where did the time go?", "Why was this answer flagged?"],
          },
        ],
      }
    }
  }

  // ---- Agent operations (any page) --------------------------------------
  if (has("quality", "regress", "eval", "worse", "degrad")) {
    const decline = (a: DeployedAgent) =>
      weekAvg(a.qualityTrend.slice(0, 7)) - weekAvg(a.qualityTrend.slice(-7))
    const agent =
      agentFromPrompt(q) ??
      [...deployedAgents].sort((a, b) => decline(b) - decline(a))[0]
    const prev = weekAvg(agent.qualityTrend.slice(0, 7))
    const week = weekAvg(agent.qualityTrend.slice(-7))
    const delta = Math.round((week - prev) * 10) / 10
    const drift = driftSignals.filter(
      (d) => d.agentId === agent.id && d.state !== "Resolved"
    )
    const exp = experiments.find(
      (e) => e.agentId === agent.id && e.status === "Running"
    )
    const flagged = reviewItems.filter(
      (r) => r.agentId === agent.id && r.status === "Flagged"
    ).length
    const pending = reviewItems.filter(
      (r) => r.agentId === agent.id && r.status === "Pending"
    ).length
    const critical = drift.find((d) => d.severity === "Critical")
    return {
      steps: [
        {
          kind: "reasoning",
          text: `Comparing ${agent.name}'s composite evaluator score for the last 7 days against the 7 before, then looking for what changed: open drift signals, a running experiment, tool errors and what reviewers flagged.`,
        },
        {
          kind: "tool",
          name: "read_agent_metrics",
          title: "Quality trend (14d)",
          input: { agent: agent.id, metric: "quality", window: "14d" },
          output: {
            previousWeek: Math.round(prev * 10) / 10,
            thisWeek: Math.round(week * 10) / 10,
            errorRate: `${agent.metrics.errorRate}%`,
            thumbsDown: `${agent.metrics.thumbsDownRate}%`,
          },
          durationMs: 320,
        },
        {
          kind: "tool",
          name: "read_drift_signals",
          title: "Open drift signals",
          input: { agent: agent.id, state: ["Open", "Acknowledged"] },
          output: drift.map((d) => ({
            metric: d.metric,
            baseline: d.baseline,
            current: d.current,
            severity: d.severity,
          })),
          durationMs: 210,
        },
        {
          kind: "text",
          markdown: `**${agent.name}**: quality ${delta < 0 ? "fell" : "rose"} **${Math.abs(delta).toFixed(1)} pts** week over week (${prev.toFixed(1)} → ${week.toFixed(1)}), currently **${agent.metrics.quality}** on \`${agent.evalDataset}\`.\n\n**What moved**\n${
            drift.length
              ? drift
                  .map(
                    (d) =>
                      `- ${d.severity === "Critical" ? "🔴" : d.severity === "Warning" ? "🟠" : "🔵"} **${d.metric}** ${d.baseline}${d.unit} → ${d.current}${d.unit} (${d.kind} drift, ${d.state.toLowerCase()}): ${d.explanation}`
                  )
                  .join("\n")
              : "- No open drift signals on this agent."
          }\n${
            exp
              ? `- 🧪 Experiment **${exp.name}** is running (${exp.split}% to B): A ${exp.variants[0].quality} vs B ${exp.variants[1].quality} quality, ${Math.round(exp.significance * 100)}% probability B wins.`
              : ""
          }\n- 👀 Review Queue: **${pending}** pending, **${flagged}** flagged this window. Last deploy ${agent.version} (prompt ${agent.promptVersion}).\n\n**Recommendation:** ${
            critical
              ? `treat the **${critical.metric}** signal as the primary cause: acknowledge it, compare traces from before and after the deploy, and consider pinning the previous prompt version while you investigate.`
              : exp
                ? `the running experiment is the likely driver; check variant B's flagged traces before promoting or stopping it.`
                : delta < 0
                  ? `the drop is within noise so far; keep sampling into the review queue and re-check tomorrow.`
                  : `no regression: quality is stable or improving.`
          }`,
        },
        {
          kind: "sources",
          items: [
            src("agent", agent.id, agent.name),
            ...drift.slice(0, 2).map((d) => src("drift", d.id, d.metric)),
            ...(exp ? [src("experiment", exp.id, exp.name)] : []),
          ],
        },
        {
          kind: "actions",
          actions: [
            {
              id: "ack-drift",
              label: "Acknowledge drift signals",
              description: `Marks ${drift.length} open signal${drift.length === 1 ? "" : "s"} on ${agent.name} as acknowledged`,
              risk: "low",
              requiresApproval: false,
            },
            {
              id: "raise-sampling",
              label: "Raise review sampling to 10%",
              description:
                "Sends more of this agent's answers to the human review queue for a week",
              risk: "medium",
              requiresApproval: true,
            },
          ],
        },
        {
          kind: "suggestions",
          items: [
            `Show me the latest prompt version for ${agent.name}`,
            "Which agents are over budget?",
          ],
        },
      ],
    }
  }
  if (has("budget", "spend", "cost", "expensive")) {
    const live = deployedAgents.filter((a) => a.environment === "production")
    const costDrift = driftSignals.filter(
      (d) => d.kind === "cost" && d.state !== "Resolved"
    )
    const costRecs = modelRecommendations.filter(
      (r) => r.kind === "cost" && (r.status === "New" || r.status === "Testing")
    )
    const isOver = (a: DeployedAgent) =>
      costDrift.some((d) => d.agentId === a.id) ||
      costRecs.some((r) => r.agentId === a.id)
    const rows = [...live].sort(
      (a, b) => b.metrics.costPerDay - a.metrics.costPerDay
    )
    const over = rows.filter(isOver)
    const total = live.reduce((s, a) => s + a.metrics.costPerDay, 0)
    const savings = costRecs.reduce((s, r) => s + (r.savingsPerMonth ?? 0), 0)
    const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`
    return {
      steps: [
        {
          kind: "reasoning",
          text: "Pulling spend per production agent for the last 24 hours and checking each against its baseline: open cost drift signals and pending cost recommendations mark an agent as over budget.",
        },
        {
          kind: "tool",
          name: "read_agent_metrics",
          title: "Spend by agent (24h)",
          input: { environment: "production", metric: "costPerDay" },
          output: rows.map((a) => ({
            agent: a.name,
            costPerDay: a.metrics.costPerDay,
            requests: a.metrics.requests24h,
          })),
          durationMs: 280,
        },
        {
          kind: "tool",
          name: "read_recommendations",
          title: "Cost recommendations",
          input: { kind: "cost", status: ["New", "Testing"] },
          output: costRecs.map((r) => ({
            agent: getDeployedAgent(r.agentId)?.name,
            savingsPerMonth: r.savingsPerMonth,
            status: r.status,
          })),
          durationMs: 190,
        },
        {
          kind: "text",
          markdown: `**${over.length} of ${live.length} production agents are over budget.** Fleet spend is **${usd(total)}/day** (~${usd(total * 30)}/month).\n\n| Agent | Model | $/day | $/1K requests | Status |\n|---|---|---|---|---|\n${rows
            .map(
              (a) =>
                `| ${a.name} | ${a.modelId.split("/")[1]} | ${usd(a.metrics.costPerDay)} | ${usd((a.metrics.costPerDay / Math.max(1, a.metrics.requests24h)) * 1000)} | ${isOver(a) ? "**Over budget**" : "On track"} |`
            )
            .join("\n")}\n\n${over
            .map((a) => {
              const d = costDrift.find((x) => x.agentId === a.id)
              const r = costRecs.find((x) => x.agentId === a.id)
              return `- **${a.name}**: ${d ? `${d.metric} ${d.unit}${d.baseline} → ${d.unit}${d.current}; ${d.explanation}` : ""}${d && r ? " " : ""}${r ? `${r.title}: saves ~$${r.savingsPerMonth?.toLocaleString("en-US")}/month (${r.status.toLowerCase()}).` : ""}`
            })
            .join(
              "\n"
            )}\n\nApplying the pending recommendations would save about **$${savings.toLocaleString("en-US")}/month**.`,
        },
        {
          kind: "sources",
          items: [
            ...over.map((a) => src("agent", a.id, a.name)),
            ...costDrift.slice(0, 1).map((d) => src("drift", d.id, d.metric)),
          ],
        },
        {
          kind: "actions",
          actions: [
            {
              id: "apply-cost-recs",
              label: "Start experiments for cost recommendations",
              description: `Creates A/B tests for ${costRecs.filter((r) => r.status === "New").length} new recommendation${costRecs.filter((r) => r.status === "New").length === 1 ? "" : "s"}`,
              risk: "medium",
              requiresApproval: true,
            },
          ],
        },
        {
          kind: "suggestions",
          items: [
            "Why did Support Triage's quality drop this week?",
            "What needs my attention today?",
          ],
        },
      ],
    }
  }
  if (has("prompt", "which version", "latest version")) {
    const agent = agentFromPrompt(q) ?? deployedAgents[0]
    const promptExp = experiments.find(
      (e) =>
        e.agentId === agent.id && e.kind === "prompt" && e.status !== "Stopped"
    )
    const hygiene = proposals.find(
      (p) => p.agentId === "prompt-hygiene" && p.recordNumber === agent.id
    )
    const deployed = new Date(agent.lastDeployed).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    return {
      steps: [
        {
          kind: "reasoning",
          text: `Reading ${agent.name}'s deployment record for the live prompt version, then checking prompt experiments and the Prompt Hygiene agent for anything newer.`,
        },
        {
          kind: "tool",
          name: "read_prompt_versions",
          title: "Live prompt",
          input: { agent: agent.id },
          output: {
            promptVersion: agent.promptVersion,
            agentVersion: agent.version,
            model: agent.modelId,
            deployed: agent.lastDeployed,
            temperature: agent.params.temperature,
            maxOutputTokens: agent.params.maxOutputTokens,
          },
          durationMs: 160,
        },
        {
          kind: "text",
          markdown: `**${agent.name}** is serving prompt **${agent.promptVersion}** (agent ${agent.version}, deployed ${deployed}) on \`${agent.modelId}\` with temperature ${agent.params.temperature} and a ${agent.params.maxOutputTokens.toLocaleString("en-US")}-token output cap.\n\n${
            promptExp
              ? `- 🧪 **${promptExp.name}** is ${promptExp.status.toLowerCase()}: ${promptExp.variants[0].promptVersion ?? agent.promptVersion} (A) vs ${promptExp.variants[1].promptVersion ?? "candidate"} (B), ${promptExp.split}% of traffic on B, ${Math.round(promptExp.significance * 100)}% probability B wins on ${promptExp.primaryMetric}.\n`
              : "- No prompt experiment is running for this agent.\n"
          }${
            hygiene
              ? `- ⚠️ Prompt Hygiene proposes **${hygiene.action}**: ${hygiene.rationale}\n`
              : `- ✅ Prompt Hygiene has no open findings; ${agent.promptVersion} is the approved version.\n`
          }- Evaluated against \`${agent.evalDataset}\`; current composite quality **${agent.metrics.quality}**.`,
        },
        {
          kind: "sources",
          items: [
            src("agent", agent.id, agent.name),
            ...(promptExp
              ? [src("experiment", promptExp.id, promptExp.name)]
              : []),
          ],
        },
        {
          kind: "suggestions",
          items: [
            `Why did ${agent.name}'s quality drop this week?`,
            "Which agents are over budget?",
          ],
        },
      ],
    }
  }

  // ---- Workspace / generic ---------------------------------------------
  if (has("attention", "today", "priorit", "p1", "p2", "urgent", "focus")) {
    const hot = incidents
      .filter((i) => openStates.includes(i.state) && i.priority <= 2)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6)
    const pendingApprovals = changes.filter(
      (c) => c.approval === "Requested"
    ).length
    return {
      steps: [
        {
          kind: "reasoning",
          text: "Scanning open work across incidents, changes and approvals. Prioritizing by priority, SLA proximity and whether it's assigned to you.",
        },
        {
          kind: "tool",
          name: "search_incidents",
          title: "Open high-priority incidents",
          input: { state: openStates, priority: ["P1", "P2"] },
          output: hot.map((h) => ({
            number: h.number,
            priority: `P${h.priority}`,
            sla: h.slaBreached ? "breached" : "ok",
          })),
          durationMs: 450,
        },
        {
          kind: "tool",
          name: "read_approvals",
          title: "Pending approvals",
          input: { approver: "me" },
          output: { changes: pendingApprovals, requests: 5 },
          durationMs: 180,
        },
        {
          kind: "text",
          markdown: `**Here's what needs attention**\n\n1. **${hot.filter((h) => h.majorIncident).length} major incident${hot.filter((h) => h.majorIncident).length === 1 ? "" : "s"}** in progress: ${hot.find((h) => h.majorIncident)?.number ?? "none"}\n2. **${hot.filter((h) => h.slaBreached).length}** high-priority incidents have breached SLA\n3. **${pendingApprovals + 5}** approvals waiting on you (${pendingApprovals} changes, 5 requests)\n\n| Number | Short description | Priority | State | Group |\n|---|---|---|---|---|\n${hot.map(fmtInc).join("\n")}`,
        },
        {
          kind: "sources",
          items: hot
            .slice(0, 4)
            .map((h) => src("incident", h.number, h.shortDescription)),
        },
        {
          kind: "actions",
          actions: [
            {
              id: "assign-hot",
              label: "Assign unassigned P1/P2 to on-call",
              description:
                "Routes unowned high-priority incidents to the on-call engineer per group",
              risk: "medium",
              requiresApproval: true,
            },
          ],
        },
        {
          kind: "suggestions",
          items: [
            "Which changes are scheduled this week?",
            "Summarize service health",
            "Show my approvals",
          ],
        },
      ],
    }
  }
  if (has("change", "scheduled", "this week", "calendar", "cab")) {
    const week = changes
      .filter((c) => ["Scheduled", "Authorize", "Implement"].includes(c.state))
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
      .slice(0, 6)
    return {
      steps: [
        {
          kind: "reasoning",
          text: "Listing scheduled and pending-authorization changes for the next 7 days and checking for same-CI conflicts.",
        },
        {
          kind: "tool",
          name: "read_changes",
          title: "Upcoming changes",
          input: {
            window: "7d",
            states: ["Scheduled", "Authorize", "Implement"],
          },
          output: week.map((c) => ({
            number: c.number,
            type: c.type,
            risk: c.risk,
            start: c.plannedStart,
          })),
          durationMs: 350,
        },
        {
          kind: "text",
          markdown: `**${week.length} changes in the next window**\n\n| Number | Change | Type | Risk | Planned |\n|---|---|---|---|---|\n${week.map((c) => `| ${c.number} | ${c.shortDescription} | ${c.type} | ${c.risk} | ${new Date(c.plannedStart).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", timeZone: "UTC" })} |`).join("\n")}\n\n${week.filter((c) => c.risk === "High" || c.risk === "Very High").length} are high risk and should be on the CAB agenda. No blackout-window violations detected.`,
        },
        {
          kind: "sources",
          items: week
            .slice(0, 4)
            .map((c) => src("change", c.number, c.shortDescription)),
        },
        {
          kind: "suggestions",
          items: ["What needs my attention today?", "Open the change calendar"],
        },
      ],
    }
  }
  if (has("health", "service", "availability", "status")) {
    return {
      steps: [
        {
          kind: "reasoning",
          text: "Aggregating service health from alerts, incidents and changes on each business service.",
        },
        {
          kind: "tool",
          name: "read_service_health",
          title: "Service health",
          input: { services: "all" },
          output: { healthy: 3, degraded: 2, critical: 1 },
          durationMs: 290,
        },
        {
          kind: "text",
          markdown: `**Service health right now**\n\n- 🔴 **Payments API**: critical. 5xx rate elevated, 3 open incidents, rollback in progress (INC0010078).\n- 🟠 **Employee Portal**: degraded. Login p95 latency 4.8s; depends on the Payments API path.\n- 🟠 **VPN Remote Access**: degraded. Gateway licenses at 94%; capacity change CHG0031123 is scheduled.\n- 🟢 ERP, Email & Calendar, CRM: healthy.\n\n30-day availability across services averages **99.85%**.`,
        },
        {
          kind: "sources",
          items: [
            src("incident", "INC0010078", "Payments API 5xx rate elevated"),
            src("change", "CHG0031123", "VPN gateway capacity increase"),
          ],
        },
        {
          kind: "suggestions",
          items: [
            "What needs my attention today?",
            "Show open P1 and P2 incidents",
          ],
        },
      ],
    }
  }

  // Fallback: lightweight record search
  const terms = q.split(/\s+/).filter((t) => t.length > 3)
  const hits = incidents
    .filter((i) =>
      terms.some((t) => i.shortDescription.toLowerCase().includes(t))
    )
    .slice(0, 5)
  const req = requests.length
  return {
    steps: [
      {
        kind: "reasoning",
        text: `Interpreting "${prompt}". No record is open, so I'm searching across incidents, changes and knowledge for matching terms.`,
      },
      {
        kind: "tool",
        name: "search_records",
        title: "Search records",
        input: { query: prompt, types: ["incident", "change", "knowledge"] },
        output: {
          incidents: hits.length,
          changes: 0,
          articles: knowledgeArticles.filter((k) =>
            terms.some((t) => k.title.toLowerCase().includes(t))
          ).length,
        },
        durationMs: 400,
      },
      {
        kind: "text",
        markdown: hits.length
          ? `I found **${hits.length} incident${hits.length === 1 ? "" : "s"}** matching that:\n\n| Number | Short description | Priority | State | Group |\n|---|---|---|---|---|\n${hits.map(fmtInc).join("\n")}\n\nOpen one and ask me to summarize it, draft an update, or find the root cause.`
          : `I couldn't find records matching that. I can help with things like:\n\n- **Triage**: "what needs my attention today?"\n- **Records**: open an incident or change and ask me to summarize, draft an update or assess risk\n- **Operations**: "summarize service health", "which changes are scheduled this week?"\n\nThere are currently ${incidents.filter((i) => openStates.includes(i.state)).length} open incidents and ${req} requests in the system.`,
      },
      ...(hits.length
        ? [
            {
              kind: "sources" as const,
              items: hits
                .slice(0, 3)
                .map((h) => src("incident", h.number, h.shortDescription)),
            },
          ]
        : []),
      { kind: "suggestions", items: starterPrompts(ctx).slice(0, 3) },
    ],
  }
}

/* ------------------------------------------------------------------------ */
/* PII redaction                                                             */
/* ------------------------------------------------------------------------ */

const PII_PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g, "[iban]"],
  [/(?:\+|\b)(?=(?:[\s()-]*\d){9,})\d[\d\s()-]{7,}\d\b/g, "[phone]"],
]

/**
 * Masks e-mail addresses, IBANs and phone numbers before a prompt reaches the
 * scripted engine. Applied by the assistant when the "Redact personal data"
 * guardrail is on; returns the text unchanged when nothing matched.
 */
export function redactPii(text: string) {
  let out = text
  let hits = 0
  for (const [re, token] of PII_PATTERNS)
    out = out.replace(re, () => {
      hits++
      return token
    })
  return { text: out, redacted: hits }
}
