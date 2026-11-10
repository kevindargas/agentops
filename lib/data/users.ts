import type { Group, User } from "@/lib/types"

export const users: User[] = [
  {
    id: "u-001",
    name: "Kevin Dargas",
    email: "kevin.dargas@agentops.dev",
    title: "Platform Owner",
    department: "IT",
    location: "San Francisco",
    vip: true,
  },
  {
    id: "u-002",
    name: "Amara Okafor",
    email: "amara.okafor@agentops.dev",
    title: "Service Desk Lead",
    department: "IT",
    location: "Austin",
  },
  {
    id: "u-003",
    name: "Diego Ramírez",
    email: "diego.ramirez@agentops.dev",
    title: "Infrastructure Engineer",
    department: "IT",
    location: "Madrid",
  },
  {
    id: "u-004",
    name: "Priya Natarajan",
    email: "priya.natarajan@agentops.dev",
    title: "Change Manager",
    department: "IT",
    location: "Bangalore",
  },
  {
    id: "u-005",
    name: "Lars Eriksen",
    email: "lars.eriksen@agentops.dev",
    title: "Network Engineer",
    department: "IT",
    location: "Oslo",
  },
  {
    id: "u-006",
    name: "Mei Tanaka",
    email: "mei.tanaka@agentops.dev",
    title: "Database Administrator",
    department: "IT",
    location: "Tokyo",
  },
  {
    id: "u-007",
    name: "Sofia Rossi",
    email: "sofia.rossi@agentops.dev",
    title: "HR Business Partner",
    department: "People",
    location: "Milan",
  },
  {
    id: "u-008",
    name: "Jamal Washington",
    email: "jamal.washington@agentops.dev",
    title: "Payroll Specialist",
    department: "People",
    location: "Chicago",
  },
  {
    id: "u-009",
    name: "Hannah Müller",
    email: "hannah.mueller@agentops.dev",
    title: "Security Analyst",
    department: "Security",
    location: "Berlin",
  },
  {
    id: "u-010",
    name: "Tomás Silva",
    email: "tomas.silva@agentops.dev",
    title: "Cloud Architect",
    department: "IT",
    location: "Lisbon",
  },
  {
    id: "u-011",
    name: "Grace Kim",
    email: "grace.kim@agentops.dev",
    title: "Application Owner, ERP",
    department: "Finance Systems",
    location: "Seoul",
  },
  {
    id: "u-012",
    name: "Oliver Bennett",
    email: "oliver.bennett@agentops.dev",
    title: "Facilities Manager",
    department: "Facilities",
    location: "London",
  },
  {
    id: "u-013",
    name: "Fatima Al-Sayed",
    email: "fatima.alsayed@agentops.dev",
    title: "Sales Director",
    department: "Sales",
    location: "Dubai",
    vip: true,
  },
  {
    id: "u-014",
    name: "Noah Fischer",
    email: "noah.fischer@agentops.dev",
    title: "Software Engineer",
    department: "Engineering",
    location: "Zurich",
  },
  {
    id: "u-015",
    name: "Isabella Costa",
    email: "isabella.costa@agentops.dev",
    title: "Marketing Manager",
    department: "Marketing",
    location: "São Paulo",
  },
  {
    id: "u-016",
    name: "Ethan Walsh",
    email: "ethan.walsh@agentops.dev",
    title: "Financial Analyst",
    department: "Finance",
    location: "Dublin",
  },
  {
    id: "u-017",
    name: "Chloé Dubois",
    email: "chloe.dubois@agentops.dev",
    title: "Product Designer",
    department: "Design",
    location: "Paris",
  },
  {
    id: "u-018",
    name: "Arjun Mehta",
    email: "arjun.mehta@agentops.dev",
    title: "Site Reliability Engineer",
    department: "IT",
    location: "Pune",
  },
  {
    id: "u-019",
    name: "Zainab Hussain",
    email: "zainab.hussain@agentops.dev",
    title: "Legal Counsel",
    department: "Legal",
    location: "Toronto",
  },
  {
    id: "u-020",
    name: "Mateo García",
    email: "mateo.garcia@agentops.dev",
    title: "Support Engineer",
    department: "IT",
    location: "Mexico City",
  },
  {
    id: "u-021",
    name: "Yuki Sato",
    email: "yuki.sato@agentops.dev",
    title: "Asset Manager",
    department: "IT",
    location: "Osaka",
  },
  {
    id: "u-022",
    name: "Liam O'Connor",
    email: "liam.oconnor@agentops.dev",
    title: "New Hire: Data Analyst",
    department: "Analytics",
    location: "Dublin",
  },
  {
    id: "u-023",
    name: "Ava Thompson",
    email: "ava.thompson@agentops.dev",
    title: "New Hire: Account Executive",
    department: "Sales",
    location: "New York",
  },
  {
    id: "u-024",
    name: "Ibrahim Yilmaz",
    email: "ibrahim.yilmaz@agentops.dev",
    title: "Operations Analyst",
    department: "Operations",
    location: "Istanbul",
  },
]

export const groups: Group[] = [
  {
    id: "g-sd",
    name: "Service Desk",
    type: "itil",
    manager: "u-002",
    members: 14,
    description: "First-line support for all employee requests and incidents.",
  },
  {
    id: "g-infra",
    name: "Infrastructure",
    type: "itil",
    manager: "u-003",
    members: 9,
    description: "Servers, virtualization, storage and data center operations.",
  },
  {
    id: "g-net",
    name: "Network Operations",
    type: "itil",
    manager: "u-005",
    members: 6,
    description: "LAN/WAN, Wi-Fi, firewalls and load balancers.",
  },
  {
    id: "g-dba",
    name: "Database Services",
    type: "itil",
    manager: "u-006",
    members: 5,
    description:
      "Database administration for Oracle, PostgreSQL and SQL Server.",
  },
  {
    id: "g-cloud",
    name: "Cloud Platform",
    type: "itil",
    manager: "u-010",
    members: 8,
    description: "AWS, Azure and Kubernetes platform engineering.",
  },
  {
    id: "g-app",
    name: "Application Support",
    type: "itil",
    manager: "u-011",
    members: 11,
    description: "ERP, CRM and internal business application support.",
  },
  {
    id: "g-sec",
    name: "Security Operations",
    type: "itil",
    manager: "u-009",
    members: 7,
    description: "SOC monitoring, vulnerability response and IAM.",
  },
  {
    id: "g-sre",
    name: "Site Reliability",
    type: "itil",
    manager: "u-018",
    members: 6,
    description:
      "Observability, on-call and incident command for digital services.",
  },
  {
    id: "g-cab",
    name: "Change Advisory Board",
    type: "cab",
    manager: "u-004",
    members: 9,
    description:
      "Weekly review and authorization of normal and emergency changes.",
  },
  {
    id: "g-hw",
    name: "Hardware Fulfillment",
    type: "fulfillment",
    manager: "u-021",
    members: 4,
    description: "Procures, images and ships end-user hardware.",
  },
  {
    id: "g-iam",
    name: "Identity & Access",
    type: "fulfillment",
    manager: "u-009",
    members: 5,
    description: "Account provisioning, group membership and access reviews.",
  },
  {
    id: "g-hr",
    name: "HR Shared Services",
    type: "hr",
    manager: "u-007",
    members: 12,
    description: "Tier-1 HR case handling for all regions.",
  },
  {
    id: "g-payroll",
    name: "Payroll Operations",
    type: "hr",
    manager: "u-008",
    members: 5,
    description: "Payroll corrections, tax forms and compensation inquiries.",
  },
  {
    id: "g-fac",
    name: "Facilities",
    type: "fulfillment",
    manager: "u-012",
    members: 6,
    description: "Office, badge access and workspace services.",
  },
]

const userMap = new Map(users.map((u) => [u.id, u]))
const groupMap = new Map(groups.map((g) => [g.id, g]))

export function getUser(id?: string): User | undefined {
  return id ? userMap.get(id) : undefined
}

export function getGroup(id?: string): Group | undefined {
  return id ? groupMap.get(id) : undefined
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export const currentUser = users[0]

/** Platform roles a user can hold; the admin Users page counts these. */
export const roles = [
  "admin",
  "itil",
  "approver",
  "agent_operator",
  "prompt_editor",
  "finance_viewer",
  "readonly",
] as const

export type Role = (typeof roles)[number]

/** Sample e-mail domain shared by every seeded user. */
export const SAMPLE_EMAIL_DOMAIN = "agentops.dev"
