# Approvals

Approvals is the decision queue for the current user: change requests waiting for authorization and catalog requests waiting for a manager. Approving a change moves it to Scheduled; approving a request starts fulfillment. The page supports single and bulk decisions with an optional comment.

In the mock data every approval is routed to Kevin Dargas (`u-001`), who is CAB chair and the manager approver for requests.

## Where to find it

- Route: `/approvals`. Sidebar: Workspace, Approvals (the sidebar badge is the live pending count from `config/nav-counts.ts`). Chord `G` then `A`.
- Also linked from the Overview "Pending approvals" tile, the My Work "Review all" button, the Requests page header and the user menu ("My approvals").
- Code: `app/(app)/approvals/page.tsx`, `features/workspace/approvals-list.tsx` (list, decision dialog, decision history sheet), `features/workspace/approvals-stats.tsx` (stat row) and `features/workspace/approvals-store.ts` (shared client store).

## What is on the page

**Header.** `PageHeader` with the Workspace eyebrow, with two buttons: "CAB agenda" (`/itsm/changes?view=cab`) and "Decision history", which opens a sheet listing every approval decided in this session (with a count pill once there is at least one). The sheet reads the same store as the list, so decisions taken on a change or request record appear there too.

**Stat tiles.** A `StatGrid` of four compact cards rendered by the client `ApprovalsStats` component: Pending (approvals in state Requested), Due within 36h, Changes (hint: how many are High or Very High risk, looked up from the change record), Requests. They read the shared store, so they drop as decisions are made.

**Toolbar.** Type filter chips All / Changes / Requests with counts, a "Select all" checkbox (indeterminate when only some visible cards are selected) and a sort select: Due soonest (default), Newest first, Highest risk.

**Bulk bar.** Appears when at least one card is selected and sticks under the header: "N selected" with the change/request split, Clear, Reject, "Approve N".

**Approval cards.** One card per approval:

| Element          | Change approval                             | Request approval                                                                                                                                      |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badge and number | "Change", `CHG...` link to the change       | "Request", `REQ...` link to the request (a Knowledge approval would link to its `KB...` article; links resolve by number prefix through `recordHref`) |
| Title            | change short description                    | catalog item names                                                                                                                                    |
| Detail line      | type, category, "CAB required" when set     | item count and stage                                                                                                                                  |
| Requested by     | requester chip                              | requester chip                                                                                                                                        |
| Second column    | Planned window (start to end)               | Requested for (only when different from requester)                                                                                                    |
| Risk             | change risk badge                           | Low, or Moderate when price is 1500 or more; plus amount or "No cost"                                                                                 |
| Due              | date plus "Nh left", "Nd left" or "overdue" | same                                                                                                                                                  |

Due is red when overdue and amber when under 36 hours. Each card has Approve and Reject buttons and a selection checkbox.

**Decision dialog.** Approve or Reject opens an alert dialog. For bulk decisions it lists the records. A labelled textarea takes an optional comment ("Reason for rejection" for reject; not validated). Confirming marks the approvals Approved or Rejected in the shared store, which removes them from the pending list, and shows a toast that only describes what happened locally ("Recorded in this session"). Nothing is sent anywhere.

**Empty state.** "No pending approvals" with a "Back to My Work" button once the list is empty, or a per-type empty state when the filter hides everything.

## What to check

Every day

- Due within 36h tile. Anything above zero is about to block a maintenance window or a fulfillment task. Sort by "Due soonest" and clear those first.
- Overdue cards (red "overdue"). An overdue change approval means the planned window may already have passed; open the change and check the Schedule card before approving.
- Changes with High or Very High risk. Open the change record, read the Planning tab (implementation, test, backout) and the Risk assessment card before approving. Reject with a reason if the backout plan is missing detail.
- Request approvals with an amount. Check "Requested for" versus "Requested by" when they differ; that is an order on behalf of someone else.

Every week

- Pending count that does not go down. Approvals in this template are seeded from changes in Authorize and requests in Pending Approval. In a live system a flat count means approvals are being created faster than decided; look at who is requesting them.
- Compare the CAB agenda (`/itsm/changes?view=cab`) with the Changes filter here. Changes in Assess appear on the agenda but not here until approval is requested.

## Actions

| Action                        | Effect in the template                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Approve (card or bulk)        | sets the approval to Approved in the shared store, success toast                                                                   |
| Reject (card or bulk)         | sets the approval to Rejected in the shared store, neutral toast; mentions the comment if one was typed                            |
| Select all / checkbox / Clear | local selection                                                                                                                    |
| Type filter, sort             | local state, not in the URL                                                                                                        |
| CAB agenda                    | navigates to `/itsm/changes?view=cab`                                                                                              |
| Decision history              | opens a sheet listing approvals decided in this session, newest first, with record type, number link, requester and decision badge |

Decisions are shared with the record pages: the approval card on a change record (`features/changes/change-approval-card.tsx`) and the approve/reject actions on a request record read the same `approvalsStore`, so approving here and then opening the change shows "Approved". Requesting approval from a change record adds a row to this inbox. Reloading restores the seed.

## Reading the data

- Risk badge tones: Low (green), Moderate (blue), High (amber), Very High (red). For requests the risk is synthetic: price of 1500 or more is Moderate, otherwise Low.
- Record badge "Change", "Request" or "Knowledge" is the approval's `recordType`. No knowledge approvals are seeded; if one were, the card would show a book icon, Low risk and link to `/itsm/knowledge/<number>`.
- Due dates are seeded as two days from now for changes and one day from now for requests, so "Due within 36h" equals the request count in the stock data.
- The "requested" time on a change approval is the change's last update; on a request approval it is the request's opened time.

## How the data gets here

`approvals` is exported from `lib/data/activity.ts`. It is derived at module load: every change with `approval === "Requested"` (state Authorize) becomes a Change approval, and the first five requests with `approval === "Requested"` (state Pending Approval) become Request approvals. All have `approverId: "u-001"` and `state: "Requested"`.

`features/workspace/approvals-store.ts` wraps that list in `createListStore` (from `lib/store.ts`) and exports `pendingApprovals`, `decidedApprovals`, `approvalForRecord`, `decideApprovals` and `requestApproval`. `features/workspace/approvals-list.tsx` reads the store and enriches each pending approval during render with the change's risk, type and planned window, or the request's catalog item names, price and requested-for user (`getChange`, `getRequest` from `lib/data/itsm`, `getCatalogItem` from `lib/data/catalog`). To wire a backend, seed the store from an API client returning the `Approval` type from `lib/types.ts` and make `decideApprovals` call a mutation.

## Related pages

- [My Work](./my-work.md) (My approvals section)
- [Changes](../service-management/changes.md) (approval card and CAB agenda view)
- [Requests](../service-management/requests.md) and [Service Catalog](../service-management/service-catalog.md)
