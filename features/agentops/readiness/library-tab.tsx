"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  LayoutGridIcon,
  NewspaperIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  EmptyValue,
  TwoLineCell,
  type DataTableFeatures,
} from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { NOW } from "@/lib/data/seed"
import { formatDate } from "@/lib/format"
import { cadenceLabel } from "@/lib/readiness/labels"
import { failureModes, glossary } from "@/lib/readiness/library"
import { isMet } from "@/lib/readiness/scoring"
import { readinessActions } from "@/lib/readiness/store"
import type {
  AssessmentResult,
  ControlEval,
  ControlSet,
  DomainDef,
  DomainId,
  FailureMode,
} from "@/lib/readiness/types"
import { ControlStatusBadge, DomainChip, useReadiness } from "./shared"

/* ------------------------------------------------------------------------ */
/* Due-state helpers                                                         */
/* ------------------------------------------------------------------------ */

const DUE_SOON_MS = 14 * 86_400_000

type DueState = "Overdue" | "Due soon" | "On track"

function dueState(review: NonNullable<ControlEval["review"]>): DueState {
  if (review.overdue) return "Overdue"
  const diff = new Date(review.dueAt).getTime() - NOW.getTime()
  return diff <= DUE_SOON_MS ? "Due soon" : "On track"
}

function markReviewed(controlId: string) {
  readinessActions.respond(controlId, {
    lastReviewed: new Date().toISOString(),
  })
  toast("Review recorded", {
    description: `${controlId} marked as reviewed today.`,
  })
}

/* ------------------------------------------------------------------------ */
/* Failure modes                                                             */
/* ------------------------------------------------------------------------ */

function FailureModeCard({
  mode,
  domain,
  evalById,
  onOpen,
}: {
  mode: FailureMode
  domain: DomainDef | undefined
  evalById: Map<string, ControlEval> | null
  onOpen: (controlId: string) => void
}) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm leading-snug">{mode.title}</CardTitle>
        {domain && (
          <CardDescription>
            <DomainChip domain={domain} />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{mode.summary}</p>
        {mode.realWorld && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
            <NewspaperIcon
              className="mt-0.5 size-3.5 shrink-0 not-italic"
              aria-hidden
            />
            <span>
              <span className="font-medium not-italic">Real-world: </span>
              {mode.realWorld}
            </span>
          </p>
        )}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Would have been caught by
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mode.controls.map((id) => {
              const ev = evalById?.get(id)
              const hidden = ev?.applicability === "not-applicable"
              return (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  size="xs"
                  className={cn("gap-1.5", hidden && "opacity-50")}
                  title={hidden ? "Not applicable to this system" : undefined}
                  onClick={() => onOpen(id)}
                >
                  <span className="font-mono">{id}</span>
                  {ev && (
                    <ControlStatusBadge
                      status={ev.response.status}
                      size="sm"
                      className="-mr-1"
                    />
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FailureModes({
  controlSet,
  result,
  onOpen,
}: {
  controlSet: ControlSet
  result: AssessmentResult | null
  onOpen: (controlId: string) => void
}) {
  const [domain, setDomain] = React.useState<DomainId | "all">("all")
  const domainById = React.useMemo(
    () => new Map(controlSet.domains.map((d) => [d.id, d])),
    [controlSet]
  )
  const evalById = React.useMemo(
    () =>
      result ? new Map(result.controls.map((e) => [e.control.id, e])) : null,
    [result]
  )
  const covered = React.useMemo(() => {
    if (!evalById) return 0
    return failureModes.filter((fm) => {
      const applicable = fm.controls
        .map((id) => evalById.get(id))
        .filter(
          (e): e is ControlEval =>
            Boolean(e) && e!.applicability !== "not-applicable"
        )
      return (
        applicable.length > 0 &&
        applicable.every((e) => isMet(e.response.status))
      )
    }).length
  }, [evalById])
  const visible =
    domain === "all"
      ? failureModes
      : failureModes.filter((fm) => fm.domain === domain)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {result ? (
            <>
              <span className="font-medium tabular-nums">
                {covered} of {failureModes.length}
              </span>{" "}
              <span className="text-muted-foreground">
                patterns fully covered — every applicable mapped control is in
                place or verified.
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Complete Setup to see which patterns your controls already cover.
            </span>
          )}
        </p>
        <ToggleGroup
          multiple={false}
          value={[domain]}
          onValueChange={(v) => setDomain((v[0] as DomainId | "all") ?? "all")}
          variant="outline"
          className="flex-wrap justify-start gap-1.5 *:data-[slot=toggle-group-item]:rounded-full!"
        >
          <ToggleGroupItem value="all" size="sm" className="gap-1.5 px-3">
            <LayoutGridIcon className="size-3.5" /> All
          </ToggleGroupItem>
          {controlSet.domains.map((d) => (
            <ToggleGroupItem
              key={d.id}
              value={d.id}
              size="sm"
              className="gap-1.5 px-3"
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-xs"
                style={{ backgroundColor: d.color }}
              />
              {d.short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<ShieldAlertIcon />}
          title="No patterns in this domain"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((fm) => (
            <FailureModeCard
              key={fm.id}
              mode={fm}
              domain={domainById.get(fm.domain)}
              evalById={evalById}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Review cadence                                                            */
/* ------------------------------------------------------------------------ */

const reviewCol = createColumnHelper<DataTableFeatures, ControlEval>()

const reviewColumns = reviewCol.columns([
  reviewCol.accessor((e) => e.control.id, {
    id: "control",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Control" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={
          <>
            <span className="mr-2 font-mono text-xs text-muted-foreground">
              {row.original.control.id}
            </span>
            {row.original.control.title}
          </>
        }
        title={row.original.control.title}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-64 max-w-md", label: "Control", skeleton: "w-48" },
  }),
  reviewCol.accessor((e) => e.control.cadence?.label ?? "", {
    id: "activity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Activity" />
    ),
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue()}</span>
    ),
    meta: { width: "min-w-48", label: "Activity", skeleton: "w-32" },
  }),
  reviewCol.accessor((e) => e.control.cadence?.every ?? "", {
    id: "every",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Every" />
    ),
    cell: ({ row }) => {
      const c = row.original.control.cadence
      return c ? cadenceLabel[c.every] : <EmptyValue />
    },
    meta: { width: "w-32", label: "Every", skeleton: "w-16" },
  }),
  reviewCol.accessor((e) => e.response.lastReviewed ?? "", {
    id: "lastReviewed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last reviewed" />
    ),
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatDate(v)}
        </span>
      ) : (
        <span className="text-muted-foreground italic">never</span>
      )
    },
    meta: { width: "w-32", label: "Last reviewed", skeleton: "w-20" },
  }),
  reviewCol.accessor((e) => e.review?.dueAt ?? "", {
    id: "due",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Due" />
    ),
    cell: ({ row }) => {
      const r = row.original.review
      if (!r) return <EmptyValue />
      return (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="tabular-nums">{formatDate(r.dueAt)}</span>
          <StateBadge state={dueState(r)} size="sm" />
        </span>
      )
    },
    meta: { width: "w-48", label: "Due", skeleton: "w-32" },
  }),
  reviewCol.accessor((e) => e.response.ownerId ?? "", {
    id: "owner",
    header: "Owner",
    cell: ({ row }) => (
      <UserChip userId={row.original.response.ownerId} size="xs" />
    ),
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
  reviewCol.display({
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="whitespace-nowrap"
        onClick={(e) => {
          e.stopPropagation()
          markReviewed(row.original.control.id)
        }}
      >
        <CheckCheckIcon /> Mark reviewed today
      </Button>
    ),
    enableHiding: false,
    meta: {
      width: "w-44",
      align: "right",
      label: "Actions",
      skeleton: "w-32",
    },
  }),
])

const standingReminders: { title: string; ids: string[]; hint: string }[] = [
  {
    title: "Eval refresh",
    ids: ["QUA-01", "DRF-07"],
    hint: "Add fresh production cases to the golden set and retire stale ones.",
  },
  {
    title: "Judge recalibration",
    ids: ["QUA-03"],
    hint: "Re-measure judge–human agreement before trusting automated scores.",
  },
  {
    title: "Model deprecation check",
    ids: ["DRF-05"],
    hint: "Confirm pinned model versions are still served and not sunset.",
  },
]

function ReminderCard({
  title,
  ids,
  hint,
  result,
}: {
  title: string
  ids: string[]
  hint: string
  result: AssessmentResult
}) {
  const matches = result.reviews.filter((e) => ids.includes(e.control.id))
  const worst: DueState | null = matches.length
    ? matches.some((e) => e.review && dueState(e.review) === "Overdue")
      ? "Overdue"
      : matches.some((e) => e.review && dueState(e.review) === "Due soon")
        ? "Due soon"
        : "On track"
    : null
  const next = matches[0]?.review?.dueAt
  return (
    <Card size="sm" className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          {title}
          {worst ? (
            <StateBadge state={worst} size="sm" />
          ) : (
            <span className="text-xs font-normal text-muted-foreground">
              Not tracked yet
            </span>
          )}
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono">{ids.join(" · ")}</span>
        {next && <span>Next due {formatDate(next)}</span>}
      </CardContent>
    </Card>
  )
}

function ReviewCadence({ result }: { result: AssessmentResult | null }) {
  if (!result) {
    return (
      <EmptyState
        icon={<CalendarClockIcon />}
        title="No assessment yet"
        description="Complete Setup to start tracking review cadences for your controls."
      />
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {standingReminders.map((r) => (
          <ReminderCard key={r.title} {...r} result={result} />
        ))}
      </div>
      <DataTable
        columns={reviewColumns}
        data={result.reviews}
        getRowId={(e) => e.control.id}
        getSearchText={(e) =>
          `${e.control.id} ${e.control.title} ${e.control.cadence?.label ?? ""}`
        }
        searchPlaceholder="Search reviews…"
        initialSorting={[{ id: "due", desc: false }]}
        pageSize={25}
        totalLabel="recurring reviews"
        emptyIcon={<CalendarClockIcon />}
        emptyTitle="Nothing to review yet"
        emptyMessage="Reviews appear once a control with a cadence is at least partially in place."
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Glossary                                                                  */
/* ------------------------------------------------------------------------ */

function Glossary() {
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  const entries = q
    ? glossary.filter(
        (g) =>
          g.term.toLowerCase().includes(q) ||
          g.definition.toLowerCase().includes(q)
      )
    : glossary

  return (
    <div className="space-y-4">
      <InputGroup className="max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter terms…"
          aria-label="Filter glossary"
        />
      </InputGroup>
      {entries.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<BookOpenIcon />}
          title="No matching terms"
          description="Try a different word — definitions are searched too."
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {entries.map((g) => (
            <div
              key={g.term}
              className="rounded-lg border bg-card p-3 ring-foreground/5"
            >
              <dt className="flex items-start justify-between gap-2 text-sm font-medium">
                {g.term}
                {g.href && (
                  <a
                    href={g.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-0.5 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Learn more <ArrowUpRightIcon className="size-3" />
                  </a>
                )}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {g.definition}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Tab                                                                       */
/* ------------------------------------------------------------------------ */

type Section = "failures" | "reviews" | "glossary"

export function LibraryTab({
  onOpen,
}: {
  onOpen: (controlId: string) => void
}) {
  const { controlSet, result } = useReadiness()
  const [section, setSection] = React.useState<Section>("failures")

  return (
    <Tabs
      value={section}
      onValueChange={(v) => setSection(v as Section)}
      className="gap-4"
    >
      <TabsList variant="line">
        <TabsTrigger value="failures">
          <ShieldAlertIcon data-icon="inline-start" /> Failure modes
          <span className="text-xs text-muted-foreground tabular-nums">
            {failureModes.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="reviews">
          <CalendarClockIcon data-icon="inline-start" /> Review cadence
          {result && result.reviews.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {result.reviews.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="glossary">
          <BookOpenIcon data-icon="inline-start" /> Glossary
          <span className="text-xs text-muted-foreground tabular-nums">
            {glossary.length}
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="failures">
        <FailureModes controlSet={controlSet} result={result} onOpen={onOpen} />
      </TabsContent>
      <TabsContent value="reviews">
        <ReviewCadence result={result} />
      </TabsContent>
      <TabsContent value="glossary">
        <Glossary />
      </TabsContent>
    </Tabs>
  )
}
