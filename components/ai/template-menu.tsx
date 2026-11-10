"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ChevronRightIcon,
  LayoutTemplateIcon,
  PenLineIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getModel } from "@/lib/ai/agents"
import { recordTypeLabel } from "@/lib/ai/assistant"
import {
  agentTemplates,
  templateCategories,
  templateFits,
  templatePrompt,
  type AgentTemplate,
} from "@/lib/ai/templates"
import { useAi } from "./ai-provider"

/**
 * Slide-in side menu listing agentic templates: pre-built multi-step runs the
 * assistant can execute against the current page. Rendered inside the chat
 * tab so it never leaves the assistant panel.
 */
export function TemplateMenu() {
  const { templatesOpen, setTemplatesOpen, runTemplate, context, status } =
    useAi()
  const [query, setQuery] = React.useState("")
  const busy = status !== "ready"

  React.useEffect(() => {
    if (!templatesOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTemplatesOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [templatesOpen, setTemplatesOpen])

  if (!templatesOpen) return null

  const q = query.trim().toLowerCase()
  const matches = (t: AgentTemplate) =>
    !q || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q)
  const suggested = context.recordType
    ? agentTemplates.filter(
        (t) => t.appliesTo && templateFits(t, context) && matches(t)
      )
    : []
  const suggestedIds = new Set(suggested.map((t) => t.id))
  const groups = templateCategories
    .map((c) => ({
      category: c,
      items: agentTemplates.filter(
        (t) => t.category === c && !suggestedIds.has(t.id) && matches(t)
      ),
    }))
    .filter((g) => g.items.length > 0)
  const total =
    suggested.length + groups.reduce((a, g) => a + g.items.length, 0)

  return (
    <>
      <button
        type="button"
        aria-label="Close templates"
        onClick={() => setTemplatesOpen(false)}
        className="absolute inset-0 z-10 animate-in bg-background/50 backdrop-blur-[1.5px] duration-150 fade-in-0"
      />
      <aside
        role="dialog"
        aria-label="Agentic templates"
        className="absolute inset-y-0 left-0 z-20 flex w-[320px] max-w-[90%] animate-in flex-col border-r bg-background shadow-2xl duration-200 fade-in-0 slide-in-from-left-6"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <LayoutTemplateIcon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold">Agentic templates</p>
            <p className="text-[11px] text-muted-foreground">
              Multi-step runs with a plan you can review
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={() => setTemplatesOpen(false)}
          >
            <XIcon />
          </Button>
        </div>

        <div className="border-b p-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="h-8 pl-8 text-sm"
              aria-label="Search templates"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-2 pb-4">
            {total === 0 && (
              <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                <p className="text-sm font-medium">No templates match</p>
                <p className="text-xs text-muted-foreground">
                  Try a different word, or ask the assistant directly.
                </p>
              </div>
            )}
            {suggested.length > 0 && (
              <TemplateGroup
                title={`For this ${context.recordType ? recordTypeLabel[context.recordType].toLowerCase() : "record"}`}
                hint={context.recordNumber}
                items={suggested}
                highlight
                onRun={runTemplate}
                disabled={busy}
                context={context}
              />
            )}
            {groups.map((g) => (
              <TemplateGroup
                key={g.category}
                title={g.category}
                items={g.items}
                onRun={runTemplate}
                disabled={busy}
                context={context}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Templates run with your current model. Steps that change records are
          queued for approval.
        </div>
      </aside>
    </>
  )
}

function TemplateGroup({
  title,
  hint,
  items,
  highlight,
  onRun,
  disabled,
  context,
}: {
  title: string
  hint?: string
  items: AgentTemplate[]
  highlight?: boolean
  onRun: (t: AgentTemplate) => void
  disabled: boolean
  context: ReturnType<typeof useAi>["context"]
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-1">
        {highlight && <SparklesIcon className="size-3 text-brand" />}
        <p
          className={cn(
            "text-[11px] font-medium tracking-wide uppercase",
            highlight ? "text-brand" : "text-muted-foreground"
          )}
        >
          {title}
        </p>
        {hint && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {items.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          onRun={onRun}
          disabled={disabled}
          context={context}
        />
      ))}
    </section>
  )
}

function TemplateCard({
  template: t,
  onRun,
  disabled,
  context,
}: {
  template: AgentTemplate
  onRun: (t: AgentTemplate) => void
  disabled: boolean
  context: ReturnType<typeof useAi>["context"]
}) {
  const model = getModel(t.recommendedModelId)
  const Icon = t.icon
  const needsRecord = t.appliesTo && !templateFits(t, context)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRun(t)}
            className={cn(
              "group/tpl flex w-full items-start gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-all hover:border-brand/40 hover:bg-brand/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              needsRecord && "border-dashed"
            )}
          />
        }
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover/tpl:bg-brand/10 group-hover/tpl:text-brand">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm leading-tight font-medium">
              {t.name}
            </span>
            {t.writes && (
              <Badge
                variant="outline"
                className="h-4 gap-0.5 px-1 text-[9px] font-medium text-muted-foreground"
              >
                <PenLineIcon className="size-2.5" /> Writes
              </Badge>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
            {t.description}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="tabular-nums">{t.steps.length} steps</span>
            <span aria-hidden>·</span>
            <span className="truncate">
              Best with {model?.name ?? "default model"}
            </span>
          </span>
        </span>
        <ChevronRightIcon className="mt-2 size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover/tpl:translate-x-0.5 group-hover/tpl:text-brand" />
      </TooltipTrigger>
      <TooltipContent side="right" align="start" className="max-w-64 p-0">
        <div className="px-2.5 py-2">
          <p className="text-[11px] font-medium opacity-70">Plan</p>
          <ol className="mt-1 flex flex-col gap-0.5 text-xs">
            {t.steps.map((s, i) => (
              <li key={s} className="flex gap-1.5">
                <span className="w-3 shrink-0 text-right tabular-nums opacity-60">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-1.5 border-t border-current/15 pt-1.5 text-[11px] opacity-70">
            “{templatePrompt(t, context)}”
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
