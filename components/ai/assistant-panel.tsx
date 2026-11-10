"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ActivityIcon,
  ArrowDownIcon,
  BookOpenIcon,
  BotIcon,
  FlaskConicalIcon,
  WavesIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  EraserIcon,
  FileTextIcon,
  GitCompareIcon,
  LayoutTemplateIcon,
  LightbulbIcon,
  ListChecksIcon,
  NetworkIcon,
  PaperclipIcon,
  PanelRightCloseIcon,
  PenLineIcon,
  RefreshCwIcon,
  RouteIcon,
  ScanSearchIcon,
  SearchIcon,
  ShieldAlertIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useStickToBottomContext } from "use-stick-to-bottom"

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { CountPill } from "@/components/shared/count-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  recordTypeLabel,
  starterPrompts,
  type Source,
  type SuggestedAction,
} from "@/lib/ai/assistant"
import { useMediaQuery } from "@/lib/store"
import { AgentCard } from "./agent-card"
import { useAi, type ChatMessage, type MessagePart } from "./ai-provider"
import { ModelPicker, resolveModel } from "./model-picker"
import { ProposalCard } from "./proposal-card"
import { TemplateMenu } from "./template-menu"

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Deterministic icon for a starter prompt, picked from its wording. */
function promptIcon(prompt: string): LucideIcon {
  const q = prompt.toLowerCase()
  if (q.includes("summar")) return FileTextIcon
  if (q.includes("draft") || q.includes("reply") || q.includes("update"))
    return PenLineIcon
  if (q.includes("similar") || q.includes("find") || q.includes("show"))
    return SearchIcon
  if (q.includes("root cause") || q.includes("why") || q.includes("hypothesis"))
    return LightbulbIcon
  if (q.includes("risk") || q.includes("assess")) return ShieldAlertIcon
  if (q.includes("impact") || q.includes("depend") || q.includes("service"))
    return NetworkIcon
  if (q.includes("schedul") || q.includes("week") || q.includes("conflict"))
    return CalendarIcon
  if (q.includes("attention") || q.includes("today")) return ListChecksIcon
  if (q.includes("health")) return ActivityIcon
  if (q.includes("policy")) return BookOpenIcon
  return SparklesIcon
}

const sourceIcon: Record<Source["kind"], LucideIcon> = {
  incident: TriangleAlertIcon,
  change: GitCompareIcon,
  problem: ScanSearchIcon,
  knowledge: BookOpenIcon,
  alert: ActivityIcon,
  request: FileTextIcon,
  agent: BotIcon,
  trace: RouteIcon,
  drift: WavesIcon,
  experiment: FlaskConicalIcon,
}

const riskTone: Record<SuggestedAction["risk"], string> = {
  low: "text-muted-foreground",
  medium: "text-warning-text",
  high: "text-danger-text",
}

/* ------------------------------------------------------------------ */
/* Message parts                                                       */
/* ------------------------------------------------------------------ */

function SourcesPart({ items }: { items: Source[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => {
          const Icon = sourceIcon[s.kind]
          return (
            <Tooltip key={`${s.kind}-${s.id}`}>
              <TooltipTrigger
                render={
                  <Link
                    href={s.href}
                    className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border bg-card px-1.5 text-2xs text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-foreground"
                  />
                }
              >
                <Icon className="size-3 shrink-0" />
                <span className="font-mono font-medium text-foreground/80">
                  {s.id}
                </span>
                <span className="max-w-32 truncate">{s.title}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{s.title}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

function ActionsPart({
  part,
  messageId,
}: {
  part: Extract<MessagePart, { type: "actions" }>
  messageId: string
}) {
  const { applyAction } = useAi()
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        <SparklesIcon className="size-3 text-brand" /> Suggested actions
      </div>
      <ul className="divide-y">
        {part.actions.map((a) => {
          const state = part.status[a.id]
          return (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight font-medium">{a.label}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {a.description} ·{" "}
                  <span className={riskTone[a.risk]}>
                    {a.risk} risk{a.requiresApproval ? ", needs approval" : ""}
                  </span>
                </p>
              </div>
              {state === "applied" ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-success/30 bg-success/10 text-success-text"
                >
                  <CheckIcon /> Applied
                </Badge>
              ) : state === "pending" ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-warning/40 bg-warning/10 text-warning-text"
                >
                  <ClockIcon /> Queued
                </Badge>
              ) : (
                <Button
                  size="xs"
                  variant={a.requiresApproval ? "outline" : "default"}
                  className="shrink-0"
                  onClick={() => applyAction(messageId, a)}
                >
                  {a.requiresApproval ? "Request" : "Apply"}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ToolPart({ part }: { part: Extract<MessagePart, { type: "tool" }> }) {
  return (
    <Tool defaultOpen={false} className="mb-0 rounded-lg bg-card">
      <ToolHeader
        type={`tool-${part.name}`}
        state={part.state}
        title={part.title}
        className="px-3 py-2 **:data-[slot=badge]:h-5 **:data-[slot=badge]:text-3xs [&>div>span]:text-xs"
      />
      <ToolContent className="space-y-3 border-t p-3 **:[pre]:text-2xs">
        <ToolInput input={part.input} />
        <ToolOutput output={part.output} errorText={undefined} />
      </ToolContent>
    </Tool>
  )
}

/** Group consecutive reasoning/tool parts so the "work" renders as one tight stack. */
function groupParts(parts: MessagePart[]) {
  const groups: {
    kind: "work" | "single"
    parts: { part: MessagePart; index: number }[]
  }[] = []
  parts.forEach((part, index) => {
    const isWork = part.type === "reasoning" || part.type === "tool"
    const last = groups[groups.length - 1]
    if (isWork && last?.kind === "work") last.parts.push({ part, index })
    else
      groups.push({
        kind: isWork ? "work" : "single",
        parts: [{ part, index }],
      })
  })
  return groups
}

function MessageToolbar({ message }: { message: ChatMessage }) {
  const { regenerate } = useAi()
  const [copied, setCopied] = React.useState(false)
  const text = message.parts
    .filter(
      (p): p is Extract<MessagePart, { type: "text" }> => p.type === "text"
    )
    .map((p) => p.text)
    .join("\n\n")

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy to clipboard")
    }
  }

  return (
    <div className="-ml-1.5 flex items-center gap-0.5 text-muted-foreground">
      <IconButton
        label={copied ? "Copied" : "Copy response"}
        size="icon-xs"
        onClick={copy}
        disabled={!text}
      >
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </IconButton>
      <IconButton label="Regenerate" size="icon-xs" onClick={regenerate}>
        <RefreshCwIcon />
      </IconButton>
      <span className="mx-1 h-3 w-px bg-border" />
      <IconButton
        label="Good response"
        size="icon-xs"
        onClick={() =>
          toast("Noted as a good response", {
            description: "Feedback stays in this session.",
          })
        }
      >
        <ThumbsUpIcon />
      </IconButton>
      <IconButton
        label="Needs work"
        size="icon-xs"
        onClick={() =>
          toast("Noted as needing work", {
            description: "Feedback stays in this session.",
          })
        }
      >
        <ThumbsDownIcon />
      </IconButton>
    </div>
  )
}

function AssistantMessage({
  message,
  isLast,
}: {
  message: ChatMessage
  isLast: boolean
}) {
  const { status, ask } = useAi()
  const streaming = isLast && status !== "ready"

  return (
    <Message from="assistant" className="max-w-full gap-1.5">
      <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
        <span className="flex size-4 items-center justify-center rounded-sm bg-brand/10 text-brand">
          <SparklesIcon
            className={cn("size-2.5", streaming && "animate-pulse")}
          />
        </span>
        AgentOps Assist
      </div>
      <MessageContent className="w-full gap-3 bg-transparent px-0 py-0">
        {message.parts.length === 0 && (
          <Shimmer className="text-sm">Thinking…</Shimmer>
        )}
        {groupParts(message.parts).map((group, gi) =>
          group.kind === "work" ? (
            <div key={`g${gi}`} className="flex flex-col gap-1.5">
              {group.parts.map(({ part, index }) =>
                part.type === "reasoning" ? (
                  <Reasoning
                    key={index}
                    isStreaming={part.streaming}
                    defaultOpen={false}
                    className="w-full text-xs"
                  >
                    <ReasoningTrigger className="text-xs [&_svg]:size-3.5" />
                    <ReasoningContent className="mt-2 rounded-md border-l-2 border-brand/30 pl-3 text-xs leading-relaxed">
                      {part.text}
                    </ReasoningContent>
                  </Reasoning>
                ) : part.type === "tool" ? (
                  <ToolPart key={index} part={part} />
                ) : null
              )}
            </div>
          ) : (
            group.parts.map(({ part, index }) => {
              switch (part.type) {
                case "text":
                  return (
                    <MessageResponse
                      key={index}
                      className="text-sm leading-relaxed [&_blockquote]:border-brand/40 [&_blockquote]:text-foreground/90 [&_table]:text-xs [&_th]:font-medium"
                    >
                      {part.text}
                    </MessageResponse>
                  )
                case "sources":
                  return <SourcesPart key={index} items={part.items} />
                case "actions":
                  return (
                    <ActionsPart
                      key={index}
                      part={part}
                      messageId={message.id}
                    />
                  )
                case "suggestions":
                  return isLast && !streaming ? (
                    <Suggestions key={index} className="pt-0.5">
                      {part.items.map((s) => (
                        <Suggestion
                          key={s}
                          suggestion={s}
                          onClick={ask}
                          size="sm"
                          className="h-7 rounded-full border-dashed px-3 text-xs hover:border-brand/40 hover:bg-brand/5"
                        />
                      ))}
                    </Suggestions>
                  ) : null
                default:
                  return null
              }
            })
          )
        )}
        {isLast && !streaming && message.parts.length > 0 && (
          <MessageToolbar message={message} />
        )}
      </MessageContent>
    </Message>
  )
}

function UserMessage({ message }: { message: ChatMessage }) {
  const text = message.parts[0]?.type === "text" ? message.parts[0].text : ""
  return (
    <Message from="user" className="max-w-[85%]">
      <MessageContent className="group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:px-3.5 group-[.is-user]:py-2.5">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </MessageContent>
    </Message>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function EmptyChat() {
  const { ask, context, setTemplatesOpen } = useAi()
  const starters = starterPrompts(context).slice(0, 4)
  const onRecord = Boolean(context.recordNumber)

  return (
    <div className="flex flex-col gap-5 px-1 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand to-brand/60 text-brand-foreground shadow-lg shadow-brand/20">
          <SparklesIcon className="size-6" />
          <span
            aria-hidden
            className="absolute -inset-1 -z-10 rounded-3xl bg-brand/15 blur-md"
          />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight">
            {onRecord
              ? `Working on ${context.recordNumber}`
              : "How can I help?"}
          </h3>
          <p className="mx-auto max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
            {onRecord
              ? "I've read this record and its related work. Ask anything or pick a suggestion."
              : "Ask about incidents, changes, services or anything in your workspace."}
          </p>
        </div>
      </div>

      {onRecord && (
        <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-2xs text-muted-foreground">
              {context.recordType
                ? recordTypeLabel[context.recordType]
                : "Record"}{" "}
              in context
            </p>
            <p className="truncate text-sm">
              <span className="font-mono text-xs font-medium">
                {context.recordNumber}
              </span>
              {context.title && (
                <span className="text-muted-foreground">
                  {" "}
                  · {context.title}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="px-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Try asking
        </p>
        {starters.map((s) => {
          const Icon = promptIcon(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="group/starter flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-all hover:border-brand/40 hover:bg-brand/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover/starter:bg-brand/10 group-hover/starter:text-brand">
                <Icon className="size-3.5" />
              </span>
              <span className="flex-1 leading-snug">{s}</span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover/starter:translate-x-0.5 group-hover/starter:text-brand" />
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setTemplatesOpen(true)}
        className="group/tpl flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm transition-colors hover:border-brand/40 hover:bg-brand/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
          <LayoutTemplateIcon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 leading-snug">
          <span className="block font-medium">
            Start from an agentic template
          </span>
          <span className="block text-xs text-muted-foreground">
            Triage, root cause, change risk, CAB notes and more
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover/tpl:translate-x-0.5 group-hover/tpl:text-brand" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Conversation chrome                                                 */
/* ------------------------------------------------------------------ */

function ScrollToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  if (isAtBottom) return null
  return (
    <button
      type="button"
      onClick={() => scrollToBottom()}
      className="absolute bottom-3 left-1/2 inline-flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full border bg-background/95 px-3 text-xs font-medium shadow-md backdrop-blur transition-colors hover:bg-muted"
    >
      <ArrowDownIcon className="size-3.5" /> Latest
    </button>
  )
}

function Composer() {
  const {
    messages,
    status,
    ask,
    stop,
    context,
    templatesOpen,
    setTemplatesOpen,
  } = useAi()
  const busy = status !== "ready"
  return (
    <div className="border-t bg-background p-3">
      <PromptInput
        onSubmit={({ text }) => {
          if (busy) return
          ask(text)
        }}
        className="rounded-xl shadow-hairline transition-shadow focus-within:shadow-raised"
      >
        <PromptInputBody>
          <PromptInputTextarea
            placeholder={
              context.recordNumber
                ? `Ask about ${context.recordNumber}`
                : "Ask AgentOps Assist"
            }
            className="min-h-11 text-sm leading-relaxed"
          />
        </PromptInputBody>
        <PromptInputFooter className="pt-0">
          <PromptInputTools className="min-w-0 gap-0.5">
            <IconButton
              label="Agentic templates"
              size="icon-xs"
              aria-pressed={templatesOpen}
              className={cn(
                "text-muted-foreground",
                templatesOpen && "bg-muted text-foreground"
              )}
              onClick={() => setTemplatesOpen(!templatesOpen)}
            >
              <LayoutTemplateIcon />
            </IconButton>
            <ModelPicker variant="compact" />
            <IconButton
              label="Attach context (disabled in demo)"
              size="icon-xs"
              className="hidden text-muted-foreground @[360px]/panel:inline-flex"
              onClick={() =>
                toast("Attachments are disabled in the scripted demo")
              }
            >
              <PaperclipIcon />
            </IconButton>
            {context.recordNumber && (
              <Badge
                variant="secondary"
                className="hidden h-5 gap-1 px-1.5 font-mono text-3xs @[420px]/panel:inline-flex"
              >
                <FileTextIcon className="size-3" /> {context.recordNumber}
              </Badge>
            )}
          </PromptInputTools>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-2xs text-muted-foreground sm:flex">
              <Kbd className="h-4 min-w-4 text-3xs">↵</Kbd> send
              <Kbd className="ml-1 h-4 min-w-4 text-3xs">⇧↵</Kbd> newline
            </span>
            <PromptInputSubmit
              status={status === "ready" ? undefined : status}
              onStop={stop}
              className="rounded-lg"
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-2xs text-muted-foreground">
        {busy ? (
          <>
            <Spinner className="size-3" /> Generating ·{" "}
            <Kbd className="h-4 px-1 text-3xs">Esc</Kbd> to stop
          </>
        ) : messages.length > 0 ? (
          "Actions that need approval are queued, never applied silently."
        ) : (
          "Scripted demo: responses are deterministic and nothing leaves your browser."
        )}
      </p>
    </div>
  )
}

function ChatTab() {
  const { messages, status, stop } = useAi()
  const root = React.useRef<HTMLDivElement>(null)
  // Escape stops a streaming reply from anywhere inside the chat tab, so the
  // "Esc to stop" hint holds whether or not the composer has focus.
  React.useEffect(() => {
    const el = root.current
    if (!el || status === "ready") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        stop()
      }
    }
    el.addEventListener("keydown", onKey)
    return () => el.removeEventListener("keydown", onKey)
  }, [status, stop])
  return (
    <div
      ref={root}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <TemplateMenu />
      <Conversation className="flex-1">
        <ConversationContent className="gap-6 px-4 py-4">
          {messages.length === 0 ? (
            <EmptyChat />
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1}
                />
              )
            )
          )}
        </ConversationContent>
        <ScrollToLatest />
      </Conversation>
      <Composer />
    </div>
  )
}

function AgentsTab() {
  const { agents, updateAgent } = useAi()
  const active = agents.filter((a) => a.enabled).length
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular-nums">
              {active}
            </span>{" "}
            of {agents.length} agents active
          </span>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
          >
            Workflow Automations <ChevronRightIcon className="size-3" />
          </Link>
        </div>
        {agents.map((a) => (
          <AgentCard
            key={a.id}
            agent={a}
            compact
            onChange={(patch) => updateAgent(a.id, patch)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function QueueTab() {
  const { proposals, decide } = useAi()
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-2 p-3">
        {proposals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckIcon className="size-4" />
            </span>
            <p className="text-sm font-medium">Queue is clear</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Agents set to “act with approval” will post their proposed changes
              here for a one-click review.
            </p>
          </div>
        ) : (
          <>
            <p className="px-1 pb-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {proposals.length}
              </span>{" "}
              proposal{proposals.length === 1 ? "" : "s"} waiting for your
              review
            </p>
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onDecide={decide} compact />
            ))}
          </>
        )}
      </div>
    </ScrollArea>
  )
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  const { settings, status, messages, clear, context } = useAi()
  const model = resolveModel(settings)
  const busy = status !== "ready"
  return (
    <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand/70 text-brand-foreground shadow-sm">
        <SparklesIcon className={cn("size-4", busy && "animate-pulse")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm leading-none font-semibold">AgentOps Assist</p>
          <Badge
            variant="outline"
            className="h-4 px-1 text-3xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            Scripted demo
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-2xs text-muted-foreground">
          {context.recordNumber ? (
            <>
              Working on{" "}
              <span className="font-mono">{context.recordNumber}</span>
            </>
          ) : (
            "Workspace assistant"
          )}
          <span aria-hidden> · </span>
          {model.name}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        {messages.length > 0 && (
          <IconButton label="Clear conversation" onClick={clear}>
            <EraserIcon />
          </IconButton>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                render={<Link href="/ai" />}
                aria-label="Workflow Automations"
              />
            }
          >
            <SlidersHorizontalIcon />
          </TooltipTrigger>
          <TooltipContent>Workflow Automations</TooltipContent>
        </Tooltip>
        <IconButton label="Close" onClick={onClose}>
          <PanelRightCloseIcon className="hidden lg:block" />
          <XIcon className="lg:hidden" />
        </IconButton>
      </div>
    </div>
  )
}

function PanelBody({ onClose }: { onClose: () => void }) {
  const { tab, setTab, proposals } = useAi()
  return (
    <div className="@container/panel flex h-full min-h-0 flex-col">
      <PanelHeader onClose={onClose} />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList
          variant="line"
          className="w-full justify-start border-b px-2 **:data-[slot=tabs-trigger]:px-2.5"
        >
          <TabsTrigger value="chat" className="flex-none text-xs">
            Chat
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex-none text-xs">
            Agents
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex-none text-xs">
            Queue
            {proposals.length > 0 && (
              <CountPill
                count={proposals.length}
                tone="inverse"
                label="waiting"
                className="ml-0.5"
              />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
          <ChatTab />
        </TabsContent>
        <TabsContent value="agents" className="flex min-h-0 flex-1 flex-col">
          <AgentsTab />
        </TabsContent>
        <TabsContent value="queue" className="flex min-h-0 flex-1 flex-col">
          <QueueTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Desktop: docked right panel. Mobile: slide-over sheet. */
export function AssistantPanel() {
  const { open, setOpen } = useAi()
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  if (isDesktop) {
    return (
      <aside
        data-state={open ? "open" : "closed"}
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 overflow-hidden border-l bg-background transition-[width] duration-200 ease-linear lg:block",
          open ? "w-[400px]" : "w-0 border-l-0"
        )}
        aria-label="AgentOps Assist"
      >
        <div className="h-full w-[400px]">
          {open && <PanelBody onClose={() => setOpen(false)} />}
        </div>
      </aside>
    )
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        showCloseButton={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>AgentOps Assist</SheetTitle>
          <SheetDescription>AI assistant</SheetDescription>
        </SheetHeader>
        <PanelBody onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
