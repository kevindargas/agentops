# Incidents

Incidents are unplanned interruptions or degradations of a service. The Incidents module is where the Service Desk and the resolver groups log, triage, work and resolve them against a resolution SLA driven by priority. It is also the record that monitoring alerts are promoted into and that AgentOps Assist knows the most about.

Used by Service Desk agents (first line), resolver groups (Network Operations, Site Reliability, Application Support and so on) and the service desk lead who watches the SLA and major-incident counters.

## Where to find it

- List: `/itsm/incidents`. Sidebar: Service Management, Incidents, with children "All incidents", "Major incidents" (`?view=major`) and "Assigned to me" (`?view=mine`). Chord `G` then `I`.
- Record: `/itsm/incidents/<number>`, for example `/itsm/incidents/INC0010078`.
- New incident sheet: `/itsm/incidents?new=1` opens it on load (used by quick create, the command menu and the catalog empty state).
- Code: `app/(app)/itsm/incidents/page.tsx`, `app/(app)/itsm/incidents/[number]/page.tsx`, `features/incidents/incidents-table.tsx`, `features/incidents/columns.tsx`, `features/incidents/new-incident-sheet.tsx`, `features/incidents/incidents-store.ts`, `features/incidents/incident-actions.tsx`. Data in `lib/data/itsm.ts`; states, priority matrix and SLA targets in `lib/constants.ts`; the "Open" delta in `lib/data/metrics.ts`.

## What is on the page

### List page

**Header.** Driven by the nav entry (eyebrow "Service Management", icon, title "Incidents"), with "Major incidents" (`?view=major`) and "New incident" (opens the sheet).

**Stat tiles.** Compact tiles without icons. Open (not Resolved, Closed or Canceled; the delta is the change in open count versus 14 days ago from `openIncidentDelta(14)`, shown as a raw count; hint major and P1/P2 counts), Unassigned (open with no assignee), SLA breached (open and breached; hint: compliance on resolved incidents), Critical (P1) (open P1s).

**Views.** `?view=major` filters to `majorIncident`; `?view=mine` filters to incidents where the current user is the assignee or the caller. An undocumented `?view=open` preselects the State facet to New, In Progress and On Hold. Changing the view resets the table. While the table loads, the page shows a table-shaped skeleton (`loading.tsx` and the Suspense fallback).

**Table.** Default sort is priority ascending (P1 first). Twenty rows per page; page sizes 10, 20, 50, 100. The "View" button toggles columns.

| Column            | Default | Content                                                                        |
| ----------------- | ------- | ------------------------------------------------------------------------------ |
| Number            | shown   | link to the record; red star when `majorIncident`                              |
| Short description | shown   | description with category and subcategory beneath                              |
| Priority          | shown   | priority badge                                                                 |
| State             | shown   | state badge                                                                    |
| Caller            | hidden  | user chip                                                                      |
| Assignment group  | shown   | group chip                                                                     |
| Assigned to       | shown   | user chip or empty                                                             |
| Affected service  | hidden  | name of the linked service or system                                           |
| SLA               | shown   | "Nh left", "Breached" or "Met"; the header has a tooltip explaining the target |
| Channel           | hidden  | Self-service, Phone, Email, Chat, Walk-in, Monitoring                          |
| Opened            | shown   | relative date                                                                  |
| Updated           | hidden  | relative date                                                                  |

Facets: State, Priority, Group (ITIL groups only), Channel. Search matches number, short description, category and subcategory. Row click opens the record. The per-row menu has Open, Assign to me, Copy number, Resolve, Cancel (confirmation dialog). Selecting rows shows a bulk bar with Assign to me and Resolve. The toolbar has an Export button that downloads the visible rows as `incidents.csv`. The table reads `incidentsStore` (a client-side copy of `incidents`), so created, assigned, resolved and canceled rows update in place.

### New incident sheet

Four sections: Who is affected (Caller, default the current user; Contact channel: Self-service, Phone, Email, Chat, Walk-in), What happened (Short description, required, 160 characters with counter; Description; Affected service, optional), Classification (Category and Subcategory from `incidentCategories`; Impact 1 to 3; Urgency 1 to 3; a live callout "Priority N" with the resolution target in hours), Routing (Assignment group, default Service Desk). The sheet uses the shared frame (header, scrolling body, footer with Cancel and the primary action); the footer shows "Unsaved draft" once anything changed, and closing a dirty form asks to discard. "Create incident" builds a New incident with the next free number, an SLA due date from the priority target, appends it to `incidentsStore` (it appears at the top of the list) and toasts "Incident INC... created".

### Record page

**Toolbar.** Number with copy button; badges Priority, State and a red "Major incident" badge when flagged. The badges read `incidentsStore`, so every action below changes them in place for the session. Actions: "Assign to me", then "Resolve" (or "Reopen" when Resolved) with a dropdown: "Put on hold...", "Resume work" (when On Hold), "Flag major incident" / "Demote major incident", "Cancel incident..." (confirmation). Overflow menu: Create problem, Create change, Create knowledge article; each creates a real record with the next free number in the matching store (`problemsStore`, `changesStore`, `knowledgeStore`) and links it on the incident. Print, Export as PDF and Copy link were removed because they performed nothing.

**Meta chips.** Assigned to, Group, Opened, SLA ("Met", "Breached" or "Due in ..."; red when breached, green when met), Channel, and "Reopened Nx" when the incident has been reopened.

**Aside.** Resolution SLA (progress bar from opened to due, target hours for the priority, due time, resolved time), Related records (linked problem or a "Find a matching problem" link, linked change, an "Affected service" card that links to Service Health; "Link" opens a dialog to pick an open problem or change, and each linked card can be unlinked), People (caller, assignee with "Unassigned - pick up from the queue" fallback, group with member count, an editable watch list with "Add watcher" opening a user picker and per-watcher remove).

**Main.** AI insights card (chips Suggested priority, Similar incidents, Correlated alerts, Knowledge matches; Summarize button; prompts "Draft a customer update", "What's the likely root cause?", "Find similar incidents"), Description, Details (caller, affected service, category, subcategory, impact, urgency, group, assignee, opened, last updated; the dead "Edit" button was removed), and tabs:

| Tab               | Content                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Activity          | work notes and comments (`buildActivity`, same five entries for every record) with a composer that toggles Work note / Comment  |
| Alerts            | alerts whose `incidentNumber` is this record, plus open alerts on the same service; rows open `/itom/alerts?alert=<number>`     |
| Similar incidents | up to five other incidents with the same category and subcategory; "Link as duplicate" goes to the list                         |
| Knowledge         | up to three published articles from the IT knowledge base (Security for Security incidents); "Attach article" goes to Knowledge |

Tabs mirror `?tab=` so a tab can be shared.

## What to check

Every day

- Critical (P1) and the major-incident star. Every open P1 should have an assignee and, if it is major, an entry on the Overview banner. A P1 in state New is unowned; use "Assign to me" or route it.
- Unassigned tile. Anything above zero in `?view=open` is waiting for triage. Sort by Priority and pick up from the top.
- SLA column. "Breached" in red on an open row is already late; "Nh left" in amber means under two hours. Resolve, or put on hold with a reason if waiting on someone (the SLA copy says the clock pauses).
- Alerts tab on P1/P2 records. If correlated alerts exist but no affected service is linked, set the service so Service Health reflects the incident.
- Channel Monitoring. Incidents opened by monitoring with no alert in the Alerts tab mean the alert was closed or never linked.

Every week

- Reopened chip. Incidents reopened once or more point at resolution notes that did not fix the issue; review the resolution code used.
- Similar incidents tab. Five or more similar incidents in the same subcategory without a linked problem is a problem-management gap; use "Create problem" from the overflow menu and record it in Problems.
- Knowledge tab with no matching articles for a recurring subcategory means a known-error article is missing.
- SLA compliance hint on the list page below your target (the Overview sparkline draws a 95 percent baseline) should be broken down per group on Analytics.

## Actions

All actions on both pages write `incidentsStore` (a session-only client copy of the seed) and describe exactly that in their toast. Nothing is persisted; a reload returns to the sample data.

| Action                                      | Where                         | Behaviour                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New incident / Create incident              | list header, sheet            | appends the incident to `incidentsStore`, toasts its number with priority and title; closes the sheet, strips `?new=1`                                                                                                                                              |
| Assign to me                                | row menu, bulk bar, toolbar   | sets the assignee to the current user in `incidentsStore`; toast; disabled on closed records                                                                                                                                                                        |
| Resolve                                     | row menu, bulk bar            | sets state Resolved and the resolved time in `incidentsStore`; closed rows are skipped                                                                                                                                                                              |
| Resolve (record)                            | toolbar                       | dialog: resolution code (Solved (Permanently), Solved (Work Around), Solved Remotely, Duplicate, Not Reproducible, Closed by Caller), notes of at least 20 characters (validated), "Notify the caller by email" checkbox; sets state Resolved and the resolved time |
| Reopen                                      | toolbar when Resolved         | sets state back to In Progress and increments the reopen count                                                                                                                                                                                                      |
| Put on hold...                              | toolbar dropdown              | dialog: reason (Awaiting caller, vendor, change, problem) and internal work note; sets state On Hold                                                                                                                                                                |
| Resume work                                 | toolbar dropdown when On Hold | sets state In Progress                                                                                                                                                                                                                                              |
| Flag / Demote major incident                | toolbar dropdown              | toggles `majorIncident`; the header badge follows                                                                                                                                                                                                                   |
| Cancel incident...                          | row menu and toolbar dropdown | confirmation dialog, then state Canceled; canceled incidents are excluded from metrics and not reopenable                                                                                                                                                           |
| Create problem / change / knowledge article | overflow                      | creates the record with the next free number in `problemsStore`, `changesStore` or `knowledgeStore`, links it on the incident and toasts the real number                                                                                                            |
| Link (Related records)                      | aside                         | dialog listing open problems and changes; the chosen record is linked and shown as a card with an unlink action                                                                                                                                                     |
| Add watcher                                 | aside                         | dialog picking a user; watchers are listed and can be removed                                                                                                                                                                                                       |
| Export                                      | list toolbar                  | downloads the visible rows as `incidents.csv` (number, description, priority, state, caller, group, assignee, affected service, channel, opened, SLA due, SLA breached)                                                                                             |
| Copy number                                 | row menu                      | copies to clipboard; toasts an error when the clipboard is unavailable                                                                                                                                                                                              |
| Post comment / Add note                     | Activity tab                  | toast only                                                                                                                                                                                                                                                          |

## Reading the data

**Priority matrix** (`calculatePriority` in `lib/constants.ts`, impact across, urgency down):

| Impact \ Urgency | 1 High | 2 Medium | 3 Low |
| ---------------- | ------ | -------- | ----- |
| 1 High           | P1     | P2       | P3    |
| 2 Medium         | P2     | P3       | P4    |
| 3 Low            | P3     | P4       | P5    |

**Resolution SLA targets** (`slaTargetHours`): P1 4h, P2 8h, P3 24h, P4 72h, P5 168h. `slaDue` is opened plus the target. For open incidents `slaBreached` is true when `slaDue` is before `NOW`; for resolved ones when resolved is after `slaDue`.

**States** (`incidentStates`) and badge tones from `components/shared/status-badge.tsx`:

| State       | Tone  | Meaning                                          |
| ----------- | ----- | ------------------------------------------------ |
| New         | blue  | logged, not yet worked; may be unassigned        |
| In Progress | brand | being worked                                     |
| On Hold     | amber | waiting on caller, vendor, change or problem     |
| Resolved    | green | fix applied; caller can reopen before auto-close |
| Closed      | grey  | finished                                         |
| Canceled    | grey  | withdrawn; excluded from resolution metrics      |

Priority badge tones: P1 red, P2 amber, P3 blue, P4 neutral, P5 grey. Labels: Critical, High, Moderate, Low, Planning.

The SLA indicator shows "Nm left" under one hour, "Nh left" under 48 hours, "Nd left" beyond, "Breached" in red, and "Met" in green once resolved.

## How the data gets here

`incidents` in `lib/data/itsm.ts` is built by `buildIncidents(72)` with `createRng(20261105)`: category, subcategory, impact, urgency, state, channel and assignee are drawn deterministically; the first row is overwritten with the headline major incident `INC0010078` ("Payments API returning 5xx for 12% of checkout requests", P1, In Progress, Site Reliability, CI `ci-004`, linked to `PRB0040011` and `CHG0031118`). About one in five open incidents is seeded as already breached. Roughly 20 percent reference a problem (`PRB0040001` to `PRB0040012`) and 10 percent a change.

Lookups: `getIncident`, `getProblem`, `getChange` from `lib/data/itsm.ts`; `getCi` from `lib/data/cmdb.ts` (internal data source, no page); `alerts` from `lib/data/itom.ts`; `knowledgeArticles` from `lib/data/catalog.ts`; `buildActivity` and users from `lib/data/activity.ts` and `lib/data/users.ts`. Categories and subcategories come from `incidentCategories` in `lib/constants.ts`.

`incidentsStore` in `features/incidents/incidents-store.ts` is a `createListStore` seeded from `incidents`; the table, row menu, bulk bar and the New incident sheet all read and write it, so the list stays consistent within a session (nothing is persisted). To wire a backend, replace `incidents` and the lookup functions with API clients returning `Incident` from `lib/types.ts`, and replace the store mutations in `incident-actions.tsx`, `columns.tsx`, `incidents-table.tsx` and `new-incident-sheet.tsx` with API calls.

## Related pages

- [Problems](./problems.md) (root cause for recurring incidents), [Changes](./changes.md) (linked and conflicting changes), [Knowledge](./knowledge.md) (suggested articles)
- [Alerts](../service-health/alerts.md) (promote alerts to incidents), [Service health](../service-health/service-health.md)
- [Overview dashboard](../workspace/overview-dashboard.md) (major incident banner), [My Work](../workspace/my-work.md), [Analytics](../workspace/analytics.md)
- AgentOps Assist on an incident record: [Assistant and shell](../assistant-and-shell.md)
