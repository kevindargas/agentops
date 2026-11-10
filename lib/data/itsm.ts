import type {
  Change,
  ChangeRisk,
  ChangeState,
  ChangeType,
  Impact,
  Incident,
  IncidentState,
  Problem,
  ProblemState,
  Request,
  RequestedItem,
  RequestStage,
  RequestState,
  Urgency,
} from "@/lib/types"
import {
  calculatePriority,
  incidentCategories,
  slaTargetHours,
} from "@/lib/constants"
import { catalogItems } from "./catalog"
import { configurationItems } from "./cmdb"
import {
  chance,
  createRng,
  daysAgo,
  daysFromNow,
  hoursAgo,
  hoursFromNow,
  int,
  NOW,
  pad,
  pick,
  weighted,
} from "./seed"
import { groups, users } from "./users"

const itilGroups = groups.filter((g) => g.type === "itil")
const requesters = users.filter(
  (u) => !["IT"].includes(u.department) || u.id === "u-001"
)
const agentsByGroup: Record<string, string[]> = {
  "g-sd": ["u-002", "u-020"],
  "g-infra": ["u-003"],
  "g-net": ["u-005"],
  "g-dba": ["u-006"],
  "g-cloud": ["u-010"],
  "g-app": ["u-011", "u-014"],
  "g-sec": ["u-009"],
  "g-sre": ["u-018"],
}

const incidentTitles: Record<string, string[]> = {
  Hardware: [
    "Laptop will not power on after update",
    "External monitor flickering when docked",
    "Printer on floor 4 jams on every job",
    "Corporate iPhone stuck in MDM enrollment",
    "Keyboard keys unresponsive on loaner device",
  ],
  Software: [
    "Excel crashes when opening finance macros",
    "SAP GUI shows 'connection refused' on launch",
    "Chrome enterprise policy blocks required extension",
    "Adobe license shows as expired",
    "Windows update loop on reboot",
  ],
  Network: [
    "Unable to connect to VPN from home office",
    "Wi-Fi drops intermittently on floor 3",
    "DNS resolution failing for internal hostnames",
    "Firewall blocking access to vendor portal",
    "Slow network performance in Madrid office",
  ],
  Database: [
    "ERP reports timing out after 30 seconds",
    "Nightly backup failed for pg-portal-prd",
    "Replication lag on HANA secondary node",
    "Read-only access request to reporting DB",
  ],
  Inquiry: [
    "How do I request a shared mailbox?",
    "Status of my laptop replacement",
    "Where is the documentation for the expense tool?",
  ],
  Security: [
    "Suspected phishing email received by finance team",
    "Malware alert on endpoint — quarantined",
    "Unauthorized access attempt to payroll system",
    "Lost laptop reported — remote wipe requested",
  ],
}

const categoryToGroup: Record<string, string> = {
  Hardware: "g-sd",
  Software: "g-app",
  Network: "g-net",
  Database: "g-dba",
  Inquiry: "g-sd",
  Security: "g-sec",
}

function buildIncidents(count: number): Incident[] {
  const rng = createRng(20261105)
  const list: Incident[] = []
  for (let i = 0; i < count; i++) {
    const n = 10000 + count - i
    const category = pick(rng, Object.keys(incidentCategories))
    const subcategory = pick(rng, incidentCategories[category])
    const impact = weighted<Impact>(rng, [
      [1, 1],
      [2, 3],
      [3, 4],
    ])
    const urgency = weighted<Urgency>(rng, [
      [1, 1],
      [2, 3],
      [3, 4],
    ])
    const priority = calculatePriority(impact, urgency)
    const state = weighted<IncidentState>(rng, [
      ["New", 3],
      ["In Progress", 5],
      ["On Hold", 2],
      ["Resolved", 3],
      ["Closed", 6],
      ["Canceled", 1],
    ])
    const isClosed =
      state === "Resolved" || state === "Closed" || state === "Canceled"
    const target = slaTargetHours[priority]
    // Open incidents: age is a fraction of the SLA target (about 1 in 5 has breached).
    // Closed incidents: opened any time in the last 40 days, resolved within ~0.2–1.3× target.
    const openedHours = isClosed
      ? int(rng, 6, 24 * 40)
      : Math.max(
          0.5,
          target * (chance(rng, 0.2) ? 1.05 + rng() * 0.8 : 0.05 + rng() * 0.85)
        )
    const opened = hoursAgo(openedHours)
    const slaDue = new Date(
      new Date(opened).getTime() + target * 3_600_000
    ).toISOString()
    const resolveAfter = isClosed
      ? target * (chance(rng, 0.15) ? 1.05 + rng() * 0.5 : 0.15 + rng() * 0.8)
      : undefined
    const resolved =
      resolveAfter !== undefined
        ? new Date(
            new Date(opened).getTime() +
              Math.min(resolveAfter, openedHours) * 3_600_000
          ).toISOString()
        : undefined
    const slaBreached = isClosed
      ? resolved !== undefined && new Date(resolved) > new Date(slaDue)
      : new Date(slaDue) < NOW
    const groupId = categoryToGroup[category]
    const assigned =
      state === "New"
        ? chance(rng, 0.3)
          ? pick(rng, agentsByGroup[groupId])
          : undefined
        : pick(rng, agentsByGroup[groupId])
    const ci = chance(rng, 0.7) ? pick(rng, configurationItems).id : undefined
    const majorIncident = priority === 1 && chance(rng, 0.5)
    list.push({
      number: `INC${pad(n)}`,
      shortDescription: pick(rng, incidentTitles[category]),
      description:
        "User reports the issue started this morning and is impacting their ability to work. Troubleshooting steps attempted so far: restart, re-authentication. Awaiting further diagnosis.",
      callerId: pick(rng, requesters).id,
      category,
      subcategory,
      impact,
      urgency,
      priority,
      state,
      assignmentGroupId: groupId,
      assignedToId: assigned,
      ciId: ci,
      channel: weighted(rng, [
        ["Self-service", 5],
        ["Phone", 3],
        ["Email", 3],
        ["Chat", 2],
        ["Walk-in", 1],
        ["Monitoring", 1],
      ]),
      opened,
      updated: hoursAgo(
        Math.min(openedHours, rng() * Math.min(openedHours, 48))
      ),
      resolved,
      slaDue,
      slaBreached,
      majorIncident,
      problemId: chance(rng, 0.2)
        ? `PRB${pad(int(rng, 40001, 40012))}`
        : undefined,
      changeId: chance(rng, 0.1)
        ? `CHG${pad(int(rng, 31101, 31125))}`
        : undefined,
      reopenCount: chance(rng, 0.1) ? 1 : 0,
    })
  }
  // Headline open P1 at the top for demo richness
  list[0] = {
    ...list[0],
    number: "INC0010078",
    shortDescription: "Payments API returning 5xx for 12% of checkout requests",
    description:
      "Synthetic monitors and customer reports indicate elevated error rates on the Payments API since 13:42 UTC. payments-svc pods are crash-looping on eks-prod-east after the 14:05 deploy.",
    callerId: "u-018",
    category: "Software",
    subcategory: "Business application",
    impact: 1,
    urgency: 1,
    priority: 1,
    state: "In Progress",
    assignmentGroupId: "g-sre",
    assignedToId: "u-018",
    ciId: "ci-004",
    channel: "Monitoring",
    opened: hoursAgo(0.8),
    updated: hoursAgo(0.1),
    resolved: undefined,
    slaDue: hoursFromNow(3.2),
    slaBreached: false,
    majorIncident: true,
    problemId: "PRB0040011",
    changeId: "CHG0031118",
    reopenCount: 0,
  }
  return list
}

export const incidents: Incident[] = buildIncidents(72)

export function getIncident(number: string) {
  return incidents.find((i) => i.number === number)
}

const problemTitles = [
  "Recurring Outlook credential prompts after tenant migration",
  "Intermittent Wi-Fi disconnects on HQ floors 3–5",
  "HANA replication lag during month-end close",
  "VPN tunnel resets every 8 hours for macOS clients",
  "Printer driver crashes on Windows 11 24H2",
  "Portal search returns stale results after deploys",
  "ERP batch jobs exceed window on Sundays",
  "MFA push notifications delayed > 60s",
  "Laptop docking stations fail to detect 4K monitors",
  "Slow logon times at Madrid site",
  "payments-svc crash loop under memory pressure",
  "Backups silently skipping encrypted volumes",
]

function buildProblems(): Problem[] {
  const rng = createRng(4001)
  return problemTitles.map((title, i) => {
    const state = weighted<ProblemState>(rng, [
      ["New", 1],
      ["Assess", 2],
      ["Root Cause Analysis", 3],
      ["Fix in Progress", 3],
      ["Resolved", 1],
      ["Closed", 2],
    ])
    const group = pick(rng, itilGroups)
    const opened = daysAgo(int(rng, 2, 120))
    const knownError =
      ["Root Cause Analysis", "Fix in Progress", "Resolved"].includes(state) &&
      chance(rng, 0.6)
    return {
      number: `PRB${pad(40001 + i)}`,
      shortDescription: title,
      state,
      priority: weighted(rng, [
        [1, 1],
        [2, 3],
        [3, 4],
        [4, 2],
      ]),
      assignmentGroupId: group.id,
      assignedToId: pick(rng, agentsByGroup[group.id] ?? ["u-002"]),
      ciId: chance(rng, 0.8) ? pick(rng, configurationItems).id : undefined,
      relatedIncidents: int(rng, 2, 48),
      knownError,
      workaround: knownError
        ? "Documented workaround available in linked knowledge article. Apply until permanent fix is deployed."
        : undefined,
      rootCause: ["Fix in Progress", "Resolved", "Closed"].includes(state)
        ? "Root cause identified: configuration drift introduced by an unreviewed change. Permanent fix tracked via linked change request."
        : undefined,
      opened,
      updated: hoursAgo(int(rng, 1, 96)),
    }
  })
}

export const problems: Problem[] = buildProblems()
export function getProblem(number: string) {
  return problems.find((p) => p.number === number)
}

const changeTemplates: {
  title: string
  type: ChangeType
  category: string
  group: string
  ci?: string
}[] = [
  {
    title: "Upgrade core switch firmware to NX-OS 10.4(4)",
    type: "Normal",
    category: "Network",
    group: "g-net",
    ci: "ci-015",
  },
  {
    title: "Patch Windows domain controllers — November CU",
    type: "Standard",
    category: "Server",
    group: "g-infra",
    ci: "ci-020",
  },
  {
    title: "Rotate TLS certificates on lb-portal-prd",
    type: "Standard",
    category: "Security",
    group: "g-cloud",
    ci: "ci-016",
  },
  {
    title: "Scale eks-prod-east node group to m7g.2xlarge",
    type: "Normal",
    category: "Cloud",
    group: "g-cloud",
    ci: "ci-012",
  },
  {
    title: "SAP S/4HANA support pack stack upgrade",
    type: "Normal",
    category: "Application",
    group: "g-app",
    ci: "ci-002",
  },
  {
    title: "Emergency rollback of payments-svc v2.14.0",
    type: "Emergency",
    category: "Application",
    group: "g-sre",
    ci: "ci-008",
  },
  {
    title: "Enable MFA number matching for all users",
    type: "Normal",
    category: "Security",
    group: "g-sec",
  },
  {
    title: "Migrate pg-portal-prd to PostgreSQL 17",
    type: "Normal",
    category: "Database",
    group: "g-dba",
    ci: "ci-011",
  },
  {
    title: "Replace failed PSU in sw-core-east-01",
    type: "Emergency",
    category: "Hardware",
    group: "g-net",
    ci: "ci-015",
  },
  {
    title: "Deploy Wi-Fi controller firmware 17.12.3",
    type: "Normal",
    category: "Network",
    group: "g-net",
    ci: "ci-028",
  },
  {
    title: "Add DR cluster eks-prod-west to service mesh",
    type: "Normal",
    category: "Cloud",
    group: "g-cloud",
    ci: "ci-027",
  },
  {
    title: "Monthly Linux patching — SAP application tier",
    type: "Standard",
    category: "Server",
    group: "g-infra",
    ci: "ci-009",
  },
  {
    title: "Decommission legacy-fileshare-01",
    type: "Normal",
    category: "Server",
    group: "g-infra",
    ci: "ci-026",
  },
  {
    title: "Increase HANA memory allocation to 4 TB",
    type: "Normal",
    category: "Database",
    group: "g-dba",
    ci: "ci-010",
  },
  {
    title: "Firewall rule: allow vendor SFTP from finance subnet",
    type: "Standard",
    category: "Network",
    group: "g-net",
    ci: "ci-014",
  },
  {
    title: "Expand NetApp aggregate aggr1 by 40 TB",
    type: "Normal",
    category: "Storage",
    group: "g-infra",
    ci: "ci-017",
  },
  {
    title: "Portal release 2026.11 — checkout redesign",
    type: "Normal",
    category: "Application",
    group: "g-app",
    ci: "ci-006",
  },
  {
    title: "Hotfix: payments-svc memory leak in retry handler",
    type: "Emergency",
    category: "Application",
    group: "g-sre",
    ci: "ci-008",
  },
  {
    title: "Rotate Redis auth tokens",
    type: "Standard",
    category: "Security",
    group: "g-sre",
    ci: "ci-023",
  },
  {
    title: "Enable S3 Object Lock on portal assets bucket",
    type: "Normal",
    category: "Cloud",
    group: "g-cloud",
    ci: "ci-022",
  },
  {
    title: "Jenkins upgrade to LTS 2.516",
    type: "Standard",
    category: "Application",
    group: "g-infra",
    ci: "ci-019",
  },
  {
    title: "Salesforce Winter '27 release validation",
    type: "Normal",
    category: "Application",
    group: "g-app",
    ci: "ci-025",
  },
  {
    title: "VPN gateway capacity upgrade (PA-3440 → PA-5420)",
    type: "Normal",
    category: "Network",
    group: "g-net",
    ci: "ci-018",
  },
  {
    title: "Quarterly DR failover test — ERP",
    type: "Normal",
    category: "Application",
    group: "g-app",
    ci: "ci-002",
  },
  {
    title: "Apply CIS benchmark hardening to AD tier",
    type: "Normal",
    category: "Security",
    group: "g-sec",
    ci: "ci-021",
  },
]

function buildChanges(): Change[] {
  const rng = createRng(3111)
  return changeTemplates.map((t, i) => {
    const state: ChangeState =
      t.type === "Emergency"
        ? weighted(rng, [
            ["Implement", 2],
            ["Review", 1],
            ["Closed", 2],
          ])
        : weighted(rng, [
            ["New", 2],
            ["Assess", 3],
            ["Authorize", 3],
            ["Scheduled", 4],
            ["Implement", 2],
            ["Review", 2],
            ["Closed", 5],
            ["Canceled", 1],
          ])
    const risk: ChangeRisk =
      t.type === "Standard"
        ? "Low"
        : weighted(rng, [
            ["Low", 2],
            ["Moderate", 4],
            ["High", 3],
            ["Very High", 1],
          ])
    const impact: Impact =
      risk === "Very High" || risk === "High" ? 1 : risk === "Moderate" ? 2 : 3
    const startOffset = ["Closed", "Review", "Implement"].includes(state)
      ? -int(rng, 1, 30)
      : int(rng, 1, 21)
    const plannedStart = new Date(NOW.getTime() + startOffset * 86_400_000)
    plannedStart.setUTCHours(int(rng, 18, 23), 0, 0, 0)
    const plannedEnd = new Date(
      plannedStart.getTime() + int(rng, 1, 6) * 3_600_000
    )
    const approval =
      state === "New" || state === "Assess"
        ? "Not Yet Requested"
        : state === "Authorize"
          ? "Requested"
          : state === "Canceled"
            ? chance(rng, 0.5)
              ? "Rejected"
              : "Not Yet Requested"
            : "Approved"
    return {
      number: `CHG${pad(31101 + i)}`,
      shortDescription: t.title,
      description: `${t.title}. This change has been reviewed for impact on dependent services via CMDB relationships. Communication to affected stakeholders is scheduled 48 hours prior to implementation.`,
      type: t.type,
      state,
      risk,
      impact,
      priority: calculatePriority(impact, t.type === "Emergency" ? 1 : 2),
      category: t.category,
      assignmentGroupId: t.group,
      assignedToId: pick(rng, agentsByGroup[t.group] ?? ["u-003"]),
      requestedById: pick(rng, [
        "u-004",
        "u-003",
        "u-010",
        "u-011",
        "u-005",
        "u-018",
      ]),
      ciId: t.ci,
      approval,
      cabRequired: t.type === "Normal" && risk !== "Low",
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      opened: daysAgo(int(rng, 3, 45)),
      updated: hoursAgo(int(rng, 1, 72)),
      implementationPlan:
        "1. Announce start in #change-calendar.\n2. Snapshot / backup affected systems.\n3. Apply change per runbook.\n4. Execute smoke tests.\n5. Announce completion and monitor for 2 hours.",
      backoutPlan:
        "Restore from pre-change snapshot and revert configuration to the previous validated baseline. Estimated backout time: 45 minutes.",
      testPlan:
        "Synthetic transaction checks, dependent service health checks, and stakeholder UAT sign-off within the maintenance window.",
    }
  })
}

export const changes: Change[] = buildChanges()
export function getChange(number: string) {
  return changes.find((c) => c.number === number)
}

function buildRequests(count: number): Request[] {
  const rng = createRng(9091)
  const list: Request[] = []
  let ritmCounter = 50200
  let taskCounter = 70400
  for (let i = 0; i < count; i++) {
    const n = 20300 + count - i
    const requestedFor = pick(rng, requesters)
    const requestedBy = chance(rng, 0.85) ? requestedFor : pick(rng, requesters)
    const state = weighted<RequestState>(rng, [
      ["Pending Approval", 3],
      ["Approved", 2],
      ["In Progress", 4],
      ["Closed Complete", 6],
      ["Closed Incomplete", 1],
      ["Closed Cancelled", 1],
    ])
    const stage: RequestStage =
      state === "Pending Approval"
        ? "Waiting for Approval"
        : state === "Approved"
          ? "Fulfillment"
          : state === "In Progress"
            ? pick(rng, ["Fulfillment", "Delivery"])
            : state === "Closed Cancelled"
              ? "Cancelled"
              : "Completed"
    const itemCount = weighted(rng, [
      [1, 7],
      [2, 2],
      [3, 1],
    ])
    const items: RequestedItem[] = []
    for (let j = 0; j < itemCount; j++) {
      const cat = pick(rng, catalogItems)
      const tasks = []
      const taskCount = stage === "Waiting for Approval" ? 0 : int(rng, 1, 2)
      for (let k = 0; k < taskCount; k++) {
        tasks.push({
          number: `SCTASK${pad(taskCounter++)}`,
          shortDescription:
            k === 0
              ? `Fulfill: ${cat.name}`
              : `Deliver and confirm receipt: ${cat.name}`,
          state: state.startsWith("Closed")
            ? ("Closed Complete" as const)
            : k === 0
              ? ("Work in Progress" as const)
              : ("Open" as const),
          assignmentGroupId: cat.fulfillmentGroupId,
          assignedToId: chance(rng, 0.6)
            ? pick(
                rng,
                users.filter((u) => u.department === "IT")
              ).id
            : undefined,
          due: daysFromNow(int(rng, 0, cat.deliveryDays + 2)),
        })
      }
      items.push({
        number: `RITM${pad(ritmCounter++)}`,
        catalogItemId: cat.id,
        quantity: cat.category === "Hardware" && chance(rng, 0.2) ? 2 : 1,
        state,
        stage,
        assignmentGroupId: cat.fulfillmentGroupId,
        tasks,
        variables: {
          Justification: "Required for role responsibilities.",
          "Cost center": `CC-${int(rng, 1000, 9999)}`,
          "Delivery location": requestedFor.location,
        },
      })
    }
    const openedDays = int(rng, 0, 30)
    list.push({
      number: `REQ${pad(n)}`,
      requestedForId: requestedFor.id,
      requestedById: requestedBy.id,
      state,
      stage,
      approval:
        state === "Pending Approval"
          ? "Requested"
          : state === "Closed Cancelled"
            ? "Rejected"
            : "Approved",
      items,
      price: items.reduce(
        (acc, it) =>
          acc +
          (catalogItems.find((c) => c.id === it.catalogItemId)?.price ?? 0) *
            it.quantity,
        0
      ),
      opened: daysAgo(openedDays),
      updated: hoursAgo(int(rng, 0, Math.max(1, openedDays * 24))),
      dueDate: daysFromNow(int(rng, -2, 7)),
    })
  }
  return list
}

export const requests: Request[] = buildRequests(36)
export function getRequest(number: string) {
  return requests.find((r) => r.number === number)
}
