"use client"

import * as React from "react"
import { cn } from "cn"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import type { AgentFramework, DeployedAgent } from "@/lib/types"
import { agentStore } from "./stores"

const frameworks: AgentFramework[] = ["LangGraph", "LangChain", "Custom"]

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

/**
 * "Register agent": collects identity fields and appends a staging agent to
 * the shared agent store so it shows up in the Agents table and stat cards
 * for this session. Metrics start at zero; the record page needs a backend.
 */
export function RegisterAgentButton() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [team, setTeam] = React.useState("")
  const [modelId, setModelId] = React.useState("anthropic/claude-haiku-5.5")
  const [framework, setFramework] = React.useState<AgentFramework>("LangGraph")
  const [description, setDescription] = React.useState("")
  const valid = name.trim().length > 1 && modelId.includes("/")

  const register = () => {
    const template = agentStore.get()[0]
    const id = `agt-${slug(name)}`
    if (agentStore.get().some((a) => a.id === id)) {
      toast.error("An agent with this name already exists")
      return
    }
    const agent: DeployedAgent = {
      ...template,
      id,
      name: name.trim(),
      description:
        description.trim() || "Registered from the console; staging only.",
      team: team.trim() || template.team,
      ownerId: currentUser.id,
      framework,
      version: "v0.1.0",
      environment: "staging",
      modelId: modelId.trim(),
      fallbackModelId: undefined,
      health: "Healthy",
      tools: [],
      graph: [],
      metrics: {
        requests24h: 0,
        p50Ms: 0,
        p95Ms: 0,
        errorRate: 0,
        quality: 0,
        thumbsDownRate: 0,
        costPerDay: 0,
        tokens24h: 0,
        reviewRate: 10,
      },
      qualityTrend: Array.from({ length: 14 }, () => 0),
      trafficTrend: Array.from({ length: 14 }, () => 0),
      driftScore: 0,
      lastDeployed: clock().toISOString(),
      semanticEntityIds: [],
      promptVersion: "p-0",
      paused: false,
      pausedReason: undefined,
      errorBudget: {
        remaining: 1,
        burnRate1h: 0,
        burnRate6h: 0,
        window: "28d",
      },
    }
    agentStore.add(agent, "end")
    setOpen(false)
    setName("")
    setTeam("")
    setDescription("")
    toast.success(`${agent.name} registered in staging`, {
      description:
        "Listed in the Agents table for this session with zero traffic. Tracing starts on the first run once a backend is wired.",
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> Register agent
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Register agent</SheetTitle>
            <SheetDescription>
              Adds a staging agent to the fleet so it can be traced, reviewed
              and gated like the rest. Owner is set to you.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <form
              id="register-agent"
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault()
                if (valid) register()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input
                    id="agent-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Procurement Assistant"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Id becomes{" "}
                    <span className="font-mono">
                      agt-{slug(name) || "name"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-team">Team</Label>
                  <Input
                    id="agent-team"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="Finance Systems"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-model">Model id</Label>
                <Input
                  id="agent-model"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="provider/model"
                  required
                />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Framework</legend>
                <RadioGroup
                  value={framework}
                  onValueChange={(v) => setFramework(v as AgentFramework)}
                  className="grid gap-2 sm:grid-cols-3"
                  aria-label="Framework"
                >
                  {frameworks.map((f) => (
                    <Label
                      key={f}
                      htmlFor={`framework-${f}`}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-data-checked:border-ring has-data-checked:bg-muted/40"
                    >
                      <RadioGroupItem id={`framework-${f}`} value={f} />
                      {f}
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-description">Description</Label>
                <Textarea
                  id="agent-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What the agent does and who it serves"
                  className="min-h-20 text-sm"
                />
              </div>
            </form>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button type="submit" form="register-agent" disabled={!valid}>
                <PlusIcon /> Register in staging
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
