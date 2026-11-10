import { describe, expect, it } from "vitest"

import { sampleAssessment, sampleSnapshots } from "@/lib/data/readiness"
import { getUser } from "@/lib/data/users"
import {
  decodeAssessment,
  diffAssessments,
  encodeAssessment,
  parseAssessment,
  readShareHash,
  toCsv,
  toMarkdown,
} from "./codec"
import { defaultControlSet } from "./controls"
import { frameworkKey, frameworks } from "./frameworks"
import { metrics } from "./metrics"
import {
  applicabilityOf,
  consensusStatus,
  evaluateAssessment,
  isRequired,
  maturityFor,
  voteSpread,
} from "./scoring"
import { snippets } from "./snippets"
import { failureModes } from "./library"
import { tools } from "./tools"
import type { Assessment, FrameworkId } from "./types"

const set = defaultControlSet
const ids = new Set(set.controls.map((c) => c.id))

describe("default control set", () => {
  it("has six domains and unique, well-formed control ids", () => {
    expect(set.domains).toHaveLength(6)
    expect(ids.size).toBe(set.controls.length)
    expect(set.controls.length).toBeGreaterThanOrEqual(40)
    for (const c of set.controls) {
      expect(c.id).toMatch(/^[A-Z]{3}-\d{2}$/)
      expect(
        set.domains.some((d) => d.id === c.domain),
        c.id
      ).toBe(true)
      expect(c.how.length, c.id).toBeGreaterThanOrEqual(2)
      expect(c.done.length, c.id).toBeGreaterThan(20)
    }
  })

  it("references only catalogued tools, metrics, snippets and framework items", () => {
    const toolIds = new Set(tools.map((t) => t.id))
    const metricIds = new Set(metrics.map((m) => m.id))
    const snippetIds = new Set(snippets.map((s) => s.id))
    const fwItems = Object.fromEntries(
      frameworks.map((f) => [f.id, new Set(f.items.map((i) => i.id))])
    ) as Record<FrameworkId, Set<string>>
    for (const c of set.controls) {
      for (const t of c.tools)
        expect(toolIds.has(t), `${c.id} tool ${t}`).toBe(true)
      for (const m of c.metrics ?? [])
        expect(metricIds.has(m), `${c.id} metric ${m}`).toBe(true)
      for (const s of c.snippets ?? [])
        expect(snippetIds.has(s), `${c.id} snippet ${s}`).toBe(true)
      for (const fw of frameworks)
        for (const ref of c.frameworks[frameworkKey[fw.id]] ?? [])
          expect(fwItems[fw.id].has(ref), `${c.id} ${fw.id} ${ref}`).toBe(true)
    }
  })

  it("maps every failure mode to real controls", () => {
    for (const f of failureModes) {
      expect(f.controls.length).toBeGreaterThanOrEqual(2)
      for (const id of f.controls)
        expect(ids.has(id), `${f.id} ${id}`).toBe(true)
    }
  })

  it("covers every OWASP LLM Top 10 item with at least one control", () => {
    const owasp = frameworks.find((f) => f.id === "owasp")!
    for (const item of owasp.items) {
      const mapped = set.controls.filter((c) =>
        c.frameworks.owasp?.includes(item.id)
      )
      expect(mapped.length, item.id).toBeGreaterThan(0)
    }
  })
})

describe("applicability and stage filters", () => {
  const base = sampleAssessment.profile
  it("hides agentic and multi-agent controls for a plain RAG bot", () => {
    const rag = { ...base, systemType: "rag" as const }
    expect(applicabilityOf(byId("VIS-05"), rag)).toBe("not-applicable")
    expect(applicabilityOf(byId("SAF-04"), rag)).toBe("not-applicable")
    expect(applicabilityOf(byId("VIS-06"), rag)).toBe("applies")
    const multi = { ...base, systemType: "multi-agent" as const }
    expect(applicabilityOf(byId("VIS-05"), multi)).toBe("applies")
  })

  it("down-weights rather than hides sensitivity and exposure controls", () => {
    const pub = {
      ...base,
      dataSensitivity: "public" as const,
      exposure: "internal" as const,
    }
    expect(applicabilityOf(byId("SAF-02"), pub)).toBe("reduced")
    expect(applicabilityOf(byId("GOV-08"), pub)).toBe("reduced")
  })

  it("requires human approval only from supervised autonomy", () => {
    expect(
      applicabilityOf(byId("SAF-05"), { ...base, autonomy: "assist" })
    ).toBe("not-applicable")
    expect(
      applicabilityOf(byId("SAF-05"), { ...base, autonomy: "autonomous" })
    ).toBe("applies")
  })

  it("shifts required controls per maturity target", () => {
    const prototypeRequired = set.controls.filter((c) =>
      isRequired(c, "prototype")
    ).length
    const productionRequired = set.controls.filter((c) =>
      isRequired(c, "production")
    ).length
    expect(prototypeRequired).toBeLessThan(productionRequired)
    expect(productionRequired).toBe(set.controls.length)
  })
})

describe("scoring", () => {
  const result = evaluateAssessment(sampleAssessment, set)

  it("produces a mid-maturity sample with blockers and gaps", () => {
    expect(result.overall).toBeGreaterThan(40)
    expect(result.overall).toBeLessThan(85)
    expect(result.blockers.length).toBeGreaterThan(0)
    expect(result.gaps.length).toBeGreaterThan(result.blockers.length)
    expect(result.domains).toHaveLength(6)
    expect(result.counts.applicable + result.counts.hidden).toBe(
      set.controls.length
    )
  })

  it("orders gaps by severity then effort", () => {
    for (let i = 1; i < result.gaps.length; i++) {
      const a = result.gaps[i - 1]
      const b = result.gaps[i]
      expect(a.severity).toBeGreaterThanOrEqual(b.severity)
    }
    expect(result.gaps[0].response.status).not.toBe("verified")
  })

  it("flags only required gate controls that are not in place as blockers", () => {
    for (const b of result.blockers) {
      expect(b.control.gate).toBe(true)
      expect(b.required).toBe(true)
      expect(["none", "planned", "partial"]).toContain(b.response.status)
    }
    expect(result.blockers.map((b) => b.control.id)).toContain("GOV-07")
  })

  it("reaches 100 and optimized when everything is verified", () => {
    const perfect: Assessment = {
      ...sampleAssessment,
      responses: Object.fromEntries(
        set.controls.map((c) => [c.id, { status: "verified" as const }])
      ),
    }
    const r = evaluateAssessment(perfect, set)
    expect(r.overall).toBe(100)
    expect(r.maturity).toBe("optimized")
    expect(r.blockers).toHaveLength(0)
    expect(r.gaps).toHaveLength(0)
  })

  it("maps scores to maturity levels", () => {
    expect(maturityFor(10, [])).toBe("ad-hoc")
    expect(maturityFor(50, [])).toBe("defined")
    expect(maturityFor(70, [])).toBe("managed")
    expect(maturityFor(90, [])).toBe("managed")
  })

  it("derives review due dates from cadence", () => {
    const withCadence = result.reviews.find((r) => r.control.id === "QUA-01")
    expect(withCadence?.review).toBeDefined()
    expect(result.reviews.some((r) => r.review?.overdue)).toBe(true)
  })

  it("uses real owners in the sample", () => {
    for (const r of Object.values(sampleAssessment.responses))
      if (r.ownerId) expect(getUser(r.ownerId)).toBeDefined()
  })

  it("is deterministic", () => {
    expect(JSON.stringify(evaluateAssessment(sampleAssessment, set))).toBe(
      JSON.stringify(result)
    )
  })
})

describe("team votes", () => {
  it("takes the majority and resolves ties downward", () => {
    expect(consensusStatus({ a: "partial", b: "partial", c: "in-place" })).toBe(
      "partial"
    )
    expect(consensusStatus({ a: "planned", b: "in-place" })).toBe("planned")
    expect(consensusStatus(undefined)).toBeUndefined()
    expect(voteSpread({ a: "none", b: "verified" })).toBe(4)
    expect(voteSpread({ a: "partial" })).toBe(0)
  })
})

describe("codec", () => {
  it("round-trips through the share encoding", () => {
    const encoded = encodeAssessment(sampleAssessment)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    const decoded = decodeAssessment(encoded)
    expect(decoded.id).toBe(sampleAssessment.id)
    expect(decoded.profile).toEqual(sampleAssessment.profile)
    expect(evaluateAssessment(decoded, set).overall).toBe(
      evaluateAssessment(sampleAssessment, set).overall
    )
    expect(readShareHash(`#s=${encoded}`)?.name).toBe(sampleAssessment.name)
    expect(readShareHash("#nothing")).toBeNull()
  })

  it("rejects malformed input and tolerates missing fields", () => {
    expect(() => parseAssessment("nope")).toThrow()
    expect(() => parseAssessment({ profile: {} })).toThrow()
    const minimal = parseAssessment({
      profile: { systemType: "chatbot" },
      target: "pilot",
      responses: { "VIS-01": { status: "bogus" } },
    })
    expect(minimal.responses["VIS-01"].status).toBe("none")
    expect(minimal.profile.regulatory).toEqual([])
  })

  it("exports CSV with one row per control and a Markdown report", () => {
    const result = evaluateAssessment(sampleAssessment, set)
    const csv = toCsv(sampleAssessment, result)
    expect(csv.split("\n")).toHaveLength(set.controls.length + 1)
    const md = toMarkdown(sampleAssessment, result, set)
    expect(md).toContain("# Support Triage Agent")
    expect(md).toContain("## Release gate blockers")
    expect(md).toContain("GOV-07")
  })

  it("diffs two assessments", () => {
    const diff = diffAssessments(
      sampleSnapshots[0].assessment,
      sampleAssessment
    )
    expect(diff.targetChanged).toBe(true)
    expect(diff.changed.length).toBeGreaterThan(5)
    expect(
      diff.changed.filter((c) => c.direction === "up").length
    ).toBeGreaterThan(diff.changed.filter((c) => c.direction === "down").length)
  })
})

function byId(id: string) {
  return set.controls.find((c) => c.id === id)!
}
