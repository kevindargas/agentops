"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ArrowRightIcon,
  LockIcon,
  MailIcon,
  MessageSquareIcon,
  PenLineIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { toneClasses } from "@/components/shared/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { currentUser, getUser, initials } from "@/lib/data/users"
import { NOW, hoursAgo } from "@/lib/data/seed"
import { formatDate, timeAgo } from "@/lib/format"
import type { ActivityEntry } from "@/lib/types"

type EntryType = ActivityEntry["type"]
type Mode = "comment" | "work_note"
type Filter = "all" | "comment" | "work_note" | "system"

const typeMeta: Record<
  EntryType,
  {
    label: string
    icon: React.ReactNode
    chip: string
    card: string
    system: boolean
  }
> = {
  comment: {
    label: "Comment",
    icon: <MessageSquareIcon />,
    chip: toneClasses.info.badge,
    card: "border-border bg-card",
    system: false,
  },
  work_note: {
    label: "Work note",
    icon: <LockIcon />,
    chip: toneClasses.warning.badge,
    card: "border-warning/30 bg-warning/5",
    system: false,
  },
  approval: {
    label: "Approval",
    icon: <ShieldCheckIcon />,
    chip: toneClasses.success.badge,
    card: "border-success/30 bg-success/5",
    system: false,
  },
  field_change: {
    label: "Field change",
    icon: <PenLineIcon />,
    chip: "",
    card: "",
    system: true,
  },
  email: {
    label: "Email",
    icon: <MailIcon />,
    chip: "",
    card: "",
    system: true,
  },
  system: {
    label: "System",
    icon: <SparklesIcon />,
    chip: "",
    card: "",
    system: true,
  },
}

const filterMatch: Record<Filter, EntryType[]> = {
  all: ["comment", "work_note", "approval", "field_change", "email", "system"],
  comment: ["comment"],
  work_note: ["work_note"],
  system: ["field_change", "email", "system", "approval"],
}

const DAY = 86_400_000

function dayLabel(iso: string) {
  const diff =
    Math.floor(NOW.getTime() / DAY) - Math.floor(new Date(iso).getTime() / DAY)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return formatDate(iso, { weekday: "short", year: undefined })
}

function groupByDay(entries: ActivityEntry[]) {
  const groups: { label: string; items: ActivityEntry[] }[] = []
  for (const entry of entries) {
    const label = dayLabel(entry.timestamp)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(entry)
    else groups.push({ label, items: [entry] })
  }
  return groups
}

/**
 * Timeline of comments, work notes and system events for a record, with a
 * compose box that posts locally (deterministic demo data, nothing persisted).
 */
export function ActivityStream({
  entries,
  className,
  showCompose = true,
  defaultMode = "work_note",
  title = "Activity",
}: {
  entries: ActivityEntry[]
  className?: string
  showCompose?: boolean
  defaultMode?: Mode
  title?: string
}) {
  const [items, setItems] = React.useState(entries)
  const [mode, setMode] = React.useState<Mode>(defaultMode)
  const [draft, setDraft] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")

  const visible = items.filter((e) => filterMatch[filter].includes(e.type))
  const groups = groupByDay(visible)
  const counts = {
    comment: items.filter((e) => e.type === "comment").length,
    work_note: items.filter((e) => e.type === "work_note").length,
  }

  function post() {
    const body = draft.trim()
    if (!body) return
    setItems((prev) => [
      {
        id: `local-${prev.length}`,
        recordNumber: prev[0]?.recordNumber ?? "",
        type: mode,
        authorId: currentUser.id,
        body,
        timestamp: hoursAgo(0),
      },
      ...prev,
    ])
    setDraft("")
    toast.success(
      mode === "comment"
        ? "Comment posted and customer notified"
        : "Work note added"
    )
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {showCompose && (
        <div className="flex gap-3">
          <Avatar className="mt-1 hidden size-8 shrink-0 sm:flex">
            <AvatarFallback className="bg-brand/10 text-xs font-medium text-brand">
              {initials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "min-w-0 flex-1 overflow-hidden rounded-xl border bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
              mode === "work_note" && "border-warning/40"
            )}
          >
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="gap-0"
            >
              <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
                <TabsList variant="line" className="h-7 gap-0">
                  <TabsTrigger value="work_note" className="h-7 px-2 text-xs">
                    <LockIcon /> Work notes
                  </TabsTrigger>
                  <TabsTrigger value="comment" className="h-7 px-2 text-xs">
                    <MessageSquareIcon /> Comments
                  </TabsTrigger>
                </TabsList>
                <span
                  className={cn(
                    "hidden text-xs sm:inline",
                    mode === "comment" ? "text-info-text" : "text-warning-text"
                  )}
                >
                  {mode === "comment"
                    ? "Visible to the customer"
                    : "Internal only"}
                </span>
              </div>
            </Tabs>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={mode === "comment" ? "New comment" : "New work note"}
              placeholder={
                mode === "comment"
                  ? "Write an update for the customer"
                  : "Add a work note for your team"
              }
              className="min-h-20 resize-none rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post()
              }}
            />
            <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <KbdGroup>
                  <Kbd>⌘</Kbd>
                  <Kbd>↵</Kbd>
                </KbdGroup>
                to post
              </span>
              <Button size="sm" onClick={post} disabled={!draft.trim()}>
                <SendIcon /> {mode === "comment" ? "Post comment" : "Add note"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          <CountPill count={items.length} />
        </h3>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-7">
            <TabsTrigger value="all" className="px-2 text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="comment" className="px-2 text-xs">
              Comments{" "}
              <span className="text-muted-foreground tabular-nums">
                {counts.comment}
              </span>
            </TabsTrigger>
            <TabsTrigger value="work_note" className="px-2 text-xs">
              Work notes{" "}
              <span className="text-muted-foreground tabular-nums">
                {counts.work_note}
              </span>
            </TabsTrigger>
            <TabsTrigger value="system" className="px-2 text-xs">
              System
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          size="sm"
          title="No activity yet"
          description="Comments, work notes and system events will appear here."
        />
      ) : (
        <div className="relative flex flex-col gap-6 before:absolute before:inset-y-3 before:left-4 before:w-px before:bg-border">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-4">
              <h4 className="relative z-10 flex items-center gap-3">
                <span className="w-8 shrink-0" aria-hidden />
                <span className="rounded-full border bg-background px-2 py-0.5 text-3xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </span>
              </h4>
              <ol className="flex flex-col gap-4">
                {group.items.map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const author = getUser(entry.authorId)
  const meta = typeMeta[entry.type]
  const name = author?.name ?? "System"

  if (meta.system) {
    return (
      <li className="relative flex gap-3">
        <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground ring-4 ring-background [&_svg]:size-3.5">
          {meta.icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{name}</span>{" "}
            {entry.type === "field_change"
              ? "updated"
              : entry.type === "email"
                ? "sent an email"
                : "·"}{" "}
            {entry.type !== "field_change" && (
              <span className="text-foreground/80">{entry.body}</span>
            )}
            <span className="whitespace-nowrap">
              {" "}
              · {timeAgo(entry.timestamp)}
            </span>
          </p>
          {entry.fieldChanges && (
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {entry.fieldChanges.map((fc) => (
                <li
                  key={fc.field}
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5"
                >
                  <span className="font-medium">{fc.field}</span>
                  <span className="text-muted-foreground line-through">
                    {fc.from}
                  </span>
                  <ArrowRightIcon className="size-3 text-muted-foreground" />
                  <span className="font-medium">{fc.to}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </li>
    )
  }

  return (
    <li className="relative flex gap-3">
      <Avatar className="relative z-10 size-8 shrink-0 ring-4 ring-background">
        <AvatarFallback className="bg-brand/10 text-xs font-medium text-brand">
          {author ? initials(author.name) : "?"}
        </AvatarFallback>
      </Avatar>
      <article
        className={cn(
          "min-w-0 flex-1 rounded-xl border px-3.5 py-2.5",
          meta.card
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-medium text-foreground">{name}</span>
          {author?.title && (
            <span className="hidden text-muted-foreground sm:inline">
              {author.title}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-medium [&_svg]:size-3",
              meta.chip
            )}
          >
            {meta.icon}
            {meta.label}
          </span>
          <time
            dateTime={entry.timestamp}
            className="ml-auto text-muted-foreground tabular-nums"
          >
            {timeAgo(entry.timestamp)}
          </time>
        </header>
        {entry.body && (
          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {entry.body}
          </p>
        )}
      </article>
    </li>
  )
}
