# Service Health

Service Health shows the state of each business service the agents depend on: a health badge, 30-day availability against the 99.9 percent SLO, a day-by-day uptime strip and the open alerts, incidents and in-flight changes touching the service. It is the status page for operators and the first place to look when the Overview says "N services degraded".

Health is derived from alerts, incidents and changes on the systems and services each business service depends on; there is no inventory UI for those systems.

## Where to find it

- Route: `/itom/health`. Sidebar: Service Health, Service Health. Chord `G` then `H`. The page title, metadata title and nav entry all read "Service Health".
- Also linked from the Overview "Service health" tile and card, from the Alerts page header and from the Affected service row of the alert sheet.
- Code: `app/(app)/itom/health/page.tsx`. Data: `serviceHealth` and `availabilitySlo` in `lib/data/itom.ts`, built from `lib/data/cmdb.ts` (internal data source, no page).

## What is on the page

**Header.** Standard `PageHeader` resolved from the nav entry (eyebrow "Service Health", icon, title). No actions.

**Stat tiles.** A compact four-column `StatGrid`:

| Tile                      | Value                       | Extra                                                                                                                |
| ------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Services healthy          | healthy / total             | a segmented bar with one segment per service colored by health, sorted by severity; hint counts degraded or critical |
| Avg availability (30d)    | mean of `availability30d`   | bar from 99 to 100 percent with the `availabilitySlo` target; hint counts services below the SLO                     |
| Services with open alerts | count with `openAlerts > 0` | hint totals open alerts                                                                                              |
| Changes in flight         | sum of `activeChanges`      | "Scheduled or implementing against these services"                                                                   |

**Status overview.** Four `MetricTile`s (Critical, Degraded, Healthy, Unknown) with the service count; the value is tinted by health (red, amber, green) and muted when the count is zero.

**Business services.** One card per service, sorted Critical, Degraded, Healthy, Unknown, then by name, with a left border in the health color:

- Service name, owner chip, health badge.
- Availability (30d) as a large percentage next to a 30-day sparkline with the SLO baseline.
- Availability bar against the SLO with the difference in points ("+0.08 pts", "-0.49 pts").
- Uptime strip: one bar per day for 30 days, green at or above the SLO, amber at or above 99, red below; native tooltip shows the day's availability.
- Three `MetricTile`s: Alerts (amber when above zero), Incidents (red when above zero), Changes.

There are no filters, tabs or forms on this page.

## What to check

Every day

- Status overview Critical count. A Critical service should have a major incident open in Incidents; in the seed Payments API is Critical and `INC0010078` is its incident. If a service is Critical with Incidents at zero, create the incident from Alerts.
- Degraded services. Check their Alerts tile; open the Alerts page filtered by source or node for that service and acknowledge what is unowned.
- Uptime strip. A red or amber bar on today or yesterday with a Healthy badge means the badge is stale relative to the history (in the template the history is synthesized to agree with the badge, so this cannot happen until real data is wired).
- Changes tile above zero on a Critical or Degraded service. A change in flight on an unhealthy service is a rollback candidate; find it on the Changes page filtered by that service.

Every week

- Avg availability below the SLO or any service below it (hint on the second tile). Each such service needs a problem record or a postmortem.
- Services with repeated amber or red days in the strip but still Healthy today point at flapping; correlate with Flapping alerts.
- Owner chips. Every service should have an owner who is active in Users & Groups.

## Actions

None. The page is read-only. Service cards are not links, and system names are not clickable because systems have no page. Use the Alerts, Incidents and Changes pages to act.

## Reading the data

**Health badge** (`ServiceHealth["health"]`) and tones from `stateTone`: Healthy (green), Degraded (amber), Critical (red), Unknown (grey).

- `availabilitySlo` (99.9) is exported from `lib/data/itom.ts` and used for every target, baseline and threshold on the page.
- `availability30d` is a single number per service in the seed (99.98 Healthy, 99.87 Degraded, 99.41 Critical), not the mean of the strip.
- The 30-day strip and sparkline are generated in the page by `buildHistory` with a seeded RNG per service and are shaped to match the badge (Critical services get bad days near today, Degraded services get a slightly low day).
- Uptime day status: up at or above the SLO, degraded at or above 99, down below 99.
- The availability bar tone follows the health badge (success, warning, danger; brand for Unknown).
- Alerts tile is a live count of non-Closed alerts whose `ciId` is the service, taken from the seed (bulk actions on the Alerts page do not change it); Incidents and Changes are fixed per health level in the seed.

## How the data gets here

`serviceHealth` in `lib/data/itom.ts` maps every item of class "Business Service" in `lib/data/cmdb.ts` to a `ServiceHealth` row. There are six: Employee Portal, ERP (SAP S/4HANA), Email and Calendar (M365), Payments API, VPN Remote Access and crm-salesforce. Health is assigned by id (Payments API Critical; Employee Portal and VPN Remote Access Degraded; the rest Healthy). `openAlerts` is counted from `alerts` in the same module; `openIncidents` is 3, 1 or 0 by health; `activeChanges` is 2 for the ERP service and 1 otherwise; `owner` is the service's `ownerId`.

Replace `serviceHealth` with a client that computes health from your monitoring and ITSM sources, and replace `buildHistory` with real daily availability. Keep the `ServiceHealth` type from `lib/types.ts` and the page renders unchanged.

## Related pages

- [Alerts](./alerts.md) (the events behind the health), [Incidents](../service-management/incidents.md), [Changes](../service-management/changes.md)
- [Overview dashboard](../workspace/overview-dashboard.md) (Service health tile and card)
