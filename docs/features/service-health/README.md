# Service Health

Service Health is the operations layer under the agents: which business services are up, and the monitoring alerts that explain why they are not. Both pages read `lib/data/itom.ts`; service rows are derived from the business services in `lib/data/cmdb.ts`, an internal data source with no page of its own.

| Page                                  | Route                                          | Chord | What it is for                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Service Health](./service-health.md) | `/itom/health`                                 | `G H` | Health, 30-day availability against the `availabilitySlo` (99.9 percent), uptime strip and alert, incident and change tiles per business service                                |
| [Alerts](./alerts.md)                 | `/itom/alerts`, `?alert=` opens a detail sheet | none  | Correlated monitoring alerts with severity, state, acknowledgement and promoted incident; bulk acknowledge, create incident, close (with confirmation); correlation rules sheet |

Service Health is read-only. Alert actions mutate a shared client store (`features/itom/alerts-store.ts`) that the table, the stat tiles and the alert sheet all read, so counts stay in step within a session; a reload returns to the seed. Severity and state colors come from `SeverityBadge` and `stateTone` in `components/shared/status-badge.tsx`; severities are listed in `alertSeverities` in `lib/constants.ts`.

Related: [Incidents](../service-management/incidents.md) for promoted alerts, [Changes](../service-management/changes.md) for the "changes in flight" counter, and the [Overview dashboard](../workspace/overview-dashboard.md) which summarizes both pages.
