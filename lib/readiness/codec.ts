import { clock } from "@/lib/data/seed"
import type {
  Assessment,
  AssessmentResult,
  ControlSet,
  ControlStatus,
  MaturityTarget,
  SystemProfile,
} from "./types"
import {
  applicabilityLabel,
  maturityLevelLabel,
  maturityTargetLabel,
  statusLabel,
  systemTypeLabel,
} from "./labels"
import { controlStatuses, maturityTargets, systemTypes } from "./types"

const SHARE_VERSION = 1

/** Share links longer than this are likely to be truncated by chat clients and proxies. */
export const SHARE_LINK_WARN_CHARS = 2000

// ---- URL-safe encoding -----------------------------------------------------

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Compact wire form: drop empty responses so links stay short. */
export function encodeAssessment(a: Assessment): string {
  const responses = Object.fromEntries(
    Object.entries(a.responses).filter(
      ([, r]) =>
        r.status !== "none" ||
        r.ownerId ||
        r.tool ||
        r.evidence ||
        r.notes ||
        r.lastReviewed ||
        (r.votes && Object.keys(r.votes).length > 0)
    )
  )
  return toBase64Url(
    JSON.stringify({ v: SHARE_VERSION, a: { ...a, responses } })
  )
}

export function decodeAssessment(encoded: string): Assessment {
  let text: string
  try {
    text = fromBase64Url(encoded)
  } catch {
    throw new Error("The share link payload is not valid base64url.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("The share link payload is not JSON.")
  }
  if (!isRecord(parsed) || typeof parsed.v !== "number")
    throw new Error("The share link payload has no version field.")
  if (parsed.v !== SHARE_VERSION)
    throw new Error(
      `Share link version ${parsed.v} is not supported (this build reads version ${SHARE_VERSION}).`
    )
  return parseAssessment(parsed.a)
}

export function shareUrl(a: Assessment, base?: string) {
  const origin =
    base ??
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "")
  return `${origin}#s=${encodeAssessment(a)}`
}

/** Decodes a `#s=` fragment, throwing a descriptive error when it cannot. */
export function decodeShareHash(hash: string): Assessment {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash)
  if (!m) throw new Error("No `s=` fragment found in the link.")
  return decodeAssessment(m[1])
}

export function readShareHash(hash: string): Assessment | null {
  if (!/[#&]s=/.test(hash)) return null
  try {
    return decodeShareHash(hash)
  } catch {
    return null
  }
}

// ---- Validation --------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function parseAssessment(input: unknown): Assessment {
  if (!isRecord(input))
    throw new Error("Not an assessment object (expected a JSON object).")
  const profile = input.profile
  if (!isRecord(profile))
    throw new Error('Missing the "profile" object with the system profile.')
  if (!systemTypes.includes(profile.systemType as SystemProfile["systemType"]))
    throw new Error(
      `Unknown system type "${String(profile.systemType)}" (expected one of ${systemTypes.join(", ")}).`
    )
  if (!maturityTargets.includes(input.target as MaturityTarget))
    throw new Error(
      `Unknown maturity target "${String(input.target)}" (expected one of ${maturityTargets.join(", ")}).`
    )
  const rawResponses = isRecord(input.responses) ? input.responses : {}
  const responses: Assessment["responses"] = {}
  for (const [id, r] of Object.entries(rawResponses)) {
    if (!isRecord(r)) continue
    const status = controlStatuses.includes(r.status as ControlStatus)
      ? (r.status as ControlStatus)
      : "none"
    responses[id] = {
      status,
      ownerId: typeof r.ownerId === "string" ? r.ownerId : undefined,
      tool: typeof r.tool === "string" ? r.tool : undefined,
      evidence: typeof r.evidence === "string" ? r.evidence : undefined,
      lastReviewed:
        typeof r.lastReviewed === "string" ? r.lastReviewed : undefined,
      notes: typeof r.notes === "string" ? r.notes : undefined,
      votes: isRecord(r.votes)
        ? (Object.fromEntries(
            Object.entries(r.votes).filter(([, v]) =>
              controlStatuses.includes(v as ControlStatus)
            )
          ) as Record<string, ControlStatus>)
        : undefined,
    }
  }
  const now = clock().toISOString()
  return {
    id:
      typeof input.id === "string"
        ? input.id
        : `asm-imported-${clock().getTime().toString(36)}`,
    name: typeof input.name === "string" ? input.name : "Imported assessment",
    controlSetId:
      typeof input.controlSetId === "string" ? input.controlSetId : "unknown",
    controlSetVersion:
      typeof input.controlSetVersion === "string"
        ? input.controlSetVersion
        : "0",
    profile: {
      name: typeof profile.name === "string" ? profile.name : "Unnamed system",
      systemType: profile.systemType as SystemProfile["systemType"],
      autonomy: (profile.autonomy as SystemProfile["autonomy"]) ?? "assist",
      dataSensitivity:
        (profile.dataSensitivity as SystemProfile["dataSensitivity"]) ??
        "internal",
      exposure: (profile.exposure as SystemProfile["exposure"]) ?? "internal",
      regulatory: Array.isArray(profile.regulatory)
        ? (profile.regulatory.filter(
            (r) => typeof r === "string"
          ) as SystemProfile["regulatory"])
        : [],
    },
    target: input.target as MaturityTarget,
    responses,
    respondents: Array.isArray(input.respondents)
      ? input.respondents.filter((r): r is string => typeof r === "string")
      : [],
    createdAt: typeof input.createdAt === "string" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now,
  }
}

// ---- Exports -----------------------------------------------------------------

export function toJson(a: Assessment) {
  return JSON.stringify(a, null, 2)
}

function csvCell(v: unknown) {
  const s = v === undefined || v === null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(a: Assessment, result: AssessmentResult) {
  const header = [
    "control_id",
    "domain",
    "title",
    "status",
    "applicability",
    "required",
    "gate",
    "risk",
    "effort",
    "severity",
    "owner",
    "tool",
    "evidence",
    "last_reviewed",
    "notes",
  ]
  const rows = result.controls.map((e) =>
    [
      e.control.id,
      e.control.domain,
      e.control.title,
      e.response.status,
      e.applicability,
      e.required,
      Boolean(e.control.gate),
      e.control.risk,
      e.control.effort,
      e.severity,
      e.response.ownerId ?? "",
      e.response.tool ?? "",
      e.response.evidence ?? "",
      e.response.lastReviewed ?? "",
      e.response.notes ?? "",
    ]
      .map(csvCell)
      .join(",")
  )
  return [header.join(","), ...rows].join("\n")
}

export function toMarkdown(
  a: Assessment,
  result: AssessmentResult,
  set: ControlSet,
  ownerName: (id?: string) => string = (id) => id ?? ""
) {
  const lines: string[] = []
  lines.push(`# ${a.name}`)
  lines.push("")
  lines.push(
    `System: **${a.profile.name}** · ${systemTypeLabel[a.profile.systemType]} · target: ${maturityTargetLabel[a.target]}`
  )
  lines.push(`Control set: ${set.name} v${set.version}`)
  lines.push("")
  lines.push(
    `**Coverage ${result.overall}/100: ${maturityLevelLabel[result.maturity]}** · ${result.blockers.length} release blocker(s) · ${result.gaps.length} gap(s)`
  )
  lines.push("")
  lines.push("## Domain coverage")
  lines.push("")
  lines.push("| Domain | Score | In place | Required met | Blockers |")
  lines.push("|---|---:|---:|---:|---:|")
  for (const d of result.domains)
    lines.push(
      `| ${d.domain.title} | ${d.score} | ${d.inPlace}/${d.applicable} | ${d.requiredMet}/${d.required} | ${d.blockers} |`
    )
  if (result.blockers.length) {
    lines.push("")
    lines.push("## Release gate blockers")
    lines.push("")
    for (const e of result.blockers)
      lines.push(
        `- **${e.control.id} ${e.control.title}**: ${statusLabel[e.response.status]}${e.response.ownerId ? ` · ${ownerName(e.response.ownerId)}` : ""}`
      )
  }
  lines.push("")
  lines.push("## Prioritized gaps")
  lines.push("")
  lines.push("| # | Control | Severity | Effort | Status | Owner |")
  lines.push("|---:|---|---:|---|---|---|")
  result.gaps.forEach((e, i) =>
    lines.push(
      `| ${i + 1} | ${e.control.id} ${e.control.title} | ${e.severity} | ${e.control.effort} | ${statusLabel[e.response.status]} | ${ownerName(e.response.ownerId)} |`
    )
  )
  lines.push("")
  lines.push("## All controls")
  lines.push("")
  for (const domain of set.domains) {
    lines.push(`### ${domain.title}`)
    lines.push("")
    for (const e of result.controls.filter(
      (c) => c.control.domain === domain.id
    )) {
      lines.push(
        `- **${e.control.id} ${e.control.title}**: ${statusLabel[e.response.status]} (${applicabilityLabel[e.applicability]}${e.required ? ", required" : ""}${e.control.gate ? ", gate" : ""})`
      )
      if (e.response.evidence)
        lines.push(`  - Evidence: ${e.response.evidence}`)
      if (e.response.notes) lines.push(`  - Notes: ${e.response.notes}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}

// ---- Diff --------------------------------------------------------------------

export interface AssessmentDiff {
  changed: {
    id: string
    from: ControlStatus
    to: ControlStatus
    direction: "up" | "down"
  }[]
  profileChanged: boolean
  targetChanged: boolean
}

const order: ControlStatus[] = [
  "none",
  "planned",
  "partial",
  "in-place",
  "verified",
]

export function diffAssessments(
  from: Assessment,
  to: Assessment
): AssessmentDiff {
  const ids = new Set([
    ...Object.keys(from.responses),
    ...Object.keys(to.responses),
  ])
  const changed: AssessmentDiff["changed"] = []
  for (const id of ids) {
    const a = from.responses[id]?.status ?? "none"
    const b = to.responses[id]?.status ?? "none"
    if (a !== b)
      changed.push({
        id,
        from: a,
        to: b,
        direction: order.indexOf(b) > order.indexOf(a) ? "up" : "down",
      })
  }
  changed.sort((x, y) => x.id.localeCompare(y.id))
  return {
    changed,
    profileChanged: JSON.stringify(from.profile) !== JSON.stringify(to.profile),
    targetChanged: from.target !== to.target,
  }
}
