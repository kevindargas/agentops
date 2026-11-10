"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  GitCompareArrowsIcon,
  RocketIcon,
  RotateCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getDeployedAgent } from "@/lib/data/agentops"
import { GATE_THRESHOLD } from "@/lib/data/deployments"
import {
  evalRuns,
  getDataset,
  getEvalCases,
  getEvaluator,
  type EvalRun,
} from "@/lib/data/evals"
import { modelDisplayName, timeAgo } from "@/lib/format"
import { downloadText } from "../audit/export"
import { draftReleaseFromRun, releaseStore } from "../deployments/store"
import { NotInDemoButton } from "./shared"
import { gateStore } from "./store"

const CANARY_STEPS = [5, 25, 100]

function csvCell(v: string | number | boolean | undefined) {
  if (v === undefined) return ""
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Every case with its scores, one row per case, for offline review. */
export function casesToCsv(run: EvalRun) {
  const cases = getEvalCases(run.id)
  const evaluatorCols = run.evaluatorIds.map((e) => getEvaluator(e)?.name ?? e)
  const header = [
    "case_id",
    "input",
    "expected",
    "actual",
    "passed",
    "baseline_passed",
    "change",
    "latency_ms",
    "cost_usd",
    "trace_id",
    ...evaluatorCols,
  ]
  const rows = cases.map((c) =>
    [
      c.id,
      c.input,
      c.expected,
      c.actual,
      c.passed,
      c.baselinePassed,
      c.change,
      c.latencyMs,
      c.cost,
      c.traceId,
      ...run.evaluatorIds.map((e) => c.scores[e]),
    ]
      .map(csvCell)
      .join(",")
  )
  return [header.join(","), ...rows].join("\r\n") + "\r\n"
}

export function RunActions({ run }: { run: EvalRun }) {
  const router = useRouter()
  const agent = getDeployedAgent(run.agentId)
  const gates = gateStore.use()
  const gate = gates.find((g) => g.agentId === run.agentId)
  const releases = releaseStore.use()
  const existing = releases.find(
    (r) =>
      r.evalGate?.runId === run.id &&
      (r.stage === "Draft" || r.stage === "Pending approval")
  )
  const others = evalRuns.filter(
    (r) =>
      r.id !== run.id &&
      r.agentId === run.agentId &&
      (r.status === "Passed" || r.status === "Failed")
  )
  const items = others.map((r) => ({
    value: r.id,
    label: `${r.id} · ${r.composite} · ${timeAgo(r.started)}`,
  }))
  const [compare, setCompare] = React.useState<string | null>(null)

  const completed = run.status === "Passed" || run.status === "Failed"
  const isCandidate =
    !!agent &&
    (run.promptVersion !== agent.promptVersion || run.modelId !== agent.modelId)
  const gateBlocks = !!gate && gate.enforced && gate.status === "Failed"
  const belowThreshold = run.composite < GATE_THRESHOLD
  const promoteDisabled =
    !completed ||
    run.status === "Failed" ||
    gateBlocks ||
    !isCandidate ||
    belowThreshold ||
    !!existing
  const promoteReason = !completed
    ? "Wait for the run to finish"
    : run.status === "Failed"
      ? "Run failed. Fix the regressions first"
      : belowThreshold
        ? `Composite ${run.composite} is below the ${GATE_THRESHOLD} gate threshold`
        : gateBlocks
          ? `${gate.rules.filter((r) => !r.pass).length} release-gate rules failing and the gate is enforced`
          : !isCandidate
            ? "This target is already what production serves"
            : existing
              ? `${existing.id} already tracks this candidate`
              : undefined

  function promote() {
    if (!agent) return
    const release = draftReleaseFromRun(run, agent)
    toast.success(`${release.id} drafted for approval`, {
      description: `${agent.name} ${release.version}: prompt ${run.promptVersion} on ${modelDisplayName(run.modelId)}. Gate passed at ${run.composite} against the ${GATE_THRESHOLD} threshold. Canary ${CANARY_STEPS.map((s) => `${s}%`).join(" then ")} once approved.`,
      action: {
        label: "Open release",
        onClick: () => router.push(`/agentops/deployments/${release.id}`),
      },
      duration: 10_000,
    })
  }

  function exportCsv() {
    const file = `${run.id}-cases.csv`
    downloadText(file, casesToCsv(run), "text/csv")
    toast.success("Results exported", {
      description: `${file} · ${run.cases} cases with every evaluator score`,
    })
  }

  return (
    <>
      <Select
        items={items}
        value={compare}
        onValueChange={(v) => {
          setCompare(null)
          const other = evalRuns.find((r) => r.id === v)
          if (!other) return
          const d = run.composite - other.composite
          toast(`${run.id} vs ${other.id}`, {
            description: `Composite ${d >= 0 ? "+" : "−"}${Math.abs(d)} pt · ${run.regressions} vs ${other.regressions} regressions · pass rate ${run.passRate}% vs ${other.passRate}%`,
            action: {
              label: `Open ${other.id}`,
              onClick: () => router.push(`/agentops/evals/${other.id}`),
            },
          })
        }}
      >
        <SelectTrigger
          aria-label="Compare to another run"
          className="w-40"
          disabled={!completed || items.length === 0}
        >
          <GitCompareArrowsIcon className="text-muted-foreground" />
          <SelectValue placeholder="Compare to…" />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>Other runs · {agent?.name ?? run.agentId}</SelectLabel>
            {items.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                <span className="font-mono text-xs">{it.value}</span>
                <span className="text-xs text-muted-foreground">
                  {it.label.split(" · ").slice(1).join(" · ")}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {completed && (
        <Button variant="outline" onClick={exportCsv}>
          <DownloadIcon /> Export CSV
        </Button>
      )}

      <NotInDemoButton
        variant="outline"
        size="default"
        reason={`Re-running needs the eval service. This would queue ${agent?.name ?? run.agentId} · ${run.promptVersion} against ${getDataset(run.datasetId)?.name ?? run.datasetId}.`}
      >
        <RotateCwIcon /> Re-run
      </NotInDemoButton>

      {existing ? (
        <Button render={<Link href={`/agentops/deployments/${existing.id}`} />}>
          <RocketIcon /> Open {existing.id}
        </Button>
      ) : (
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <AlertDialogTrigger
                render={<Button disabled={promoteDisabled} />}
              >
                <RocketIcon /> Promote to production
              </AlertDialogTrigger>
            </TooltipTrigger>
            {promoteReason && <TooltipContent>{promoteReason}</TooltipContent>}
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Draft a production release?</AlertDialogTitle>
              <AlertDialogDescription>
                {agent?.name} would serve prompt{" "}
                <code className="font-mono">{run.promptVersion}</code> on{" "}
                {modelDisplayName(run.modelId)}. The release is drafted as a
                canary ({CANARY_STEPS.map((s) => `${s}%`).join(" then ")}) and
                waits for approval; its eval gate is this run, composite{" "}
                {run.composite} against the {GATE_THRESHOLD} threshold with{" "}
                {run.regressions} regressions. Roll back is one click from the
                release record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={promote}>
                <RocketIcon /> Draft release
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
