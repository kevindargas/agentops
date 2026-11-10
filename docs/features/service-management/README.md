# Service Management

Service Management is the ITSM layer that the agents plug into: the records humans and workflow agents create, approve and resolve. Six modules share one data file (`lib/data/itsm.ts`, plus `lib/data/catalog.ts` for catalog items and articles), one state vocabulary (`lib/constants.ts`) and one badge color system (`stateTone` in `components/shared/status-badge.tsx`).

| Page                                    | Routes                                                                                  | Chord | What it is for                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| [Incidents](./incidents.md)             | `/itsm/incidents`, `?view=major`, `?view=mine`, `?new=1`, `/itsm/incidents/<INC>`       | `G I` | Restore service; priority from impact and urgency; resolution SLA; major incidents |
| [Problems](./problems.md)               | `/itsm/problems`, `?new=1`, `/itsm/problems/<PRB>`                                      | none  | Root cause of recurring incidents; known errors and workarounds                    |
| [Changes](./changes.md)                 | `/itsm/changes`, `?view=cab`, `?new=1`, `/itsm/changes/<CHG>`, `/itsm/changes/calendar` | `G C` | Plan, assess, authorize and schedule changes; CAB; freeze windows; conflicts       |
| [Requests](./requests.md)               | `/itsm/requests`, `/itsm/requests/<REQ>`                                                | `G Q` | Catalog orders: REQ, requested items (RITM) and fulfillment tasks (SCTASK)         |
| [Service Catalog](./service-catalog.md) | `/itsm/catalog`, `?q=`, `?category=`                                                    | none  | Browse and order hardware, software, access and services                           |
| [Knowledge](./knowledge.md)             | `/itsm/knowledge`, `?new=1`, `/itsm/knowledge/<KB>`                                     | `G K` | Articles, known errors and how-tos across IT, HR, Facilities and Security          |

Record numbers are routable from anywhere: the command menu (`⌘K`) finds INC, CHG, REQ and KB numbers, and `recordHref` in `components/shared/record-link.tsx` maps a prefix to its page. The services and systems (`ci-...`) referenced by these records come from `lib/data/cmdb.ts`, an internal data source with no page; the UI calls them "Affected service".

Every list page uses the same header dialect as Agent Operations (`PageHeader` with the nav group as eyebrow, the nav icon and title) and a compact stat row without icons. Each list has a create sheet opened from the header or from `?new=1` (incidents, changes, problems, knowledge; requests are created from the catalog). Created records are appended to a per-module client store (`features/<module>/<module>-store.ts`, built with `createListStore`), so they appear in the tables, the change calendar and the requests list within the session; nothing is persisted across reloads. Other actions update that store or show a toast. The mock data is deterministic and anchored to `NOW` (`2026-11-05T14:30:00Z`) in `lib/data/seed.ts`. The CAB slot is `cabSchedule` in `lib/constants.ts` ("Thursday 09:00 UTC").

## Service desk lead checklist

Start of shift

- Open [Incidents](./incidents.md) with `?view=major`. Every major incident needs an owner, a linked CI and a "Due in" SLA chip rather than "Breached".
- Switch to `?view=open`, sort by Priority. Clear the Unassigned tile: assign or route every New incident.
- Scan the SLA column for red "Breached" and amber "under 2h". Resolve, or put on hold with a reason.
- Check [Alerts](../service-health/alerts.md) for Critical and unacknowledged alerts without an incident; promote them.
- Clear your [Approvals](../workspace/approvals.md) due within 36 hours so changes can be scheduled and requests fulfilled.

During the day

- Watch the Overview banner and the notifications bell for new P1s and SLA warnings.
- On any P1/P2 record, use the Alerts tab and the AI insights card ("Correlated alerts", "Similar incidents") before escalating.
- Use `?view=cab` on Changes before the CAB meeting; reject with a reason rather than leaving changes in Authorize.

Weekly

- [Problems](./problems.md): open problems with open linked incidents have a workaround recorded; known errors have an article in [Knowledge](./knowledge.md).
- [Changes](./changes.md) calendar: no non-emergency chips on freeze days; no two changes on the same CI in one window.
- [Requests](./requests.md): due dates in red; tasks still Open past due; stage Delivery older than a few days.
- [Knowledge](./knowledge.md): articles in Review cleared; helpful rating under 70 percent on high-view articles flagged.
- [Analytics](../workspace/analytics.md): per-group SLA attainment under 90 percent, emergency change share over 10 percent, backlog trend.
- Data hygiene: incidents in channel Monitoring without a correlated alert, and P1/P2 incidents without an affected service. (Problems' "Incidents linked" is derived from the incidents themselves, so it always matches the Incidents tab in the sample.)
