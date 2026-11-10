"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  AlertTriangleIcon,
  BookOpenIcon,
  BotIcon,
  CheckSquareIcon,
  ChevronRightIcon,
  ClockIcon,
  ClipboardCheckIcon,
  FlaskConicalIcon,
  GitBranchIcon,
  HistoryIcon,
  PackageIcon,
  RouteIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Section } from "@/components/shared/page-header"
import {
  PriorityBadge,
  StateBadge,
  toneClasses,
} from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { timeAgo } from "@/lib/format"
import type { Priority } from "@/lib/types"

export type WorkItemType =
  | "Review"
  | "Experiment"
  | "Agent"
  | "Trace"
  | "Incident"
  | "Problem"
  | "Change"
  | "Request"
  | "Knowledge"

export interface WorkItem {
  number: string
  title: string
  type: WorkItemType
  state: string
  href: string
  updated: string
  priority?: Priority
  /** ISO due date; rendered as a countdown with overdue styling */
  due?: string
  /** SLA already breached or otherwise needs attention */
  attention?: boolean
  /** Secondary line, e.g. "Network Operations · VPN" */
  meta?: string
  /** Person associated with the row (requester, assignee…) */
  personId?: string
  personLabel?: string
}

export interface WorkSections {
  assigned: WorkItem[]
  approvals: WorkItem[]
  requested: WorkItem[]
  recent: WorkItem[]
}

const typeIcon: Record<WorkItemType, LucideIcon> = {
  Review: ClipboardCheckIcon,
  Experiment: FlaskConicalIcon,
  Agent: BotIcon,
  Trace: RouteIcon,
  Incident: AlertTriangleIcon,
  Problem: AlertTriangleIcon,
  Change: GitBranchIcon,
  Request: PackageIcon,
  Knowledge: BookOpenIcon,
}

const typeTint: Record<WorkItemType, string> = {
  Review: toneClasses.progress.soft,
  Experiment: toneClasses.success.soft,
  Agent: toneClasses.progress.soft,
  Trace: toneClasses.muted.soft,
  Incident: toneClasses.danger.soft,
  Problem: toneClasses.warning.soft,
  Change: toneClasses.info.soft,
  Request: toneClasses.progress.soft,
  Knowledge: toneClasses.muted.soft,
}

const filters: { value: "All" | WorkItemType; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Review", label: "Reviews" },
  { value: "Experiment", label: "Experiments" },
  { value: "Incident", label: "Incidents" },
  { value: "Change", label: "Changes" },
  { value: "Request", label: "Requests" },
]

function DueLabel({ due, nowIso }: { due: string; nowIso: string }) {
  const hours =
    (new Date(due).getTime() - new Date(nowIso).getTime()) / 3_600_000
  const overdue = hours < 0
  const soon = !overdue && hours < 24
  const text = overdue
    ? `Overdue ${timeAgo(due).replace(" ago", "")}`
    : hours < 1
      ? `${Math.max(1, Math.round(hours * 60))}m left`
      : hours < 48
        ? `${Math.round(hours)}h left`
        : `${Math.round(hours / 24)}d left`
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        overdue
          ? "font-medium text-danger-text"
          : soon
            ? "text-warning-text"
            : "text-muted-foreground"
      )}
    >
      <ClockIcon className="size-3.5" /> {text}
    </span>
  )
}

function Row({ item, nowIso }: { item: WorkItem; nowIso: string }) {
  const Icon = typeIcon[item.type]
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          typeTint[item.type]
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {item.number}
          </span>
          {item.attention && (
            <Badge
              variant="outline"
              className="h-4 border-destructive/30 bg-destructive/10 px-1.5 text-3xs text-danger-text"
            >
              Needs attention
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-medium">{item.title}</p>
        {(item.meta || item.personId) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {item.meta && <span className="truncate">{item.meta}</span>}
            {item.personId && (
              <span className="inline-flex items-center gap-1">
                {item.personLabel ?? "For"}{" "}
                <UserChip
                  userId={item.personId}
                  size="xs"
                  className="[&_span]:text-xs"
                />
              </span>
            )}
          </div>
        )}
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
        {item.due ? (
          <DueLabel due={item.due} nowIso={nowIso} />
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {timeAgo(item.updated)}
          </span>
        )}
        <span className="text-2xs text-muted-foreground/70">{item.type}</span>
      </div>
      {item.priority && (
        <PriorityBadge
          priority={item.priority}
          short
          className="hidden sm:inline-flex"
        />
      )}
      <StateBadge
        state={item.state}
        dot={false}
        className="w-28 justify-center"
      />
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  )
}

function WorkList({
  items,
  empty,
  nowIso,
  limit,
}: {
  items: WorkItem[]
  empty: { title: string; description: string }
  nowIso: string
  limit?: number
}) {
  const [expanded, setExpanded] = React.useState(false)
  if (items.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<CheckSquareIcon />}
        title={empty.title}
        description={empty.description}
      />
    )
  }
  const shown = limit && !expanded ? items.slice(0, limit) : items
  return (
    <Card className="py-0">
      <CardContent className="divide-y px-0">
        {shown.map((i) => (
          <Row key={`${i.type}-${i.number}`} item={i} nowIso={nowIso} />
        ))}
        {limit && items.length > limit && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show less" : `Show ${items.length - limit} more`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MyWorkBoard({
  sections,
  nowIso,
}: {
  sections: WorkSections
  nowIso: string
}) {
  const [filter, setFilter] =
    React.useState<(typeof filters)[number]["value"]>("All")
  const [attentionOnly, setAttentionOnly] = React.useState(false)

  const apply = (items: WorkItem[]) =>
    items.filter(
      (i) =>
        (filter === "All" || i.type === filter) &&
        (!attentionOnly || i.attention)
    )
  const assigned = apply(sections.assigned)
  const approvals = apply(sections.approvals)
  const requested = apply(sections.requested)
  const recent = apply(sections.recent)
  const total =
    assigned.length + approvals.length + requested.length + recent.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          multiple={false}
          value={[filter]}
          onValueChange={(v) => setFilter((v[0] as typeof filter) ?? "All")}
          variant="outline"
          className="flex-wrap justify-start gap-1 *:data-[slot=toggle-group-item]:rounded-full!"
        >
          {filters.map((f) => (
            <ToggleGroupItem
              key={f.value}
              value={f.value}
              size="sm"
              className="px-3"
            >
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          multiple
          value={attentionOnly ? ["attention"] : []}
          onValueChange={(v) => setAttentionOnly(v.includes("attention"))}
          variant="outline"
        >
          <ToggleGroupItem value="attention" size="sm" className="gap-1.5 px-3">
            <AlertTriangleIcon className="size-3.5" /> Needs attention only
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<CheckSquareIcon />}
          title="Nothing matches these filters"
          description="Try a different record type, or clear the attention filter to see everything on your plate."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilter("All")
                setAttentionOnly(false)
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <Section
            title={
              <SectionTitle
                icon={CheckSquareIcon}
                label="Assigned to me"
                count={assigned.length}
              />
            }
            description="Agent answers to review, experiments you own and records where you are the assignee"
          >
            <WorkList
              items={assigned}
              nowIso={nowIso}
              limit={6}
              empty={{
                title: "Nothing assigned to you",
                description:
                  "New assignments will show up here the moment they land.",
              }}
            />
          </Section>
          <Section
            title={
              <SectionTitle
                icon={ShieldCheckIcon}
                label="My approvals"
                count={approvals.length}
              />
            }
            description="Changes and requests waiting for your decision"
            actions={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/approvals" />}
              >
                Review all <ChevronRightIcon />
              </Button>
            }
          >
            <WorkList
              items={approvals}
              nowIso={nowIso}
              limit={4}
              empty={{
                title: "No pending approvals",
                description: "You are all caught up.",
              }}
            />
          </Section>
          <Section
            title={
              <SectionTitle
                icon={PackageIcon}
                label="My requests"
                count={requested.length}
              />
            }
            description="Things you have asked for or reported"
          >
            <WorkList
              items={requested}
              nowIso={nowIso}
              limit={5}
              empty={{
                title: "You have not requested anything yet",
                description:
                  "Incidents you report and items you order will show up here.",
              }}
            />
          </Section>
          <Section
            title={
              <SectionTitle
                icon={HistoryIcon}
                label="Recently viewed"
                count={recent.length}
              />
            }
            description="Records you opened recently"
          >
            <WorkList
              items={recent}
              nowIso={nowIso}
              empty={{
                title: "No recent records",
                description:
                  "Records you open will be listed here for quick access.",
              }}
            />
          </Section>
        </>
      )}
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  label,
  count,
}: {
  icon: LucideIcon
  label: string
  count: number
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      {label}
      <CountPill count={count} size="default" />
    </span>
  )
}
