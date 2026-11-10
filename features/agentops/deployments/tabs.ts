export type DeploymentsTab = "releases" | "environments" | "approvals"

export const deploymentsTabs: DeploymentsTab[] = [
  "releases",
  "environments",
  "approvals",
]

export function isDeploymentsTab(v: string | undefined): v is DeploymentsTab {
  return deploymentsTabs.includes(v as DeploymentsTab)
}
