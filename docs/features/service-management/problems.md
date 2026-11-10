# Problems

Problems track the root cause behind recurring incidents. A problem moves through assessment and root cause analysis to a fix, and can publish a known error with a workaround so the Service Desk resolves faster while the permanent fix is delivered through a change. Used by problem managers and resolver-group leads.

## Where to find it

- List: `/itsm/problems`. Sidebar: Service Management, Problems (no chord).
- Record: `/itsm/problems/<number>`, for example `/itsm/problems/PRB0040011`.
- New problem sheet: `/itsm/problems?new=1` opens it on load (used by quick create and the command menu).
- Code: `app/(app)/itsm/problems/page.tsx`, `app/(app)/itsm/problems/[number]/page.tsx`, `features/problems/problems-table.tsx`, `new-problem-sheet.tsx`, `problems-store.ts`. Data in `lib/data/itsm.ts` (`problems`, `getProblem`, `incidentsForProblem`); states in `problemStates` in `lib/constants.ts`.

## What is on the page

### List page

**Header.** Driven by the nav entry (eyebrow "Service Management", icon, title), with "Known error articles" (goes to `/itsm/knowledge`) and "New problem" (opens the create sheet). The table toolbar has no create button; the header is the single create action.

**Stat tiles.** Compact tiles without icons: Open problems (not Resolved or Closed; hint P1/P2 count), In root cause analysis, Known errors (hint: how many have a documented workaround), Incidents linked (sum of `incidentsForProblem(number).length` across all problems, the same figure as each problem's `relatedIncidents`).

**New problem sheet.** Three sections: What keeps happening (Short description, required, 160 characters; Affected service, optional), Priority and routing (Priority P1 to P5 with a live badge; Assignment group), Workaround (optional text and a "Publish as known error" checkbox that only takes effect when a workaround is given). "Create problem" appends a New problem with zero linked incidents to `problemsStore`, so it appears in the table, and toasts its number. Closing a dirty form asks to discard; `?new=1` is stripped on close.

**Table.** Default sort is Incidents descending.

| Column            | Content                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Number            | link to the record; bookmark icon when `knownError`                                                 |
| Short description | title                                                                                               |
| Priority          | priority badge                                                                                      |
| State             | state badge                                                                                         |
| Incidents         | `relatedIncidents`, derived from the incidents that carry this problem id; the header has a tooltip |
| Affected service  | name of the linked service or system, or empty                                                      |
| Assignment group  | group chip                                                                                          |
| Assigned to       | user chip                                                                                           |
| Opened            | relative date                                                                                       |

Facets: State, Priority, Known error (yes/no), Group. Search matches number and description. The table reads `problemsStore`, so a problem created from the sheet appears without a reload.

### Record page

**Toolbar.** Number, badges Priority, State and an amber "Known error" badge; the badges read `problemsStore` so the actions below flip them in place. Actions: "Publish known error" (opens a dialog with an optional workaround, sets `knownError`; disabled and relabelled "Known error published" afterwards) and "Create change" (opens a dialog prefilled from the problem, appends a New change to `changesStore` so it appears in the change list and on the calendar, and moves the problem to Fix in Progress; disabled when Resolved or Closed). Overflow: Link incident (goes to `/itsm/incidents`), Move to root cause analysis (sets the state), Follow / Unfollow (local toggle), Close problem (confirmation that linked incidents stay in their current state, then state Closed).

**Meta chips.** Assigned to, Group, Opened, Incidents ("N linked · M open", amber when any are open; counted with `incidentsForProblem`).

**Aside.** Lifecycle (vertical tracker over New, Assess, Root Cause Analysis, Fix in Progress, Resolved, Closed, with "In <state> since ..." or "Closed <date>"), Impact (linked incidents, still open, P1/P2 among them, workaround available or not; the same `incidentsForProblem` list as the chip and the Incidents tab), Affected service (card linking to Service Health, plus support group and owner).

**Main.** A "Workaround available" alert when a workaround exists; Analysis with two boxes, Root cause ("Not yet identified. Analysis in progress." when empty) and Workaround ("No workaround documented."); Details (affected service, Known error yes/no, group, assignee, opened, last updated; the dead "Edit" button was removed); tabs:

| Tab       | Content                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Activity  | shared activity stream                                                                                    |
| Incidents | incidents whose `problemId` equals this problem (`incidentsForProblem`); "Link incident" goes to the list |
| Changes   | up to three seeded changes on the same service (server-rendered; a change drafted here shows on the list page, not in this tab) |

## What to check

Every day

- Open problems with open linked incidents (amber Incidents chip). These are live. Make sure the problem has an assignee and that the Workaround box is filled in if one exists, because the incident page tells agents to inherit it.
- Problems in Root Cause Analysis with a P1 or P2 priority. Confirm the assignee updated the activity stream recently.

Every week

- Known errors without a knowledge article. "Known error" means an article should exist; use the "Known error articles" button and search for the problem title in Knowledge. The seeded article "Wi-Fi drops intermittently on HQ floors 3-5" is the model.
- Problems in Fix in Progress with no change in the Changes tab. The fix should be tracked as a change on the same service; use "Create change".
- Incidents linked versus the Incidents tab. `relatedIncidents` is derived from the incidents that carry this `problemId`, so the count and the Incidents tab agree in the sample. In a live system a gap between the two means incidents are not being linked.
- Problems opened more than 90 days ago still in Assess or New are stale; close them or reassign.

## Actions

| Action                         | Behaviour in the template                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| New problem (header, `?new=1`) | opens the create sheet; "Create problem" appends a New problem to `problemsStore` and toasts its number         |
| Publish known error            | dialog with optional workaround; sets `knownError` (and the workaround) in `problemsStore`; the badge flips     |
| Create change                  | dialog prefilled from the problem; appends a New change to `changesStore`, moves the problem to Fix in Progress |
| Link incident                  | navigates to `/itsm/incidents`                                                                                  |
| Move to root cause analysis    | sets state Root Cause Analysis                                                                                  |
| Follow / Unfollow              | local toggle                                                                                                    |
| Close problem                  | confirmation dialog, then state Closed; disabled when Resolved or Closed                                        |
| Row click                      | opens the record                                                                                                |

Record actions write `problemsStore` for the session only; a reload returns to the seed.

## Reading the data

**States** (`problemStates`) and tones:

| State               | Tone  | Meaning                                            |
| ------------------- | ----- | -------------------------------------------------- |
| New                 | blue  | logged                                             |
| Assess              | amber | being qualified                                    |
| Root Cause Analysis | amber | investigation in progress                          |
| Fix in Progress     | brand | cause known, fix underway (often through a change) |
| Resolved            | green | fix delivered                                      |
| Closed              | grey  | verified and archived                              |

- Known error (bookmark icon, amber pill) is only ever set on problems in Root Cause Analysis, Fix in Progress or Resolved in the seed, and always comes with a workaround text.
- Root cause text is present for Fix in Progress, Resolved and Closed.
- Priority badges follow the incident scale (P1 red through P5 grey).
- The affected service card shows the class, environment and business criticality and links to Service Health; services have no record page of their own.

## How the data gets here

`problems` in `lib/data/itsm.ts` is built from twelve fixed titles (`PRB0040001` to `PRB0040012`) with `createRng(4001)`: state, priority, group, assignee, affected service, known error and workaround/root cause text are drawn deterministically; `relatedIncidents` is counted from the incidents that carry the problem id (`incidentsForProblem`). The headline incident `INC0010078` links to `PRB0040011` ("payments-svc crash loop under memory pressure"). Problems created in the browser live in `problemsStore` (`features/problems/problems-store.ts`) and are not persisted.

Incidents reference problems through `Incident.problemId`; the record page filters `incidents` by that field. Changes in the Changes tab are matched by `ciId`, not by an explicit link. Replace `problems`, `getProblem` and the handlers in `problems-table.tsx` and the record page overflow to connect a backend.

## Related pages

- [Incidents](./incidents.md) (linked incidents, "Create problem" from a record)
- [Changes](./changes.md) (the fix), [Knowledge](./knowledge.md) (known error articles)
- Service desk checklist in the [Service Management index](./README.md)
