# Requests

Requests are orders placed from the Service Catalog. One request (REQ) holds one or more requested items (RITM), and each item is fulfilled through catalog tasks (SCTASK) assigned to a fulfillment group. Requests that need approval wait on the requester's manager before any task is created.

Used by requesters tracking their orders, approvers, and fulfillment groups (Hardware Fulfillment, Identity and Access, Cloud Platform and so on).

## Where to find it

- List: `/itsm/requests`. Sidebar: Service Management, Requests. Chord `G` then `Q` (`G R` belongs to the Review Queue).
- Record: `/itsm/requests/<number>`, for example `/itsm/requests/REQ0020335`.
- New requests are created from the catalog, not here: "New request" goes to `/itsm/catalog`.
- Code: `app/(app)/itsm/requests/page.tsx`, `[number]/page.tsx`, `features/requests/requests-table.tsx`, `features/requests/requests-store.ts`. Data in `lib/data/itsm.ts` (`requests`, `getRequest`) and `lib/data/catalog.ts` (`getCatalogItem`); states in `requestStates` in `lib/constants.ts`; the spend delta in `lib/data/metrics.ts`.

## What is on the page

### List page

**Header.** Driven by the nav entry (eyebrow "Service Management", icon, title), with "Approvals" (`/approvals`) and "New request" (`/itsm/catalog`).

**Stat tiles.** Compact tiles without icons: Open requests (state not starting with Closed; hint: requested items in flight), Pending approval, Open fulfillment tasks (tasks not Closed across open requests), Fulfilled spend (30d) (sum of price for Closed Complete requests updated in the last 30 days, from `fulfilledRequestSpendDelta(30)`; the delta is the percent change against the 30 days before, or a hint with the previous figure when that window is empty).

**Table.** Default sort Opened descending.

| Column        | Default | Content                                                                                                          |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| Number        | shown   | link to the record                                                                                               |
| Items         | shown   | catalog item names, with "N items · M tasks" beneath                                                             |
| Requested for | shown   | user chip                                                                                                        |
| State         | shown   | state badge                                                                                                      |
| Stage         | shown   | Waiting for Approval, Fulfillment, Delivery, Completed, Cancelled; header tooltip explains it derives from state |
| Approval      | hidden  | Not Yet Requested, Requested, Approved, Rejected                                                                 |
| Price         | shown   | "Free" or currency                                                                                               |
| Opened        | shown   | relative date                                                                                                    |
| Due           | shown   | date; red when past due and still open                                                                           |

Facets: State, Stage, Category (category of the first item; options are the categories present in `catalogItems`). Search matches the request number, RITM numbers and item names. The toolbar and the empty state both offer "Browse catalog". The table reads `requestsStore`, so a request submitted from the catalog appears at the top without a reload.

### Record page

**Toolbar.** Number; title is the catalog item names; description "N items · price"; badges State and Stage, read from `requestsStore`. Actions: when approval is Requested, "Reject" and "Approve": Approve opens a dialog with an optional comment and sets the request to In Progress / Fulfillment; Reject requires a reason of at least 10 characters and closes the request as Closed Cancelled. Both write the shared `approvalsStore`, so the matching inbox entry on `/approvals` is decided at the same time. Otherwise "Order again" (`/itsm/catalog`). Overflow: Duplicate request (adds a Pending Approval copy with new REQ and RITM numbers to `requestsStore`), Follow / Unfollow (local toggle), Cancel request (confirmation, then Closed Cancelled; disabled when closed).

**Meta chips.** Requested for, Approval (tone by state, reads `approvalsStore`), Opened, Due (red when past and open), Total.

**Lifecycle tracker.** Waiting for Approval, Fulfillment, Delivery, Completed; Cancelled renders as stopped.

**Aside.** Approval (approver is the current user, Kevin Dargas in the seed; requested-by chip; while Requested a note says the approver is reminded after `approvalReminderHours` (18 hours) with the derived time), Delivery (progress from opened to due date, "N / M complete" tasks, expected-by date), Request details (requested for, opened, last updated, total price).

**Main.** Requested items, one card per RITM: number, stage badge, "done/total tasks", catalog name and description, variables (Justification, Cost center, Delivery location), line price and quantity, fulfillment group. Tabs:

| Tab               | Content                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Fulfillment tasks | SCTASK rows: number, description ("Fulfill: ..." or "Deliver and confirm receipt: ..."), item, group, assignee, state, due |
| Activity          | shared activity stream, composer defaults to Comment (customer-visible)                                                    |

## What to check

Every day

- Pending approval tile. Each one is also on `/approvals`; approve or reject there so fulfillment can start.
- Due column in red. Open requests past their due date are late deliveries. Open the record, look at the Fulfillment tasks tab and find the task without an assignee.
- Tasks in state Open (as opposed to Work in Progress) with a due date today or earlier have not been picked up by the fulfillment group.

Every week

- Open fulfillment tasks tile trending up while Open requests is flat means tasks are being created but not closed; check the fulfillment groups on Users & Groups.
- Requests in stage Delivery for more than a few days: the "Deliver and confirm receipt" task is waiting on the requester.
- Fulfilled spend. Compare with the catalog prices; large jumps usually mean hardware orders with quantity 2.
- Closed Incomplete requests (red state badge) deserve a comment in Activity explaining what was not delivered.

## Actions

| Action                                     | Behaviour in the template                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| New request / Order again / Browse catalog | navigate to `/itsm/catalog`                                                                            |
| Approvals                                  | navigates to `/approvals`                                                                              |
| Approve (record toolbar)                   | dialog with optional comment; decides the approval in `approvalsStore`, sets In Progress / Fulfillment |
| Reject (record toolbar)                    | dialog with a required reason; decides the approval, sets Closed Cancelled                             |
| Duplicate request                          | adds a Pending Approval copy with new numbers to `requestsStore`                                       |
| Follow / Unfollow                          | local toggle                                                                                           |
| Cancel request                             | confirmation, then Closed Cancelled; disabled when closed                                              |
| Post comment / Add note                    | toast only                                                                                             |

Record actions write `requestsStore` and `approvalsStore` for the session only; nothing is persisted.

## Reading the data

**Request states** (`requestStates`) and tones: Pending Approval (amber), Approved (green), In Progress (brand), Closed Complete (green), Closed Incomplete (red), Closed Cancelled (grey).

**Stages** (`RequestStage`) and tones: Waiting for Approval (amber), Fulfillment (brand), Delivery (brand), Completed (green), Cancelled (grey). Stage is derived from state: Pending Approval gives Waiting for Approval, Approved gives Fulfillment, In Progress gives Fulfillment or Delivery, Closed Cancelled gives Cancelled, other closed states give Completed.

**Task states**: Open (blue), Work in Progress (brand), Closed Complete (green), Closed Incomplete (red). Tasks exist only once a request has left Waiting for Approval; the first task is "Fulfill", the optional second is "Deliver and confirm receipt".

**Approval**: Requested while Pending Approval, Rejected when Closed Cancelled, otherwise Approved.

Price is the sum of catalog item price times quantity across items. "Free" and "No charge" denote zero.

## How the data gets here

`requests` in `lib/data/itsm.ts` is built by `buildRequests(36)` with `createRng(9091)`: numbers `REQ0020301` to `REQ0020336`, RITM numbers from `RITM0050200`, SCTASK numbers from `SCTASK0070400`. Each request draws requested-for and requested-by (same person 85 percent of the time), state, one to three catalog items, quantity (hardware sometimes 2), tasks with due dates inside the item's delivery window, and a due date between two days ago and seven days ahead. Catalog items and fulfillment groups come from `lib/data/catalog.ts` and `lib/data/users.ts`.

Approvals shown on `/approvals` are derived from these requests in `lib/data/activity.ts` (first five with approval Requested). Requests submitted from the catalog in the browser live in `requestsStore` (`features/requests/requests-store.ts`, a `createListStore` seeded from `requests`) and are not persisted. Replace `requests`, `getRequest` and the record page handlers to connect a fulfillment backend.

## Related pages

- [Service Catalog](./service-catalog.md) (where requests start), [Approvals](../workspace/approvals.md)
- [My Work](../workspace/my-work.md) (My requests section), [Overview dashboard](../workspace/overview-dashboard.md) (recent open requests)
- [Users & Groups](../administration/users-and-groups.md) (fulfillment groups)
