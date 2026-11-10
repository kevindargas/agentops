# Adding a module

A module is a list page, optionally a record page, a data module, a client store and a navigation entry. This guide walks through the steps with a worked example: a **Webhooks** page under Govern that lists outbound webhook endpoints with a record sheet.

## 1. Model

Decide where the types live. Core domain types shared across modules go in `lib/types.ts`; types used by one feature live in its data module. Our example is self-contained, so the type goes with the data.

Create `lib/data/webhooks.ts`:

```ts
import { createRng, daysAgo, hoursAgo, int, pick } from "./seed"

export type WebhookStatus = "Active" | "Paused" | "Failing"

export interface Webhook {
  id: string            // whk-001
  name: string
  url: string
  events: string[]
  status: WebhookStatus
  deliveries24h: number
  failureRate: number   // 0-100
  lastDelivery: string
  ownerId: string
  created: string
}

const rng = createRng(9301) // unique seed for this module

export const webhooks: Webhook[] = Array.from({ length: 12 }, (_, i) => ({
  id: `whk-${String(i + 1).padStart(3, "0")}`,
  name: pick(rng, ["Slack alerts", "PagerDuty", "Data warehouse", "Ticketing"]),
  url: `https://hooks.example.com/${i + 1}`,
  events: ["release.promoted", "budget.breached"],
  status: pick(rng, ["Active", "Active", "Paused", "Failing"]),
  deliveries24h: int(rng, 0, 400),
  failureRate: int(rng, 0, 12),
  lastDelivery: hoursAgo(int(rng, 0, 48)),
  ownerId: pick(rng, ["u-001", "u-003", "u-005"]),
  created: daysAgo(int(rng, 10, 300)),
}))

export function getWebhook(id: string) {
  return webhooks.find((w) => w.id === id)
}

/** Count helper for stat cards and badges; takes a list so client state can be recounted. */
export function failingWebhookCount(list: Webhook[] = webhooks) {
  return list.filter((w) => w.status === "Failing").length
}
```

Rules: a unique `createRng` seed, every timestamp from `seed.ts` helpers (never `new Date()`; read the time through `clock()`), real `u-` ids for owners. Add `export * from "./webhooks"` to `lib/data/index.ts`; `lib/data/barrel.test.ts` fails until you do, and `lib/data/integrity.test.ts` will check that every `ownerId` resolves.

If your module has lifecycle states that other modules also use, add the list to `lib/constants.ts`. If a stat card needs a trend, derive it with `compareWindows` or `countInWindows` from `lib/data/metrics.ts` rather than typing a delta.

## 2. Client store

Create `features/agentops/webhooks/store.ts`:

```ts
import { webhooks, type Webhook } from "@/lib/data/webhooks"
import { createListStore } from "@/lib/store"

export const webhookStore = createListStore<Webhook>(webhooks, (w) => w.id)
```

Every client component on the page reads `webhookStore.use()` and mutates through `patch`, `add`, `remove`. Because the store is module-scoped, the table, the stat cards and any sheet show the same list after an action; a reload returns to the seed. Client components import `@/lib/data/webhooks` directly, never the `@/lib/data` barrel.

## 3. List page

Create `features/agentops/webhooks/webhooks-table.tsx`:

```tsx
"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { toast } from "sonner"
import { DataTable, type DataTableFeatures } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { failingWebhookCount, type Webhook } from "@/lib/data/webhooks"
import { timeAgo } from "@/lib/format"
import { webhookStore } from "./store"

const col = createColumnHelper<DataTableFeatures, Webhook>()

const columns = col.columns([
  col.accessor("name", { header: "Name" }),
  col.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <StateBadge state={getValue()} />,
  }),
  col.accessor("deliveries24h", {
    header: "Deliveries 24h",
    meta: { numeric: true },
  }),
  col.accessor("failureRate", {
    header: "Failure rate",
    meta: { numeric: true },
    cell: ({ getValue }) => `${getValue()}%`,
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} />,
  }),
  col.accessor("lastDelivery", {
    header: "Last delivery",
    sortFn: "datetime",
    cell: ({ getValue }) => timeAgo(getValue()),
  }),
  col.display({
    id: "actions",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        disabled={row.original.status === "Paused"}
        onClick={() => {
          webhookStore.patch(row.original.id, { status: "Paused" })
          toast("Webhook paused", {
            description: `${row.original.name} will not receive events.`,
          })
        }}
      >
        Pause
      </Button>
    ),
  }),
])

export function WebhooksView() {
  const rows = webhookStore.use()
  return (
    <>
      <StatGrid columns={3}>
        <StatCard label="Endpoints" value={rows.length} />
        <StatCard
          label="Failing"
          value={failingWebhookCount(rows)}
          tone={failingWebhookCount(rows) ? "danger" : undefined}
        />
        <StatCard
          label="Deliveries · 24h"
          value={rows.reduce((s, w) => s + w.deliveries24h, 0)}
        />
      </StatGrid>
      <DataTable
        columns={columns}
        data={rows}
        facets={[{ column: "status", title: "Status" }]}
        getSearchText={(w) => `${w.name} ${w.url} ${w.events.join(" ")}`}
        rowHref={(w) => `/agentops/webhooks?webhook=${w.id}`}
      />
    </>
  )
}
```

Notes: `sortFn`, not `sortingFn`; numeric columns use `meta.numeric`; the table owns its state; the stat cards read the same store as the table so they move when a row is paused; the toast describes exactly what changed in the store. `rowHref` points back at the list with a query param, which is the pattern for a sheet-driven detail; if you prefer a record page, point it at `/agentops/webhooks/${w.id}`. Pass `hint` to `DataTableColumnHeader` for jargon headers.

Create the route `app/(app)/agentops/webhooks/page.tsx`:

```tsx
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { WebhooksView } from "@/features/agentops/webhooks/webhooks-table"

export const metadata: Metadata = { title: "Webhooks" }

export default function WebhooksPage() {
  return (
    <>
      <PageHeader
        nav="/agentops/webhooks"
        description="Outbound endpoints notified on releases, budgets and incidents."
      />
      <WebhooksView />
    </>
  )
}
```

`nav` resolves the eyebrow ("Govern"), icon and title from the nav entry you add in step 6. Add `app/(app)/agentops/webhooks/loading.tsx`:

```tsx
import { TableSkeleton } from "@/components/shared/skeletons"

export default function Loading() {
  return <TableSkeleton columns={6} />
}
```

## 4. Detail: sheet or record page

**Sheet (query param).** Create a client component that reads `?webhook=` with `useQueryParam("webhook")` from `hooks/use-query-param.ts`, looks the record up in `webhookStore`, and renders a `Sheet` using the shared frame:

```tsx
<SheetContent className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}>
  <SheetHeader className="border-b px-6 py-5">...</SheetHeader>
  <SheetBody>
    <DetailList items={...} />
  </SheetBody>
  <SheetFooterActions primary={<Button onClick={save}>Save</Button>} />
</SheetContent>
```

Close by setting the param to `null`; the hook writes with `history.replaceState`, so there is no server round trip. Add `?webhook=` to the deep-link table in [conventions](conventions.md): every link must target a param that is read.

**Record page.** Create `app/(app)/agentops/webhooks/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { RecordHeader } from "@/components/record/record-header"
import { DetailList } from "@/components/shared/detail-list"
import { getWebhook } from "@/lib/data"

export default async function WebhookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const webhook = getWebhook(id)
  if (!webhook) notFound()
  return (
    <>
      <RecordHeader number={webhook.id} title={webhook.name} state={webhook.status} />
      <DetailList
        items={[
          { label: "URL", value: webhook.url },
          { label: "Events", value: webhook.events.join(", ") },
        ]}
      />
    </>
  )
}
```

`params` is a Promise; `await` it. Compose `RecordTabs` (syncs `?tab=` by default), `ActivityStream` and `RelatedList` as the record grows. Add a `loading.tsx` next to it rendering `<RecordSkeleton />`, add the `whk-` prefix to `isRecordSegment` in `components/layout/breadcrumbs.tsx` so the id renders verbatim, and to `recordHref` in `components/shared/record-link.tsx` so links resolve from anywhere. Add `"/agentops/webhooks": "whk-001"` to `SAMPLE_IDS` in `scripts/warm-routes.mjs`; `scripts/warm.test.ts` fails otherwise.

## 5. Destructive actions and toasts

Pausing is reversible, so a toast is enough. Deleting a webhook is destructive: wrap it in an `AlertDialog` with the consequence spelled out, then `webhookStore.remove(id)`. If the action should appear in the Audit Log, call `auditStore.append(...)` from `features/agentops/audit/audit-store.ts` with a new `AuditSource` of `"webhook"`; the hash chain is extended for you. Never toast about a download, an e-mail or an audit entry that did not happen.

## 6. Navigation

Add the entry to the Govern group in `config/nav.ts`:

```ts
{
  title: "Webhooks",
  href: "/agentops/webhooks",
  icon: WebhookIcon,
  keywords: ["notifications", "outbound", "endpoint"],
  description: "Outbound endpoints notified on platform events",
},
```

The sidebar, breadcrumbs, command menu search, `PageHeader nav=` and the warm script all follow from this entry. Add a `shortcut: "G …"` only if the letter is free; `config/nav.test.ts` fails on a duplicate. If the page deserves a sidebar badge, do not write a literal: add `"webhooks"` to `NavBadgeKey`, set `badge: "webhooks"` on the item, and add `webhooks: failingWebhookCount()` to `getNavCounts()` in `config/nav-counts.ts`.

## 7. Status vocabulary

Add `Failing: "danger"` to `stateTone` in `components/shared/status-badge.tsx`. `Active` and `Paused` already exist. Unknown states render neutral, so forgetting this is not a crash, but it is a visual bug.

## 8. Audit and tests

- If users can change a webhook (pause, rotate secret), derive seeded audit events for it in `lib/data/audit.ts` with source `"webhook"` added to `AuditSource`, and append session events through `auditStore.append`, rather than keeping a separate history.
- Add `lib/data/webhooks.test.ts` with at least: unique ids, every `ownerId` resolves to a user, deterministic across two module evaluations, and `failingWebhookCount` matching the page selector (or add a case to `lib/data/counts.test.ts`).
- Run `pnpm typecheck && pnpm lint && pnpm test`.

## Checklist

- [ ] Data module with unique seed, count helper, re-exported from `lib/data/index.ts`
- [ ] `createListStore` at module scope; stat cards and table read the same store
- [ ] Table with `createColumnHelper<DataTableFeatures, T>()`, facets, search text, `rowHref`
- [ ] Route under `app/(app)/agentops/<feature>/` with `PageHeader nav=`, `metadata.title` and a `loading.tsx`
- [ ] Detail as sheet (`useQueryParam`, shared sheet frame) or record page (`await params`, `RecordSkeleton`)
- [ ] Nav entry in `config/nav.ts`; badge through `NavBadgeKey` and `getNavCounts()` if any
- [ ] New states in `stateTone`; new id prefix in breadcrumbs and `recordHref`; `SAMPLE_IDS` for dynamic routes
- [ ] `AlertDialog` on destructive actions; truthful toasts; audit events for mutations; tests next to the data
