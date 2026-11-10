"use client"

import * as React from "react"
import { cn } from "cn"
import {
  DownloadIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CopyButton } from "@/components/shared/copy-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deployedAgents, NOW } from "@/lib/data"
import {
  toolPermissions,
  toolRisks,
  toolsForAgent,
  type PermissionDecision,
  type ToolRisk,
} from "@/lib/data/tools"
import { AgentChip } from "../shared"
import { decisionMeta, RiskBadge } from "./shared"

const decisions: PermissionDecision[] = ["allow", "approval", "deny"]
const key = (agentId: string, risk: ToolRisk) => `${agentId}:${risk}`

function initialMatrix() {
  return Object.fromEntries(
    toolPermissions.map((p) => [key(p.agentId, p.risk), p.decision])
  ) as Record<string, PermissionDecision>
}

const toneOn: Record<PermissionDecision, string> = {
  allow:
    "aria-pressed:border-success/30 aria-pressed:bg-success/10 aria-pressed:text-success-text",
  approval:
    "aria-pressed:border-warning/40 aria-pressed:bg-warning/15 aria-pressed:text-warning-text",
  deny: "aria-pressed:border-destructive/30 aria-pressed:bg-destructive/10 aria-pressed:text-danger-text",
}

export function PermissionsTab() {
  const [matrix, setMatrix] =
    React.useState<Record<string, PermissionDecision>>(initialMatrix)
  const [exportOpen, setExportOpen] = React.useState(false)
  const defaults = React.useMemo(() => initialMatrix(), [])
  const dirty = Object.keys(matrix).filter((k) => matrix[k] !== defaults[k])

  const set = (agentId: string, risk: ToolRisk, d: PermissionDecision) => {
    const k = key(agentId, risk)
    if (matrix[k] === d) return
    setMatrix((m) => ({ ...m, [k]: d }))
    const name = deployedAgents.find((a) => a.id === agentId)?.name ?? agentId
    toast.success(`${name} · ${risk} → ${decisionMeta[d].label}`, {
      description: decisionMeta[d].description + ". Takes effect next turn.",
    })
  }

  const policy = {
    version: 1,
    generatedAt: NOW.toISOString(),
    defaultDecision: "deny",
    agents: deployedAgents.map((a) => ({
      id: a.id,
      name: a.name,
      rules: toolRisks.map((risk) => ({
        risk: risk.toLowerCase(),
        decision: matrix[key(a.id, risk)],
        tools: toolsForAgent(a.id)
          .filter((t) => t.risk === risk && t.status !== "Disabled")
          .map((t) => t.name),
      })),
    })),
  }
  const json = JSON.stringify(policy, null, 2)

  const openDestructive = deployedAgents.filter(
    (a) => matrix[key(a.id, "Destructive")] === "allow"
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Agent × risk level</h2>
            <p className="text-xs text-muted-foreground">
              The decision applies to every tool of that risk the agent is
              allowlisted for. A tool&apos;s own policy can only be stricter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={dirty.length === 0}
              onClick={() => {
                setMatrix(defaults)
                toast("Permissions reset to the deployed policy")
              }}
            >
              <RotateCcwIcon /> Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              <DownloadIcon /> Export policy as JSON
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Agent
                </th>
                {toolRisks.map((risk) => (
                  <th
                    key={risk}
                    scope="col"
                    className="px-3 py-2 text-left font-medium"
                  >
                    <span className="inline-flex items-center gap-1.5 tracking-normal normal-case">
                      <RiskBadge risk={risk} size="sm" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {deployedAgents.map((a) => {
                const agentTools = toolsForAgent(a.id)
                return (
                  <tr key={a.id} className="align-middle">
                    <th
                      scope="row"
                      className="px-3 py-2.5 text-left font-normal"
                    >
                      <AgentChip agentId={a.id} />
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {a.team} · {agentTools.length} tool
                        {agentTools.length === 1 ? "" : "s"}
                      </span>
                    </th>
                    {toolRisks.map((risk) => {
                      const k = key(a.id, risk)
                      const value = matrix[k]
                      const count = agentTools.filter(
                        (t) => t.risk === risk && t.status !== "Disabled"
                      ).length
                      const changed = value !== defaults[k]
                      return (
                        <td key={risk} className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <ToggleGroup
                              value={[value]}
                              onValueChange={(v) => {
                                const next = v[0] as
                                  PermissionDecision | undefined
                                if (next) set(a.id, risk, next)
                              }}
                              variant="outline"
                              size="sm"
                              spacing={0}
                              aria-label={`${a.name}: ${risk} tools`}
                            >
                              {decisions.map((d) => {
                                const meta = decisionMeta[d]
                                const Icon = meta.icon
                                return (
                                  <Tooltip key={d}>
                                    <TooltipTrigger
                                      render={
                                        <ToggleGroupItem
                                          value={d}
                                          aria-label={meta.label}
                                          className={cn(
                                            "h-7 min-w-7 px-2",
                                            toneOn[d]
                                          )}
                                        />
                                      }
                                    >
                                      <Icon aria-hidden />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {meta.label} — {meta.description}
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              })}
                            </ToggleGroup>
                            <span
                              className={cn(
                                "text-[11px] text-muted-foreground tabular-nums",
                                count === 0 && "text-muted-foreground/50"
                              )}
                            >
                              {count} tool{count === 1 ? "" : "s"}
                              {changed && (
                                <span
                                  className="ml-1 inline-block size-1.5 rounded-full bg-brand align-middle"
                                  aria-label="changed"
                                />
                              )}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {dirty.length === 0
            ? "Matches the deployed policy."
            : `${dirty.length} cell${dirty.length === 1 ? "" : "s"} differ from the deployed policy — export to review the diff.`}
        </p>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheckIcon className="size-4 text-brand" /> Least privilege
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            An agent should hold the smallest set of tools that lets it finish
            its job, and the riskiest of those should sit behind a human. Prompt
            injection turns every reachable tool into an attack surface, so the
            matrix is what bounds the blast radius — not the prompt.
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-xs">
            {decisions.map((d) => {
              const meta = decisionMeta[d]
              const Icon = meta.icon
              return (
                <li key={d} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      d === "allow" &&
                        "border-success/30 bg-success/10 text-success-text",
                      d === "approval" &&
                        "border-warning/40 bg-warning/15 text-warning-text",
                      d === "deny" &&
                        "border-destructive/30 bg-destructive/10 text-danger-text"
                    )}
                  >
                    <Icon className="size-2.5" aria-hidden />
                  </span>
                  <span>
                    <span className="font-medium text-foreground">
                      {meta.label}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      — {meta.description}.
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Risk levels</h3>
          <dl className="mt-2 flex flex-col gap-2 text-xs">
            {(
              [
                [
                  "Read",
                  "Fetches data. Safe to automate; watch for exfiltration.",
                ],
                [
                  "Write",
                  "Creates or updates records. Reversible, but visible to people.",
                ],
                [
                  "Destructive",
                  "Deletes, pages, publishes or pays. Never without approval.",
                ],
              ] as [ToolRisk, string][]
            ).map(([risk, text]) => (
              <div key={risk} className="flex items-start gap-2">
                <dt className="shrink-0">
                  <RiskBadge risk={risk} size="sm" />
                </dt>
                <dd className="leading-relaxed text-muted-foreground">
                  {text}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {openDestructive.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-danger-text">
              <TriangleAlertIcon className="size-3.5" /> Destructive tools
              auto-allowed
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {openDestructive.map((a) => (
                <li key={a.id}>
                  <AgentChip agentId={a.id} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tool permission policy</DialogTitle>
            <DialogDescription>
              Per-agent decisions by risk level, with the tools each rule
              currently covers. Commit this next to the agent configs.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed">
            {json}
          </pre>
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              {deployedAgents.length} agents · {json.length.toLocaleString()}{" "}
              bytes
            </span>
            <div className="flex items-center gap-2">
              <CopyButton value={json} label="Copy JSON" />
              <Button
                size="sm"
                onClick={() => {
                  setExportOpen(false)
                  toast.success("tool-policy.json downloaded")
                }}
              >
                <DownloadIcon /> Download
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
