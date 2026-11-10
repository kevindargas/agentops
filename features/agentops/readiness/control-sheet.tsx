"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  AlertTriangleIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { users } from "@/lib/data/users"
import { formatDate } from "@/lib/format"
import { frameworkKey, frameworks } from "@/lib/readiness/frameworks"
import {
  cadenceLabel,
  maturityTargetLabel,
  statusHint,
  statusLabel,
} from "@/lib/readiness/labels"
import { metrics } from "@/lib/readiness/metrics"
import { consensusStatus, voteSpread } from "@/lib/readiness/scoring"
import { snippets } from "@/lib/readiness/snippets"
import { readinessActions } from "@/lib/readiness/store"
import { tools } from "@/lib/readiness/tools"
import {
  controlStatuses,
  type Assessment,
  type ControlEval,
  type ControlStatus,
  type DomainDef,
  type ToolDef,
} from "@/lib/readiness/types"
import {
  ApplicabilityBadge,
  ControlStatusBadge,
  DomainChip,
  EffortBadge,
  GateBadge,
  RequiredBadge,
  RiskDots,
  useReadiness,
} from "./shared"

const toolKindLabel: Record<ToolDef["kind"], string> = {
  "open-source": "Open source",
  managed: "Managed",
  both: "Open source + managed",
}

const NONE = "__none__"
const OTHER = "__other__"

const ownerItems = [
  { value: NONE, label: "Unassigned" },
  ...users.map((u) => ({ value: u.id, label: u.name })),
]

/**
 * Compact 5-way status picker used in control rows and the sheet. Each item
 * carries the status hint as a tooltip.
 */
export function StatusToggle({
  value,
  onChange,
  disabled = false,
  size = "sm",
  className,
  "aria-label": ariaLabel = "Status",
}: {
  value: ControlStatus | undefined
  onChange: (status: ControlStatus) => void
  disabled?: boolean
  size?: "sm" | "default"
  className?: string
  "aria-label"?: string
}) {
  return (
    <ToggleGroup
      multiple={false}
      value={value ? [value] : []}
      onValueChange={(v) => v[0] && onChange(v[0] as ControlStatus)}
      variant="outline"
      spacing={0}
      size={size}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
    >
      {controlStatuses.map((s) => (
        <Tooltip key={s}>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value={s}
                className={cn(
                  "px-2.5",
                  s === "verified" && "data-pressed:text-success-text",
                  s === "in-place" && "data-pressed:text-success-text"
                )}
              />
            }
          >
            {statusLabel[s]}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-56">
            {statusHint[s]}
          </TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}

export function ControlSheet({
  controlId,
  onClose,
  onNavigate,
  navigationIds = [],
  onSetup,
}: {
  controlId: string | null
  onClose: () => void
  /** Opens another control from the previous / next buttons. */
  onNavigate?: (id: string) => void
  /** Ordered control ids the previous / next buttons walk through. */
  navigationIds?: string[]
  /** Shown when a control is requested before an assessment exists. */
  onSetup?: () => void
}) {
  const { assessment, result, controlSet, respondent } = useReadiness()
  const entry =
    controlId && result
      ? result.controls.find((e) => e.control.id === controlId)
      : undefined
  const domain = entry
    ? controlSet.domains.find((d) => d.id === entry.control.domain)
    : undefined
  const index = controlId ? navigationIds.indexOf(controlId) : -1
  const prevId = index > 0 ? navigationIds[index - 1] : null
  const nextId =
    index >= 0 && index < navigationIds.length - 1
      ? navigationIds[index + 1]
      : null
  const inSet =
    controlId !== null && controlSet.controls.some((c) => c.id === controlId)

  return (
    <Sheet open={controlId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {entry && assessment && domain ? (
          <ControlBody
            key={controlId}
            entry={entry}
            domain={domain}
            assessment={assessment}
            respondent={respondent}
          />
        ) : assessment === null && inSet ? (
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>No assessment yet</SheetTitle>
            <SheetDescription>
              {controlId} is in the active control set, but a control can only
              be answered against a system profile. Complete Setup first; the
              control opens from the Controls tab afterwards.
            </SheetDescription>
          </SheetHeader>
        ) : (
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Control not found</SheetTitle>
            <SheetDescription>
              {controlId
                ? `${controlId} is not part of ${controlSet.name} v${controlSet.version}.`
                : "Pick a control from the list."}
            </SheetDescription>
          </SheetHeader>
        )}
        <SheetFooterActions
          primary={
            assessment === null && inSet && onSetup ? (
              <Button onClick={onSetup}>Go to Setup</Button>
            ) : undefined
          }
          tertiary={
            entry && onNavigate && navigationIds.length > 1 ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prevId}
                  onClick={() => prevId && onNavigate(prevId)}
                  aria-label={
                    prevId ? `Previous control ${prevId}` : "Previous control"
                  }
                >
                  <ChevronLeftIcon /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextId}
                  onClick={() => nextId && onNavigate(nextId)}
                  aria-label={
                    nextId ? `Next control ${nextId}` : "Next control"
                  }
                >
                  Next <ChevronRightIcon />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {index + 1} of {navigationIds.length}
                </span>
              </>
            ) : undefined
          }
        />
      </SheetContent>
    </Sheet>
  )
}

function ControlBody({
  entry,
  domain,
  assessment,
  respondent,
}: {
  entry: ControlEval
  domain: DomainDef
  assessment: Assessment
  respondent: string
}) {
  const { control: c, response, applicability, required, review } = entry
  const id = React.useId()
  const respond = (patch: Parameters<typeof readinessActions.respond>[1]) =>
    readinessActions.respond(c.id, patch)

  // Tool select: known tool id, free text ("other"), or none.
  const suggested = tools.filter((t) => c.tools.includes(t.id))
  const knownTool = suggested.some((t) => t.id === response.tool)
  const [otherSelected, setOtherSelected] = React.useState(
    Boolean(response.tool) && !knownTool
  )
  const toolValue =
    otherSelected || (response.tool && !knownTool)
      ? OTHER
      : (response.tool ?? NONE)
  const toolItems = [
    { value: NONE, label: "Not selected" },
    ...suggested.map((t) => ({ value: t.id, label: t.name })),
    { value: OTHER, label: "Other" },
  ]

  const evidence = response.evidence?.trim() ?? ""
  const evidenceIsLink =
    /^https?:\/\//i.test(evidence) || evidence.startsWith("/")
  const evidenceExternal = /^https?:\/\//i.test(evidence)

  const controlMetrics = metrics.filter((m) => c.metrics?.includes(m.id))
  const controlSnippets = snippets.filter((s) => c.snippets?.includes(s.id))
  const mappings = frameworks
    .map((f) => ({
      framework: f,
      refs: c.frameworks[frameworkKey[f.id]] ?? [],
    }))
    .filter((m) => m.refs.length > 0)

  const votes = response.votes ?? {}
  const voteEntries = Object.entries(votes)
  const consensus = consensusStatus(response.votes)
  const spread = voteSpread(response.votes)
  const respondentName = respondent.trim()
  const myVote = respondentName ? votes[respondentName] : undefined

  const applyConsensus = () => {
    if (!consensus) return
    respond({ status: consensus })
    toast.success("Consensus applied", {
      description: `${c.id} set to ${statusLabel[consensus].toLowerCase()} from ${voteEntries.length} votes.`,
    })
  }

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            {c.id}
          </span>
          <DomainChip domain={domain} />
          {required && <RequiredBadge />}
          {c.gate && <GateBadge />}
          <ApplicabilityBadge applicability={applicability} />
          <RiskDots risk={c.risk} className="ml-1" />
          <EffortBadge effort={c.effort} />
        </div>
        <SheetTitle className="text-lg leading-tight">{c.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            Required at:{" "}
            <span className="font-medium text-foreground">
              {maturityTargetLabel[c.requiredAt]}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            Current <ControlStatusBadge status={response.status} size="sm" />
          </span>
          {response.ownerId && (
            <span className="inline-flex items-center gap-1.5">
              Owner <UserChip userId={response.ownerId} size="xs" />
            </span>
          )}
        </SheetDescription>
      </SheetHeader>

      <SheetBody>
        <div className="flex flex-col gap-7">
          <Section title="What it is">
            <p className="text-sm leading-relaxed">{c.what}</p>
          </Section>

          <Section title="Why it matters">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {c.why}
            </p>
          </Section>

          <Section title="How to implement">
            <ol className="flex flex-col gap-2">
              {c.how.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-2xs font-semibold text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Done looks like">
            <div className="flex gap-3 rounded-lg border border-success/30 bg-success/5 p-3 text-sm leading-relaxed">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success-text" />
              <p>{c.done}</p>
            </div>
          </Section>

          {/* Response form */}
          <Section
            title="Your response"
            description="Changes save as you type and feed the score immediately."
          >
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Status</span>
                <StatusToggle
                  value={response.status}
                  onChange={(status) => respond({ status })}
                  size="default"
                  className="flex-wrap"
                />
                <p className="text-xs text-muted-foreground">
                  {statusHint[response.status]}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-owner`} className="text-xs">
                    Owner
                  </Label>
                  <Select
                    value={response.ownerId ?? NONE}
                    onValueChange={(v) =>
                      respond({
                        ownerId: !v || v === NONE ? undefined : String(v),
                      })
                    }
                    items={ownerItems}
                  >
                    <SelectTrigger id={`${id}-owner`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        <span className="text-muted-foreground">
                          Unassigned
                        </span>
                      </SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <UserChip userId={u.id} size="xs" />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-tool`} className="text-xs">
                    Tool used
                  </Label>
                  <Select
                    value={toolValue}
                    onValueChange={(v) => {
                      const next = v ? String(v) : NONE
                      if (next === OTHER) {
                        setOtherSelected(true)
                        if (knownTool) respond({ tool: undefined })
                        return
                      }
                      setOtherSelected(false)
                      respond({ tool: next === NONE ? undefined : next })
                    }}
                    items={toolItems}
                  >
                    <SelectTrigger id={`${id}-tool`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        <span className="text-muted-foreground">
                          Not selected
                        </span>
                      </SelectItem>
                      {suggested.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {toolValue === OTHER && (
                    <Input
                      aria-label="Other tool"
                      placeholder="Tool name"
                      value={knownTool ? "" : (response.tool ?? "")}
                      onChange={(e) =>
                        respond({ tool: e.target.value || undefined })
                      }
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`${id}-evidence`} className="text-xs">
                    Evidence link
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`${id}-evidence`}
                      placeholder="https://… or /agentops/traces"
                      value={response.evidence ?? ""}
                      onChange={(e) =>
                        respond({ evidence: e.target.value || undefined })
                      }
                      className="font-mono text-xs"
                    />
                    {evidenceIsLink && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        render={
                          evidenceExternal ? (
                            <a
                              href={evidence}
                              target="_blank"
                              rel="noreferrer"
                            />
                          ) : (
                            <Link href={evidence} />
                          )
                        }
                      >
                        Open <ExternalLinkIcon />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-reviewed`} className="text-xs">
                    Last reviewed
                  </Label>
                  <Input
                    id={`${id}-reviewed`}
                    type="date"
                    value={response.lastReviewed?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      respond({ lastReviewed: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`${id}-notes`} className="text-xs">
                    Notes
                  </Label>
                  <Textarea
                    id={`${id}-notes`}
                    placeholder="Where it is implemented, known gaps, who to ask."
                    value={response.notes ?? ""}
                    onChange={(e) =>
                      respond({ notes: e.target.value || undefined })
                    }
                    className="min-h-20"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Framework mappings */}
          {mappings.length > 0 && (
            <Section
              title="Framework mappings"
              description="Hover an item for its title."
            >
              <dl className="flex flex-col gap-2.5">
                {mappings.map(({ framework, refs }) => (
                  <div
                    key={framework.id}
                    className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">
                      <a
                        href={framework.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {framework.short}
                      </a>
                    </dt>
                    <dd className="flex flex-wrap gap-1">
                      {refs.map((ref) => {
                        const item = framework.items.find((i) => i.id === ref)
                        return (
                          <Tooltip key={ref}>
                            <TooltipTrigger
                              render={
                                <span className="inline-flex h-5 cursor-default items-center rounded-md border bg-card px-1.5 font-mono text-2xs" />
                              }
                            >
                              {ref}
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-64">
                              {item?.title ?? ref}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {/* Suggested tools */}
          {suggested.length > 0 && (
            <Section
              title="Suggested tools"
              description="Credible primary options for this control. Pick one to record it above."
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                {suggested.map((t) => {
                  const selected = response.tool === t.id
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        "flex flex-col gap-1.5 rounded-lg border bg-card p-3",
                        selected && "border-ring"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {t.name}
                        </a>
                        <StateBadge
                          state={toolKindLabel[t.kind]}
                          size="sm"
                          dot={false}
                          className="ml-auto"
                        />
                      </div>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {t.summary}
                      </p>
                      <Button
                        type="button"
                        variant={selected ? "secondary" : "ghost"}
                        size="xs"
                        className="mt-auto w-fit"
                        disabled={selected}
                        onClick={() => {
                          setOtherSelected(false)
                          respond({ tool: t.id })
                        }}
                      >
                        {selected ? (
                          <>
                            <CheckCheckIcon /> Selected
                          </>
                        ) : (
                          "Use this tool"
                        )}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {/* Metrics */}
          {controlMetrics.length > 0 && (
            <Section
              title="Metrics"
              description="What to chart once the control is in place."
            >
              <ul className="divide-y rounded-lg border">
                {controlMetrics.map((m) => (
                  <li key={m.id} className="flex flex-col gap-1 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-2xs text-muted-foreground">
                        {m.direction === "higher-is-better"
                          ? "higher is better"
                          : "lower is better"}
                      </span>
                      <span className="ml-auto font-mono text-2xs tabular-nums">
                        <span className="text-warning-text">
                          warn {m.warn}
                          {m.unit}
                        </span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-danger-text">
                          crit {m.crit}
                          {m.unit}
                        </span>
                      </span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {m.formula}
                    </p>
                    {m.otel && (
                      <p className="font-mono text-2xs text-muted-foreground/80">
                        {m.otel}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Snippets */}
          {controlSnippets.length > 0 && (
            <Section
              title="Snippets"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href="/agentops/readiness?tab=tooling" />}
                >
                  See Tooling tab
                </Button>
              }
            >
              <ul className="divide-y rounded-lg border">
                {controlSnippets.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                      {s.language}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Review cadence */}
          {c.cadence && (
            <Section title="Review cadence">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                <span className="font-medium">
                  {cadenceLabel[c.cadence.every]}
                </span>
                <span className="text-muted-foreground">{c.cadence.label}</span>
                <span className="ml-auto">
                  {review ? (
                    review.overdue ? (
                      <StateBadge state="Overdue" size="sm" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Due {formatDate(review.dueAt)}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Tracked once partial or better
                    </span>
                  )}
                </span>
              </div>
            </Section>
          )}

          {/* Team votes */}
          <Section
            title="Team votes"
            description="Each respondent answers independently; apply the consensus when you agree."
            action={
              consensus && (
                <Button
                  size="sm"
                  variant={
                    consensus === response.status ? "outline" : "default"
                  }
                  disabled={consensus === response.status}
                  onClick={applyConsensus}
                >
                  Apply consensus
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              {voteEntries.length > 0 ? (
                <>
                  <ul className="flex flex-col gap-1.5">
                    {voteEntries.map(([name, status]) => (
                      <li
                        key={name}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="inline-flex items-center gap-2">
                          <UsersIcon className="size-3.5 text-muted-foreground" />
                          {name}
                          {name === respondentName && (
                            <span className="text-2xs text-muted-foreground">
                              you
                            </span>
                          )}
                        </span>
                        <ControlStatusBadge status={status} size="sm" />
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                    <span className="text-muted-foreground">Consensus</span>
                    {consensus && (
                      <ControlStatusBadge status={consensus} size="sm" />
                    )}
                    {spread >= 2 && (
                      <span className="inline-flex items-center gap-1 text-warning-text">
                        <AlertTriangleIcon className="size-3.5" />
                        Respondents disagree by {spread} steps
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No votes yet
                  {assessment.respondents.length > 0
                    ? ` from ${assessment.respondents.join(", ")}`
                    : ""}
                  . Enter your name and cast the first one.
                </p>
              )}

              <div className="flex flex-col gap-2 border-t pt-3">
                <div className="flex flex-col gap-1.5 sm:max-w-xs">
                  <Label htmlFor={`${id}-respondent`} className="text-xs">
                    Your name
                  </Label>
                  <Input
                    id={`${id}-respondent`}
                    value={respondent}
                    onChange={(e) =>
                      readinessActions.setRespondent(e.target.value)
                    }
                    placeholder="e.g. Amara Okafor"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Your vote</span>
                  <StatusToggle
                    aria-label="Your vote"
                    value={myVote}
                    disabled={!respondentName}
                    onChange={(status) =>
                      readinessActions.vote(c.id, respondentName, status)
                    }
                    className="flex-wrap"
                  />
                  {!respondentName && (
                    <p className="text-xs text-muted-foreground">
                      Add your name to vote.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Learn more */}
          {c.learnMore && c.learnMore.length > 0 && (
            <Section title="Learn more">
              <ul className="flex flex-col gap-1">
                {c.learnMore.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                    >
                      {l.label}
                      <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </SheetBody>
    </>
  )
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
