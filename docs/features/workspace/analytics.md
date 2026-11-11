# Analytics

Analytics is the reporting page for the service-management side: incident flow, demand mix, change throughput and per-group SLA attainment. It answers "how are we doing" rather than "what do I do next", so it is aimed at the service desk lead and the change manager, with a period selector that reruns every chart against the same window.

Agent fleet analytics are not here; they live on the Fleet Overview and the Agent Operations pages.

## Where to find it

- Route: `/analytics`. Sidebar: Workspace, Analytics. Chord `G` then `N`.
- Period is in the URL: `?period=7d`, `?period=30d` or `?period=90d` (default `90d`). The selector writes the parameter with `history.replaceState` (`useQueryParam`) and the client view re-renders every chart; the page itself is static.
- Code: `app/(app)/analytics/page.tsx` (header and period select), KPIs, charts and table in `features/workspace/analytics-view.tsx` (client, inside `Suspense` with `TableSkeleton`), period helpers in `components/charts/period.ts` and `components/charts/period-select.tsx`.

## What is on the page

**Header.** `PageHeader` with the Workspace eyebrow, "Figures cover the selected period unless noted", and the period select (the chosen period is named in the Incident volume chart description).

**KPI tiles.** A `StatGrid` of four compact cards. Every value and delta is derived from the records for the selected window versus the window immediately before it (`countInWindows` and `meanTimeToResolveHours` in `lib/data/metrics.ts`); a delta is omitted when the previous window has no data.

| Tile                  | Value                                                                                                                 | Delta                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Mean time to resolve  | mean of resolved minus opened, in hours, over incidents resolved in the window                                        | hours vs the previous window (down is good)                            |
| Reopen rate           | resolved incidents in the window with `reopenCount` above zero, as a percent of resolved                              | points vs the previous window (down is good)                           |
| Change success rate   | closed changes minus an assumed 6 percent backed out, over closed plus canceled; hint shows the `changeSuccessTarget` | points vs the same formula over changes updated in the previous window |
| Self-service adoption | share of incidents opened in the window via Self-service or Chat                                                      | points vs the previous window                                          |

Each tile has a 12-point sparkline whose last point is the current value; the earlier points are a seeded walk, not history.

**Incident flow.** "Incident volume" is an opened vs resolved per-day chart for the window. The series is synthetic (seeded by the period length), not derived from incident records. The Insights card next to it derives three statements from that series: backlog up or down with the number of days resolution kept pace, the peak day with its percent above the daily average, and the weekend share of demand (over 20 percent prompts "Consider extending Service Desk coverage").

**Demand mix.** Two horizontal bar charts over incidents actually opened inside the window: "Incidents by channel" (largest bar emphasized, footer gives the self-service plus chat share) and "Incidents by category" (footer names the largest category and its share).

**Change management.** "Changes implemented per week" (per day when the period is 7d), a stacked bar by type Standard / Normal / Emergency; the series is synthetic and the footer compares the emergency share with a 10 percent target. "Change pipeline" is a donut over all changes by lifecycle stage: Awaiting approval (New, Assess, Authorize), Scheduled, Implementing (Implement, Review), Closed, Canceled. Footer: changes waiting on CAB (`cabRequired` and state Authorize) and the success rate.

**Team performance.** A table (with a screen-reader caption) of assignment groups over all incidents (not period-filtered): Group, Total, Open, Resolved, SLA met and an attainment bar against a 90 percent target. Footer names the best group among those with at least three resolved incidents.

## What to check

Every day

- Incident volume insight. "Backlog up" with resolution keeping pace on only a few days means intake is outrunning the desk. Cross-check the Open incidents tile on the Overview.
- Self-service adoption. A drop while phone or walk-in rises on the channel chart usually means the portal or chat path is broken or unknown; check the Service Catalog and Knowledge pages are reachable.

Every week

- Change success rate and emergency share. Emergency share above the 10 percent target (footer turns amber) means too many changes bypass assessment. Review the emergency changes on the Changes page.
- Change pipeline. A large "Awaiting approval" slice with "waiting on CAB" above a handful means the CAB agenda is backing up; open `/itsm/changes?view=cab`.
- Team performance. Attainment below 90 percent drops the bar from green to brand, below 75 to warning, below 65 to danger. Open Incidents filtered by that group and look at breached rows.
- Demand mix by category. The largest category drives knowledge and problem work. If one category is above half of demand, check Problems for a known error covering it.
- Switch the period to 7d and 30d and compare. The trend series change shape with the window because they are regenerated, which is expected in the template.

## Actions

- Period select: writes `?period=` to the URL through `useQueryParam` (replace, no navigation, no scroll) and the view re-renders.
- "Open incidents" button on the Incident volume card: navigates to `/itsm/incidents`.
- No exports, no drill-down filters, no mutations.

## Reading the data

- Attainment bar tone: at or above 90 percent success, 75 to 90 brand, 65 to 75 warning, below that danger (`toneForScore` with `good: 90, ok: 75` in `components/charts/availability-bar.tsx`).
- "Open" in the team table is incidents without a resolved time that are not Canceled; it therefore includes On Hold.
- "SLA met" counts resolved incidents with `slaBreached === false`.
- The donut uses `--chart-1` to `--chart-5` in stage order; legend at the bottom.
- Deltas on the four tiles compare the selected window with the window before it. With the 90-day window the previous window reaches back 180 days, so some deltas disappear when the seed has no records that old.
- Chart heights come from `CHART_HEIGHT` in `components/charts/chart-primitives.ts`; the change success sparkline draws its baseline at `changeSuccessTarget` from `lib/constants.ts`.

## How the data gets here

- Incidents and changes: `lib/data/itsm.ts`. Groups: `lib/data/users.ts` (`getGroup`).
- Period parsing: `resolvePeriod` in `components/charts/period.ts`, with `7d`, `30d`, `90d` options.
- KPI values and deltas: `meanTimeToResolveHours`, `countInWindows` and `mean` from `lib/data/metrics.ts` over `incidents` and `changes`.
- The daily incident series, the weekly change series and the sparkline walks are generated in `AnalyticsView` with `createRng(7 + days)` from `lib/data/seed.ts`, anchored to `NOW`. Replace `trend`, `weekly` and `sparks` with real aggregates when connecting a reporting backend.

## Related pages

- [Overview dashboard](./overview-dashboard.md) for the live counts the trends summarize
- [Incidents](../service-management/incidents.md), [Changes](../service-management/changes.md), [Users & Groups](../administration/users-and-groups.md) for the assignment groups in the table
