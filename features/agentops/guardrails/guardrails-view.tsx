"use client"

import * as React from "react"
import {
  FlaskConicalIcon,
  Grid3x3Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { setQueryParams } from "@/hooks/use-query-param"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  Guardrail,
  GuardrailViolation,
  ViolationVerdict,
} from "@/lib/data/guardrails"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatNumber } from "@/lib/format"
import { recordAudit } from "../audit/audit-store"
import { CoverageMatrix } from "./coverage-matrix"
import { PoliciesTable } from "./policies-table"
import { PolicySheet } from "./policy-sheet"
import { fmtPct } from "./shared"
import {
  computeGuardrailStats,
  fpTone,
  policyStore,
  violationStore,
} from "./store"
import { TestPlayground } from "./test-playground"
import { ViolationsTable } from "./violations-table"

import { isGuardrailsTab, type GuardrailsTab } from "./tabs"

export { isGuardrailsTab, type GuardrailsTab }

const verdictLabel: Record<ViolationVerdict, string> = {
  Verified: "true positive",
  Dismissed: "false positive",
  Pending: "pending",
}

/**
 * Page body for /agentops/guardrails. The URL is the single source of truth:
 * `GuardrailsRoute` reads `?tab=`, `?policy=` and `?byPolicy=` and passes
 * them in, and every tab change or sheet open writes them back with
 * `setQueryParams` (no navigation), so links into this route update the
 * page in place and the back button is untouched.
 */
export function GuardrailsView({
  policyId,
  tab = "policies",
  violationPolicyId,
}: {
  /** `?policy=`: the policy whose sheet is open. Unknown ids are ignored. */
  policyId?: string
  /** `?tab=`, already validated with `isGuardrailsTab`. */
  tab?: GuardrailsTab
  /** `?byPolicy=` pre-filters the Violations tab to one policy. */
  violationPolicyId?: string
}) {
  const policies = policyStore.use()
  const violations = violationStore.use()

  const open = policies.find((g) => g.id === policyId) ?? null

  const openPolicy = (id: string) => setQueryParams({ policy: id })
  const closePolicy = () => setQueryParams({ policy: null })
  const changeTab = (next: GuardrailsTab) =>
    setQueryParams({
      tab: next === "policies" ? null : next,
      byPolicy: next === "violations" ? (violationPolicyId ?? null) : null,
    })

  const duplicate = (id: string) => {
    const src = policyStore.get().find((g) => g.id === id)
    if (!src) return
    const copyId = `${src.id}-copy`
    if (policyStore.get().some((g) => g.id === copyId)) {
      toast("Copy already exists", { description: copyId })
      openPolicy(copyId)
      return
    }
    const copy: Guardrail = {
      ...src,
      id: copyId,
      name: `${src.name} (copy)`,
      status: "Draft",
      triggers24h: 0,
      history: src.history.map(() => 0),
      falsePositiveRate: 0,
      ownerId: currentUser.id,
      updated: clock().toISOString(),
      policy: src.policy.replace(
        /^id: .*$/m,
        `id: ${copyId.replace(/^grd-/, "")}`
      ),
      versions: [
        {
          version: "v1.0",
          changed: clock().toISOString(),
          authorId: currentUser.id,
          summary: `Duplicated from ${src.name}`,
        },
      ],
    }
    policyStore.add(copy, "end")
    recordAudit({
      action: "guardrail.policy.created",
      source: "guardrail",
      target: {
        kind: "guardrail",
        id: copy.id,
        label: copy.name,
        href: `/agentops/guardrails?policy=${copy.id}`,
      },
      summary: `Created draft policy "${copy.name}" by duplicating ${src.name}`,
      context: { policyVersion: "v1.0" },
    })
    toast.success("Policy duplicated", {
      description: `${copy.name} created as a draft and recorded in the audit log.`,
    })
    openPolicy(copyId)
  }

  const setVerdict = (ids: string[], verdict: ViolationVerdict) => {
    const before = violationStore
      .get()
      .filter((v) => ids.includes(v.id))
      .map((v) => ({
        id: v.id,
        verdict: v.verdict,
        reviewerId: v.reviewerId,
      }))
    if (before.length === 0) return
    const apply = (
      rows: { id: string; verdict: ViolationVerdict; reviewerId?: string }[]
    ) =>
      violationStore.set((prev) =>
        prev.map((v) => {
          const r = rows.find((x) => x.id === v.id)
          return r ? { ...v, verdict: r.verdict, reviewerId: r.reviewerId } : v
        })
      )
    apply(
      before.map((b) => ({
        id: b.id,
        verdict,
        reviewerId: verdict === "Pending" ? undefined : currentUser.id,
      }))
    )
    const n = before.length
    const noun = n === 1 ? "violation" : "violations"
    const policyIds = [
      ...new Set(
        violationStore
          .get()
          .filter((v) => ids.includes(v.id))
          .map((v) => v.policyId)
      ),
    ]
    const policyNames = policyIds
      .map((id) => policyStore.get().find((g) => g.id === id)?.name ?? id)
      .join(", ")
    const event = recordAudit({
      action:
        verdict === "Verified"
          ? "guardrail.violation.verified"
          : verdict === "Dismissed"
            ? "guardrail.violation.dismissed"
            : "guardrail.violation.reopened",
      source: "guardrail",
      target: {
        kind: "guardrail",
        id: policyIds[0],
        label: policyNames,
        href:
          policyIds.length === 1
            ? `/agentops/guardrails?tab=violations&byPolicy=${policyIds[0]}`
            : "/agentops/guardrails?tab=violations",
      },
      summary: `Marked ${n} ${noun} ${verdictLabel[verdict]} (${ids.join(", ")})`,
      before: before.map((b) => b.verdict).join(", "),
      after: verdict,
    })
    toast(`${n} ${noun} marked ${verdictLabel[verdict]}`, {
      description:
        verdict === "Dismissed"
          ? `Lowers the false-positive rate inputs for ${policyNames}. Recorded as ${event.id}.`
          : verdict === "Verified"
            ? `Counts toward the decided verdicts for ${policyNames}. Recorded as ${event.id}.`
            : `Back in the review backlog. Recorded as ${event.id}.`,
      action: {
        label: "Undo",
        onClick: () => {
          apply(before)
          recordAudit({
            action: "guardrail.violation.reopened",
            source: "guardrail",
            target: {
              kind: "guardrail",
              id: policyIds[0],
              label: policyNames,
              href: "/agentops/guardrails?tab=violations",
            },
            summary: `Reverted verdict on ${n} ${noun} (${ids.join(", ")})`,
            before: verdict,
            after: before.map((b) => b.verdict).join(", "),
          })
        },
      },
      duration: 8000,
    })
  }

  return (
    <>
      <GuardrailStats policies={policies} violations={violations} />
      <Tabs
        value={tab}
        onValueChange={(v) => changeTab(v as GuardrailsTab)}
        className="gap-4"
      >
        <TabsList aria-label="Guardrails sections">
          <TabsTrigger value="policies">
            <ShieldCheckIcon /> Policies
          </TabsTrigger>
          <TabsTrigger value="violations">
            <ShieldAlertIcon /> Violations
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <Grid3x3Icon /> Coverage
          </TabsTrigger>
          <TabsTrigger value="test">
            <FlaskConicalIcon /> Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <PoliciesTable
            policies={policies}
            violations={violations}
            onOpen={openPolicy}
          />
        </TabsContent>
        <TabsContent value="violations">
          <ViolationsTable
            // The facet is seeded once per `?byPolicy=` value; the table never
            // writes that param itself, so the key only changes on navigation.
            key={violationPolicyId ?? ""}
            violations={violations}
            policies={policies}
            onOpenPolicy={openPolicy}
            onVerdict={setVerdict}
            initialFacets={
              violationPolicyId ? { policy: [violationPolicyId] } : undefined
            }
          />
        </TabsContent>
        <TabsContent value="coverage">
          <CoverageMatrix policies={policies} onOpenPolicy={openPolicy} />
        </TabsContent>
        <TabsContent value="test">
          <TestPlayground policies={policies} onOpenPolicy={openPolicy} />
        </TabsContent>
      </Tabs>

      <PolicySheet
        policy={open}
        violations={violations}
        onClose={closePolicy}
        onPatch={(id, patch) => policyStore.patch(id, patch)}
        onDuplicate={duplicate}
      />
    </>
  )
}

/** Fleet cards computed from the same client lists the tables render. */
function GuardrailStats({
  policies,
  violations,
}: {
  policies: Guardrail[]
  violations: GuardrailViolation[]
}) {
  const s = React.useMemo(
    () => computeGuardrailStats(policies, violations),
    [policies, violations]
  )
  const tone = fpTone(s.fpRate)
  return (
    <StatGrid columns={5}>
      <StatCard
        label="Active policies"
        value={s.active}
        hint={`${s.total - s.active} disabled or draft`}
      />
      <StatCard
        label="Blocked · 24h"
        value={formatNumber(s.blocked24h)}
        hint="Across Block-mode policies"
      />
      <StatCard
        label="Flagged · 24h"
        value={formatNumber(s.flagged24h)}
        hint="Routed to review, not stopped"
      />
      <StatCard
        label="False-positive rate"
        value={s.fpRate === null ? "n/a" : fmtPct(s.fpRate)}
        className={
          tone === "danger"
            ? "[&_[data-slot=card-title]]:text-danger-text"
            : tone === "warning"
              ? "[&_[data-slot=card-title]]:text-warning-text"
              : undefined
        }
        hint={`From ${s.decided} reviewer verdicts · ${s.pending} pending`}
        href="/agentops/guardrails?tab=violations"
      />
      <StatCard
        label="Agents without output guardrails"
        value={s.withoutOutput.length}
        className={
          s.withoutOutput.length > 0
            ? "border-warning/40 bg-warning/5 [&_[data-slot=card-title]]:text-warning-text"
            : undefined
        }
        hint={
          s.withoutOutput.length > 0
            ? s.withoutOutput.map((a) => a.name).join(", ")
            : "Every agent has at least one"
        }
        href="/agentops/guardrails?tab=coverage"
      />
    </StatGrid>
  )
}
