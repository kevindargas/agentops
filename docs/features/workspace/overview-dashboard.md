# Overview

The Overview is the landing page of AgentOps. It gives the platform owner one screen with the state of the agent fleet (health, spend, review backlog, drift, failing evals) on top, and the service-management picture (incidents, SLA, service health, approvals, changes, alerts, requests) underneath. It is read-mostly: almost everything on it is a link into the page where the work actually happens.

It is built for whoever opens the app in the morning and needs to decide where to look first. In the mock data that person is Kevin Dargas (Platform Owner), so the greeting, the "assigned to you" counts and the "My work" card are computed for him.

## Where to find it

- Route: `/dashboard`. The root `/` redirects here, and the home icon in the breadcrumbs links here.
- Sidebar: Workspace, Overview. Keyboard chord `G` then `D`.
- Code: `app/(app)/dashboard/page.tsx` (server component), chart wrappers in `features/workspace/fleet-charts.tsx`, proposals card in `features/ai/agent-proposals-card.tsx`.

## What is on the page

**Header.** A large `PageHeader` (`nav="/dashboard"`, `size="lg"`) with the Workspace eyebrow, a greeting derived from the UTC hour of the fixed demo clock ("Good afternoon, Kevin"), the date, and a one-line summary: production agents and how many need attention, open incidents and how many are P1/P2, and how many business services are degraded. Two buttons: "Fleet Overview" (`/agentops`) and "Review Queue" (`/agentops/reviews`).

**Major incident banner.** Shown only when at least one open incident has `majorIncident` set. It shows the first one with priority, state, number, short description, opened time, the affected service (resolved from `ciId`) and the assignment group. "View incident" (outline) and "Join bridge" (primary) both open `/itsm/incidents/<number>`. When more than one is open, a "+N more" link points at `/itsm/incidents?view=major`, the view the incidents table reads.

**Agent operations tiles** (a five-column `StatGrid` of compact stat cards without icons, each a link):

| Tile                | Value                                                                                    | Delta and hint                                                                                                  | Links to                                                               |
| ------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Fleet health        | healthy / total production agents                                                        | quality change vs the prior 7 days in points; composite quality and requests today; 14-day quality sparkline    | `/agentops/agents`                                                     |
| Spend today         | sum of `costPerDay` for production agents                                                | spend change vs prior week in percent (down is good); number of new cost recommendations; 14-day cost sparkline | `/agentops/recommendations`                                            |
| Review queue        | pending review items                                                                     | high-priority count and items assigned to you; 14-day reviewed sparkline                                        | `/agentops/reviews`                                                    |
| Open drift signals  | signals not in state Resolved                                                            | critical count and acknowledged count                                                                           | `/agentops/drift`                                                      |
| Failing evals (24h) | traces in the last 24 hours that failed or scored under 0.6 on grounded, helpful or safe | worst agent by count and running experiments; 14-day errors sparkline                                           | `/agentops/traces` (the traces page does not read a status filter yet) |

**Fleet charts.** "Fleet traffic" is a 30-day line chart of requests per day and the share sampled into human review; the footer says whether quality held or slipped this week and names the top open drift signal. "Spend by agent" is a horizontal bar chart of cost per day for production agents; the footer gives the top agent's share of today's spend.

**Agent cards.** Three cards side by side: "Agents needing attention" (production agents whose health is not Healthy, sorted by drift score, with quality, error rate and PSI), "Review queue" (top five pending items by priority with reason, agent and trace id) and "Open drift signals" (top five by severity with metric, agent, baseline and current value). Each row links to the relevant Agent Operations page.

**Agent proposals.** Rendered only while workflow agents have proposals waiting. Shows up to three proposal cards with Approve and Reject, a "Review in Assist" button that opens the AgentOps Assist panel on its Queue tab, and a "Control center" link to `/ai`.

**Service management tiles** (a four-column `StatGrid`):

| Tile              | Value                                                   | Delta and hint                                                                                                                                                                               | Links to          |
| ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Open incidents    | incidents not Resolved, Closed or Canceled              | open count now minus open count 14 days ago (`openIncidentDelta(14)`, down is good); major and high-priority counts; 14-point sparkline ending at the current count                          | `/itsm/incidents` |
| SLA compliance    | resolved incidents that did not breach / all resolved   | compliance over the last 14 days minus the 14 days before, in points (`slaComplianceDelta(14)`); count of open incidents already breached; sparkline with the `slaComplianceTarget` baseline | none              |
| Service health    | healthy / total business services                       | open alert count                                                                                                                                                                             | `/itom/health`    |
| Pending approvals | approvals in state Requested (`pendingApprovalCount()`) | none                                                                                                                                                                                         | `/approvals`      |

**Service charts.** "Incident volume" (opened vs resolved per day, 30 days; footer says whether the backlog grew or shrank over the last 7 days) and "Open by priority" (horizontal bars P1 to P5; footer counts P1/P2).

**Service cards.** "Service health" lists every business service with 30-day availability and open alerts (links to `/itom/health`). "My work" lists up to five open incidents assigned to the current user (links to each record, "View all" goes to `/my-work`). "Upcoming changes" lists the next five changes in Scheduled, Authorize or Implement whose planned start is later than 24 hours ago ("Calendar" goes to `/itsm/changes/calendar`).

**Recent activity.** Two columns: the five most recent open alerts (severity dot, description, node, opened; links to `/itom/alerts`) and the five most recent open requests (number, item count, requested-for chip; links to the request).

## What to check

Every day

- Major incident banner. Any banner means a P1 is open and flagged major. Open the incident, confirm an assignee and that the SLA chip is not "Breached".
- Fleet health. Fewer healthy than total means Degraded, Drifting or Paused agents in production. Open "Agents needing attention" and look at the one with the highest PSI first.
- Failing evals (24h). A non-zero count with a single agent named in the hint points to a regression on that agent. Follow the link to failed traces.
- Review queue. A growing pending count, or a high-priority count above zero, means reviewers are behind. Open the queue.
- Open drift signals. Any Critical count in the hint should already have an acknowledgement; if "acknowledged" is zero while "critical" is not, nobody has looked.
- Spend today delta. A double-digit positive percent vs prior week with no matching traffic increase on the Fleet traffic chart is a cost regression. Check Spend by agent for the outlier.
- Agent proposals. Proposals waiting for approval are blocked work. Decide on them or open the Queue tab in Assist.
- Open incidents vs SLA compliance. Breached-open count above zero in the SLA hint means tickets are already late. Open `/itsm/incidents` sorted by priority.
- Service health card. Any Degraded or Critical service should correlate with the alerts list and the major incident banner. If a service is Critical and no incident exists, create one from Alerts.

Every week

- Fleet traffic footer. "Quality slipped" for more than one week in a row means the drift board is not being worked.
- Incident volume footer. Backlog growing week over week means opened is outpacing resolved; check Analytics for the group that is behind.
- Upcoming changes. Walk the list against the change calendar for freeze windows and conflicts before CAB.
- Spend by agent. Confirm the top agent's share is expected; if one agent is more than half of spend, look for a cost recommendation.

## Actions

- Approve or Reject on an agent proposal card: removes the proposal from the queue and appends an entry to the assistant activity log, with a toast. Local state only; reload restores the seed.
- "Review in Assist": opens the AgentOps Assist panel on the Queue tab.
- Every other element is a navigation link. There are no forms on this page.

## Reading the data

- Agent health badges: Healthy (green), Degraded (amber), Drifting (amber), Paused (amber). Tones come from `stateTone` in `components/shared/status-badge.tsx`.
- Drift severity badges: Critical (red), Warning (amber), Info (blue).
- Incident priority badges: P1 Critical (red), P2 High (amber), P3 Moderate (blue), P4 Low (neutral), P5 Planning (grey). Labels from `priorityLabels` in `lib/constants.ts`.
- Incident state badges: New (blue), In Progress (brand), On Hold (amber), Resolved (green), Closed (grey), Canceled (grey).
- Stat card deltas are green when the move is good and red when it is bad. Spend, drift, failing evals and open incidents treat "down" as good.
- "Composite quality" is the request-weighted mean of each production agent's `metrics.quality` (0 to 100).
- "Failing evals" is not an eval run; it is a filter over traces: status Failed, or any of grounded, helpful, safe below 0.6.
- The incident trend chart is a synthetic series generated in the page with a seeded RNG. The two service sparklines are seeded walks anchored so their last point equals the figure on the card; the earlier points are not history.
- Empty list bodies use the shared `EmptyState` (small, bare). Chart heights come from `CHART_HEIGHT` in `components/charts/chart-primitives.ts`.

## How the data gets here

Everything is deterministic mock data under `lib/data/`, anchored to `NOW` (`2026-11-05T14:30:00Z`) in `lib/data/seed.ts`.

| Section                                                                                 | Module                               |
| --------------------------------------------------------------------------------------- | ------------------------------------ |
| Agents, traces, review items, drift signals, experiments, recommendations, `fleetDaily` | `lib/data/agentops.ts`               |
| Incidents, changes, requests                                                            | `lib/data/itsm.ts`                   |
| Alerts, business service health                                                         | `lib/data/itom.ts`                   |
| Approvals (derived from changes and requests awaiting approval)                         | `lib/data/activity.ts`               |
| Period-over-period deltas                                                               | `lib/data/metrics.ts`                |
| Current user, groups                                                                    | `lib/data/users.ts`                  |
| Service names for incidents (`getCi`)                                                   | `lib/data/cmdb.ts` (internal, no UI) |
| Agent proposals and workflow agents                                                     | `lib/ai/agents.ts` via `AiProvider`  |

To wire a backend, replace those modules with clients that return the same types from `lib/types.ts`. The synthetic trend series in `buildTrend` and the sparkline walks in `buildSparks` should be replaced with real aggregates at the same time; the deltas already come from `lib/data/metrics.ts` and will follow the data.

## Related pages

- [My Work](./my-work.md), [Approvals](./approvals.md), [Analytics](./analytics.md)
- [Incidents](../service-management/incidents.md), [Changes](../service-management/changes.md), [Requests](../service-management/requests.md)
- [Service health](../service-health/service-health.md), [Alerts](../service-health/alerts.md)
- AgentOps Assist and the command menu: [Assistant and shell](../assistant-and-shell.md)
