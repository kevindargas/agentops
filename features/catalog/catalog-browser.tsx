"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArmchairIcon,
  ArrowRightIcon,
  BoxesIcon,
  BuildingIcon,
  CalendarHeartIcon,
  ChartBarIcon,
  CheckCircle2Icon,
  CloudIcon,
  CodeIcon,
  DatabaseIcon,
  FileTextIcon,
  HeadphonesIcon,
  HeartHandshakeIcon,
  IdCardIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LaptopIcon,
  LayoutGridIcon,
  MailIcon,
  MessageSquareIcon,
  MonitorIcon,
  PaletteIcon,
  SearchIcon,
  ServerIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  TimerIcon,
  UserPlusIcon,
  UsersIcon,
  VideoIcon,
  WorkflowIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState } from "@/components/shared/empty-state"
import { catalogItems, getGroup, users } from "@/lib/data"
import { currentUser } from "@/lib/data/users"
import { formatCurrency } from "@/lib/format"
import type { CatalogCategory, CatalogItem } from "@/lib/types"

const icons: Record<string, LucideIcon> = {
  laptop: LaptopIcon,
  monitor: MonitorIcon,
  smartphone: SmartphoneIcon,
  headphones: HeadphonesIcon,
  palette: PaletteIcon,
  code: CodeIcon,
  workflow: WorkflowIcon,
  "chart-bar": ChartBarIcon,
  "user-plus": UserPlusIcon,
  "key-round": KeyRoundIcon,
  mail: MailIcon,
  "shield-check": ShieldCheckIcon,
  cloud: CloudIcon,
  boxes: BoxesIcon,
  server: ServerIcon,
  database: DatabaseIcon,
  video: VideoIcon,
  "message-square": MessageSquareIcon,
  "file-text": FileTextIcon,
  landmark: LandmarkIcon,
  "calendar-heart": CalendarHeartIcon,
  "id-card": IdCardIcon,
  armchair: ArmchairIcon,
}

export const categoryMeta: Record<
  CatalogCategory,
  { icon: LucideIcon; tint: string }
> = {
  Hardware: { icon: LaptopIcon, tint: "bg-brand/10 text-brand" },
  Software: { icon: CodeIcon, tint: "bg-info/10 text-info" },
  "Access & Accounts": {
    icon: KeyRoundIcon,
    tint: "bg-warning/15 text-warning-text",
  },
  "Cloud & Infrastructure": {
    icon: CloudIcon,
    tint: "bg-chart-3/15 text-green-700 dark:text-chart-3",
  },
  Collaboration: {
    icon: UsersIcon,
    tint: "bg-chart-5/15 text-pink-700 dark:text-chart-5",
  },
  "HR Services": {
    icon: HeartHandshakeIcon,
    tint: "bg-chart-2/15 text-orange-700 dark:text-chart-2",
  },
  Facilities: { icon: BuildingIcon, tint: "bg-muted text-muted-foreground" },
}

const categories: CatalogCategory[] = [
  "Hardware",
  "Software",
  "Access & Accounts",
  "Cloud & Infrastructure",
  "Collaboration",
  "HR Services",
  "Facilities",
]
type SortKey = "popular" | "name" | "price" | "fastest"

export function priceLabel(item: CatalogItem) {
  if (item.price === 0) return "Free"
  return `${formatCurrency(item.price)}${item.category === "Software" || item.category === "Collaboration" || item.category === "Cloud & Infrastructure" ? "/mo" : ""}`
}

export function deliveryLabel(item: CatalogItem) {
  return item.deliveryDays === 0
    ? "Instant"
    : `${item.deliveryDays} day${item.deliveryDays > 1 ? "s" : ""}`
}

export function CatalogBrowser({
  initialQuery = "",
  initialCategory,
}: {
  initialQuery?: string
  initialCategory?: CatalogCategory
}) {
  const [query, setQuery] = React.useState(initialQuery)
  const [category, setCategory] = React.useState<"All" | CatalogCategory>(
    initialCategory ?? "All"
  )
  const [sort, setSort] = React.useState<SortKey>("popular")
  const [ordering, setOrdering] = React.useState<CatalogItem | null>(null)

  const q = query.trim().toLowerCase()
  const visible = catalogItems
    .filter(
      (c) =>
        (category === "All" || c.category === category) &&
        (!q ||
          `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(q))
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "price") return a.price - b.price
      if (sort === "fastest") return a.deliveryDays - b.deliveryDays
      return (
        Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name)
      )
    })
  const popular = catalogItems.filter((c) => c.popular)
  const browsing = category === "All" && !q
  const counts = categories.reduce<Record<string, number>>(
    (acc, c) => (
      (acc[c] = catalogItems.filter((i) => i.category === c).length),
      acc
    ),
    {}
  )

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-brand/15 via-card to-card p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative z-10 flex flex-col gap-5 md:max-w-2xl">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
              <SparklesIcon className="size-3.5" /> {catalogItems.length}{" "}
              services · {popular.length} popular right now
            </p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              What do you need today?
            </h2>
            <p className="text-sm text-muted-foreground">
              Order hardware, software, access and services. Anything that needs
              approval is routed to your manager automatically.
            </p>
          </div>
          <InputGroup className="h-12 w-full rounded-xl bg-background shadow-sm">
            <InputGroupAddon>
              <SearchIcon className="size-5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search e.g. laptop, Salesforce access, VPN, badge…"
              className="text-base"
              aria-label="Search the catalog"
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <XIcon />
                </Button>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Try:
            {[
              "MacBook",
              "Salesforce",
              "Kubernetes",
              "Parental leave",
              "Badge",
            ].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQuery(t)}
                className="rounded-full border bg-background px-2.5 py-0.5 transition-colors hover:bg-muted"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ToggleGroup
          multiple={false}
          value={[category]}
          onValueChange={(v) => setCategory((v[0] as typeof category) ?? "All")}
          variant="outline"
          className="flex-wrap justify-start gap-1.5 *:data-[slot=toggle-group-item]:rounded-full!"
        >
          <ToggleGroupItem value="All" size="sm" className="gap-1.5 px-3">
            <LayoutGridIcon className="size-3.5" /> All{" "}
            <span className="text-xs text-muted-foreground tabular-nums">
              {catalogItems.length}
            </span>
          </ToggleGroupItem>
          {categories.map((c) => {
            const Icon = categoryMeta[c].icon
            return (
              <ToggleGroupItem
                key={c}
                value={c}
                size="sm"
                className="gap-1.5 px-3"
              >
                <Icon className="size-3.5" /> {c}{" "}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {counts[c]}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <Select
          value={sort}
          onValueChange={(v) => setSort((v as SortKey) ?? "popular")}
          items={{
            popular: "Most popular",
            name: "Name A–Z",
            price: "Price: low to high",
            fastest: "Fastest delivery",
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Sort catalog">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="popular">Most popular</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="price">Price: low to high</SelectItem>
            <SelectItem value="fastest">Fastest delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {browsing && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <SparklesIcon className="size-4 text-brand" /> Popular right now
            </h2>
            <span className="text-xs text-muted-foreground">
              Most requested across the company this month
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popular.slice(0, 4).map((item) => (
              <CatalogItemCard
                key={item.id}
                item={item}
                onOrder={() => setOrdering(item)}
                compact
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {q
              ? `Results for “${query}”`
              : category === "All"
                ? "All services"
                : category}{" "}
            <span className="font-normal text-muted-foreground">
              ({visible.length})
            </span>
          </h2>
          {(q || category !== "All") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("")
                setCategory("All")
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title="No matching services"
            description="Try a broader search term or browse by category. If you still can't find it, open a general request."
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/itsm/incidents?new=1" />}
              >
                Open a general request
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <CatalogItemCard
                key={item.id}
                item={item}
                onOrder={() => setOrdering(item)}
              />
            ))}
          </div>
        )}
      </section>

      <RequestSheet item={ordering} onClose={() => setOrdering(null)} />
    </div>
  )
}

export function CatalogItemCard({
  item,
  onOrder,
  compact = false,
}: {
  item: CatalogItem
  onOrder: () => void
  compact?: boolean
}) {
  const Icon = icons[item.icon] ?? BoxesIcon
  const tint = categoryMeta[item.category].tint
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOrder}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOrder()
        }
      }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground transition-all duration-200 outline-none",
        "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            tint
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-sm font-semibold tabular-nums">
            {priceLabel(item)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <TimerIcon className="size-3" /> {deliveryLabel(item)}
          </span>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-1.5 leading-snug font-medium">
          <span className="truncate">{item.name}</span>
          {item.popular && !compact && (
            <SparklesIcon
              className="size-3.5 shrink-0 text-brand"
              aria-label="Popular"
            />
          )}
        </p>
        <p
          className={cn(
            "text-sm text-muted-foreground",
            compact ? "line-clamp-1" : "line-clamp-2"
          )}
        >
          {item.description}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{item.category}</Badge>
          {item.approvalRequired ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <ShieldCheckIcon /> Approval
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-success/30 text-success-text"
            >
              <CheckCircle2Icon /> Auto-fulfilled
            </Badge>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
          Request <ArrowRightIcon className="size-3.5" />
        </span>
      </div>
    </div>
  )
}

export function RequestSheet({
  item,
  onClose,
}: {
  item: CatalogItem | null
  onClose: () => void
}) {
  const [draft, setDraft] = React.useState<{
    id: string
    qty: number
    forId: string
  } | null>(null)
  const qty = item && draft?.id === item.id ? draft.qty : 1
  const forId = item && draft?.id === item.id ? draft.forId : currentUser.id
  const update = (patch: Partial<{ qty: number; forId: string }>) =>
    item && setDraft({ id: item.id, qty, forId, ...patch })
  const Icon = item ? (icons[item.icon] ?? BoxesIcon) : BoxesIcon
  const group = item ? getGroup(item.fulfillmentGroupId) : undefined

  return (
    <Sheet open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        {item && (
          <>
            <SheetHeader className="gap-4 border-b bg-muted/30 p-6">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl",
                    categoryMeta[item.category].tint
                  )}
                >
                  <Icon className="size-6" />
                </div>
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="leading-tight">{item.name}</SheetTitle>
                  <SheetDescription className="line-clamp-3">
                    {item.description}
                  </SheetDescription>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border bg-background p-2.5">
                  <dt className="text-muted-foreground">Price</dt>
                  <dd className="font-semibold tabular-nums">
                    {priceLabel(item)}
                  </dd>
                </div>
                <div className="rounded-lg border bg-background p-2.5">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="font-semibold">{deliveryLabel(item)}</dd>
                </div>
                <div className="rounded-lg border bg-background p-2.5">
                  <dt className="text-muted-foreground">Approval</dt>
                  <dd className="font-semibold">
                    {item.approvalRequired ? "Manager" : "None"}
                  </dd>
                </div>
              </dl>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 p-6">
              <Field>
                <FieldLabel htmlFor="for">Requested for</FieldLabel>
                <Select
                  value={forId}
                  onValueChange={(v) => v && update({ forId: v })}
                  items={users.map((u) => ({ value: u.id, label: u.name }))}
                >
                  <SelectTrigger id="for" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Order on behalf of a teammate or a new hire.
                </FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="qty">Quantity</FieldLabel>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    max={10}
                    value={qty}
                    onChange={(e) =>
                      update({
                        qty: Math.min(
                          10,
                          Math.max(1, Number(e.target.value) || 1)
                        ),
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cc">Cost center</FieldLabel>
                  <Input id="cc" defaultValue="CC-4210" className="font-mono" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="just">Business justification</FieldLabel>
                <Textarea
                  id="just"
                  placeholder={
                    item.approvalRequired
                      ? "Your manager will see this when approving."
                      : "Optional — helps the fulfillment team."
                  }
                  className="min-h-24"
                />
              </Field>
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated total</span>
                  <span className="font-semibold tabular-nums">
                    {item.price === 0
                      ? "Free"
                      : `${formatCurrency(item.price * qty)}${priceLabel(item).endsWith("/mo") ? "/mo" : ""}`}
                  </span>
                </div>
                <ol className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">
                      1
                    </span>
                    Submit request
                  </li>
                  {item.approvalRequired && (
                    <li className="flex items-center gap-2">
                      <span className="flex size-4 items-center justify-center rounded-full border text-[10px] font-semibold">
                        2
                      </span>
                      Manager approval (usually within a day)
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <span className="flex size-4 items-center justify-center rounded-full border text-[10px] font-semibold">
                      {item.approvalRequired ? 3 : 2}
                    </span>
                    Fulfilled by {group?.name ?? "the service team"} in{" "}
                    {deliveryLabel(item).toLowerCase()}
                  </li>
                </ol>
              </div>
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Request REQ0020337 submitted", {
                    description: item.approvalRequired
                      ? "Sent to your manager for approval."
                      : `${group?.name ?? "Fulfillment"} has started working on it.`,
                  })
                  onClose()
                }}
              >
                Submit request
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
