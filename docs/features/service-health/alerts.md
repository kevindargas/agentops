# Alerts

Alerts is event management: monitoring events from Datadog, Prometheus, CloudWatch, SolarWinds, Nagios and other sources are de-duplicated and correlated into alerts with a severity, a state, an event count and, when promoted, a linked incident. Operators acknowledge alerts, create incidents from them, or close noise. The Alert Correlation workflow agent proposes groupings into the AgentOps Assist queue.

## Where to find it

- Route: `/itom/alerts`. Sidebar: Service Health, Alerts (the badge is the live count of alerts that are not Closed, from `getNavCounts()` in `config/nav-counts.ts`). No chord.
- Deep link: `?alert=ALT0060001` opens the alert detail sheet on load.
- Linked from the Overview "Recent activity" alerts column, the Alerts tab on incident records, and AgentOps Assist sources of kind "alert".
- Code: `app/(app)/itom/alerts/page.tsx`, `features/itom/alerts-table.tsx`, `features/itom/alerts-stats.tsx`, `features/itom/alert-sheet.tsx`, `features/itom/correlation-rules-sheet.tsx`, `features/itom/alerts-store.ts`. Data: `alerts` in `lib/data/itom.ts`; severities in `alertSeverities` in `lib/constants.ts`; the open-alert delta in `openAlertDelta()` in `lib/data/metrics.ts`.

## What is on the page

**Header.** Standard `PageHeader` resolved from the nav entry (eyebrow "Service Health", Alerts icon and title). Actions: "Service Health" (`/itom/health`) and "Correlation rules" (opens a sheet, see Actions).

**Stat tiles.** A compact four-column `StatGrid`, rendered by `AlertsStats` from the shared client store so every bulk action moves the numbers:

| Tile            | Value                                                                                           | Extra                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Open alerts     | alerts whose state is not Closed                                                                | delta is the change in open alerts versus 14 days ago (`openAlertDelta(14)`, down is good); hint counts how many are promoted to incidents |
| Critical        | open and Critical                                                                               |                                                                                                                                            |
| Unacknowledged  | open and not acknowledged                                                                       |                                                                                                                                            |
| Noise reduction | `1 - open alerts / events` as a percentage, where events is the sum of `count` over open alerts | hint shows the two numbers behind the ratio                                                                                                |

**Table.** Compact density, caption "Alerts" for screen readers. The State facet is preset to Open, Reopen and Flapping, so Closed alerts are hidden until you clear it. Default sort is Severity, Critical first. Clicking a row (or the alert number) opens the detail sheet.

| Column      | Content                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| Severity    | Critical, Major, Minor, Warning, Info, Clear badge                                           |
| Alert       | `ALT...` number; opens the detail sheet (`?alert=`)                                          |
| Description | description with source and metric beneath, in mono                                          |
| Node        | host, cluster or device name                                                                 |
| State       | Open, Reopen, Flapping, Closed badge                                                         |
| Ack         | green check when acknowledged, otherwise empty; header tooltip "Acknowledged by an operator" |
| Incident    | link to the promoted incident or empty                                                       |
| Count       | number of events correlated into the alert; header tooltip explains the de-duplication       |
| Last event  | relative time of the last update                                                             |

Facets: Severity, State, Source (distinct values from the current list), Acknowledged (yes/no). Search matches number, description, node, source and metric. Selecting rows shows a bulk bar with Acknowledge, Create incident and Close.

**Alert sheet.** Alerts have no record page; the sheet is the detail view. It shows the number with severity, state and an Acknowledged badge, the description, source, metric and last event, three tiles (Events, Opened, Incident), a detail list (Node, Source, Metric, Affected service with a link to Service Health, Acknowledged by, Last event) and a footer with Close alert (confirmation), Acknowledge and Create incident or Open incident. Closing the sheet clears `?alert=`.

## What to check

Every day

- Critical tile. Every Critical alert should have an Incident link; in the seed the two Payments API alerts link to `INC0010078`. A Critical with no incident is the first thing to promote.
- Unacknowledged tile. Select the unacknowledged rows (Acknowledged facet: Unacknowledged) and acknowledge what your team owns; the tile drops as you do.
- Reopen state (red). An alert that closed and reopened means the earlier fix did not hold; check its incident.
- Flapping state (amber). Flapping alerts inflate the count column; either fix the threshold or suppress them before they page someone.
- Count column. High counts on one node (dozens of events) indicate a storm; the correlation agent may already have a proposal in the Assist queue.

Every week

- Source facet. A source with many Info or Warning alerts and no incidents is noise; open Correlation rules and review that source's de-duplication rule.
- Clear severity rows (green). These are recovery events; close them if they are still Open.
- Alerts older than two weeks still Open (Last event far in the past) are stale; close or convert to a problem.
- Cross-check the Alerts counter on Service Health for each degraded service with the rows here filtered by node.

## Actions

Every action below mutates the shared client store (`alertsStore` in `features/itom/alerts-store.ts`), so the table, the stat tiles and the sheet agree. Nothing is persisted; a reload returns to the seed.

| Action                                    | Behaviour in the template                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row click, alert number                   | opens the alert sheet and sets `?alert=`                                                                                                                                                                                                                                                    |
| Acknowledge (bulk, sheet)                 | sets `acknowledged` and records the current user as `acknowledgedById`; toast "N alerts acknowledged"                                                                                                                                                                                       |
| Create incident (bulk, sheet)             | mints the next incident number after the seeded range (`INC0010080`, `INC0010081`, ...), writes it to `incidentNumber` on the selected alerts and acknowledges them; toast names the number. The incident record itself is not created, so the link resolves to the incident not-found page |
| Open incident (sheet)                     | navigates to the linked incident when one exists                                                                                                                                                                                                                                            |
| Close (bulk, sheet)                       | confirmation dialog, then sets state Closed; toast "N alerts closed"                                                                                                                                                                                                                        |
| Correlation rules                         | opens a sheet with one de-duplication rule per monitoring source (open alerts and events it produced) plus a "Close on recovery" rule; each switch pauses or resumes the rule for this session with a toast. Existing alerts are not changed                                                |
| Service Health                            | navigates to `/itom/health`                                                                                                                                                                                                                                                                 |
| Incident link                             | opens the incident record                                                                                                                                                                                                                                                                   |
| Facets, search, sort, column View toggles | local table state                                                                                                                                                                                                                                                                           |

## Reading the data

**Severity** (`alertSeverities`, `SeverityBadge`):

| Severity | Tone    | Typical meaning                                     |
| -------- | ------- | --------------------------------------------------- |
| Critical | red     | service down or error rate breach; usually promoted |
| Major    | amber   | degraded capacity, failing component                |
| Minor    | blue    | threshold crossed, no user impact yet               |
| Warning  | neutral | early signal                                        |
| Info     | grey    | deploy events, maintenance notices                  |
| Clear    | green   | recovery; always Closed in the seed                 |

**State** (`AlertState`) and tones: Open (blue), Reopen (red), Flapping (amber), Closed (grey).

- Ack: `acknowledged`; every acknowledged alert in the seed names an acknowledger, with the three headline alerts credited to the SRE on the bridge (u-018).
- Incident: `incidentNumber`; set for the first two alerts (INC0010078), for Critical alerts, and for about half of Major alerts.
- Count: events correlated into the alert; the two headline alerts carry 40 to 120 events.
- Affected service: the alert's `ciId` resolved through `getCi()`; shown in the sheet with a link to Service Health.
- Node and source are free text; the Source facet is built from the distinct values present.

## How the data gets here

`alerts` in `lib/data/itom.ts` is built by `buildAlerts()` with `createRng(7777)`: 24 fixed templates (source, metric, description, node, service, severity) become `ALT0060001` to `ALT0060024`, followed by 16 noise alerts drawn from the non-critical templates (`ALT0060025` to `ALT0060040`). Clear-severity alerts are always Closed. The first three alerts are the Payments API story (5xx rate, crash loop, memory) opened within the last hour.

The same array feeds `serviceHealth.openAlerts`, the Alerts tab on incident records, the Overview "Open alerts" list, the sidebar badge and the workflow agent proposal "Create incident from 3 correlated alerts on sw-core-east-01" in `lib/ai/agents.ts`. Replace `alerts` with an event-management client returning `Alert` from `lib/types.ts`, and replace the store mutations in `features/itom/alerts-store.ts` with API calls; the table, tiles and sheet read only from that store.

## Related pages

- [Service Health](./service-health.md), [Incidents](../service-management/incidents.md) (Alerts tab, promotion target)
- [Overview dashboard](../workspace/overview-dashboard.md) (Recent activity)
- AgentOps Assist queue (Alert Correlation proposals): [Assistant and shell](../assistant-and-shell.md)
