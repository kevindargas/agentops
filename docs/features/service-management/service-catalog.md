# Service Catalog

The Service Catalog is the storefront: hardware, software, access, cloud resources, collaboration tools, HR services and facilities requests. Picking an item opens an order sheet; submitting creates a request that either starts fulfillment immediately or waits for the requester's manager. It is the employee-facing entry point, and the page every "New request" button leads to.

## Where to find it

- Route: `/itsm/catalog`. Sidebar: Service Management, Service Catalog (no chord). Quick create "Service request" and the command menu "New service request" also land here.
- Deep links: `?q=<text>` pre-fills the search, `?category=<name>` pre-selects a category (ignored if the name is not one of the seven categories).
- Code: `app/(app)/itsm/catalog/page.tsx` (static), `features/catalog/catalog-view.tsx` (reads `?q=` and `?category=` on the client inside `Suspense`), `features/catalog/catalog-browser.tsx` (browser, item card and request sheet). Submitted requests go into `features/requests/requests-store.ts`. Data in `lib/data/catalog.ts` (`catalogItems`, `getCatalogItem`).

## What is on the page

**Header.** Driven by the nav entry (eyebrow "Service Management", icon, title), with "My requests" (`/itsm/requests`).

**Hero.** Item count and popular count, a large search box with a clear button, and suggestion chips: MacBook, Salesforce, Kubernetes, Parental leave, Badge.

**Filter row.** Category toggles with counts, built from the categories present in `catalogItems`: All (24), Hardware (5), Software (4), Access & Accounts (4), Cloud & Infrastructure (4), Collaboration (2), HR Services (3), Facilities (2). Sort select: Most popular (default; popular first, then name), Name A to Z, Price: low to high, Fastest delivery.

**Popular right now.** A section (shared `Section` heading) shown only while browsing with no search and category All: the first four popular items as compact cards.

**Results.** A section headed "All services", the category name, or "Results for ..." with a count pill and a Clear button when filtered. Item cards show: category-tinted icon, price ("Free", or currency with "/mo" for Software, Collaboration and Cloud & Infrastructure), delivery ("Instant" or "N days"), name with a sparkle for popular items, description, category badge, and either "Approval" (manager approval required) or "Auto-fulfilled". The whole card is a button that opens the request sheet. With no matches, an empty state offers "Open a general request", which goes to `/itsm/incidents?new=1`.

**Request sheet.** Uses the shared sheet frame (detail width, header, scrolling body, footer with Cancel and Submit request). Header with the item, its description and three facts: Price, Delivery, Approval (Manager or None). Fields: Requested for (default the current user, any user selectable), Quantity (1 to 10), Cost center (default CC-4210), Business justification (placeholder changes with approval requirement). An estimated total (price times quantity, "/mo" kept for subscription items) and a numbered path: Submit request, Manager approval (usually within a day) when required, Fulfilled by <group> in <delivery>.

## What to check

Every day

- Nothing on this page needs daily attention from an operator; it is for requesters. If people report they cannot find an item, try the search terms they used and the category filter.

Every week

- Items marked "Approval" versus the approver load on `/approvals`. The seed routes every approval to one person; in a live system confirm the manager mapping.
- Delivery promises. "Fastest delivery" sort shows the committed lead times; compare with the Due column on Requests to see whether fulfillment groups meet them.
- Popular flags. Four items are shown as "Popular right now"; in the template this is a static boolean per item, not computed from order volume.
- Price and "/mo" labels. The monthly suffix is inferred from category, not stored per item; a one-off software purchase would be mislabelled.

## Actions

| Action                                                 | Behaviour in the template                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search, suggestion chips, category toggle, sort, Clear | local state (initial values can come from `?q=` and `?category=`; later changes are not written back to the URL)                                                                                                                                                                                                                            |
| Card click / Enter / Space                             | opens the request sheet for that item                                                                                                                                                                                                                                                                                                       |
| Requested for, Quantity, Cost center, Justification    | local draft per item                                                                                                                                                                                                                                                                                                                        |
| Submit request                                         | builds a request with the next free REQ and RITM numbers (Pending Approval and Waiting for Approval when the item needs approval, otherwise In Progress and Fulfillment), appends it to `requestsStore` so it appears at the top of `/itsm/requests`, toasts "Request REQ... submitted" and closes the sheet. Not persisted across reloads. |
| Cancel                                                 | closes the sheet                                                                                                                                                                                                                                                                                                                            |
| My requests                                            | navigates to `/itsm/requests`                                                                                                                                                                                                                                                                                                               |
| Open a general request                                 | navigates to the incident sheet                                                                                                                                                                                                                                                                                                             |

## Reading the data

- Approval badge: `approvalRequired` on the item. Approval-required items go to Pending Approval; others start in Fulfillment.
- Delivery: `deliveryDays`; 0 renders "Instant" (only Privileged Access (Just-in-Time) in the seed).
- Fulfillment group: `fulfillmentGroupId`, resolved with `getGroup`. Groups used: Hardware Fulfillment (g-hw), Identity & Access (g-iam), Security Operations (g-sec), Cloud Platform (g-cloud), Infrastructure (g-infra), Database Services (g-dba), HR Shared Services (g-hr), Payroll Operations (g-payroll), Facilities (g-fac).
- Category tints come from the shared tone system (`toneClasses`) and chart tokens so they hold up in dark mode: Hardware brand, Software info, Access & Accounts warning, Cloud & Infrastructure success, Collaboration chart-5, HR Services chart-2, Facilities muted.
- Icons are looked up by the item's `icon` slug; unknown slugs fall back to a boxes icon.

## How the data gets here

`catalogItems` in `lib/data/catalog.ts` is a static array of 24 items (`cat-001` to `cat-061` with gaps), each with id, name, category, description, price, deliveryDays, icon, popular, approvalRequired and fulfillmentGroupId. The same file also holds `knowledgeArticles`. Requests built in `lib/data/itsm.ts` pick items from this array, and request rows resolve names with `getCatalogItem`.

To connect a backend, replace `catalogItems` with your catalog and swap the `requestsStore.add` call in `RequestSheet` for a create-request mutation that redirects to the new record.

## Related pages

- [Requests](./requests.md) (what a submitted order becomes), [Approvals](../workspace/approvals.md)
- [Incidents](./incidents.md) (fallback for things the catalog does not cover)
- [Users & Groups](../administration/users-and-groups.md) (fulfillment groups)
