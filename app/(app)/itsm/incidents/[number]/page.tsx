import type { Metadata } from "next"
import {
  ClockIcon,
  LinkIcon,
  RadioIcon,
  TimerIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { ActivityStream } from "@/components/record/activity-stream"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection, SummaryRow } from "@/components/record/record-section"
import { RecordTabs } from "@/components/record/record-tabs"
import { RelatedList } from "@/components/record/related-list"
import { SlaProgress } from "@/components/record/sla-progress"
import { DetailList } from "@/components/shared/detail-list"
import {
  PriorityBadge,
  SeverityBadge,
  StateBadge,
} from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import { impactLabels, slaTargetHours, urgencyLabels } from "@/lib/constants"
import {
  alerts,
  buildActivity,
  getCi,
  getGroup,
  getIncident,
  incidents,
  knowledgeArticles,
} from "@/lib/data"
import { formatDateTime, timeAgo } from "@/lib/format"
import {
  IncidentActions,
  IncidentBadges,
} from "@/features/incidents/incident-actions"
import {
  IncidentRelatedRecords,
  IncidentWatchers,
} from "@/features/incidents/incident-related-actions"
import { RecordAiInsights } from "@/components/ai/record-ai-insights"

/**
 * Every sample record is prerendered at build time so the static export has a
 * page per number; anything else is a 404. The server build gets the same list.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return incidents.map((incident) => ({ number: incident.number }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  return { title: number }
}

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number } = await params
  const incident = getIncident(number)
  if (!incident)
    return (
      <RecordNotFound
        number={number}
        backHref="/itsm/incidents"
        backLabel="incidents"
      />
    )

  const ci = getCi(incident.ciId)
  const relatedAlerts = alerts.filter(
    (a) =>
      a.incidentNumber === incident.number ||
      (ci && a.ciId === ci.id && a.state !== "Closed")
  )
  const similar = incidents
    .filter(
      (i) =>
        i.number !== incident.number &&
        i.category === incident.category &&
        i.subcategory === incident.subcategory
    )
    .slice(0, 5)
  const suggestedKb = knowledgeArticles
    .filter(
      (k) =>
        k.state === "Published" &&
        k.knowledgeBase ===
          (incident.category === "Security" ? "Security" : "IT")
    )
    .slice(0, 3)
  const slaTone = incident.slaBreached
    ? "danger"
    : incident.resolved
      ? "success"
      : "default"

  return (
    <>
      <RecordHeader
        number={incident.number}
        title={incident.shortDescription}
        backHref="/itsm/incidents"
        backLabel="incidents"
        badges={
          <>
            <PriorityBadge priority={incident.priority} />
            <IncidentBadges incident={incident} />
          </>
        }
        meta={
          <>
            <MetaItem label="Assigned to" icon={<UserIcon />}>
              <UserChip userId={incident.assignedToId} size="xs" />
            </MetaItem>
            <MetaItem label="Group" icon={<UsersIcon />}>
              <GroupChip groupId={incident.assignmentGroupId} />
            </MetaItem>
            <MetaItem label="Opened" icon={<ClockIcon />}>
              {timeAgo(incident.opened)}
            </MetaItem>
            <MetaItem label="SLA" icon={<TimerIcon />} tone={slaTone}>
              {incident.resolved
                ? incident.slaBreached
                  ? "Breached"
                  : "Met"
                : incident.slaBreached
                  ? "Breached"
                  : `Due ${timeAgo(incident.slaDue)}`}
            </MetaItem>
            <MetaItem label="Channel" icon={<RadioIcon />}>
              {incident.channel}
            </MetaItem>
            {incident.reopenCount > 0 && (
              <MetaItem label="Reopened" tone="warning">
                {incident.reopenCount}×
              </MetaItem>
            )}
          </>
        }
        actions={<IncidentActions incident={incident} />}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection
              title="Resolution SLA"
              icon={<TimerIcon />}
              size="sm"
              contentClassName="flex flex-col gap-3"
            >
              <SlaProgress
                start={incident.opened}
                due={incident.slaDue}
                completed={incident.resolved}
                breached={incident.slaBreached}
              />
              <Separator />
              <SummaryRow label="Target">
                {slaTargetHours[incident.priority]}h for P{incident.priority}
              </SummaryRow>
              <SummaryRow label="Due">
                {formatDateTime(incident.slaDue)}
              </SummaryRow>
              {incident.resolved && (
                <SummaryRow label="Resolved">
                  {formatDateTime(incident.resolved)}
                </SummaryRow>
              )}
            </RecordSection>

            <RecordSection
              title="Related records"
              icon={<LinkIcon />}
              size="sm"
              contentClassName="flex flex-col gap-2"
            >
              <IncidentRelatedRecords incident={incident} />
            </RecordSection>

            <RecordSection
              title="People"
              icon={<UsersIcon />}
              size="sm"
              contentClassName="flex flex-col gap-3"
            >
              <DetailList
                columns={1}
                className="gap-y-3"
                items={[
                  {
                    label: "Caller",
                    value: (
                      <UserChip
                        userId={incident.callerId}
                        showTitle
                        size="md"
                      />
                    ),
                  },
                  {
                    label: "Assigned to",
                    value: (
                      <UserChip
                        userId={incident.assignedToId}
                        showTitle
                        size="md"
                        fallback="Unassigned. Pick up from the queue"
                      />
                    ),
                  },
                  {
                    label: "Assignment group",
                    value: (
                      <span>
                        {getGroup(incident.assignmentGroupId)?.name}{" "}
                        <span className="text-muted-foreground">
                          · {getGroup(incident.assignmentGroupId)?.members}{" "}
                          members
                        </span>
                      </span>
                    ),
                  },
                ]}
              />
              <Separator />
              <IncidentWatchers incident={incident} />
            </RecordSection>
          </>
        }
      >
        <RecordAiInsights
          context={{
            pathname: `/itsm/incidents/${incident.number}`,
            recordType: "incident",
            recordNumber: incident.number,
            title: incident.shortDescription,
          }}
          chips={[
            {
              label: "Suggested priority",
              value: `P${incident.priority}`,
              tone: "good",
            },
            { label: "Similar incidents", value: String(similar.length) },
            {
              label: "Correlated alerts",
              value: String(relatedAlerts.length),
              tone: relatedAlerts.length > 0 ? "warn" : "default",
            },
            { label: "Knowledge matches", value: String(suggestedKb.length) },
          ]}
          prompts={[
            "Draft a customer update",
            "What's the likely root cause?",
            "Find similar incidents",
          ]}
        />

        <RecordSection
          title="Description"
          description={`Reported by ${incident.channel.toLowerCase()} ${timeAgo(incident.opened)}`}
        >
          <p className="max-w-[72ch] text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {incident.description}
          </p>
        </RecordSection>

        <RecordSection title="Details">
          <DetailList
            columns={2}
            items={[
              {
                label: "Caller",
                value: <UserChip userId={incident.callerId} />,
              },
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
              { label: "Category", value: incident.category },
              { label: "Subcategory", value: incident.subcategory },
              {
                label: "Impact",
                value: `${incident.impact} - ${impactLabels[incident.impact]}`,
              },
              {
                label: "Urgency",
                value: `${incident.urgency} - ${urgencyLabels[incident.urgency]}`,
              },
              {
                label: "Assignment group",
                value: <GroupChip groupId={incident.assignmentGroupId} />,
              },
              {
                label: "Assigned to",
                value: <UserChip userId={incident.assignedToId} />,
              },
              { label: "Opened", value: formatDateTime(incident.opened) },
              {
                label: "Last updated",
                value: `${formatDateTime(incident.updated)} (${timeAgo(incident.updated)})`,
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
                  entries={buildActivity(
                    incident.number,
                    incident.assignedToId
                  )}
                />
              ),
            },
            {
              value: "alerts",
              label: "Alerts",
              count: relatedAlerts.length,
              content: (
                <RelatedList
                  title="Correlated alerts"
                  description="Open alerts on the affected service, plus alerts that created this incident."
                  rows={relatedAlerts}
                  getKey={(a) => a.number}
                  getHref={(a) => `/itom/alerts?alert=${a.number}`}
                  emptyMessage="No alerts are correlated with this incident."
                  viewAllHref="/itom/alerts"
                  columns={[
                    {
                      header: "Alert",
                      cell: (a) => (
                        <span className="font-mono text-xs">{a.number}</span>
                      ),
                    },
                    {
                      header: "Severity",
                      cell: (a) => <SeverityBadge severity={a.severity} />,
                    },
                    {
                      header: "Description",
                      cell: (a) => (
                        <span className="line-clamp-1">{a.description}</span>
                      ),
                    },
                    {
                      header: "Node",
                      cell: (a) => (
                        <span className="text-muted-foreground">{a.node}</span>
                      ),
                      hideOnMobile: true,
                    },
                    {
                      header: "Opened",
                      cell: (a) => (
                        <span className="text-muted-foreground">
                          {timeAgo(a.opened)}
                        </span>
                      ),
                      hideOnMobile: true,
                    },
                  ]}
                />
              ),
            },
            {
              value: "similar",
              label: "Similar incidents",
              count: similar.length,
              content: (
                <RelatedList
                  title="Same category and subcategory"
                  rows={similar}
                  getKey={(i) => i.number}
                  getHref={(i) => `/itsm/incidents/${i.number}`}
                  emptyMessage="No other incidents share this category."
                  action={{
                    label: "Link as duplicate",
                    href: "/itsm/incidents",
                  }}
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
              value: "knowledge",
              label: "Knowledge",
              count: suggestedKb.length,
              content: (
                <RelatedList
                  title="Suggested articles"
                  description="Published articles from the matching knowledge base."
                  rows={suggestedKb}
                  getKey={(k) => k.number}
                  getHref={(k) => `/itsm/knowledge/${k.number}`}
                  emptyMessage="No matching articles yet."
                  action={{ label: "Attach article", href: "/itsm/knowledge" }}
                  columns={[
                    {
                      header: "Article",
                      cell: (k) => (
                        <span className="font-mono text-xs">{k.number}</span>
                      ),
                    },
                    { header: "Title", cell: (k) => k.title },
                    {
                      header: "Helpful",
                      cell: (k) => (
                        <span className="text-muted-foreground tabular-nums">
                          {Math.round(
                            (k.helpful /
                              Math.max(1, k.helpful + k.notHelpful)) *
                              100
                          )}
                          %
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
