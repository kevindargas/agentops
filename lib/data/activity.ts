import type { ActivityEntry, Approval, Notification } from "@/lib/types"
import { changes, requests } from "./itsm"
import { daysFromNow, hoursAgo } from "./seed"

/** Generic activity stream used by every record page. */
export function buildActivity(
  recordNumber: string,
  assigneeId?: string
): ActivityEntry[] {
  const agent = assigneeId ?? "u-002"
  return [
    {
      id: `${recordNumber}-a5`,
      recordNumber,
      type: "work_note",
      authorId: agent,
      body: "Reviewed logs and correlated with monitoring alerts. Narrowing down to the 14:05 deployment. Engaging the application owner for a rollback decision.",
      timestamp: hoursAgo(0.4),
    },
    {
      id: `${recordNumber}-a4`,
      recordNumber,
      type: "field_change",
      authorId: agent,
      body: "",
      timestamp: hoursAgo(1.1),
      fieldChanges: [
        { field: "State", from: "New", to: "In Progress" },
        { field: "Assigned to", from: "—", to: "Self" },
      ],
    },
    {
      id: `${recordNumber}-a3`,
      recordNumber,
      type: "comment",
      authorId: "u-001",
      body: "Is there an ETA on this? Several teams are blocked and leadership is asking for an update.",
      timestamp: hoursAgo(1.5),
    },
    {
      id: `${recordNumber}-a2`,
      recordNumber,
      type: "email",
      authorId: "u-002",
      body: 'Notification sent to caller: "Your record has been received and is being worked by our team."',
      timestamp: hoursAgo(2.2),
    },
    {
      id: `${recordNumber}-a1`,
      recordNumber,
      type: "system",
      authorId: "u-002",
      body: "Record created via Self-service portal. Priority calculated from Impact × Urgency.",
      timestamp: hoursAgo(2.3),
    },
  ]
}

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "P1 Major Incident declared",
    body: "INC0010078 — Payments API returning 5xx. You are on the bridge.",
    timestamp: hoursAgo(0.7),
    read: false,
    type: "sla",
    href: "/itsm/incidents/INC0010078",
  },
  {
    id: "n2",
    title: "Approval requested",
    body: "CHG0031104 — Scale eks-prod-east node group. CAB review Thursday.",
    timestamp: hoursAgo(2),
    read: false,
    type: "approval",
    href: "/itsm/changes/CHG0031104",
  },
  {
    id: "n3",
    title: "Assigned to you",
    body: "REQ0020335 — New Hire Account Setup for Liam O'Connor.",
    timestamp: hoursAgo(5),
    read: false,
    type: "assignment",
    href: "/itsm/requests/REQ0020335",
  },
  {
    id: "n4",
    title: "SLA breach warning",
    body: "INC0010052 will breach resolution SLA in 45 minutes.",
    timestamp: hoursAgo(6),
    read: true,
    type: "sla",
    href: "/itsm/incidents/INC0010052",
  },
  {
    id: "n5",
    title: "You were mentioned",
    body: "Priya Natarajan mentioned you in CHG0031101 work notes.",
    timestamp: hoursAgo(20),
    read: true,
    type: "mention",
    href: "/itsm/changes/CHG0031101",
  },
  {
    id: "n6",
    title: "Drift signal opened",
    body: "IT Helpdesk Copilot: topic mix shift (PSI 0.31) against baseline.",
    timestamp: hoursAgo(12),
    read: true,
    type: "system",
    href: "/agentops/drift",
  },
]

export const approvals: Approval[] = [
  ...changes
    .filter((c) => c.approval === "Requested")
    .map<Approval>((c) => ({
      id: `apr-${c.number}`,
      recordNumber: c.number,
      recordType: "Change",
      shortDescription: c.shortDescription,
      requestedById: c.requestedById,
      approverId: "u-001",
      state: "Requested",
      requested: c.updated,
      due: daysFromNow(2),
    })),
  ...requests
    .filter((r) => r.approval === "Requested")
    .slice(0, 5)
    .map<Approval>((r) => ({
      id: `apr-${r.number}`,
      recordNumber: r.number,
      recordType: "Request",
      shortDescription: `${r.items.length} item(s) requested for ${r.requestedForId}`,
      requestedById: r.requestedById,
      approverId: "u-001",
      state: "Requested",
      requested: r.opened,
      due: daysFromNow(1),
    })),
]
