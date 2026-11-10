"use client"

import * as React from "react"
import {
  FlaskConicalIcon,
  Grid3x3Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  guardrails as seedPolicies,
  guardrailViolations as seedViolations,
  type Guardrail,
  type GuardrailViolation,
  type ViolationVerdict,
} from "@/lib/data/guardrails"
import { CoverageMatrix } from "./coverage-matrix"
import { PoliciesTable } from "./policies-table"
import { PolicySheet } from "./policy-sheet"
import { TestPlayground } from "./test-playground"
import { ViolationsTable } from "./violations-table"

type Tab = "policies" | "violations" | "coverage" | "test"
const tabs: Tab[] = ["policies", "violations", "coverage", "test"]

function setPolicyParam(id: string | null) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (id) url.searchParams.set("policy", id)
  else url.searchParams.delete("policy")
  window.history.replaceState(null, "", url)
}

export function GuardrailsView({
  initialPolicyId,
  initialTab,
}: {
  initialPolicyId?: string
  initialTab?: string
}) {
  const [policies, setPolicies] = React.useState<Guardrail[]>(seedPolicies)
  const [violations, setViolations] =
    React.useState<GuardrailViolation[]>(seedViolations)
  const [openId, setOpenId] = React.useState<string | null>(
    initialPolicyId && seedPolicies.some((g) => g.id === initialPolicyId)
      ? initialPolicyId
      : null
  )
  const [tab, setTab] = React.useState<Tab>(
    tabs.includes(initialTab as Tab) ? (initialTab as Tab) : "policies"
  )

  const open = policies.find((g) => g.id === openId) ?? null

  const openPolicy = React.useCallback((id: string) => {
    setOpenId(id)
    setPolicyParam(id)
  }, [])
  const closePolicy = () => {
    setOpenId(null)
    setPolicyParam(null)
  }

  const patch = (id: string, p: Partial<Guardrail>) =>
    setPolicies((prev) => prev.map((g) => (g.id === id ? { ...g, ...p } : g)))

  const duplicate = (id: string) => {
    const src = policies.find((g) => g.id === id)
    if (!src) return
    const copyId = `${src.id}-copy`
    if (policies.some((g) => g.id === copyId)) {
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
      policy: src.policy.replace(
        /^id: .*$/m,
        `id: ${copyId.replace(/^grd-/, "")}`
      ),
      versions: [
        {
          version: "v1.0",
          changed: src.updated,
          authorId: "u-001",
          summary: `Duplicated from ${src.name}`,
        },
      ],
    }
    setPolicies((prev) => [...prev, copy])
    toast.success("Policy duplicated", {
      description: `${copy.name} created as a draft.`,
    })
    openPolicy(copyId)
  }

  const setVerdict = (ids: string[], verdict: ViolationVerdict) =>
    setViolations((prev) =>
      prev.map((v) =>
        ids.includes(v.id) ? { ...v, verdict, reviewerId: "u-001" } : v
      )
    )

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
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
          <PoliciesTable policies={policies} onOpen={openPolicy} />
        </TabsContent>
        <TabsContent value="violations">
          <ViolationsTable
            violations={violations}
            policies={policies}
            onOpenPolicy={openPolicy}
            onVerdict={setVerdict}
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
        onPatch={patch}
        onDuplicate={duplicate}
      />
    </>
  )
}
