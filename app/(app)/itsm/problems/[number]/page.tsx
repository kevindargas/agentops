import type { Metadata } from "next"
import {
  AlertTriangleIcon,
  ClockIcon,
  LightbulbIcon,
  SearchIcon,
  ServerIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { PriorityBadge, StateBadge } from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import {
  ProblemActions,
  ProblemBadges,
} from "@/features/problems/problem-actions"
import { problemStates } from "@/lib/constants"
import {
  buildActivity,
  changes,
  getCi,
  getProblem,
  incidentsForProblem,
} from "@/lib/data"
import { formatDate, formatDateTime, timeAgo } from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  return { title: number }
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number } = await params
  const problem = getProblem(number)
  if (!problem)
    return (
      <RecordNotFound
        number={number}
        backHref="/itsm/problems"
        backLabel="problems"
      />
    )
  const ci = getCi(problem.ciId)
  const linkedIncidents = incidentsForProblem(problem.number)
  const openLinked = linkedIncidents.filter(
    (i) => !["Resolved", "Closed", "Canceled"].includes(i.state)
  )
  const linkedChanges = changes
    .filter((c) => c.ciId === problem.ciId)
    .slice(0, 3)
  const closed = ["Resolved", "Closed"].includes(problem.state)

  return (
    <>
      <RecordHeader
        number={problem.number}
        title={problem.shortDescription}
        backHref="/itsm/problems"
        backLabel="problems"
        badges={
          <>
            <PriorityBadge priority={problem.priority} />
            <ProblemBadges problem={problem} />
          </>
        }
        meta={
          <>
            <MetaItem label="Assigned to" icon={<UserIcon />}>
              <UserChip userId={problem.assignedToId} size="xs" />
            </MetaItem>
            <MetaItem label="Group" icon={<UsersIcon />}>
              <GroupChip groupId={problem.assignmentGroupId} />
            </MetaItem>
            <MetaItem label="Opened" icon={<ClockIcon />}>
              {timeAgo(problem.opened)}
            </MetaItem>
            <MetaItem
              label="Incidents"
              icon={<AlertTriangleIcon />}
              tone={openLinked.length > 0 ? "warning" : "default"}
            >
              {linkedIncidents.length} linked · {openLinked.length} open
            </MetaItem>
          </>
        }
        actions={<ProblemActions problem={problem} />}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection
              title="Lifecycle"
              size="sm"
              description={
                closed
                  ? `Closed ${formatDate(problem.updated)}`
                  : `In ${problem.state} since ${timeAgo(problem.updated)}`
              }
            >
              <LifecycleTracker
                stages={problemStates}
                current={problem.state}
                orientation="vertical"
              />
            </RecordSection>

            <RecordSection
              title="Impact"
              icon={<AlertTriangleIcon />}
              size="sm"
              contentClassName="flex flex-col gap-2"
            >
              <SummaryRow label="Linked incidents">
                {linkedIncidents.length}
              </SummaryRow>
              <SummaryRow label="Still open">{openLinked.length}</SummaryRow>
              <SummaryRow label="P1 / P2">
                {linkedIncidents.filter((i) => i.priority <= 2).length}
              </SummaryRow>
              <SummaryRow label="Workaround">
                {problem.workaround ? "Available" : "None yet"}
              </SummaryRow>
            </RecordSection>

            {ci && (
              <RecordSection
                title="Affected service"
                icon={<ServerIcon />}
                size="sm"
                contentClassName="flex flex-col gap-3"
              >
                <RelatedRecordCard
                  number={ci.id.toUpperCase()}
                  type={ci.class}
                  title={ci.name}
                  href="/itom/health"
                  state={ci.status}
                  icon={<ServerIcon />}
                  meta={`${ci.environment} · ${ci.businessCriticality}`}
                />
                <DetailList
                  columns={1}
                  className="gap-y-3"
                  items={[
                    {
                      label: "Support group",
                      value: <GroupChip groupId={ci.supportGroupId} />,
                    },
                    { label: "Owner", value: <UserChip userId={ci.ownerId} /> },
                  ]}
                />
              </RecordSection>
            )}
          </>
        }
      >
        {problem.workaround && (
          <Alert>
            <LightbulbIcon />
            <AlertTitle>Workaround available</AlertTitle>
            <AlertDescription>{problem.workaround}</AlertDescription>
          </Alert>
        )}

        <RecordSection
          title="Analysis"
          description="Root cause and interim workaround, shared with linked incidents."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <SearchIcon className="size-3.5" /> Root cause
              </h3>
              {problem.rootCause ? (
                <p className="text-sm leading-relaxed">{problem.rootCause}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not yet identified. Analysis in progress.
                </p>
              )}
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <WrenchIcon className="size-3.5" /> Workaround
              </h3>
              {problem.workaround ? (
                <p className="text-sm leading-relaxed">{problem.workaround}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No workaround documented.
                </p>
              )}
            </div>
          </div>
        </RecordSection>

        <RecordSection title="Details">
          <DetailList
            items={[
              {
                label: "Affected service",
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
                label: "Known error",
                value: problem.knownError
                  ? "Yes, published to the knowledge base"
                  : "No",
              },
              {
                label: "Assignment group",
                value: <GroupChip groupId={problem.assignmentGroupId} />,
              },
              {
                label: "Assigned to",
                value: <UserChip userId={problem.assignedToId} />,
              },
              { label: "Opened", value: formatDateTime(problem.opened) },
              {
                label: "Last updated",
                value: `${formatDateTime(problem.updated)} (${timeAgo(problem.updated)})`,
              },
            ]}
          />
        </RecordSection>

        <RecordTabs
          tabs={[
            {
              value: "activity",
              label: "Activity",
              content: (
                <ActivityStream
                  entries={buildActivity(problem.number, problem.assignedToId)}
                />
              ),
            },
            {
              value: "incidents",
              label: "Incidents",
              count: linkedIncidents.length,
              content: (
                <RelatedList
                  title="Linked incidents"
                  description="Incidents attached to this problem inherit its workaround and known-error status."
                  rows={linkedIncidents}
                  getKey={(i) => i.number}
                  getHref={(i) => `/itsm/incidents/${i.number}`}
                  emptyMessage="No incidents linked yet."
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
                    {
                      header: "Opened",
                      cell: (i) => (
                        <span className="text-muted-foreground">
                          {timeAgo(i.opened)}
                        </span>
                      ),
                      hideOnMobile: true,
                    },
                  ]}
                />
              ),
            },
            {
              value: "changes",
              label: "Changes",
              count: linkedChanges.length,
              content: (
                <RelatedList
                  title="Related changes"
                  description="Changes on the same service."
                  rows={linkedChanges}
                  getKey={(c) => c.number}
                  getHref={(c) => `/itsm/changes/${c.number}`}
                  emptyMessage="No changes scheduled for this service."
                  action={{
                    label: "Create change",
                    href: "/itsm/changes?new=1",
                  }}
                  columns={[
                    {
                      header: "Number",
                      cell: (c) => (
                        <span className="font-mono text-xs">{c.number}</span>
                      ),
                    },
                    {
                      header: "Short description",
                      cell: (c) => (
                        <span className="line-clamp-1">
                          {c.shortDescription}
                        </span>
                      ),
                    },
                    { header: "Type", cell: (c) => c.type, hideOnMobile: true },
                    {
                      header: "State",
                      cell: (c) => <StateBadge state={c.state} />,
                    },
                    {
                      header: "Planned",
                      cell: (c) => (
                        <span className="text-muted-foreground">
                          {formatDate(c.plannedStart)}
                        </span>
                      ),
                      hideOnMobile: true,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </RecordLayout>
    </>
  )
}
