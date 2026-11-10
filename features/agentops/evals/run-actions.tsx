"use client"

import * as React from "react"
import { GitCompareArrowsIcon, RocketIcon, RotateCwIcon } from "lucide-react"
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
import { getDeployedAgent } from "@/lib/data"
import {
  evalRuns,
  getDataset,
  getReleaseGate,
  type EvalRun,
} from "@/lib/data/evals"
import { modelDisplayName } from "@/features/agentops/format"
import { timeAgo } from "@/lib/format"

export function RunActions({ run }: { run: EvalRun }) {
  const agent = getDeployedAgent(run.agentId)
  const gate = getReleaseGate(run.agentId)
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
  const promoteDisabled =
    !completed || run.status === "Failed" || gateBlocks || !isCandidate
  const promoteReason = !completed
    ? "Wait for the run to finish"
    : run.status === "Failed"
      ? "Run failed — fix regressions first"
      : gateBlocks
        ? `${gate.rules.filter((r) => !r.pass).length} release-gate rules failing`
        : !isCandidate
          ? "This target is already what production serves"
          : undefined

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
          toast("Comparison opened", {
            description: `${run.id} vs ${other.id}: composite ${d >= 0 ? "+" : "−"}${Math.abs(d)} pt · ${run.regressions} vs ${other.regressions} regressions`,
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

      <Button
        variant="outline"
        onClick={() =>
          toast("Re-run queued", {
            description: `${agent?.name ?? run.agentId} · ${run.promptVersion} · ${getDataset(run.datasetId)?.name ?? run.datasetId}`,
          })
        }
      >
        <RotateCwIcon /> Re-run
      </Button>

      <AlertDialog>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <AlertDialogTrigger render={<Button disabled={promoteDisabled} />}>
              <RocketIcon /> Promote to production
            </AlertDialogTrigger>
          </TooltipTrigger>
          {promoteReason && <TooltipContent>{promoteReason}</TooltipContent>}
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Promote this target to production?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {agent?.name} will serve prompt{" "}
              <code className="font-mono">{run.promptVersion}</code> on{" "}
              {modelDisplayName(run.modelId)} for 100% of traffic. The release
              gate passed on {run.id} with a composite of {run.composite} and no
              regressions. Rollback is one click from the agent page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toast.success("Promotion started", {
                  description: `${agent?.name} → ${run.promptVersion} · ${modelDisplayName(run.modelId)}. Canary at 10% for 30 minutes, then full rollout.`,
                })
              }
            >
              Promote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
