"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookMarkedIcon,
  BookOpenIcon,
  BotIcon,
  CornerDownLeftIcon,
  GitBranchIcon,
  LaptopIcon,
  MoonIcon,
  PackageIcon,
  PanelLeftIcon,
  PlusIcon,
  RocketIcon,
  RouteIcon,
  ScrollTextIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { useAi } from "@/components/ai/ai-provider"
import { PriorityBadge, StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useSidebar } from "@/components/ui/sidebar"
import { goToShortcuts, navigation, quickCreateItems } from "@/config/nav"
import { siteConfig } from "@/config/site"
import {
  agentTraces,
  changes,
  deployedAgents,
  incidents,
  knowledgeArticles,
  prompts,
  promptTypeLabel,
  releases,
  requests,
  semanticEntities,
} from "@/lib/data"
import { openQuickCreate } from "./quick-create"

const OPEN_EVENT = "agentops:command-menu"
/** How long after pressing G the second key of a chord is accepted. */
const CHORD_TIMEOUT_MS = 1200

export function openCommandMenu() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** True when a bare keystroke should be left alone: typing, or inside an open popup. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return Boolean(
    target.closest(
      '[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]'
    )
  )
}

function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <KbdGroup>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </KbdGroup>
  )
}

export function CommandMenuTrigger({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openCommandMenu}
      aria-keyshortcuts="Meta+K"
      className={cn(
        "h-7 w-44 justify-start gap-2 border-border/70 bg-muted/40 px-2 font-normal text-muted-foreground shadow-none hover:border-border hover:bg-muted/70 hover:text-foreground xl:w-64 dark:bg-input/20 dark:hover:bg-input/40",
        className
      )}
    >
      <SearchIcon className="size-3.5 opacity-70" />
      <span className="hidden truncate lg:inline">
        Search records, people, actions…
      </span>
      <span className="lg:hidden">Search</span>
      <KbdGroup className="ml-auto hidden xl:flex">
        {siteConfig.shortcuts.commandMenu.map((k) => (
          <Kbd
            key={k}
            className="h-4.5 min-w-4.5 bg-background/80 text-[10px] shadow-xs ring-1 ring-border/60 dark:bg-muted"
          >
            {k}
          </Kbd>
        ))}
      </KbdGroup>
    </Button>
  )
}

interface Hit {
  kind: string
  number: string
  title: string
  href: string
  icon: LucideIcon
  meta: React.ReactNode
}

function searchRecords(q: string): Hit[] {
  const hits: Hit[] = []
  const match = (...parts: string[]) =>
    parts.join(" ").toLowerCase().includes(q)
  for (const i of incidents)
    if (match(i.number, i.shortDescription))
      hits.push({
        kind: "Incident",
        number: i.number,
        title: i.shortDescription,
        href: `/itsm/incidents/${i.number}`,
        icon: AlertTriangleIcon,
        meta: <PriorityBadge priority={i.priority} short />,
      })
  for (const c of changes)
    if (match(c.number, c.shortDescription))
      hits.push({
        kind: "Change",
        number: c.number,
        title: c.shortDescription,
        href: `/itsm/changes/${c.number}`,
        icon: GitBranchIcon,
        meta: <StateBadge state={c.state} />,
      })
  for (const r of requests)
    if (match(r.number))
      hits.push({
        kind: "Request",
        number: r.number,
        title: `${r.items.length} item(s)`,
        href: `/itsm/requests/${r.number}`,
        icon: PackageIcon,
        meta: <StateBadge state={r.state} />,
      })
  for (const k of knowledgeArticles)
    if (match(k.number, k.title))
      hits.push({
        kind: "Article",
        number: k.number,
        title: k.title,
        href: `/itsm/knowledge/${k.number}`,
        icon: BookOpenIcon,
        meta: <StateBadge state={k.state} />,
      })
  for (const a of deployedAgents)
    if (match(a.id, a.name, a.team, a.framework, a.modelId))
      hits.push({
        kind: "Agent",
        number: a.version,
        title: a.name,
        href: `/agentops/agents/${a.id}`,
        icon: BotIcon,
        meta: <StateBadge state={a.health} />,
      })
  for (const s of semanticEntities)
    if (match(s.name, s.kind, s.domain, ...s.synonyms))
      hits.push({
        kind: "Semantic layer",
        number: s.kind,
        title: s.name,
        href: `/agentops/semantic-layer?entity=${s.id}`,
        icon: BookMarkedIcon,
        meta: <StateBadge state={s.status} />,
      })
  for (const p of prompts)
    if (match(p.id, p.slug, p.name, p.type))
      hits.push({
        kind: "Prompt",
        number: p.slug,
        title: p.name,
        href: `/agentops/prompts/${p.id}`,
        icon: ScrollTextIcon,
        meta: (
          <span className="text-xs text-muted-foreground">
            {promptTypeLabel[p.type]}
          </span>
        ),
      })
  for (const r of releases)
    if (match(r.id, r.version, r.summary, r.agentId))
      hits.push({
        kind: "Release",
        number: r.id,
        title: `${r.version} · ${r.summary}`,
        href: `/agentops/deployments/${r.id}`,
        icon: RocketIcon,
        meta: <StateBadge state={r.stage} size="sm" />,
      })
  if (q.startsWith("tr_"))
    for (const t of agentTraces)
      if (t.id.startsWith(q))
        hits.push({
          kind: "Trace",
          number: t.id,
          title: t.userQuery,
          href: `/agentops/traces/${t.id}`,
          icon: RouteIcon,
          meta: <StateBadge state={t.status} />,
        })
  return hits.slice(0, 12)
}

export function CommandMenu() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const { toggleSidebar } = useSidebar()
  const { toggle: toggleAssistant } = useAi()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  // Timestamp of the last bare "G" press, for G-then-key chords.
  const pendingChord = React.useRef<number | null>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (open || mod || e.altKey || isTypingTarget(e.target)) return

      const key = e.key.toLowerCase()
      const started = pendingChord.current
      pendingChord.current = null
      if (started !== null && e.timeStamp - started < CHORD_TIMEOUT_MS) {
        const target = goToShortcuts[key]
        if (target) {
          e.preventDefault()
          router.push(target.href)
        }
        return
      }
      if (key === siteConfig.shortcuts.goTo.toLowerCase()) {
        pendingChord.current = e.timeStamp
        return
      }
      if (key === siteConfig.shortcuts.quickCreate[0].toLowerCase()) {
        e.preventDefault()
        openQuickCreate()
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [open, router])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }

  const run = React.useCallback((action: () => void) => {
    setOpen(false)
    setQuery("")
    action()
  }, [])

  const go = React.useCallback(
    (href: string) => run(() => router.push(href)),
    [run, router]
  )

  const q = query.trim().toLowerCase()
  const records = React.useMemo(
    () => (q.length < 2 ? [] : searchRecords(q)),
    [q]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command menu"
      description="Search records, jump to a page or run an action"
      className="sm:max-w-xl"
    >
      <Command loop>
        <CommandInput
          placeholder="Search records, pages and actions…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-96">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="text-sm">No results for “{query}”</span>
              <span className="text-xs text-muted-foreground">
                Try a record number such as INC0010042, or a page name.
              </span>
            </div>
          </CommandEmpty>

          {records.length > 0 && (
            <CommandGroup heading="Records">
              {records.map((r) => (
                <CommandItem
                  key={r.href}
                  value={`${r.kind} ${r.number} ${r.title}`}
                  onSelect={() => go(r.href)}
                >
                  <r.icon className="text-muted-foreground" />
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {r.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <CommandShortcut className="flex items-center gap-2 tracking-normal">
                    <span className="hidden text-[11px] sm:inline">
                      {r.kind}
                    </span>
                    {r.meta}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Actions">
            {quickCreateItems.map((item) => (
              <CommandItem
                key={item.href}
                value={`new create ${item.title}`}
                onSelect={() => go(item.href)}
              >
                {item.icon ? (
                  <item.icon className="text-muted-foreground" />
                ) : (
                  <PlusIcon />
                )}
                <span>New {item.title.toLowerCase()}</span>
              </CommandItem>
            ))}
            <CommandItem
              value="toggle sidebar collapse expand"
              onSelect={() => run(toggleSidebar)}
            >
              <PanelLeftIcon className="text-muted-foreground" />
              <span>Toggle sidebar</span>
              <CommandShortcut className="tracking-normal">
                <Keys keys={siteConfig.shortcuts.sidebar} />
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              value="toggle assistant kevin assist ai chat"
              onSelect={() => run(toggleAssistant)}
            >
              <SparklesIcon className="text-brand" />
              <span>Toggle AgentOps Assist</span>
              <CommandShortcut className="tracking-normal">
                <Keys keys={siteConfig.shortcuts.assistant} />
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {navigation.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={[
                    group.label,
                    item.title,
                    ...(item.keywords ?? []),
                  ].join(" ")}
                  onSelect={() => go(item.href)}
                >
                  {item.icon ? (
                    <item.icon className="text-muted-foreground" />
                  ) : (
                    <ArrowRightIcon />
                  )}
                  <span className="shrink-0">{item.title}</span>
                  {item.description && (
                    <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:inline">
                      {item.description}
                    </span>
                  )}
                  {item.shortcut && (
                    <CommandShortcut className="tracking-normal">
                      <Keys keys={item.shortcut.split(" ")} />
                    </CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          <CommandSeparator />

          <CommandGroup heading="Appearance">
            <CommandItem
              value="theme light mode"
              onSelect={() => run(() => setTheme("light"))}
            >
              <SunIcon className="text-muted-foreground" />
              <span>Light theme</span>
            </CommandItem>
            <CommandItem
              value="theme dark mode"
              onSelect={() => run(() => setTheme("dark"))}
            >
              <MoonIcon className="text-muted-foreground" />
              <span>Dark theme</span>
            </CommandItem>
            <CommandItem
              value="theme system auto"
              onSelect={() => run(() => setTheme("system"))}
            >
              <LaptopIcon className="text-muted-foreground" />
              <span>System theme</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <div className="flex items-center justify-between gap-4 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span className="ml-0.5">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeftIcon />
              </Kbd>
              <span className="ml-0.5">Open</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd>
              <span className="ml-0.5">Close</span>
            </span>
          </div>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>{siteConfig.shortcuts.goTo}</Kbd>
            <span>then a letter to jump</span>
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
