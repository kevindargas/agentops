import type { LucideIcon } from "lucide-react"
import {
  ActivityIcon,
  CoinsIcon,
  BookOpenIcon,
  BotIcon,
  RouteIcon,
  WavesIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  FileSearchIcon,
  GitCompareIcon,
  LightbulbIcon,
  MegaphoneIcon,
  NetworkIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  TimerIcon,
  TrendingDownIcon,
} from "lucide-react"

import type { AssistantContext } from "./assistant"

export type TemplateCategory =
  | "Agent Ops"
  | "Incidents"
  | "Changes"
  | "Problems"
  | "Knowledge"
  | "Operations"

export interface AgentTemplate {
  id: string
  name: string
  /** One-sentence description of what the agent run does. */
  description: string
  category: TemplateCategory
  icon: LucideIcon
  /** Prompt sent to the assistant. `{record}` is replaced by the record in context. */
  prompt: string
  /** Tools the template will call, in order. Shown as the "plan". */
  steps: string[]
  /** Curated model id this template performs best with. */
  recommendedModelId: string
  /** Record types this template applies to. Undefined = anywhere. */
  appliesTo?: NonNullable<AssistantContext["recordType"]>[]
  /** Whether the template may propose write actions (vs. read-only analysis). */
  writes: boolean
}

export const templateCategories: TemplateCategory[] = [
  "Agent Ops",
  "Incidents",
  "Changes",
  "Problems",
  "Knowledge",
  "Operations",
]

export const agentTemplates: AgentTemplate[] = [
  {
    id: "agent-health",
    name: "Agent health review",
    description:
      "Reads 24-hour traffic, latency, errors, quality and the review queue for a deployed agent and summarizes its state.",
    category: "Agent Ops",
    icon: BotIcon,
    prompt: "How is this agent doing?",
    steps: [
      "Read agent metrics",
      "Check review queue & experiments",
      "Summarize health",
    ],
    recommendedModelId: "claude-haiku-5-5",
    appliesTo: ["agent"],
    writes: false,
  },
  {
    id: "agent-drift",
    name: "Drift triage",
    description:
      "Correlates open drift signals with recent deploys and tool errors to explain what moved and what to do first.",
    category: "Agent Ops",
    icon: WavesIcon,
    prompt: "Why is quality drifting?",
    steps: [
      "Read drift signals",
      "Correlate with deploys & tools",
      "Recommend next step",
    ],
    recommendedModelId: "claude-fable-5-1",
    appliesTo: ["agent"],
    writes: true,
  },
  {
    id: "agent-model-change",
    name: "Model change review",
    description:
      "Weighs shadow evals, the running experiment and deprecation notices to recommend whether to switch models.",
    category: "Agent Ops",
    icon: LightbulbIcon,
    prompt: "Should we change the model?",
    steps: ["Read recommendations", "Compare evidence", "Propose rollout"],
    recommendedModelId: "claude-sonnet-5-5",
    appliesTo: ["agent"],
    writes: true,
  },
  {
    id: "trace-explain",
    name: "Explain this trace",
    description:
      "Narrates a LangGraph run span by span: what each node did, where it failed or slowed, and how the answer was formed.",
    category: "Agent Ops",
    icon: RouteIcon,
    prompt: "Explain this trace",
    steps: ["Read spans", "Narrate the path", "Assess the answer"],
    recommendedModelId: "claude-sonnet-5-5",
    appliesTo: ["trace"],
    writes: false,
  },
  {
    id: "fleet-quality",
    name: "Quality regression review",
    description:
      "Finds the agent whose evaluator score fell the most this week and explains it from drift signals, experiments and reviewer flags.",
    category: "Agent Ops",
    icon: TrendingDownIcon,
    prompt: "Why did quality drop this week?",
    steps: [
      "Compare 7-day quality windows",
      "Read drift signals & experiments",
      "Recommend next step",
    ],
    recommendedModelId: "claude-sonnet-5-5",
    writes: true,
  },
  {
    id: "fleet-budget",
    name: "Spend review",
    description:
      "Lists spend per production agent, flags the ones over budget and totals the savings from pending cost recommendations.",
    category: "Agent Ops",
    icon: CoinsIcon,
    prompt: "Which agents are over budget?",
    steps: [
      "Read spend by agent",
      "Check cost drift & recommendations",
      "Rank",
    ],
    recommendedModelId: "claude-haiku-5-5",
    writes: true,
  },
  {
    id: "prompt-version",
    name: "Live prompt check",
    description:
      "Reports the prompt version an agent is serving, any prompt experiment in flight and Prompt Hygiene findings.",
    category: "Agent Ops",
    icon: ScrollTextIcon,
    prompt: "Show me the latest prompt version for the helpdesk agent",
    steps: ["Read deployment", "Check prompt experiments", "Summarize"],
    recommendedModelId: "claude-haiku-5-5",
    writes: false,
  },
  {
    id: "incident-summary",
    name: "Incident briefing",
    description:
      "Reads the record, work notes and linked CI, then produces a stakeholder-ready summary with next steps.",
    category: "Incidents",
    icon: ClipboardListIcon,
    prompt: "Summarize {record} for a stakeholder briefing",
    steps: [
      "Read incident & work notes",
      "Resolve linked CI and problem",
      "Draft summary & next step",
    ],
    recommendedModelId: "claude-sonnet-5-5",
    appliesTo: ["incident"],
    writes: true,
  },
  {
    id: "incident-rca",
    name: "Root cause analysis",
    description:
      "Correlates alerts and change windows on the affected CI to rank likely root causes with evidence.",
    category: "Incidents",
    icon: LightbulbIcon,
    prompt: "What's the likely root cause of {record}?",
    steps: [
      "Correlate alerts on the CI",
      "Find overlapping changes",
      "Rank hypotheses with confidence",
    ],
    recommendedModelId: "claude-fable-5-1",
    appliesTo: ["incident"],
    writes: false,
  },
  {
    id: "incident-similar",
    name: "Find similar incidents",
    description:
      "Searches the last 90 days for matching incidents and surfaces resolutions that worked before.",
    category: "Incidents",
    icon: FileSearchIcon,
    prompt: "Find similar incidents to {record}",
    steps: [
      "Search by category & CI",
      "Rank by similarity",
      "Extract prior resolutions",
    ],
    recommendedModelId: "claude-haiku-5-5",
    appliesTo: ["incident"],
    writes: true,
  },
  {
    id: "incident-comms",
    name: "Stakeholder update",
    description:
      "Drafts a plain-language customer or stakeholder update from the current timeline and impact.",
    category: "Incidents",
    icon: MegaphoneIcon,
    prompt: "Draft a customer update for {record}",
    steps: [
      "Read timeline & impact",
      "Draft update in plain language",
      "Queue for approval",
    ],
    recommendedModelId: "claude-sonnet-5-5",
    appliesTo: ["incident"],
    writes: true,
  },
  {
    id: "change-risk",
    name: "Change risk review",
    description:
      "Scores the change against service blast radius, open incidents, failure history and schedule conflicts.",
    category: "Changes",
    icon: ShieldAlertIcon,
    prompt: "Assess the risk of {record}",
    steps: [
      "Map affected systems & services",
      "Check open incidents",
      "Review past failures",
      "Score & recommend",
    ],
    recommendedModelId: "claude-fable-5-1",
    appliesTo: ["change"],
    writes: true,
  },
  {
    id: "change-impact",
    name: "Impact analysis",
    description:
      "Walks the dependency graph to list every business service the change could affect.",
    category: "Changes",
    icon: NetworkIcon,
    prompt: "What services are impacted by {record}?",
    steps: [
      "Read change scope",
      "Traverse service dependencies",
      "List services & owners",
    ],
    recommendedModelId: "gemini-3-1-pro",
    appliesTo: ["change"],
    writes: false,
  },
  {
    id: "change-cab",
    name: "CAB notes",
    description:
      "Prepares Change Advisory Board notes: scope, risk, backout plan, validation and open questions.",
    category: "Changes",
    icon: GitCompareIcon,
    prompt: "Draft CAB notes for {record}",
    steps: ["Read plan & backout", "Pull risk assessment", "Draft notes"],
    recommendedModelId: "claude-sonnet-5-5",
    appliesTo: ["change"],
    writes: true,
  },
  {
    id: "problem-hypothesis",
    name: "Problem investigation",
    description:
      "Summarizes the investigation so far and proposes the next root cause hypothesis to test.",
    category: "Problems",
    icon: ScanSearchIcon,
    prompt:
      "Summarize the investigation so far and suggest a root cause hypothesis for {record}",
    steps: [
      "Read linked incidents",
      "Summarize findings",
      "Propose hypothesis & test",
    ],
    recommendedModelId: "claude-fable-5-1",
    appliesTo: ["problem"],
    writes: false,
  },
  {
    id: "kb-draft",
    name: "Known error article",
    description:
      "Turns a resolved incident or problem into a draft knowledge article with symptoms, cause and fix.",
    category: "Knowledge",
    icon: BookOpenIcon,
    prompt: "Draft a known error article from {record}",
    steps: [
      "Read resolution notes",
      "Check for existing articles",
      "Draft article",
    ],
    recommendedModelId: "claude-sonnet-5-5",
    appliesTo: ["incident", "problem"],
    writes: true,
  },
  {
    id: "ops-attention",
    name: "Daily attention list",
    description:
      "Scans open work across modules and ranks what needs you today: breaches, P1s, stuck approvals.",
    category: "Operations",
    icon: ActivityIcon,
    prompt: "What needs my attention today?",
    steps: [
      "Scan open incidents & SLAs",
      "Check pending approvals",
      "Rank by urgency",
    ],
    recommendedModelId: "claude-haiku-5-5",
    writes: false,
  },
  {
    id: "ops-change-week",
    name: "Change calendar review",
    description:
      "Lists changes scheduled this week and flags collisions with freeze windows or shared CIs.",
    category: "Operations",
    icon: CalendarClockIcon,
    prompt: "Which changes are scheduled this week?",
    steps: ["Read change schedule", "Detect conflicts", "Summarize by day"],
    recommendedModelId: "gpt-5-4-mini",
    writes: false,
  },
  {
    id: "ops-health",
    name: "Service health digest",
    description:
      "Summarizes availability, active alerts and degraded services into a short status digest.",
    category: "Operations",
    icon: TimerIcon,
    prompt: "Summarize service health",
    steps: ["Read service health", "Correlate active alerts", "Draft digest"],
    recommendedModelId: "gemini-3-flash",
    writes: false,
  },
]

/** Fill the template prompt for the current page context. */
export function templatePrompt(t: AgentTemplate, ctx: AssistantContext) {
  const record = ctx.recordNumber ?? "this record"
  return t.prompt.replace("{record}", record)
}

/** Templates that make sense for the current context float to the top. */
export function rankTemplates(ctx: AssistantContext) {
  const fits = (t: AgentTemplate) =>
    !t.appliesTo ||
    (ctx.recordType ? t.appliesTo.includes(ctx.recordType) : false)
  return [...agentTemplates].sort((a, b) => Number(fits(b)) - Number(fits(a)))
}

export function templateFits(t: AgentTemplate, ctx: AssistantContext) {
  return (
    !t.appliesTo ||
    (ctx.recordType ? t.appliesTo.includes(ctx.recordType) : false)
  )
}
