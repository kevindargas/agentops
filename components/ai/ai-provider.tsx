"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"

import {
  agentActivity as seedActivity,
  agents as seedAgents,
  models,
  proposals as seedProposals,
  type AgentActivity,
  type AgentProposal,
  type AiAgent,
  type Autonomy,
} from "@/lib/ai/agents"
import {
  contextFromPathname,
  planResponse,
  type AssistantContext,
  type Source,
  type SuggestedAction,
} from "@/lib/ai/assistant"
import { templatePrompt, type AgentTemplate } from "@/lib/ai/templates"
import { hoursAgo } from "@/lib/data/seed"
import { createStore } from "@/lib/store"

export type ChatStatus = "ready" | "submitted" | "streaming" | "error"

export type MessagePart =
  | { type: "reasoning"; text: string; streaming: boolean }
  | {
      type: "tool"
      name: string
      title: string
      input: Record<string, unknown>
      output?: unknown
      state: "input-available" | "output-available"
    }
  | { type: "text"; text: string; streaming: boolean }
  | { type: "sources"; items: Source[] }
  | {
      type: "actions"
      actions: SuggestedAction[]
      status: Record<string, "applied" | "pending" | "rejected">
    }
  | { type: "suggestions"; items: string[] }

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  parts: MessagePart[]
  createdAt: number
}

/** A model pinned from the live catalog (/ai/models) so it can be chosen in the picker. */
export interface CatalogModelRef {
  id: string
  name: string
  provider: string
  description: string
}

export interface AiSettings {
  modelId: string
  catalogModel?: CatalogModelRef
  defaultAutonomy: Autonomy
  requireApprovalForHighRisk: boolean
  piiRedaction: boolean
  dailyActionBudget: number
  allowedTools: string[]
  showReasoning: boolean
}

interface PersistedUi {
  open: boolean
  tab: "chat" | "agents" | "queue"
}

const uiStore = createStore<PersistedUi>(
  { open: false, tab: "chat" },
  "agentops:assistant"
)
const settingsStore = createStore<AiSettings>(
  {
    modelId: models[1].id,
    defaultAutonomy: "approve",
    requireApprovalForHighRisk: true,
    piiRedaction: true,
    dailyActionBudget: 500,
    allowedTools: [
      "read_records",
      "search_knowledge",
      "update_fields",
      "create_records",
    ],
    showReasoning: true,
  },
  "agentops:ai-settings"
)

interface AiContextValue {
  // panel
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  tab: PersistedUi["tab"]
  setTab: (tab: PersistedUi["tab"]) => void
  /** Agentic templates side menu inside the chat tab. */
  templatesOpen: boolean
  setTemplatesOpen: (open: boolean) => void
  /** Run an agentic template against the current page context. */
  runTemplate: (template: AgentTemplate) => void
  // chat
  context: AssistantContext
  messages: ChatMessage[]
  status: ChatStatus
  ask: (prompt: string) => void
  /** Re-run the most recent user prompt (drops the last assistant reply). */
  regenerate: () => void
  stop: () => void
  clear: () => void
  applyAction: (messageId: string, action: SuggestedAction) => void
  // settings
  settings: AiSettings
  updateSettings: (patch: Partial<AiSettings>) => void
  // agents
  agents: AiAgent[]
  updateAgent: (
    id: string,
    patch: Partial<Pick<AiAgent, "enabled" | "autonomy">>
  ) => void
  proposals: AgentProposal[]
  decide: (id: string, decision: "approve" | "reject") => void
  activity: AgentActivity[]
}

const AiContext = React.createContext<AiContextValue | null>(null)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let idCounter = 0
const nextId = () => `m${Date.now().toString(36)}${(idCounter++).toString(36)}`

export function AiProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ui = uiStore.use()
  const settings = settingsStore.use()
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [status, setStatus] = React.useState<ChatStatus>("ready")
  const [agents, setAgents] = React.useState<AiAgent[]>(seedAgents)
  const [proposals, setProposals] =
    React.useState<AgentProposal[]>(seedProposals)
  const [activity, setActivity] = React.useState<AgentActivity[]>(seedActivity)
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const abortRef = React.useRef<{ cancelled: boolean } | null>(null)

  const context = React.useMemo(() => contextFromPathname(pathname), [pathname])

  // ⌘J / Ctrl+J toggles the assistant.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "j" || e.key === "J") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        uiStore.set((s) => ({ ...s, open: !s.open }))
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const patchAssistant = React.useCallback(
    (id: string, fn: (parts: MessagePart[]) => MessagePart[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, parts: fn(m.parts) } : m))
      )
    },
    []
  )

  const stop = React.useCallback(() => {
    if (abortRef.current) abortRef.current.cancelled = true
    setStatus("ready")
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        parts: m.parts.map((p) =>
          p.type === "reasoning" || p.type === "text"
            ? { ...p, streaming: false }
            : p
        ),
      }))
    )
  }, [])

  const ask = React.useCallback(
    async (prompt: string) => {
      const text = prompt.trim()
      if (!text) return
      uiStore.set({ open: true, tab: "chat" })
      const run = planResponse(text, context)
      const token = { cancelled: false }
      abortRef.current = token
      const assistantId = nextId()
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "user",
          parts: [{ type: "text", text, streaming: false }],
          createdAt: Date.now(),
        },
        {
          id: assistantId,
          role: "assistant",
          parts: [],
          createdAt: Date.now(),
        },
      ])
      setStatus("submitted")
      await sleep(350)
      if (token.cancelled) return
      setStatus("streaming")

      for (const step of run.steps) {
        if (token.cancelled) return
        if (step.kind === "reasoning") {
          if (!settings.showReasoning) continue
          patchAssistant(assistantId, (parts) => [
            ...parts,
            { type: "reasoning", text: "", streaming: true },
          ])
          const words = step.text.split(" ")
          for (let i = 0; i < words.length; i++) {
            if (token.cancelled) return
            await sleep(22)
            const slice = words.slice(0, i + 1).join(" ")
            patchAssistant(assistantId, (parts) =>
              parts.map((p, idx) =>
                idx === parts.length - 1 && p.type === "reasoning"
                  ? { ...p, text: slice }
                  : p
              )
            )
          }
          patchAssistant(assistantId, (parts) =>
            parts.map((p, idx) =>
              idx === parts.length - 1 && p.type === "reasoning"
                ? { ...p, streaming: false }
                : p
            )
          )
        } else if (step.kind === "tool") {
          patchAssistant(assistantId, (parts) => [
            ...parts,
            {
              type: "tool",
              name: step.name,
              title: step.title,
              input: step.input,
              state: "input-available",
            },
          ])
          await sleep(step.durationMs)
          if (token.cancelled) return
          patchAssistant(assistantId, (parts) =>
            parts.map((p, idx) =>
              idx === parts.length - 1 && p.type === "tool"
                ? { ...p, output: step.output, state: "output-available" }
                : p
            )
          )
        } else if (step.kind === "text") {
          patchAssistant(assistantId, (parts) => [
            ...parts,
            { type: "text", text: "", streaming: true },
          ])
          const chunks = step.markdown.match(/\S+\s*/g) ?? [step.markdown]
          let acc = ""
          for (const chunk of chunks) {
            if (token.cancelled) return
            acc += chunk
            await sleep(14)
            const snapshot = acc
            patchAssistant(assistantId, (parts) =>
              parts.map((p, idx) =>
                idx === parts.length - 1 && p.type === "text"
                  ? { ...p, text: snapshot }
                  : p
              )
            )
          }
          patchAssistant(assistantId, (parts) =>
            parts.map((p, idx) =>
              idx === parts.length - 1 && p.type === "text"
                ? { ...p, streaming: false }
                : p
            )
          )
        } else if (step.kind === "sources") {
          patchAssistant(assistantId, (parts) => [
            ...parts,
            { type: "sources", items: step.items },
          ])
        } else if (step.kind === "actions") {
          await sleep(120)
          patchAssistant(assistantId, (parts) => [
            ...parts,
            { type: "actions", actions: step.actions, status: {} },
          ])
        } else if (step.kind === "suggestions") {
          patchAssistant(assistantId, (parts) => [
            ...parts,
            { type: "suggestions", items: step.items },
          ])
        }
      }
      setStatus("ready")
    },
    [context, patchAssistant, settings.showReasoning]
  )

  const clear = React.useCallback(() => {
    stop()
    setMessages([])
  }, [stop])

  const runTemplate = React.useCallback(
    (template: AgentTemplate) => {
      setTemplatesOpen(false)
      void ask(templatePrompt(template, context))
    },
    [ask, context]
  )

  const regenerate = React.useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const text =
      lastUser?.parts[0]?.type === "text" ? lastUser.parts[0].text : undefined
    if (!lastUser || !text) return
    stop()
    const idx = messages.indexOf(lastUser)
    setMessages(messages.slice(0, idx))
    void ask(text)
  }, [ask, messages, stop])

  const applyAction = React.useCallback(
    (messageId: string, action: SuggestedAction) => {
      const needsApproval =
        action.requiresApproval ||
        (settings.requireApprovalForHighRisk && action.risk === "high")
      const recordNumber = context.recordNumber ?? "—"
      if (needsApproval) {
        setProposals((prev) => [
          {
            id: `chat-${action.id}-${Date.now()}`,
            agentId: "triage",
            recordNumber,
            recordHref: context.pathname,
            action: action.label,
            rationale: `Requested from AgentOps Assist: ${action.description}`,
            confidence: 0.9,
            created: hoursAgo(0),
            impact:
              action.risk === "high"
                ? "high"
                : action.risk === "medium"
                  ? "medium"
                  : "low",
          },
          ...prev,
        ])
        toast("Queued for approval", {
          description: `${action.label} on ${recordNumber}`,
        })
        patchAssistant(messageId, (parts) =>
          parts.map((p) =>
            p.type === "actions"
              ? { ...p, status: { ...p.status, [action.id]: "pending" } }
              : p
          )
        )
      } else {
        setActivity((prev) => [
          {
            id: `act-${Date.now()}`,
            agentId: "triage",
            summary: `${action.label} (via AgentOps Assist)`,
            recordNumber,
            recordHref: context.pathname,
            outcome: "applied",
            timestamp: hoursAgo(0),
            actor: "You",
          },
          ...prev,
        ])
        toast.success(action.label, {
          description: `Applied to ${recordNumber}`,
        })
        patchAssistant(messageId, (parts) =>
          parts.map((p) =>
            p.type === "actions"
              ? { ...p, status: { ...p.status, [action.id]: "applied" } }
              : p
          )
        )
      }
    },
    [context, patchAssistant, settings.requireApprovalForHighRisk]
  )

  const updateAgent = React.useCallback(
    (id: string, patch: Partial<Pick<AiAgent, "enabled" | "autonomy">>) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                ...patch,
                health:
                  patch.enabled === false
                    ? "Paused"
                    : patch.enabled === true && a.health === "Paused"
                      ? "Healthy"
                      : a.health,
              }
            : a
        )
      )
    },
    []
  )

  const decide = React.useCallback(
    (id: string, decision: "approve" | "reject") => {
      const p = proposals.find((x) => x.id === id)
      if (!p) return
      setProposals((prev) => prev.filter((x) => x.id !== id))
      setActivity((prev) => [
        {
          id: `act-${Date.now()}`,
          agentId: p.agentId,
          summary: p.action,
          recordNumber: p.recordNumber,
          recordHref: p.recordHref,
          outcome: decision === "approve" ? "approved" : "rejected",
          timestamp: hoursAgo(0),
          actor: "You",
        },
        ...prev,
      ])
      if (decision === "approve")
        toast.success("Approved", { description: p.action })
      else toast("Rejected", { description: p.action })
    },
    [proposals]
  )

  const value = React.useMemo<AiContextValue>(
    () => ({
      open: ui.open,
      setOpen: (open) => uiStore.set({ open }),
      toggle: () => uiStore.set((s) => ({ ...s, open: !s.open })),
      tab: ui.tab,
      setTab: (tab) => uiStore.set({ tab }),
      templatesOpen,
      setTemplatesOpen,
      runTemplate,
      context,
      messages,
      status,
      ask,
      regenerate,
      stop,
      clear,
      applyAction,
      settings,
      updateSettings: (patch) => settingsStore.set(patch),
      agents,
      updateAgent,
      proposals,
      decide,
      activity,
    }),
    [
      ui.open,
      ui.tab,
      templatesOpen,
      runTemplate,
      context,
      messages,
      status,
      ask,
      regenerate,
      stop,
      clear,
      applyAction,
      settings,
      agents,
      updateAgent,
      proposals,
      decide,
      activity,
    ]
  )

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>
}

export function useAi() {
  const ctx = React.useContext(AiContext)
  if (!ctx) throw new Error("useAi must be used within AiProvider")
  return ctx
}
