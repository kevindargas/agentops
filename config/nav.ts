import type { LucideIcon } from "lucide-react"
import {
  ActivityIcon,
  AlertTriangleIcon,
  BookMarkedIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  CoinsIcon,
  FileClockIcon,
  FlaskRoundIcon,
  LibraryIcon,
  PlugZapIcon,
  RocketIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
  ClipboardCheckIcon,
  FlaskConicalIcon,
  LayersIcon,
  LightbulbIcon,
  RouteIcon,
  WavesIcon,
  WorkflowIcon,
  BellRingIcon,
  BookOpenIcon,
  BotIcon,
  CheckSquareIcon,
  CircleDotIcon,
  GitBranchIcon,
  HeartPulseIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "lucide-react"

/**
 * Live sidebar badges. Each key resolves to a count in `config/nav-counts.ts`
 * (computed on the server from the data modules), so the sidebar never shows a
 * literal that drifts from the page it points at.
 */
export type NavBadgeKey =
  "approvals" | "reviews" | "recommendations" | "alerts" | "proposals"

export type NavCounts = Record<NavBadgeKey, number>

export interface NavItem {
  title: string
  href: string
  icon?: LucideIcon
  /** Which live count to show next to the item. See `getNavCounts()`. */
  badge?: NavBadgeKey
  description?: string
  /**
   * "Go to" chord shown in the sidebar tooltip and command menu, e.g. "G D".
   * The first key is always the prefix from `siteConfig.shortcuts.goTo`.
   */
  shortcut?: string
  /** Extra search terms for the command menu. */
  keywords?: string[]
  items?: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Application navigation. Grouped by module: a personal workspace, the agent
 * operations layers (operate, build, govern), then the service-management and
 * service-health surfaces the agents plug into.
 */
export const navigation: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Overview",
        href: "/dashboard",
        icon: LayoutDashboardIcon,
        shortcut: "G D",
        keywords: ["home", "dashboard"],
        description: "Operational overview across all modules",
      },
      {
        title: "My Work",
        href: "/my-work",
        icon: CheckSquareIcon,
        shortcut: "G W",
        keywords: ["tasks", "inbox", "assigned"],
        description: "Tasks assigned to you or your groups",
      },
      {
        title: "Approvals",
        href: "/approvals",
        icon: ShieldCheckIcon,
        badge: "approvals",
        shortcut: "G A",
        description: "Changes and requests awaiting your approval",
      },
      {
        title: "Analytics",
        href: "/analytics",
        icon: LineChartIcon,
        shortcut: "G N",
        keywords: ["reports", "metrics", "kpi"],
        description: "Performance analytics and reporting",
      },
    ],
  },
  {
    label: "Agent Operations",
    items: [
      {
        title: "Fleet Overview",
        href: "/agentops",
        icon: ActivityIcon,
        shortcut: "G O",
        keywords: ["agentops", "llm", "observability", "fleet"],
        description:
          "Traffic, quality, cost and alerts across every deployed agent",
      },
      {
        title: "Agents",
        href: "/agentops/agents",
        icon: BotIcon,
        keywords: ["langgraph", "langchain", "deployments", "versions"],
        description: "Deployed agents, their graphs, models, tools and health",
      },
      {
        title: "Traces",
        href: "/agentops/traces",
        icon: RouteIcon,
        keywords: ["spans", "runs", "latency", "tokens", "debug"],
        description:
          "Every agent run with spans, tokens, cost and evaluator scores",
      },
      {
        title: "Review Queue",
        href: "/agentops/reviews",
        icon: ClipboardCheckIcon,
        badge: "reviews",
        shortcut: "G R",
        keywords: ["human in the loop", "hitl", "feedback", "rubric"],
        description: "Sampled and flagged answers awaiting a human verdict",
      },
      {
        title: "Drift & Quality",
        href: "/agentops/drift",
        icon: WavesIcon,
        keywords: ["psi", "embedding", "evals", "regression", "monitoring"],
        description:
          "Input, output and quality drift against each agent's baseline",
      },
      {
        title: "Experiments",
        href: "/agentops/experiments",
        icon: FlaskConicalIcon,
        keywords: ["a/b", "ab test", "variant", "canary"],
        description: "A/B tests on models, prompts, retrieval and tooling",
      },
      {
        title: "Recommendations",
        href: "/agentops/recommendations",
        icon: LightbulbIcon,
        badge: "recommendations",
        keywords: ["model change", "cost", "deprecation", "upgrade"],
        description: "Evidence-backed model and configuration changes",
      },
    ],
  },
  {
    label: "Build",
    items: [
      {
        title: "Prompts",
        href: "/agentops/prompts",
        icon: ScrollTextIcon,
        shortcut: "G P",
        keywords: [
          "prompt",
          "template",
          "system prompt",
          "version",
          "registry",
          "rubric",
          "diff",
        ],
        description:
          "Prompt registry: versions, labels, diffs, evals and promotion",
      },
      {
        title: "Playground",
        href: "/agentops/playground",
        icon: SlidersHorizontalIcon,
        shortcut: "G L",
        keywords: [
          "temperature",
          "top p",
          "max tokens",
          "reasoning effort",
          "parameters",
          "compare",
          "sandbox",
        ],
        description:
          "Tune generation parameters, run prompts and compare configurations",
      },
      {
        title: "Tools & MCP",
        href: "/agentops/tools",
        icon: WrenchIcon,
        shortcut: "G T",
        keywords: [
          "tool",
          "mcp",
          "server",
          "schema",
          "permissions",
          "function",
        ],
        description:
          "Tool registry, MCP servers and per-agent permission matrix",
      },
      {
        title: "Knowledge & Memory",
        href: "/agentops/knowledge",
        icon: LibraryIcon,
        keywords: [
          "knowledge base",
          "vector",
          "embeddings",
          "retrieval",
          "rag",
          "memory",
          "ingestion",
        ],
        description:
          "Vector indexes, ingestion sources, agent memory and retrieval quality",
      },
      {
        title: "Semantic Layer",
        href: "/agentops/semantic-layer",
        icon: BookMarkedIcon,
        keywords: ["metrics", "definitions", "glossary", "ontology", "sql"],
        description:
          "Governed metric and entity definitions agents are allowed to use",
      },
      {
        title: "Model Catalog",
        href: "/ai/models",
        icon: LayersIcon,
        keywords: ["openrouter", "llm", "pricing", "context"],
        description:
          "Every model available through OpenRouter, with pricing and capabilities",
      },
      {
        title: "Workflow Automations",
        href: "/ai",
        icon: WorkflowIcon,
        badge: "proposals",
        shortcut: "G X",
        keywords: [
          "ai control center",
          "assistant",
          "copilot",
          "approvals",
          "guardrails",
        ],
        description:
          "Internal workflow agents, proposals, approval queue and assistant guardrails",
      },
    ],
  },
  {
    label: "Govern",
    items: [
      {
        title: "Guardrails",
        href: "/agentops/guardrails",
        icon: ShieldCheckIcon,
        shortcut: "G G",
        keywords: [
          "policy",
          "pii",
          "redaction",
          "jailbreak",
          "injection",
          "safety",
          "compliance",
        ],
        description:
          "Policy-as-code rules bounding what agents may read, say and do",
      },
      {
        title: "Evals & Datasets",
        href: "/agentops/evals",
        icon: FlaskRoundIcon,
        shortcut: "G E",
        keywords: [
          "evaluation",
          "golden set",
          "dataset",
          "regression",
          "judge",
          "release gate",
        ],
        description:
          "Regression-test prompts, models and agents; release gates for promotion",
      },
      {
        title: "Deployments",
        href: "/agentops/deployments",
        icon: RocketIcon,
        keywords: [
          "release",
          "canary",
          "rollout",
          "rollback",
          "promote",
          "environments",
        ],
        description:
          "Releases, canaries, environments and approvals for the agent fleet",
      },
      {
        title: "Audit Log",
        href: "/agentops/audit",
        icon: FileClockIcon,
        keywords: [
          "audit",
          "evidence",
          "tamper",
          "who changed",
          "history",
          "compliance",
        ],
        description:
          "Append-only record of who changed what, when and under which approval",
      },
      {
        title: "Schedules & Triggers",
        href: "/agentops/schedules",
        icon: CalendarClockIcon,
        keywords: [
          "cron",
          "trigger",
          "webhook",
          "run history",
          "freeze window",
        ],
        description: "When and why agents run on their own",
      },
      {
        title: "Providers & Routing",
        href: "/agentops/providers",
        icon: PlugZapIcon,
        keywords: [
          "gateway",
          "api keys",
          "routing",
          "fallback",
          "rate limits",
          "quotas",
        ],
        description:
          "Model provider connections, scoped API keys, routing chains and rate limits",
      },
      {
        title: "Readiness Assessment",
        href: "/agentops/readiness",
        icon: ClipboardListIcon,
        shortcut: "G Y",
        keywords: [
          "readiness",
          "assessment",
          "controls",
          "maturity",
          "checklist",
          "owasp",
          "nist",
          "eu ai act",
          "gap analysis",
          "release gate",
          "llmops",
        ],
        description:
          "Score your controls across visibility, quality, drift, safety, cost and governance",
      },
      {
        title: "Costs & Budgets",
        href: "/agentops/costs",
        icon: CoinsIcon,
        keywords: [
          "finops",
          "spend",
          "budget",
          "tokens",
          "savings",
          "forecast",
        ],
        description:
          "Spend by agent, model and provider, budgets with breach actions",
      },
    ],
  },
  {
    label: "Service Management",
    items: [
      {
        title: "Incidents",
        href: "/itsm/incidents",
        icon: AlertTriangleIcon,
        shortcut: "G I",
        keywords: ["outage", "ticket", "p1"],
        description: "Restore normal service as quickly as possible",
        items: [
          { title: "All incidents", href: "/itsm/incidents" },
          { title: "Major incidents", href: "/itsm/incidents?view=major" },
          { title: "Assigned to me", href: "/itsm/incidents?view=mine" },
        ],
      },
      {
        title: "Problems",
        href: "/itsm/problems",
        icon: CircleDotIcon,
        description: "Root cause analysis and known errors",
      },
      {
        title: "Changes",
        href: "/itsm/changes",
        icon: GitBranchIcon,
        shortcut: "G C",
        keywords: ["cab", "release", "deployment"],
        description: "Plan, assess and authorize changes",
        items: [
          { title: "All changes", href: "/itsm/changes" },
          { title: "Change Calendar", href: "/itsm/changes/calendar" },
          { title: "CAB agenda", href: "/itsm/changes?view=cab" },
        ],
      },
      {
        title: "Requests",
        href: "/itsm/requests",
        icon: PackageIcon,
        shortcut: "G Q",
        keywords: ["ritm", "order"],
        description: "Service requests, requested items and tasks",
      },
      {
        title: "Service Catalog",
        href: "/itsm/catalog",
        icon: ShoppingBagIcon,
        description: "Order hardware, software, access and services",
      },
      {
        title: "Knowledge",
        href: "/itsm/knowledge",
        icon: BookOpenIcon,
        shortcut: "G K",
        keywords: ["kb", "articles", "docs"],
        description: "Articles, known errors and how-tos",
      },
    ],
  },
  {
    label: "Service Health",
    items: [
      {
        title: "Service Health",
        href: "/itom/health",
        icon: HeartPulseIcon,
        shortcut: "G H",
        keywords: ["status", "uptime", "availability"],
        description: "Business service health and availability",
      },
      {
        title: "Alerts",
        href: "/itom/alerts",
        icon: BellRingIcon,
        badge: "alerts",
        description: "Event management and alert correlation",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users & Groups",
        href: "/admin/users",
        icon: UsersIcon,
        description: "People, assignment groups and roles",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        shortcut: "G S",
        keywords: ["preferences", "appearance", "theme"],
        description: "Appearance, notifications and platform settings",
      },
    ],
  },
]

export const flatNavigation: NavItem[] = navigation.flatMap((g) =>
  g.items.flatMap((i) => [i, ...(i.items ?? [])])
)

/** Nav item whose href (ignoring the query string) matches `href`. */
export function findNavItem(href: string): NavItem | undefined {
  const path = href.split("?")[0]
  return (
    flatNavigation.find((n) => n.href === href) ??
    flatNavigation.find((n) => n.href.split("?")[0] === path)
  )
}

/** Sidebar group that owns `href`; used for page eyebrows and breadcrumbs. */
export function findNavGroup(href: string): NavGroup | undefined {
  const path = href.split("?")[0]
  return navigation.find((g) =>
    g.items.some(
      (i) =>
        i.href.split("?")[0] === path ||
        (i.items ?? []).some((s) => s.href.split("?")[0] === path)
    )
  )
}

type ShortcutItem = NavItem & { shortcut: string }

/**
 * Lookup for "G + key" chords: lower-case second key to nav item, e.g.
 * goToShortcuts.d opens the Overview. `config/nav.test.ts` asserts every
 * second key is unique so no page silently shadows another.
 */
export const goToShortcuts: Record<string, NavItem> = Object.fromEntries(
  flatNavigation
    .filter((i): i is ShortcutItem => typeof i.shortcut === "string")
    .map((i) => [i.shortcut.split(" ")[1].toLowerCase(), i])
)

export const quickCreateItems: NavItem[] = [
  { title: "Incident", href: "/itsm/incidents?new=1", icon: AlertTriangleIcon },
  { title: "Change request", href: "/itsm/changes?new=1", icon: GitBranchIcon },
  { title: "Service request", href: "/itsm/catalog", icon: ShoppingBagIcon },
  { title: "Problem", href: "/itsm/problems?new=1", icon: CircleDotIcon },
  {
    title: "Knowledge article",
    href: "/itsm/knowledge?new=1",
    icon: ScrollTextIcon,
  },
]
