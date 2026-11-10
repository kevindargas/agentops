# Changes

Changes are planned modifications to services and systems. The module covers the full lifecycle from New through Assess, Authorize, Scheduled, Implement and Review to Closed, with an approval card, risk assessment, schedule conflict detection and a calendar with freeze windows. Standard changes are pre-approved, normal changes with moderate or higher risk go to the Change Advisory Board (CAB), emergency changes take an expedited path.

Used by change requesters and implementers, the change manager (Priya Natarajan in the seed) and the CAB.

## Where to find it

- List: `/itsm/changes`. Sidebar: Service Management, Changes, with children "All changes", "Change calendar" (`/itsm/changes/calendar`) and "CAB agenda" (`?view=cab`). Chord `G` then `C`.
- Record: `/itsm/changes/<number>`, for example `/itsm/changes/CHG0031104`.
- Calendar: `/itsm/changes/calendar`.
- New change sheet: `/itsm/changes?new=1` opens it on load (used by quick create and the command menu); the list and calendar headers open the same sheet.
- Code: `app/(app)/itsm/changes/page.tsx`, `[number]/page.tsx`, `calendar/page.tsx`; `features/changes/changes-table.tsx`, `new-change-sheet.tsx`, `changes-store.ts`, `change-approval-card.tsx`, `change-calendar.tsx`. Data in `lib/data/itsm.ts` (`changes`, `getChange`, `nextCab`, `changeFreezeWindows`); states, types, risks and `cabSchedule` in `lib/constants.ts`.

## What is on the page

### List page

**Header.** Page header driven by the nav entry (eyebrow "Service Management", icon, title), with "Calendar" and "New change" (opens the create sheet). The table toolbar only carries the Calendar link; the header is the single create action.

**Stat tiles.** Compact tiles without icons: Active changes (not Closed or Canceled; hint high and very high risk), Awaiting approval (approval Requested; hint "Next CAB: Thursday 09:00 UTC" with the date of the next slot, both from `cabSchedule` and `nextCab()`), Scheduled this week (planned start within the next 7 days), Emergency (active emergency changes).

**New change sheet.** Four sections: What is changing (Short description, required, 160 characters; Description; Category from the categories in the data; Affected service), Type and risk (Type; Risk, locked to Low for Standard changes; a callout saying whether the change is pre-approved, needs the change manager, goes to the CAB with the next slot, or takes the emergency path, plus the derived priority), Schedule and routing (Planned start and end in UTC, defaulting to tomorrow 18:00 for two hours; Assignment group), Plans (Implementation, Backout, Test). The draft is created in state New with approval Not Yet Requested and `cabRequired` set for Normal changes above Low risk. "Create change" appends the record to `changesStore`, so it appears in the table and on the calendar, and toasts "Change CHG... created as draft". Closing a dirty form asks to discard; `?new=1` is stripped from the URL on close.

**CAB agenda view.** `?view=cab` filters to changes with `cabRequired` in state Assess or Authorize and uses the empty copy "CAB agenda is empty".

**Table.** Default sort is Planned start ascending.

| Column            | Default | Content                                                                   |
| ----------------- | ------- | ------------------------------------------------------------------------- |
| Number            | shown   | link to the record                                                        |
| Short description | shown   | title with category and affected service beneath                          |
| Type              | shown   | Standard (grey), Normal (blue), Emergency (red) pill; sorts in that order |
| State             | shown   | state badge; sorts in lifecycle order                                     |
| Risk              | shown   | Low, Moderate, High, Very High badge                                      |
| Approval          | shown   | Not Yet Requested, Requested, Approved, Rejected                          |
| Planned start     | shown   | date and time                                                             |
| Planned end       | hidden  | date and time                                                             |
| Assignment group  | shown   | group chip                                                                |
| Assigned to       | hidden  | user chip                                                                 |

Facets: Type, State, Risk, Approval. Search matches number, description and category. The Risk header carries a tooltip explaining when a change goes to the CAB. The table reads `changesStore`, so rows created from the sheet appear without a reload.

### Record page

**Toolbar.** Number; badges Type pill, State (reads `changesStore`), Risk and a short Priority badge. Actions: "View in calendar" and "Start implementation" (enabled only in state Scheduled; a tooltip explains why it is disabled otherwise; confirmation, then the change moves to Implement). Overflow: Copy as template (drafts a new change with the same plans in `changesStore` and toasts its number), Link incident (goes to the incident list), Follow / Unfollow (local toggle), Cancel change (confirmation, then state Canceled; disabled when Closed or Canceled).

**Meta chips.** Assigned to, Group, Window (links to the calendar; "Starts in ...", "In progress · ends ...", or "Ended ..."), Approval (green Approved, red Rejected, amber Requested), Opened.

**Lifecycle tracker.** Horizontal stepper over New, Assess, Authorize, Scheduled, Implement, Review, Closed; Canceled renders as a stopped marker.

**Aside.**

- Approval card. Lists approvers derived from the data: the Change Advisory Board group's manager as Change manager (Priya Natarajan in the seed) always; for CAB-required changes also the current user as CAB chair (Kevin Dargas) and the Security Operations group's manager as Security (Hannah Müller). Shows "N of M approved", a segmented progress bar and "CAB Thursday 09:00 UTC" (`cabSchedule.label`, with the next slot date from `nextCab()`) when CAB is required. The card reads the same `approvalsStore` as the Approvals inbox, so a decision taken on `/approvals` shows here and vice versa. Buttons depend on the approval state: "Request approval" (Not Yet Requested; adds the change to the inbox), "Approve" and "Reject" (Requested; reject needs a reason of at least 10 characters; approving a change in Assess or Authorize also moves it to Scheduled), "Re-request approval" (Rejected). Once Approved, the card says the change can be scheduled within the maintenance window. Toasts describe the session-only state change.
- Schedule. Window progress bar (fills while the window is active), planned start and end, a "Default maintenance window: Weekdays 18:00 to 00:00 UTC" line (no data field exists), and a Conflicts count (red when above zero).
- Risk assessment. Five factors each with a three-bar level: Change risk, Service criticality, Impacted services, Open incidents on service, Schedule conflicts, plus a line stating whether CAB authorization, change manager approval or no review (standard change) is required.
- Affected service card, linking to Service Health.

**Main.** A red "Schedule conflict detected" alert listing other open changes on the same service within 24 hours of this planned start; Description; Details (requested by, affected service, group, assignee, type, category, impact, CAB required, opened, last updated; the dead "Edit" button was removed); tabs:

| Tab               | Content                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Planning          | Implementation plan, Test plan, Backout plan as three text blocks                                            |
| Impacted services | services that depend on this change's service (parents in `ciRelationships`) with class, criticality, status |
| Incidents         | incidents linked by `changeId` plus open incidents on the same service (max six); "Link incident"            |
| Activity          | shared activity stream                                                                                       |

### Calendar

Month and Week views with previous, next and Today buttons and a range label in a section heading. The grid scrolls horizontally on narrow screens (minimum 56rem) instead of clipping. Each day cell shows up to three chips (six in week view) tinted by type through the shared tone system, with the start time and a tooltip (number, type, risk, window). Days inside a freeze window are hatched and tagged "Freeze"; the windows come from `changeFreezeWindows` in `lib/data/itsm.ts` (Black Friday freeze 26 to 30 November 2026, Quarter-end freeze 28 December 2026 to 3 January 2027; the end date is exclusive in the data) and are the same list the scheduler's deploy freezes derive from. Clicking a day fills the side card with that day's changes (state, risk, group, assignee) or a small "Nothing scheduled" empty state with freeze guidance. Canceled changes are excluded. The calendar reads `changesStore`, so a change created from the header sheet shows up on its planned day. The header offers "List view" and "New change" (opens the sheet).

## What to check

Every day

- Emergency tile. Each emergency change should be in Implement, Review or Closed with a linked incident in its Incidents tab; an emergency change without an incident needs justification.
- Changes whose window is active (Window chip "In progress"). Check the Schedule progress bar and that the assignee is set.
- Schedule conflict alert on any change starting in the next 24 hours. Two changes on the same service in one night need to be re-sequenced or one deferred.
- Awaiting approval. Open `?view=cab` and clear the agenda before the CAB meeting; changes in Authorize are blocked until approved.

Every week

- Scheduled this week versus the calendar. Walk the week view; chips landing on hatched freeze days (other than emergency) must move.
- Risk assessment card on High and Very High changes. Service criticality "Most Critical" plus open incidents on the service plus a conflict is three red bars; that change should not be approved without a reviewed backout plan.
- Approval state Rejected. Rejected changes stay off the CAB agenda until re-requested; confirm the requester has addressed the reason.
- Planning tab. Standard changes still need a backout plan; in the seed all plans are templated text, so in a live system check they are specific.
- Analytics change section: emergency share above 10 percent and a growing "Awaiting approval" slice mean the process is backing up.

## Actions

| Action                                              | Behaviour in the template                                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| New change (list header, calendar header, `?new=1`) | opens the create sheet; "Create change" appends a New change to `changesStore` and toasts its number                                |
| Request approval / Approve / Reject / Re-request    | writes `approvalsStore` (shared with `/approvals`); reject validates a 10-character reason; approving moves the change to Scheduled |
| Start implementation                                | enabled only when Scheduled (tooltip otherwise); confirmation, then state Implement in `changesStore`                               |
| View in calendar, Window chip                       | navigate to the calendar                                                                                                            |
| Copy as template                                    | adds a New change with the same plans to `changesStore` and toasts its number                                                       |
| Link incident                                       | navigates to `/itsm/incidents`                                                                                                      |
| Follow / Unfollow                                   | local toggle                                                                                                                        |
| Cancel change                                       | confirmation, then state Canceled; disabled when Closed or Canceled                                                                 |
| Calendar navigation, view toggle, day selection     | local state                                                                                                                         |

## Reading the data

**States** (`changeStates`) and tones: New (blue), Assess (amber), Authorize (amber), Scheduled (blue), Implement (brand), Review (amber), Closed (grey), Canceled (grey).

**Types** (`changeTypes`): Standard, Normal, Emergency. Standard changes are always Low risk and never need CAB. `cabRequired` is true for Normal changes whose risk is not Low.

**Risk** (`changeRisks`) tones: Low (green), Moderate (blue), High (amber), Very High (red). Impact is derived from risk (High or Very High gives impact 1, Moderate 2, Low 3), and priority from impact and urgency (urgency 1 for Emergency, otherwise 2).

**Approval** values: Not Yet Requested (New, Assess), Requested (Authorize), Approved (Scheduled onward), Rejected (some Canceled). Tones: Not Yet Requested grey, Requested amber, Approved green, Rejected red.

**Conflicts** are other non-closed changes on the same `ciId` whose planned start is within 24 hours of this one.

**Impacted services** are services where a `ciRelationships` row has this change's service as `childId`.

## How the data gets here

`changes` in `lib/data/itsm.ts` is built from 25 fixed templates (`CHG0031101` to `CHG0031125`) with `createRng(3111)`. Each template fixes title, type, category, group and CI; the seed draws state, risk, planned window (18:00 to 23:00 UTC start, 1 to 6 hours, between 30 days ago and 21 days ahead), requester and assignee. Implementation, test and backout plans are the same template text for every change.

The CAB slot is `cabSchedule` in `lib/constants.ts` ("Thursday 09:00 UTC"); `nextCab()` in `lib/data/itsm.ts` computes the next occurrence after `NOW` for the "Next CAB" hint. Freeze windows are `changeFreezeWindows` in `lib/data/itsm.ts`. Changes created in the browser live in `changesStore` (`features/changes/changes-store.ts`, a `createListStore` seeded from `changes`) and are not persisted. Impacted services use `ciRelationships` and `configurationItems` from `lib/data/cmdb.ts` (internal, no page). The approval records shown on `/approvals` are seeded in `lib/data/activity.ts` and held client-side in `approvalsStore` (`features/workspace/approvals-store.ts`), which the approval card reads and writes too.

## Related pages

- [Approvals](../workspace/approvals.md) (the approver's queue), [Incidents](./incidents.md), [Problems](./problems.md)
- [Service health](../service-health/service-health.md) ("Changes in flight" per service)
- [Analytics](../workspace/analytics.md) (change throughput and pipeline), [Overview dashboard](../workspace/overview-dashboard.md) (upcoming changes)
