import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardCheckIcon, RouteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { recordHref } from "@/components/shared/record-link"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { MyWorkBoard, type WorkItem } from "@/features/workspace/my-work-board"
import {
  agentTraces,
  approvals,
  changes,
  deployedAgents,
  driftSignals,
  experiments,
  getCatalogItem,
  getDeployedAgent,
  getGroup,
  hoursAgo,
  incidents,
  knowledgeArticles,
  NOW,
  requests,
  reviewItems,
} from "@/lib/data"
import { currentUser } from "@/lib/data/users"

export const metadata: Metadata = { title: "My Work" }

export default function MyWorkPage() {
  const me = currentUser.id
  const openInc = incidents.filter(
    (i) => !["Resolved", "Closed", "Canceled"].includes(i.state)
  )

  const assigned: WorkItem[] = [
    ...openInc
      .filter((i) => i.assignedToId === me)
      .map<WorkItem>((i) => ({
        number: i.number,
        title: i.shortDescription,
        type: "Incident",
        state: i.state,
        priority: i.priority,
        href: `/itsm/incidents/${i.number}`,
        updated: i.updated,
        due: i.slaDue,
        attention: i.slaBreached || i.priority === 1,
        meta: `${getGroup(i.assignmentGroupId)?.name} · ${i.category}`,
        personId: i.callerId,
        personLabel: "Caller",
      })),
    ...changes
      .filter(
        (c) =>
          c.assignedToId === me && !["Closed", "Canceled"].includes(c.state)
      )
      .map<WorkItem>((c) => ({
        number: c.number,
        title: c.shortDescription,
        type: "Change",
        state: c.state,
        priority: c.priority,
        href: `/itsm/changes/${c.number}`,
        updated: c.updated,
        due: c.plannedStart,
        attention: c.type === "Emergency" || c.risk === "Very High",
        meta: `${c.type} · ${c.risk} risk`,
      })),
    ...reviewItems
      .filter((r) => r.assignedToId === me && r.status === "Pending")
      .map<WorkItem>((r) => ({
        number: r.id,
        title: `${r.reason} · ${getDeployedAgent(r.agentId)?.name ?? r.agentId}`,
        type: "Review",
        state: r.status,
        priority: r.priority,
        href: "/agentops/reviews",
        updated: r.created,
        due: new Date(
          new Date(r.created).getTime() + 48 * 3_600_000
        ).toISOString(),
        attention: r.priority === 1,
        meta: `Trace ${r.traceId}`,
      })),
    ...experiments
      .filter((e) => e.ownerId === me && e.status !== "Completed")
      .map<WorkItem>((e) => ({
        number: e.id,
        title: e.name,
        type: "Experiment",
        state: e.status,
        href: `/agentops/experiments?open=${e.id}`,
        updated: e.started,
        due: e.ends,
        meta: `${e.kind} · ${e.split}% to B · ${Math.round(e.significance * 100)}% significance`,
      })),
  ].sort(
    (a, b) =>
      Number(b.attention ?? false) - Number(a.attention ?? false) ||
      (a.priority ?? 9) - (b.priority ?? 9)
  )

  const myApprovals: WorkItem[] = approvals
    .filter((a) => a.approverId === me && a.state === "Requested")
    .map<WorkItem>((a) => ({
      number: a.recordNumber,
      title: a.shortDescription,
      type:
        a.recordType === "Change"
          ? "Change"
          : a.recordType === "Request"
            ? "Request"
            : "Knowledge",
      state: a.state,
      href: recordHref(a.recordNumber),
      updated: a.requested,
      due: a.due,
      attention: new Date(a.due).getTime() - NOW.getTime() < 36 * 3_600_000,
      personId: a.requestedById,
      personLabel: "Requested by",
    }))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))

  const requested: WorkItem[] = [
    ...incidents
      .filter((i) => i.callerId === me)
      .slice(0, 6)
      .map<WorkItem>((i) => ({
        number: i.number,
        title: i.shortDescription,
        type: "Incident",
        state: i.state,
        priority: i.priority,
        href: `/itsm/incidents/${i.number}`,
        updated: i.updated,
        meta: `${i.channel} · ${getGroup(i.assignmentGroupId)?.name}`,
        personId: i.assignedToId,
        personLabel: "Assigned to",
      })),
    ...requests
      .filter((r) => r.requestedForId === me || r.requestedById === me)
      .map<WorkItem>((r) => ({
        number: r.number,
        title: r.items
          .map((i) => getCatalogItem(i.catalogItemId)?.name ?? i.catalogItemId)
          .join(", "),
        type: "Request",
        state: r.state,
        href: `/itsm/requests/${r.number}`,
        updated: r.updated,
        due: r.state.startsWith("Closed") ? undefined : r.dueDate,
        meta: r.stage,
      })),
    ...changes
      .filter((c) => c.requestedById === me)
      .slice(0, 4)
      .map<WorkItem>((c) => ({
        number: c.number,
        title: c.shortDescription,
        type: "Change",
        state: c.state,
        priority: c.priority,
        href: `/itsm/changes/${c.number}`,
        updated: c.updated,
        meta: `${c.type} · ${c.risk} risk`,
        personId: c.assignedToId,
        personLabel: "Assigned to",
      })),
  ].sort((a, b) => b.updated.localeCompare(a.updated))

  // Deterministic "recently viewed" trail: a handful of hot records with fixed view times.
  const recentSources: {
    item: WorkItem | undefined
    viewedHoursAgo: number
  }[] = [
    {
      item: toIncident(incidents.find((i) => i.majorIncident)),
      viewedHoursAgo: 0.3,
    },
    {
      item: toChange(changes.find((c) => c.approval === "Requested")),
      viewedHoursAgo: 1.2,
    },
    {
      item: toKnowledge(
        knowledgeArticles
          .filter((k) => k.state === "Published")
          .sort((a, b) => b.views - a.views)[0]
      ),
      viewedHoursAgo: 3,
    },
    {
      item: toAgent(deployedAgents.find((a) => a.health === "Drifting")),
      viewedHoursAgo: 2,
    },
    {
      item: toTrace(agentTraces.find((t) => t.status === "Needs review")),
      viewedHoursAgo: 5,
    },
    {
      item: toIncident(openInc.find((i) => i.slaBreached && !i.majorIncident)),
      viewedHoursAgo: 7,
    },
  ]
  const recent = recentSources.flatMap(({ item, viewedHoursAgo }) =>
    item ? [{ ...item, updated: hoursAgo(viewedHoursAgo) }] : []
  )

  const attention = assigned.filter((i) => i.attention).length
  const myReviews = assigned.filter((i) => i.type === "Review")
  const openDrift = driftSignals.filter((d) => d.state === "Open").length

  return (
    <>
      <PageHeader
        nav="/my-work"
        description="Everything on your plate in one place: agent answers waiting for your review, experiments you own, records assigned to you and approvals waiting on your decision."
        actions={
          <>
            <Button variant="outline" render={<Link href="/agentops/traces" />}>
              <RouteIcon /> Explore traces
            </Button>
            <Button render={<Link href="/agentops/reviews" />}>
              <ClipboardCheckIcon /> Open Review Queue
            </Button>
          </>
        }
      />
      <StatGrid columns={4}>
        <StatCard
          label="Assigned to me"
          value={assigned.length}
          hint={`${myReviews.length} reviews · ${assigned.filter((i) => i.type === "Incident").length} incidents · ${assigned.filter((i) => i.type === "Change").length} changes`}
        />
        <StatCard
          label="Reviews waiting"
          value={myReviews.length}
          href="/agentops/reviews"
          hint={`${myReviews.filter((r) => r.priority === 1).length} policy matches · ${openDrift} open drift signal${openDrift === 1 ? "" : "s"} fleet-wide`}
        />
        <StatCard
          label="Needs attention"
          value={attention}
          upIsGood={false}
          hint="Policy matches, breached SLA, P1 or overdue"
        />
        <StatCard
          label="Pending approvals"
          value={myApprovals.length}
          hint={
            <Link
              href="/approvals"
              className="underline-offset-4 hover:underline"
            >
              Review approvals
            </Link>
          }
        />
      </StatGrid>
      <MyWorkBoard
        sections={{ assigned, approvals: myApprovals, requested, recent }}
        nowIso={NOW.toISOString()}
      />
    </>
  )
}

function toIncident(
  i: (typeof incidents)[number] | undefined
): WorkItem | undefined {
  if (!i) return undefined
  return {
    number: i.number,
    title: i.shortDescription,
    type: "Incident",
    state: i.state,
    priority: i.priority,
    href: `/itsm/incidents/${i.number}`,
    updated: i.updated,
    meta: `${getGroup(i.assignmentGroupId)?.name} · ${i.category}`,
    attention: i.slaBreached,
  }
}
function toChange(
  c: (typeof changes)[number] | undefined
): WorkItem | undefined {
  if (!c) return undefined
  return {
    number: c.number,
    title: c.shortDescription,
    type: "Change",
    state: c.state,
    priority: c.priority,
    href: `/itsm/changes/${c.number}`,
    updated: c.updated,
    meta: `${c.type} · ${c.risk} risk`,
  }
}
function toKnowledge(
  k: (typeof knowledgeArticles)[number] | undefined
): WorkItem | undefined {
  if (!k) return undefined
  return {
    number: k.number,
    title: k.title,
    type: "Knowledge",
    state: k.state,
    href: `/itsm/knowledge/${k.number}`,
    updated: k.updated,
    meta: `${k.knowledgeBase} · ${k.views.toLocaleString("en-US")} views`,
  }
}
function toAgent(
  a: (typeof deployedAgents)[number] | undefined
): WorkItem | undefined {
  if (!a) return undefined
  return {
    number: a.id,
    title: a.name,
    type: "Agent",
    state: a.health,
    href: `/agentops/agents/${a.id}`,
    updated: a.lastDeployed,
    meta: `${a.framework} ${a.version} · ${a.modelId.split("/")[1]}`,
    attention: a.health === "Drifting",
  }
}
function toTrace(
  t: (typeof agentTraces)[number] | undefined
): WorkItem | undefined {
  if (!t) return undefined
  return {
    number: t.id,
    title: t.userQuery,
    type: "Trace",
    state: t.status,
    href: `/agentops/traces/${t.id}`,
    updated: t.startedAt,
    meta: `${getDeployedAgent(t.agentId)?.name ?? t.agentId} · ${t.channel}`,
  }
}
