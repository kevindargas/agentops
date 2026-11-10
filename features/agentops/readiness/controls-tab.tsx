"use client"

import * as React from "react"
import { cn } from "cn"
import {
  AlertTriangleIcon,
  ClipboardListIcon,
  SearchIcon,
  UsersIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"

import { AvailabilityBar } from "@/components/charts/availability-bar"
import { EmptyState } from "@/components/shared/empty-state"
import { UserChip } from "@/components/shared/user-chip"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { timeAgo } from "@/lib/format"
import { statusLabel } from "@/lib/readiness/labels"
import { isMet, voteSpread } from "@/lib/readiness/scoring"
import { readinessActions } from "@/lib/readiness/store"
import { getTool } from "@/lib/readiness/tools"
import {
  controlStatuses,
  type ControlEval,
  type ControlStatus,
  type DomainId,
  type DomainScore,
} from "@/lib/readiness/types"
import { StatusToggle } from "./control-sheet"
import {
  ApplicabilityBadge,
  DomainChip,
  EffortBadge,
  GateBadge,
  RequiredBadge,
  RiskDots,
  scoreTone,
  useReadiness,
} from "./shared"

type StatusFilter = ControlStatus | "all"

const statusItems: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  ...controlStatuses.map((s) => ({ value: s, label: statusLabel[s] })),
]

/**
 * Every control grouped by domain with inline status editing. Opens the
 * control sheet through `onOpen`.
 */
export function ControlsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { result, controlSet, showNotApplicable } = useReadiness()
  const [query, setQuery] = React.useState("")
  const [domains, setDomains] = React.useState<DomainId[]>([])
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [onlyGaps, setOnlyGaps] = React.useState(false)
  const [onlyRequired, setOnlyRequired] = React.useState(false)
  const switchId = React.useId()

  if (!result) {
    return (
      <EmptyState
        icon={<ClipboardListIcon />}
        title="No assessment yet"
        description="Describe the system on the Setup tab to see which controls apply."
      />
    )
  }

  const q = query.trim().toLowerCase()
  const filtersActive =
    q.length > 0 ||
    domains.length > 0 ||
    status !== "all" ||
    onlyGaps ||
    onlyRequired

  const visible = result.controls.filter((e) => {
    if (e.applicability === "not-applicable" && !showNotApplicable) return false
    if (domains.length > 0 && !domains.includes(e.control.domain)) return false
    if (status !== "all" && e.response.status !== status) return false
    if (onlyGaps && isMet(e.response.status)) return false
    if (onlyRequired && !e.required) return false
    if (q) {
      const hay =
        `${e.control.id} ${e.control.title} ${e.control.what}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const groups = controlSet.domains
    .map((domain) => ({
      domain,
      score: result.domains.find((d) => d.domain.id === domain.id),
      items: visible.filter((e) => e.control.domain === domain.id),
    }))
    .filter((g) => g.items.length > 0)

  const clearFilters = () => {
    setQuery("")
    setDomains([])
    setStatus("all")
    setOnlyGaps(false)
    setOnlyRequired(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id or title…"
              aria-label="Search controls"
            />
          </InputGroup>
          <Select
            value={status}
            onValueChange={(v) => setStatus((v as StatusFilter) ?? "all")}
            items={statusItems}
          >
            <SelectTrigger aria-label="Status filter" className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            multiple
            value={[
              ...(onlyGaps ? ["gaps"] : []),
              ...(onlyRequired ? ["required"] : []),
            ]}
            onValueChange={(v) => {
              setOnlyGaps(v.includes("gaps"))
              setOnlyRequired(v.includes("required"))
            }}
            variant="outline"
            aria-label="Quick filters"
          >
            <ToggleGroupItem value="gaps" size="sm" className="px-3">
              Only gaps
            </ToggleGroupItem>
            <ToggleGroupItem value="required" size="sm" className="px-3">
              Only required
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Switch
              id={switchId}
              size="sm"
              checked={showNotApplicable}
              onCheckedChange={(c) => readinessActions.setShowNotApplicable(c)}
            />
            <Label htmlFor={switchId} className="text-xs font-normal">
              Show not-applicable
              <span className="text-muted-foreground">
                ({result.counts.hidden})
              </span>
            </Label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            multiple
            value={domains}
            onValueChange={(v) => setDomains(v as DomainId[])}
            variant="outline"
            aria-label="Filter by domain"
            className="flex-wrap *:data-[slot=toggle-group-item]:rounded-full!"
          >
            {controlSet.domains.map((d) => (
              <ToggleGroupItem
                key={d.id}
                value={d.id}
                size="sm"
                className="px-3"
              >
                <DomainChip domain={d} short />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="text-xs text-muted-foreground tabular-nums sm:ml-auto">
            {visible.length} of {result.counts.applicable} applicable controls
          </span>
          {filtersActive && (
            <Button variant="ghost" size="xs" onClick={clearFilters}>
              <XIcon /> Clear
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<SearchIcon />}
          title="No controls match"
          description="Loosen the filters or clear the search."
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <Accordion
          key={controlSet.id}
          defaultValue={controlSet.domains.map((d) => d.id)}
          className="rounded-xl border bg-card px-3"
        >
          {groups.map(({ domain, score, items }) => (
            <AccordionItem key={domain.id} value={domain.id}>
              <AccordionTrigger className="items-center gap-3 py-3 hover:no-underline">
                <DomainGroupHeader
                  domain={domain}
                  score={score}
                  shown={items.length}
                />
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="divide-y divide-border/70 rounded-lg border">
                  {items.map((e) => (
                    <ControlRow key={e.control.id} entry={e} onOpen={onOpen} />
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}

function DomainGroupHeader({
  domain,
  score,
  shown,
}: {
  domain: DomainScore["domain"]
  score: DomainScore | undefined
  shown: number
}) {
  const value = score?.score ?? 0
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
      <DomainChip domain={domain} className="text-sm" />
      <span className="text-xs font-normal text-muted-foreground tabular-nums">
        {score ? `${score.inPlace} of ${score.applicable} in place` : "—"}
        {score && shown !== score.applicable && (
          <span className="text-muted-foreground/70"> · {shown} shown</span>
        )}
        {score && score.blockers > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-danger-text">
            <AlertTriangleIcon className="size-3" />
            {score.blockers} blocker{score.blockers === 1 ? "" : "s"}
          </span>
        )}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <AvailabilityBar
          value={value}
          tone={scoreTone(value)}
          size="sm"
          className="w-20 sm:w-28"
        />
        <span
          className={cn(
            "w-7 text-right font-mono text-xs font-semibold tabular-nums"
          )}
        >
          {value}
        </span>
      </span>
    </span>
  )
}

function ControlRow({
  entry,
  onOpen,
}: {
  entry: ControlEval
  onOpen: (id: string) => void
}) {
  const { control: c, response, applicability, required, blocker } = entry
  const na = applicability === "not-applicable"
  const tool = response.tool ? getTool(response.tool) : undefined
  const votes = response.votes ? Object.keys(response.votes).length : 0
  const spread = voteSpread(response.votes)

  return (
    <li
      className={cn(
        "grid gap-2 px-3 py-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center",
        na && "opacity-60",
        blocker && "bg-destructive/[0.03]"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
            {c.id}
          </span>
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="min-w-0 rounded-sm text-left text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {c.title}
          </button>
          {required && <RequiredBadge />}
          {c.gate && <GateBadge />}
          <ApplicabilityBadge applicability={applicability} />
          <RiskDots risk={c.risk} />
          <EffortBadge effort={c.effort} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <UserChip userId={response.ownerId} size="xs" />
          {(tool || response.tool) && (
            <span className="inline-flex items-center gap-1">
              <WrenchIcon className="size-3" />
              {tool?.name ?? response.tool}
            </span>
          )}
          {response.lastReviewed && (
            <span>Reviewed {timeAgo(response.lastReviewed)}</span>
          )}
          {entry.review?.overdue && (
            <span className="text-danger-text">Review overdue</span>
          )}
          {votes > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px]",
                spread >= 2 && "border-warning/40 text-warning-text"
              )}
              title={
                spread >= 2
                  ? `Respondents disagree by ${spread} steps`
                  : undefined
              }
            >
              <UsersIcon className="size-3" />
              {votes} vote{votes === 1 ? "" : "s"}
              {spread >= 2 && <AlertTriangleIcon className="size-3" />}
            </span>
          )}
        </div>
      </div>
      <StatusToggle
        aria-label={`Status for ${c.id}`}
        value={response.status}
        onChange={(status) => readinessActions.respond(c.id, { status })}
        className="flex-wrap lg:justify-end"
      />
    </li>
  )
}
