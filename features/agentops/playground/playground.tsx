"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "cn"
import {
  BracesIcon,
  ColumnsIcon,
  FlaskConicalIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  SquareIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { modelDisplayName } from "@/features/agentops/format"
import { ModelChip } from "@/features/agentops/shared"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  cloneParams,
  configFromSearchParams,
  diffParams,
  extractVariables,
  getSamplePrompt,
  renderPrompt,
  type PlaygroundConfig,
  type PlaygroundRunRecord,
} from "@/lib/data/playground"
import { ColumnBadge, ConfigPanel } from "./config-panel"
import { MetricsStrip } from "./metrics-strip"
import { RunTranscript } from "./run-transcript"
import { RunsList } from "./runs-list"
import { useSimulatedRun } from "./use-simulated-run"

type Column = "A" | "B"

const MAX_RUNS = 8

/**
 * Playground root. Owns the two configurations (A is always live; B only in
 * compare mode), the prompt + variables, both simulated streams and the
 * in-memory run history. Reads the initial configuration from the URL so
 * share links reproduce a setup exactly.
 */
export function Playground() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [configs, setConfigs] = React.useState<
    Record<Column, PlaygroundConfig>
  >(() => {
    const a = configFromSearchParams(searchParams)
    return { A: a, B: { ...a, params: cloneParams(a.params) } }
  })
  const [compare, setCompare] = React.useState(false)
  const [editing, setEditing] = React.useState<Column>("A")
  const [prompt, setPrompt] = React.useState(
    () => getSamplePrompt(configs.A.agentId).text
  )
  const [vars, setVars] = React.useState<Record<string, string>>({})
  const [runs, setRuns] = React.useState<PlaygroundRunRecord[]>([])
  const runSeq = React.useRef(0)

  const runA = useSimulatedRun()
  const runB = useSimulatedRun()
  const busy = runA.streaming || runB.streaming

  const agentA = getDeployedAgent(configs.A.agentId) ?? deployedAgents[0]
  const agentB = getDeployedAgent(configs.B.agentId) ?? deployedAgents[0]
  const sample = getSamplePrompt(configs.A.agentId)
  const varNames = extractVariables(prompt)
  const resolvedVars = Object.fromEntries(
    varNames.map((n) => [n, vars[n] ?? sample.variables[n] ?? ""])
  )
  const input = renderPrompt(prompt, resolvedVars)

  const updateConfig = (col: Column, next: PlaygroundConfig) => {
    setConfigs((c) => ({ ...c, [col]: next }))
    // Keep the sample prompt in step with the primary agent unless the user
    // has edited it.
    if (col === "A" && next.agentId !== configs.A.agentId) {
      if (prompt === getSamplePrompt(configs.A.agentId).text) {
        setPrompt(getSamplePrompt(next.agentId).text)
        setVars({})
      }
      if (!compare)
        setConfigs((c) => ({
          ...c,
          B: { ...next, params: cloneParams(next.params) },
        }))
    }
  }

  const record = (
    label: Column | undefined,
    config: PlaygroundConfig,
    text: string,
    result: PlaygroundRunRecord["result"]
  ): PlaygroundRunRecord => ({
    id: `run-${++runSeq.current}`,
    label,
    config: { ...config, params: cloneParams(config.params) },
    input: text,
    result,
  })

  const run = () => {
    if (busy || !input.trim()) return
    const text = input
    const next: PlaygroundRunRecord[] = []
    const resA = runA.start(configs.A, text)
    next.push(record(compare ? "A" : undefined, configs.A, text, resA))
    if (compare) {
      const resB = runB.start(configs.B, text)
      next.push(record("B", configs.B, text, resB))
    }
    setRuns((r) => [...next.reverse(), ...r].slice(0, MAX_RUNS))
  }

  const stop = () => {
    runA.stop()
    runB.stop()
  }

  const rerun = (r: PlaygroundRunRecord) => {
    if (busy) return
    const col: Column = r.label === "B" && compare ? "B" : "A"
    setConfigs((c) => ({
      ...c,
      [col]: { ...r.config, params: cloneParams(r.config.params) },
    }))
    setPrompt(r.input)
    setVars({})
    const target = col === "B" ? runB : runA
    const res = target.start(r.config, r.input)
    setRuns((list) =>
      [
        record(compare ? col : undefined, r.config, r.input, res),
        ...list,
      ].slice(0, MAX_RUNS)
    )
  }

  const toggleCompare = (on: boolean) => {
    setCompare(on)
    setEditing("A")
    if (on) {
      setConfigs((c) => ({
        ...c,
        B: { ...c.A, params: cloneParams(c.A.params) },
      }))
      runB.reset()
    }
  }

  const createExperiment = () => {
    const d = diffParams(configs.B.params, configs.A.params)
    const what =
      configs.A.modelId !== configs.B.modelId
        ? `${modelDisplayName(configs.A.modelId)} vs ${modelDisplayName(configs.B.modelId)}`
        : d.length
          ? d.map((x) => x.label.toLowerCase()).join(", ")
          : "identical configurations"
    toast.success("Experiment drafted", {
      description: `${agentA.name}: ${what}. Open it to set traffic split and the primary metric.`,
      action: {
        label: "Open experiments",
        onClick: () => router.push("/agentops/experiments"),
      },
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 self-start rounded-xl border bg-card p-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
            Configuration
          </h2>
          {compare && (
            <ToggleGroup
              multiple={false}
              value={[editing]}
              onValueChange={(v) => v[0] && setEditing(v[0] as Column)}
              variant="outline"
              spacing={0}
              aria-label="Configuration to edit"
            >
              {(["A", "B"] as const).map((c) => (
                <ToggleGroupItem
                  key={c}
                  value={c}
                  size="sm"
                  className="px-3 font-mono text-xs data-pressed:bg-muted"
                >
                  {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
        <ConfigPanel
          key={editing}
          label={compare ? editing : undefined}
          config={configs[editing]}
          onChange={(next) => updateConfig(editing, next)}
        />
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            multiple={false}
            value={[compare ? "compare" : "single"]}
            onValueChange={(v) => v[0] && toggleCompare(v[0] === "compare")}
            variant="outline"
            spacing={0}
            aria-label="Playground mode"
          >
            <ToggleGroupItem value="single" size="sm" className="gap-1.5 px-3">
              <PlayIcon className="size-3.5" /> Single
            </ToggleGroupItem>
            <ToggleGroupItem value="compare" size="sm" className="gap-1.5 px-3">
              <ColumnsIcon className="size-3.5" /> Compare A/B
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            {compare && (
              <Button variant="outline" size="sm" onClick={createExperiment}>
                <FlaskConicalIcon /> Create experiment from this
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/agentops/agents/${agentA.id}`} />}
            >
              Agent record
            </Button>
          </div>
        </div>

        <PromptInput
          onSubmit={() => run()}
          className="rounded-xl shadow-xs transition-shadow focus-within:shadow-sm"
        >
          <PromptInputBody>
            <Label htmlFor="playground-prompt" className="sr-only">
              Prompt
            </Label>
            <PromptInputTextarea
              id="playground-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Write the user turn. Use {{variable}} placeholders to parametrise it."
              className="min-h-24 text-sm leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Escape" && busy) {
                  e.preventDefault()
                  stop()
                }
              }}
            />
            {varNames.length > 0 && (
              <div className="grid gap-2 border-t px-3 py-2.5 sm:grid-cols-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:col-span-2">
                  <BracesIcon className="size-3" /> Variables
                </p>
                {varNames.map((name) => (
                  <div key={name} className="flex flex-col gap-1">
                    <Label
                      htmlFor={`var-${name}`}
                      className="font-mono text-[11px] text-muted-foreground"
                    >
                      {`{{${name}}}`}
                    </Label>
                    <Input
                      id={`var-${name}`}
                      value={resolvedVars[name]}
                      onChange={(e) =>
                        setVars((v) => ({ ...v, [name]: e.target.value }))
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </PromptInputBody>
          <PromptInputFooter className="pt-0">
            <PromptInputTools className="min-w-0 flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              {compare ? (
                <>
                  <ColumnBadge label="A" />
                  <ModelChip modelId={configs.A.modelId} className="text-xs" />
                  <span className="text-muted-foreground/60">·</span>
                  <ColumnBadge label="B" />
                  <ModelChip modelId={configs.B.modelId} className="text-xs" />
                </>
              ) : (
                <>
                  <ModelChip modelId={configs.A.modelId} className="text-xs" />
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {configs.A.promptVersion}
                  </Badge>
                  <span className="font-mono tabular-nums">
                    T {configs.A.params.temperature.toFixed(1)} ·{" "}
                    {configs.A.params.reasoningEffort}
                  </span>
                </>
              )}
            </PromptInputTools>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                <Kbd className="h-4 min-w-4 text-[10px]">↵</Kbd> run
                <Kbd className="ml-1 h-4 min-w-4 text-[10px]">⇧↵</Kbd> newline
              </span>
              <PromptInputSubmit
                status={busy ? "streaming" : undefined}
                onStop={stop}
                disabled={!busy && !input.trim()}
                className="gap-1.5 rounded-lg px-2.5"
                size="sm"
              >
                {busy ? (
                  <>
                    <SquareIcon className="size-3.5" /> Stop
                  </>
                ) : (
                  <>
                    <PlayIcon className="size-3.5" />{" "}
                    {compare ? "Run both" : "Run"}
                  </>
                )}
              </PromptInputSubmit>
            </div>
          </PromptInputFooter>
        </PromptInput>

        {compare ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {(["A", "B"] as const).map((col) => {
              const cfg = configs[col]
              const other = col === "A" ? configs.B : configs.A
              const r = col === "A" ? runA : runB
              const o = col === "A" ? runB : runA
              const agent = col === "A" ? agentA : agentB
              const d = diffParams(cfg.params, other.params)
              return (
                <section
                  key={col}
                  aria-label={`Configuration ${col} results`}
                  className={cn(
                    "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4",
                    editing === col && "ring-2 ring-ring/20"
                  )}
                >
                  <header className="flex flex-wrap items-center gap-2">
                    <ColumnBadge label={col} />
                    <ModelChip modelId={cfg.modelId} className="text-xs" />
                    <Badge
                      variant="outline"
                      className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {cfg.promptVersion}
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                      {cfg.modelId !== other.modelId || d.length
                        ? `${d.length + (cfg.modelId !== other.modelId ? 1 : 0)} differ from ${col === "A" ? "B" : "A"}`
                        : `same as ${col === "A" ? "B" : "A"}`}
                    </span>
                  </header>
                  <MetricsStrip
                    metrics={r.result?.metrics ?? null}
                    other={o.result?.metrics ?? null}
                    warnings={r.result?.warnings}
                    pending={r.streaming}
                  />
                  <RunTranscript
                    input={r.input}
                    result={r.result}
                    progress={{ value: r.progress, streaming: r.streaming }}
                    agentName={agent.name}
                  />
                </section>
              )
            })}
          </div>
        ) : (
          <section
            aria-label="Run results"
            className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4"
          >
            <MetricsStrip
              metrics={runA.result?.metrics ?? null}
              warnings={runA.result?.warnings}
              pending={runA.streaming}
            />
            <RunTranscript
              input={runA.input}
              result={runA.result}
              progress={{ value: runA.progress, streaming: runA.streaming }}
              agentName={agentA.name}
            />
          </section>
        )}

        <RunsList runs={runs} onRerun={rerun} disabled={busy} />
      </div>
    </div>
  )
}
