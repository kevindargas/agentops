# My Work

My Work is the personal inbox. It pulls together everything that waits on the current user across modules: agent answers to review, experiments they own, incidents and changes assigned to them, approvals routed to them, things they have requested or reported, and a short "recently viewed" trail. It is for an individual operator, not a team lead.

In the mock data the current user is Kevin Dargas (`u-001`), so the counts reflect what is assigned to or requested by him.

## Where to find it

- Route: `/my-work`. Sidebar: Workspace, My Work. Chord `G` then `W`.
- Also reached from the "View all" button on the Overview "My work" card and the "View all" link in the notifications popover.
- Code: `app/(app)/my-work/page.tsx` (server component that builds the sections) and `features/workspace/my-work-board.tsx` (client board with filters).

## What is on the page

**Header.** `PageHeader` with the Workspace eyebrow and nav icon, a description, and two buttons: "Explore traces" (`/agentops/traces`) and "Open Review Queue" (`/agentops/reviews`).

**Stat tiles.** A `StatGrid` of four compact cards (no icons).

| Tile              | Value                                                              | Hint                                                                     |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Assigned to me    | count of items in the Assigned section                             | reviews, incidents and changes split                                     |
| Reviews waiting   | pending review items assigned to me (links to `/agentops/reviews`) | P1 reviews labelled "policy matches", plus open drift signals fleet-wide |
| Needs attention   | items flagged `attention` in the Assigned section                  | "Policy matches, breached SLA, P1 or overdue"                            |
| Pending approvals | approvals where I am the approver and the state is still Requested | link "Review approvals" to `/approvals`                                  |

**Filter bar.** Record-type chips All, Reviews, Experiments, Incidents, Changes, Requests, plus a "Needs attention only" toggle. Filters apply to all four sections at once. When nothing matches, an empty state offers "Clear filters".

**Assigned to me** (shows 6, "Show N more" expands):

- Open incidents where `assignedToId` is me. Due is the SLA due time. Flagged for attention when the SLA has breached or the priority is P1. Person chip shows the caller.
- Changes assigned to me that are not Closed or Canceled. Due is the planned start. Flagged when type is Emergency or risk is Very High.
- Pending review items assigned to me. Due is created time plus 48 hours. Flagged when priority is P1. Links to `/agentops/reviews`.
- Experiments I own that are not Completed. Due is the planned end. Links to `/agentops/experiments?open=<id>`, which opens the experiment sheet.

Sorted with attention items first, then by priority.

**My approvals** (shows 4). Approvals where `approverId` is me and the state is Requested, sorted by due date. Flagged for attention when due in under 36 hours. "Review all" goes to `/approvals`. Links resolve by record number prefix (`recordHref`): changes to the change, requests to the request, knowledge approvals to the article. This section is built on the server from the seed, so decisions taken on `/approvals` in the same session do not remove rows here until a reload.

**My requests** (shows 5). Incidents I reported (as caller, up to 6), requests requested for or by me, and changes I requested (up to 4). Sorted by last update. Person chip shows the assignee.

**Recently viewed.** A fixed, deterministic trail of six records with fixed "viewed" times: the open major incident, a change with approval Requested, the most viewed published knowledge article, a drifting agent, a trace needing review and a breached non-major incident. This is a placeholder for real view history.

**Row anatomy.** Type icon with a tint per type (from `toneClasses`), record number in mono, optional "Needs attention" badge, title, meta line (group and category, change type and risk, trace id, experiment split and significance), person chip, due countdown or last-updated time, type label, priority badge (when the record has one), state badge, chevron. The whole row is a link.

## What to check

Every day

- Needs attention tile. Anything above zero should be opened first. Turn on "Needs attention only" to see just those rows.
- Due countdowns in red ("Overdue ...") on incidents mean the resolution SLA has passed. Open the incident and either resolve it or put it on hold with a reason.
- Reviews waiting. Pending reviews older than 48 hours show as overdue because the due date is created plus 48 hours. Work the review queue.
- My approvals with less than 36 hours left are flagged; decide on them in Approvals so changes can be scheduled and requests can start fulfillment.
- Experiments you own with a passed end date are still shown as not Completed. Promote, stop or extend them in Experiments.

Every week

- My requests. Requests that are still "Waiting for Approval" after several days are stuck with an approver; chase them from the request record.
- Recently viewed. In the template this list is static. After wiring real view history, use it to confirm the records you touched were actually updated.

## Actions

- Record-type chips and the attention toggle filter the board. Client state only, not written to the URL.
- "Show N more" / "Show less" expands a section. Section counts use the shared `CountPill`; empty sections render the shared `EmptyState`.
- Every row is a link to the record. There are no mutations on this page.

## Reading the data

- Type tints: Review and Agent (progress), Experiment (success), Incident (danger), Problem (warning), Change (info), Request (progress), Trace and Knowledge (muted); all from `toneClasses` in `components/shared/status-badge.tsx`. The `Problem` type exists in `WorkItemType` but no problems are sourced into any section.
- Due label: "Nm left" under one hour, "Nh left" under 48 hours, otherwise "Nd left"; red when overdue, amber when under 24 hours.
- State badges follow `stateTone` in `components/shared/status-badge.tsx`: incident, change, request and review states as on their own pages; experiment states Running (brand), Draft (grey), Promoted (green), Stopped (grey); agent health Drifting (amber); trace status Needs review (amber).
- The "policy matches" count in the Reviews tile is simply P1 reviews, not a filter on review reason.

## How the data gets here

- Incidents, changes, requests: `lib/data/itsm.ts`.
- Review items, experiments, agents, traces, drift signals: `lib/data/agentops.ts`.
- Approvals: `lib/data/activity.ts` (`approvals`, all routed to `u-001`).
- Knowledge articles: `lib/data/catalog.ts` (`knowledgeArticles`).
- Current user: `currentUser` in `lib/data/users.ts` (first user, Kevin Dargas).
- The "recently viewed" trail is assembled in the page from fixed picks; replace `recentSources` with a view-history source.

Everything is anchored to `NOW` in `lib/data/seed.ts`. The board receives `nowIso` as a prop so server and client agree on countdowns.

## Related pages

- [Overview dashboard](./overview-dashboard.md), [Approvals](./approvals.md)
- [Incidents](../service-management/incidents.md), [Changes](../service-management/changes.md), [Requests](../service-management/requests.md)
- Review Queue (`/agentops/reviews`) and Experiments (`/agentops/experiments`) in Agent Operations
