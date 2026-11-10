import { defaultControlSet } from "@/lib/readiness/controls"
import type {
  Assessment,
  ControlResponse,
  ControlStatus,
  Snapshot,
} from "@/lib/readiness/types"

import { createRng, daysAgo, pick, weighted } from "./seed"
import { getUser } from "./users"

/**
 * Sample assessment for the demo: a supervised support agent heading to
 * production, with EU AI Act and GDPR in scope. Mid-maturity on purpose so
 * the results view shows gaps, blockers and overdue reviews.
 */

const owners = ["u-001", "u-002", "u-003", "u-004", "u-005", "u-006"]

/** Team-mode respondents, resolved from the users table by id. */
const respondentIds = ["u-001", "u-002", "u-003"]
const respondentNames = respondentIds.map((id) => {
  const u = getUser(id)
  if (!u) throw new Error(`readiness sample: unknown user ${id}`)
  return u.name
})
const [kevin, amara, diego] = respondentNames

const evidenceFor: Record<string, string> = {
  visibility: "/agentops/traces",
  quality: "/agentops/evals",
  drift: "/agentops/drift",
  safety: "/agentops/guardrails",
  "cost-performance": "/agentops/costs",
  governance: "/agentops/deployments",
}

const toolsByDomain: Record<string, string[]> = {
  visibility: ["langfuse", "datadog", "openlit"],
  quality: ["braintrust", "promptfoo", "langfuse"],
  drift: ["langfuse", "phoenix", "litellm"],
  safety: ["lakera", "presidio", "nemo-guardrails", "promptfoo"],
  "cost-performance": ["litellm", "helicone", "grafana"],
  governance: ["langfuse", "mlflow"],
}

/** Hand-picked statuses that tell a coherent story; the rest are seeded. */
const pinned: Record<string, ControlStatus> = {
  "VIS-01": "verified",
  "VIS-02": "verified",
  "VIS-03": "in-place",
  "VIS-04": "in-place",
  "VIS-07": "partial",
  "VIS-08": "partial",
  "QUA-01": "in-place",
  "QUA-02": "partial",
  "QUA-03": "planned",
  "QUA-04": "in-place",
  "DRF-02": "none",
  "DRF-03": "in-place",
  "DRF-04": "verified",
  "DRF-05": "planned",
  "SAF-01": "in-place",
  "SAF-02": "partial",
  "SAF-04": "verified",
  "SAF-05": "partial",
  "SAF-08": "none",
  "SAF-11": "verified",
  "CST-02": "in-place",
  "CST-04": "partial",
  "GOV-01": "verified",
  "GOV-02": "partial",
  "GOV-05": "in-place",
  "GOV-07": "none",
  "GOV-08": "in-place",
  // Wave-2 controls: newer practices, so the sample is deliberately less mature.
  "VIS-09": "partial",
  "VIS-10": "in-place",
  "VIS-12": "planned",
  "QUA-09": "none",
  "QUA-10": "planned",
  "QUA-11": "none",
  "QUA-13": "in-place",
  "QUA-14": "in-place",
  "DRF-09": "in-place",
  "DRF-10": "in-place",
  "DRF-12": "none",
  "SAF-12": "planned",
  "SAF-13": "partial",
  "SAF-15": "none",
  "SAF-16": "in-place",
  "SAF-19": "planned",
  "CST-09": "none",
  "CST-10": "partial",
  "CST-12": "planned",
  "GOV-12": "none",
  "GOV-13": "partial",
  "GOV-14": "planned",
  "GOV-15": "partial",
}

const order: ControlStatus[] = [
  "none",
  "planned",
  "partial",
  "in-place",
  "verified",
]

function buildResponses(seed: number, shift: number) {
  const rng = createRng(seed)
  const responses: Record<string, ControlResponse> = {}
  for (const c of defaultControlSet.controls) {
    let status =
      pinned[c.id] ??
      weighted<ControlStatus>(rng, [
        ["none", 2],
        ["planned", 3],
        ["partial", 4],
        ["in-place", 4],
        ["verified", 2],
      ])
    if (shift) {
      status = order[Math.max(0, order.indexOf(status) - shift)]
      if (rng() < 0.3 && status !== "none")
        status = order[order.indexOf(status) - 1]
    }
    const r: ControlResponse = { status }
    if (status !== "none") {
      r.ownerId = pick(rng, owners)
      r.tool = pick(rng, toolsByDomain[c.domain])
    }
    if (status === "in-place" || status === "verified") {
      r.evidence = evidenceFor[c.domain]
      r.lastReviewed = daysAgo(Math.floor(rng() * 140) + 5 + shift * 60)
    }
    if (status === "partial")
      r.notes = "Covers production agents; staging and shadow agents pending."
    if (status === "planned")
      r.notes = "Owner assigned; targeted for next quarter."
    responses[c.id] = r
  }
  return responses
}

export const sampleAssessment: Assessment = {
  id: "asm-sample-support",
  name: "Support Triage Agent: production readiness",
  controlSetId: defaultControlSet.id,
  controlSetVersion: defaultControlSet.version,
  profile: {
    name: "Support Triage Agent",
    systemType: "agent",
    autonomy: "supervised",
    dataSensitivity: "confidential",
    exposure: "external",
    regulatory: ["eu-ai-act", "gdpr"],
  },
  target: "production",
  responses: {
    ...buildResponses(7101, 0),
    "QUA-03": {
      status: "planned",
      ownerId: "u-004",
      tool: "braintrust",
      notes: "Judge agreement measured once at 0.72; recalibration planned.",
      votes: { [kevin]: "planned", [amara]: "partial", [diego]: "planned" },
    },
    "SAF-05": {
      status: "partial",
      ownerId: "u-002",
      tool: "nemo-guardrails",
      evidence: "/agentops/guardrails?tab=policies",
      notes:
        "Approvals exist for destructive tools; external messaging still auto-sends.",
      votes: { [kevin]: "partial", [amara]: "in-place", [diego]: "partial" },
    },
  },
  respondents: respondentNames,
  createdAt: daysAgo(62),
  updatedAt: daysAgo(1),
}

export const sampleSnapshots: Snapshot[] = [
  {
    id: "snap-sample-q3",
    label: "Pilot exit review",
    takenAt: daysAgo(58),
    assessment: {
      ...sampleAssessment,
      target: "pilot",
      responses: buildResponses(7101, 1),
      respondents: [],
      updatedAt: daysAgo(58),
    },
  },
]
