import type {
  AlertSeverity,
  ChangeRisk,
  ChangeType,
  Impact,
  Priority,
  Urgency,
} from "@/lib/types"

/** ITIL priority matrix: impact × urgency → priority */
export function calculatePriority(impact: Impact, urgency: Urgency): Priority {
  const matrix: Record<Impact, Record<Urgency, Priority>> = {
    1: { 1: 1, 2: 2, 3: 3 },
    2: { 1: 2, 2: 3, 3: 4 },
    3: { 1: 3, 2: 4, 3: 5 },
  }
  return matrix[impact][urgency]
}

export const priorityLabels: Record<Priority, string> = {
  1: "Critical",
  2: "High",
  3: "Moderate",
  4: "Low",
  5: "Planning",
}

export const impactLabels: Record<Impact, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
}

export const urgencyLabels: Record<Urgency, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
}

/** Resolution SLA targets in hours, by priority */
export const slaTargetHours: Record<Priority, number> = {
  1: 4,
  2: 8,
  3: 24,
  4: 72,
  5: 168,
}

export const incidentStates = [
  "New",
  "In Progress",
  "On Hold",
  "Resolved",
  "Closed",
  "Canceled",
] as const

export const incidentCategories: Record<string, string[]> = {
  Hardware: ["Laptop", "Monitor", "Printer", "Mobile device", "Peripheral"],
  Software: [
    "Operating system",
    "Business application",
    "Browser",
    "Licensing",
  ],
  Network: ["VPN", "Wi-Fi", "LAN", "DNS", "Firewall"],
  Database: ["Performance", "Availability", "Backup", "Access"],
  Inquiry: ["How-to", "Status request", "Documentation"],
  Security: ["Phishing", "Malware", "Access violation", "Lost device"],
}

export const problemStates = [
  "New",
  "Assess",
  "Root Cause Analysis",
  "Fix in Progress",
  "Resolved",
  "Closed",
] as const

export const changeStates = [
  "New",
  "Assess",
  "Authorize",
  "Scheduled",
  "Implement",
  "Review",
  "Closed",
  "Canceled",
] as const

export const changeTypes: ChangeType[] = ["Standard", "Normal", "Emergency"]
export const changeRisks: ChangeRisk[] = [
  "Low",
  "Moderate",
  "High",
  "Very High",
]

export const requestStates = [
  "Pending Approval",
  "Approved",
  "In Progress",
  "Closed Complete",
  "Closed Incomplete",
  "Closed Cancelled",
] as const

export const alertSeverities: AlertSeverity[] = [
  "Critical",
  "Major",
  "Minor",
  "Warning",
  "Info",
  "Clear",
]
