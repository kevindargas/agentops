import type { Metadata } from "next"
import Link from "next/link"
import {
  BellIcon,
  CalendarIcon,
  CalendarClockIcon,
  ClockIcon,
  CopyIcon,
  FlaskConicalIcon,
  LinkIcon,
  ListChecksIcon,
  PlayIcon,
  ServerIcon,
  ShieldAlertIcon,
  ShieldIcon,
  UndoIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { cn } from "cn"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ActivityStream } from "@/components/record/activity-stream"
import { LifecycleTracker } from "@/components/record/lifecycle-tracker"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection, SummaryRow } from "@/components/record/record-section"
import { RecordTabs } from "@/components/record/record-tabs"
import { RelatedList } from "@/components/record/related-list"
import { RelatedRecordCard } from "@/components/record/related-record-card"
import { DetailList } from "@/components/shared/detail-list"
import {
  PriorityBadge,
  RiskBadge,
  StateBadge,
} from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import { ChangeApprovalCard } from "@/features/changes/change-approval-card"
import { ChangeTypePill } from "@/features/changes/changes-table"
import { changeStates, impactLabels } from "@/lib/constants"
import {
  buildActivity,
  changes,
  ciRelationships,
  configurationItems,
  getChange,
  getCi,
  incidents,
} from "@/lib/data"
import { NOW } from "@/lib/data/seed"
import { formatDateTime, timeAgo } from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  return { title: number }
}

function PlanBlock({
  title,
  icon,
  body,
}: {
  title: string
  icon: React.ReactNode
  body: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
        {icon} {title}
      </h3>
      <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
        {body}
      </pre>
    </div>
  )
}

export default async function ChangePage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number } = await params
  const change = getChange(number)
  if (!change)
    return (
      <RecordNotFound
        number={number}
        backHref="/itsm/changes"
        backLabel="changes"
      />
    )
  const ci = getCi(change.ciId)
  const impacted = ci
    ? ciRelationships
        .filter((r) => r.childId === ci.id)
        .map((r) => configurationItems.find((c) => c.id === r.parentId))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
    : []
  const linkedIncidents = incidents
    .filter(
      (i) =>
        i.changeId === change.number ||
        (ci && i.ciId === ci.id && !["Closed", "Canceled"].includes(i.state))
    )
    .slice(0, 6)
  const conflicts = changes.filter(
    (c) =>
      c.number !== change.number &&
      c.ciId === change.ciId &&
      !["Closed", "Canceled"].includes(c.state) &&
      Math.abs(
        new Date(c.plannedStart).getTime() -
          new Date(change.plannedStart).getTime()
      ) < 86_400_000
  )

  const start = new Date(change.plannedStart).getTime()
  const end = new Date(change.plannedEnd).getTime()
  const durationH = Math.round((end - start) / 3_600_000)
  const windowState =
    NOW.getTime() < start ? "upcoming" : NOW.getTime() > end ? "past" : "active"
  const windowPct =
    windowState === "active"
      ? Math.round(((NOW.getTime() - start) / (end - start)) * 100)
      : windowState === "past"
        ? 100
        : 0
  const startsIn = timeAgo(change.plannedStart)
  const done = ["Closed", "Canceled"].includes(change.state)

  const riskFactors: { label: string; value: string; level: 0 | 1 | 2 }[] = [
    {
      label: "Change risk",
      value: change.risk,
      level: change.risk === "Low" ? 0 : change.risk === "Moderate" ? 1 : 2,
    },
    {
      label: "CI criticality",
      value: ci?.businessCriticality.split(" - ")[1] ?? "Unknown",
      level: !ci
        ? 1
        : ci.businessCriticality.startsWith("1")
          ? 2
          : ci.businessCriticality.startsWith("2")
            ? 1
            : 0,
    },
    {
      label: "Impacted services",
      value: String(impacted.length),
      level: impacted.length === 0 ? 0 : impacted.length < 3 ? 1 : 2,
    },
    {
      label: "Open incidents on CI",
      value: String(linkedIncidents.length),
      level:
        linkedIncidents.length === 0 ? 0 : linkedIncidents.length < 3 ? 1 : 2,
    },
    {
      label: "Schedule conflicts",
      value: String(conflicts.length),
      level: conflicts.length === 0 ? 0 : 2,
    },
  ]
  const levelClass = ["bg-success", "bg-warning", "bg-destructive"]

  return (
    <>
      <RecordHeader
        number={change.number}
        title={change.shortDescription}
        backHref="/itsm/changes"
        backLabel="changes"
        badges={
          <>
            <ChangeTypePill type={change.type} />
            <StateBadge state={change.state} />
            <RiskBadge risk={change.risk} />
            <PriorityBadge priority={change.priority} short />
          </>
        }
        meta={
          <>
            <MetaItem label="Assigned to" icon={<UserIcon />}>
              <UserChip userId={change.assignedToId} size="xs" />
            </MetaItem>
            <MetaItem label="Group" icon={<UsersIcon />}>
              <GroupChip groupId={change.assignmentGroupId} />
            </MetaItem>
            <MetaItem
              label="Window"
              icon={<CalendarClockIcon />}
              tone={windowState === "active" ? "info" : "default"}
              href="/itsm/changes/calendar"
            >
              {windowState === "active"
                ? `In progress · ends ${timeAgo(change.plannedEnd)}`
                : windowState === "upcoming"
                  ? `Starts ${startsIn}`
                  : `Ended ${timeAgo(change.plannedEnd)}`}
            </MetaItem>
            <MetaItem
              label="Approval"
              icon={<ShieldIcon />}
              tone={
                change.approval === "Approved"
                  ? "success"
                  : change.approval === "Rejected"
                    ? "danger"
                    : change.approval === "Requested"
                      ? "warning"
                      : "default"
              }
            >
              {change.approval}
            </MetaItem>
            <MetaItem label="Opened" icon={<ClockIcon />}>
              {timeAgo(change.opened)}
            </MetaItem>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/itsm/changes/calendar" />}
            >
              <CalendarIcon /> View in calendar
            </Button>
            <Button disabled={change.state !== "Scheduled"}>
              <PlayIcon /> Start implementation
            </Button>
          </>
        }
        overflow={[
          {
            label: "Copy as template",
            icon: <CopyIcon />,
            message: "Change template drafted from this record",
          },
          {
            label: "Link incident",
            icon: <LinkIcon />,
            href: "/itsm/incidents",
          },
          {
            label: "Follow",
            icon: <BellIcon />,
            message: `You now follow ${change.number}`,
            separatorBefore: true,
          },
          {
            label: "Cancel change",
            destructive: true,
            separatorBefore: true,
            disabled: done,
            confirm: {
              title: `Cancel ${change.number}?`,
              description:
                "The maintenance window will be released and approvers notified. Linked incidents stay open.",
              actionLabel: "Cancel change",
            },
            message: `${change.number} canceled`,
          },
        ]}
      />

      <LifecycleTracker
        stages={changeStates.filter((s) => s !== "Canceled")}
        current={change.state}
        terminal={["Canceled"]}
      />

      <RecordLayout
        aside={
          <>
            <ChangeApprovalCard change={change} />

            <RecordSection
              title="Schedule"
              icon={<CalendarClockIcon />}
              size="sm"
              contentClassName="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {windowState === "active"
                      ? "Window in progress"
                      : windowState === "upcoming"
                        ? `Starts ${startsIn}`
                        : "Window closed"}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {durationH}h window
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      windowState === "past"
                        ? "bg-muted-foreground/40"
                        : "bg-brand"
                    )}
                    style={{ width: `${windowPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{formatDateTime(change.plannedStart)}</span>
                  <span>{formatDateTime(change.plannedEnd)}</span>
                </div>
              </div>
              <Separator />
              <SummaryRow label="Planned start">
                {formatDateTime(change.plannedStart)}
              </SummaryRow>
              <SummaryRow label="Planned end">
                {formatDateTime(change.plannedEnd)}
              </SummaryRow>
              <SummaryRow label="Maintenance window">
                Weekday 18:00–00:00 UTC
              </SummaryRow>
              <SummaryRow label="Conflicts">
                <span
                  className={
                    conflicts.length > 0
                      ? "font-medium text-destructive"
                      : undefined
                  }
                >
                  {conflicts.length}
                </span>
              </SummaryRow>
            </RecordSection>

            <RecordSection
              title="Risk assessment"
              icon={<ShieldAlertIcon />}
              size="sm"
              action={<RiskBadge risk={change.risk} />}
              contentClassName="flex flex-col gap-2.5"
            >
              {riskFactors.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="flex gap-0.5" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-3 w-1 rounded-full",
                            i <= f.level ? levelClass[f.level] : "bg-muted"
                          )}
                        />
                      ))}
                    </span>
                    {f.label}
                  </span>
                  <span className="tabular-nums">{f.value}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                {change.cabRequired
                  ? "CAB authorization is required before scheduling."
                  : change.type === "Standard"
                    ? "Pre-approved standard change — no CAB review."
                    : "Change manager approval is sufficient."}
              </p>
            </RecordSection>

            {ci && (
              <RecordSection
                title="Configuration item"
                icon={<ServerIcon />}
                size="sm"
              >
                <RelatedRecordCard
                  number={ci.id.toUpperCase()}
                  type={ci.class}
                  title={ci.name}
                  state={ci.status}
                  icon={<ServerIcon />}
                  meta={`${ci.environment} · ${ci.businessCriticality}`}
                />
              </RecordSection>
            )}
          </>
        }
      >
        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <ShieldAlertIcon />
            <AlertTitle>Schedule conflict detected</AlertTitle>
            <AlertDescription>
              <span>
                {conflicts.length} other change{conflicts.length > 1 ? "s" : ""}{" "}
                on the same configuration item within 24 hours:{" "}
                {conflicts.map((c, i) => (
                  <span key={c.number}>
                    {i > 0 && ", "}
                    <Link
                      href={`/itsm/changes/${c.number}`}
                      className="font-mono underline underline-offset-4"
                    >
                      {c.number}
                    </Link>
                  </span>
                ))}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <RecordSection
          title="Description"
          description={`${change.type} change · ${change.category}`}
        >
          <p className="max-w-[72ch] text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {change.description}
          </p>
        </RecordSection>

        <RecordSection
          title="Details"
          action={
            <Button variant="ghost" size="xs" disabled={done}>
              Edit
            </Button>
          }
        >
          <DetailList
            items={[
              {
                label: "Requested by",
                value: <UserChip userId={change.requestedById} />,
              },
              {
                label: "Configuration item",
                value: ci ? (
                  <span className="inline-flex items-center gap-1.5">
                    {ci.name}
                    <span className="text-xs text-muted-foreground">
                      {ci.class}
                    </span>
                  </span>
                ) : undefined,
              },
              {
                label: "Assignment group",
                value: <GroupChip groupId={change.assignmentGroupId} />,
              },
              {
                label: "Assigned to",
                value: <UserChip userId={change.assignedToId} />,
              },
              { label: "Type", value: <ChangeTypePill type={change.type} /> },
              { label: "Category", value: change.category },
              {
                label: "Impact",
                value: `${change.impact} - ${impactLabels[change.impact]}`,
              },
              {
                label: "CAB required",
                value: change.cabRequired ? "Yes" : "No",
              },
              { label: "Opened", value: formatDateTime(change.opened) },
              {
                label: "Last updated",
                value: `${formatDateTime(change.updated)} (${timeAgo(change.updated)})`,
              },
            ]}
          />
        </RecordSection>

        <RecordTabs
          tabs={[
            {
              value: "planning",
              label: "Planning",
              content: (
                <div className="grid gap-3 lg:grid-cols-3">
                  <PlanBlock
                    title="Implementation plan"
                    icon={<ListChecksIcon />}
                    body={change.implementationPlan}
                  />
                  <PlanBlock
                    title="Test plan"
                    icon={<FlaskConicalIcon />}
                    body={change.testPlan}
                  />
                  <PlanBlock
                    title="Backout plan"
                    icon={<UndoIcon />}
                    body={change.backoutPlan}
                  />
                </div>
              ),
            },
            {
              value: "impact",
              label: "Impacted services",
              count: impacted.length,
              content: (
                <RelatedList
                  title="Services depending on this CI"
                  description="Upstream services that may be affected during the window."
                  rows={impacted}
                  getKey={(c) => c.id}
                  emptyMessage="No upstream dependencies found."
                  columns={[
                    { header: "Name", cell: (c) => c.name },
                    {
                      header: "Class",
                      cell: (c) => (
                        <span className="text-muted-foreground">{c.class}</span>
                      ),
                      hideOnMobile: true,
                    },
                    {
                      header: "Criticality",
                      cell: (c) => c.businessCriticality,
                    },
                    {
                      header: "Status",
                      cell: (c) => <StateBadge state={c.status} />,
                    },
                  ]}
                />
              ),
            },
            {
              value: "incidents",
              label: "Incidents",
              count: linkedIncidents.length,
              content: (
                <RelatedList
                  title="Incidents on the same CI"
                  rows={linkedIncidents}
                  getKey={(i) => i.number}
                  getHref={(i) => `/itsm/incidents/${i.number}`}
                  emptyMessage="No open incidents on this configuration item."
                  action={{ label: "Link incident", href: "/itsm/incidents" }}
                  columns={[
                    {
                      header: "Number",
                      cell: (i) => (
                        <span className="font-mono text-xs">{i.number}</span>
                      ),
                    },
                    {
                      header: "Short description",
                      cell: (i) => (
                        <span className="line-clamp-1">
                          {i.shortDescription}
                        </span>
                      ),
                    },
                    {
                      header: "Priority",
                      cell: (i) => (
                        <PriorityBadge priority={i.priority} short />
                      ),
                    },
                    {
                      header: "State",
                      cell: (i) => <StateBadge state={i.state} />,
                    },
                  ]}
                />
              ),
            },
            {
              value: "activity",
              label: "Activity",
              content: (
                <ActivityStream
                  entries={buildActivity(change.number, change.assignedToId)}
                />
              ),
            },
          ]}
        />
      </RecordLayout>
    </>
  )
}
