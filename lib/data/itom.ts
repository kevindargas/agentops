import type {
  Alert,
  AlertSeverity,
  AlertState,
  ServiceHealth,
} from "@/lib/types"
import { configurationItems } from "./cmdb"
import { chance, createRng, hoursAgo, int, pad, pick, weighted } from "./seed"

const alertTemplates: {
  source: string
  metric: string
  description: string
  ciId?: string
  node: string
  severity?: AlertSeverity
}[] = [
  {
    source: "Datadog",
    metric: "http.5xx.rate",
    description: "5xx error rate above 10% for 5 minutes",
    ciId: "ci-004",
    node: "payments-api.prod",
    severity: "Critical",
  },
  {
    source: "Kubernetes",
    metric: "pod.crashloop",
    description: "Container restarting: payments-svc-7d9f (CrashLoopBackOff)",
    ciId: "ci-008",
    node: "eks-prod-east/ns-payments",
    severity: "Critical",
  },
  {
    source: "Prometheus",
    metric: "container.memory.usage",
    description: "Memory usage > 92% of limit on payments-svc",
    ciId: "ci-008",
    node: "eks-prod-east/ns-payments",
    severity: "Major",
  },
  {
    source: "SolarWinds",
    metric: "interface.errors",
    description: "CRC errors increasing on Ethernet1/49",
    ciId: "ci-015",
    node: "sw-core-east-01",
    severity: "Major",
  },
  {
    source: "SolarWinds",
    metric: "hardware.psu",
    description: "Power supply 2 failed",
    ciId: "ci-015",
    node: "sw-core-east-01",
    severity: "Critical",
  },
  {
    source: "CloudWatch",
    metric: "rds.cpu",
    description: "CPUUtilization > 85% for 15 minutes",
    ciId: "ci-011",
    node: "pg-portal-prd",
    severity: "Minor",
  },
  {
    source: "CloudWatch",
    metric: "rds.replica_lag",
    description: "ReplicaLag > 30s",
    ciId: "ci-011",
    node: "pg-portal-prd-replica",
    severity: "Warning",
  },
  {
    source: "SAP Solution Manager",
    metric: "hana.replication",
    description: "System replication status: SYNCING",
    ciId: "ci-010",
    node: "sap-db-prd-01",
    severity: "Warning",
  },
  {
    source: "Nagios",
    metric: "disk.usage",
    description: "/var/log at 91% capacity",
    ciId: "ci-009",
    node: "sap-app-prd-01",
    severity: "Minor",
  },
  {
    source: "Nagios",
    metric: "ntp.offset",
    description: "Clock offset 1.2s from stratum 2 server",
    ciId: "ci-020",
    node: "win-ad-dc-01",
    severity: "Warning",
  },
  {
    source: "Palo Alto Panorama",
    metric: "vpn.tunnel",
    description: "GlobalProtect gateway connections at 94% of license",
    ciId: "ci-018",
    node: "vpn-gw-east-01",
    severity: "Minor",
  },
  {
    source: "Cisco DNA Center",
    metric: "wifi.client_disconnects",
    description: "Abnormal client disconnect rate on floor 3 APs",
    ciId: "ci-028",
    node: "wifi-ctrl-hq-01",
    severity: "Major",
  },
  {
    source: "NetApp ActiveIQ",
    metric: "aggregate.capacity",
    description: "aggr1 at 88% used",
    ciId: "ci-017",
    node: "nas-east-01",
    severity: "Warning",
  },
  {
    source: "CloudWatch",
    metric: "alb.target_5xx",
    description: "HTTPCode_Target_5XX_Count > 50",
    ciId: "ci-016",
    node: "lb-portal-prd",
    severity: "Major",
  },
  {
    source: "Datadog",
    metric: "redis.evicted_keys",
    description: "Evicted keys > 1000/min",
    ciId: "ci-023",
    node: "redis-portal-prd",
    severity: "Minor",
  },
  {
    source: "Synthetic Monitor",
    metric: "portal.login.latency",
    description: "Login transaction p95 latency 4.8s (threshold 3s)",
    ciId: "ci-001",
    node: "employee-portal",
    severity: "Major",
  },
  {
    source: "Datadog",
    metric: "deploy.event",
    description: "Deployment completed: portal-web-app v2026.11.3",
    ciId: "ci-006",
    node: "eks-prod-east/ns-portal",
    severity: "Info",
  },
  {
    source: "Jenkins",
    metric: "job.status",
    description: "Pipeline portal-nightly failed at stage 'integration-tests'",
    ciId: "ci-019",
    node: "vm-jenkins-01",
    severity: "Minor",
  },
  {
    source: "Microsoft 365",
    metric: "service.health",
    description: "Exchange Online: delayed mail delivery (EX1024567)",
    ciId: "ci-003",
    node: "m365-tenant",
    severity: "Warning",
  },
  {
    source: "CrowdStrike",
    metric: "endpoint.detection",
    description: "Suspicious PowerShell execution blocked",
    node: "LAPTOP-FIN-0231",
    severity: "Major",
  },
  {
    source: "AWS Health",
    metric: "ec2.scheduled_maintenance",
    description: "Scheduled maintenance for 3 instances in us-east-1a",
    ciId: "ci-012",
    node: "eks-prod-east",
    severity: "Info",
  },
  {
    source: "Prometheus",
    metric: "node.not_ready",
    description: "Node ip-10-50-12-7 NotReady for 3 minutes",
    ciId: "ci-012",
    node: "eks-prod-east",
    severity: "Major",
  },
  {
    source: "SolarWinds",
    metric: "device.unreachable",
    description: "Device unreachable via SNMP for 10 minutes",
    ciId: "ci-026",
    node: "legacy-fileshare-01",
    severity: "Clear",
  },
  {
    source: "Datadog",
    metric: "http.5xx.rate",
    description: "5xx error rate recovered below 1%",
    ciId: "ci-007",
    node: "portal-api.prod",
    severity: "Clear",
  },
]

function buildAlerts(): Alert[] {
  const rng = createRng(7777)
  const list: Alert[] = []
  alertTemplates.forEach((t, i) => {
    const severity =
      t.severity ?? pick(rng, ["Major", "Minor", "Warning"] as AlertSeverity[])
    const state: AlertState =
      severity === "Clear"
        ? "Closed"
        : weighted(rng, [
            ["Open", 6],
            ["Reopen", 1],
            ["Flapping", 1],
            ["Closed", 2],
          ])
    const openedHours = i < 3 ? 0.9 - i * 0.2 : int(rng, 1, 96)
    list.push({
      number: `ALT${pad(60001 + i)}`,
      severity,
      state,
      source: t.source,
      node: t.node,
      metric: t.metric,
      description: t.description,
      ciId: t.ciId,
      incidentNumber:
        i < 2
          ? "INC0010078"
          : severity === "Critical" ||
              (severity === "Major" && chance(rng, 0.5))
            ? `INC${pad(int(rng, 10001, 10071))}`
            : undefined,
      acknowledged: i < 3 ? true : chance(rng, 0.45),
      acknowledgedById: i < 3 ? "u-018" : undefined,
      count: i < 2 ? int(rng, 40, 120) : int(rng, 1, 25),
      opened: hoursAgo(openedHours),
      updated: hoursAgo(Math.min(openedHours, rng() * 2)),
    })
  })
  // Fill with additional noise alerts
  for (let i = 0; i < 16; i++) {
    const t = pick(
      rng,
      alertTemplates.filter((a) => a.severity !== "Critical")
    )
    const severity = weighted<AlertSeverity>(rng, [
      ["Minor", 3],
      ["Warning", 4],
      ["Info", 2],
      ["Major", 1],
    ])
    const openedHours = int(rng, 24, 24 * 14)
    list.push({
      number: `ALT${pad(60001 + alertTemplates.length + i)}`,
      severity,
      state: weighted(rng, [
        ["Open", 2],
        ["Closed", 5],
      ]),
      source: t.source,
      node: t.node,
      metric: t.metric,
      description: t.description,
      ciId: t.ciId,
      acknowledged: chance(rng, 0.7),
      count: int(rng, 1, 8),
      opened: hoursAgo(openedHours),
      updated: hoursAgo(int(rng, 1, openedHours)),
    })
  }
  return list
}

export const alerts: Alert[] = buildAlerts()

export const serviceHealth: ServiceHealth[] = configurationItems
  .filter((c) => c.class === "Business Service")
  .map((c) => {
    const openAlerts = alerts.filter(
      (a) => a.ciId === c.id && a.state !== "Closed"
    ).length
    const health: ServiceHealth["health"] =
      c.id === "ci-004"
        ? "Critical"
        : c.id === "ci-005" || c.id === "ci-001"
          ? "Degraded"
          : "Healthy"
    return {
      ciId: c.id,
      name: c.name,
      health,
      availability30d:
        health === "Critical" ? 99.41 : health === "Degraded" ? 99.87 : 99.98,
      openAlerts,
      openIncidents: health === "Critical" ? 3 : health === "Degraded" ? 1 : 0,
      activeChanges: c.id === "ci-002" ? 2 : 1,
      owner: c.ownerId,
    }
  })
