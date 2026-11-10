import type { Metadata } from "next"
import Link from "next/link"
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  PackageIcon,
  ReceiptIcon,
  ShieldIcon,
  TruckIcon,
  UserIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ActivityStream } from "@/components/record/activity-stream"
import { LifecycleTracker } from "@/components/record/lifecycle-tracker"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection, SummaryRow } from "@/components/record/record-section"
import { RecordTabs } from "@/components/record/record-tabs"
import { RelatedList } from "@/components/record/related-list"
import { SlaProgress } from "@/components/record/sla-progress"
import { DetailList } from "@/components/shared/detail-list"
import { StateBadge } from "@/components/shared/status-badge"
import { GroupChip, UserChip } from "@/components/shared/user-chip"
import { buildActivity, getCatalogItem, getRequest } from "@/lib/data"
import { NOW } from "@/lib/data/seed"
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
} from "@/lib/format"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number } = await params
  return { title: number }
}

const stages = [
  "Waiting for Approval",
  "Fulfillment",
  "Delivery",
  "Completed",
] as const

export default async function RequestPage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number } = await params
  const request = getRequest(number)
  if (!request)
    return (
      <RecordNotFound
        number={number}
        backHref="/itsm/requests"
        backLabel="requests"
      />
    )
  const tasks = request.items.flatMap((i) =>
    i.tasks.map((t) => ({ ...t, item: i.number }))
  )
  const doneTasks = tasks.filter((t) => t.state.startsWith("Closed")).length
  const closed = request.state.startsWith("Closed")
  const title = request.items
    .map((i) => getCatalogItem(i.catalogItemId)?.name)
    .filter(Boolean)
    .join(", ")
  const approvalTone =
    request.approval === "Approved"
      ? "success"
      : request.approval === "Rejected"
        ? "danger"
        : request.approval === "Requested"
          ? "warning"
          : "default"

  return (
    <>
      <RecordHeader
        number={request.number}
        title={title || "Service request"}
        backHref="/itsm/requests"
        backLabel="requests"
        description={`${request.items.length} item${request.items.length === 1 ? "" : "s"} · ${request.price === 0 ? "No charge" : formatCurrency(request.price)}`}
        badges={
          <>
            <StateBadge state={request.state} />
            <StateBadge state={request.stage} dot={false} />
          </>
        }
        meta={
          <>
            <MetaItem label="Requested for" icon={<UserIcon />}>
              <UserChip userId={request.requestedForId} size="xs" />
            </MetaItem>
            <MetaItem
              label="Approval"
              icon={<ShieldIcon />}
              tone={approvalTone}
            >
              {request.approval}
            </MetaItem>
            <MetaItem label="Opened" icon={<ClockIcon />}>
              {timeAgo(request.opened)}
            </MetaItem>
            <MetaItem
              label="Due"
              icon={<CalendarIcon />}
              tone={
                !closed && new Date(request.dueDate).getTime() < NOW.getTime()
                  ? "danger"
                  : "default"
              }
            >
              {formatDate(request.dueDate)}
            </MetaItem>
            <MetaItem label="Total" icon={<ReceiptIcon />}>
              {request.price === 0 ? "Free" : formatCurrency(request.price)}
            </MetaItem>
          </>
        }
        actions={
          request.approval === "Requested" ? (
            <>
              <Button variant="outline">
                <XIcon /> Reject
              </Button>
              <Button>
                <CheckIcon /> Approve
              </Button>
            </>
          ) : (
            <Button variant="outline" render={<Link href="/itsm/catalog" />}>
              <PackageIcon /> Order again
            </Button>
          )
        }
        overflow={[
          {
            label: "Duplicate request",
            icon: <CopyIcon />,
            message: "Draft request created with the same items",
          },
          {
            label: "Follow",
            icon: <BellIcon />,
            message: `You now follow ${request.number}`,
            separatorBefore: true,
          },
          {
            label: "Cancel request",
            destructive: true,
            separatorBefore: true,
            disabled: closed,
            confirm: {
              title: `Cancel ${request.number}?`,
              description:
                "Open fulfillment tasks will be closed incomplete and the requester notified.",
              actionLabel: "Cancel request",
            },
            message: `${request.number} cancelled`,
          },
        ]}
      />

      <LifecycleTracker
        stages={stages}
        current={request.stage}
        terminal={["Cancelled"]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection
              title="Approval"
              icon={<ShieldIcon />}
              size="sm"
              action={<StateBadge state={request.approval} />}
              contentClassName="flex flex-col gap-3"
            >
              <DetailList
                columns={1}
                className="gap-y-3"
                items={[
                  {
                    label: "Approver",
                    value: <UserChip userId="u-001" showTitle size="md" />,
                  },
                  {
                    label: "Requested by",
                    value: <UserChip userId={request.requestedById} />,
                  },
                ]}
              />
              {request.approval === "Requested" && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Waiting on the requester’s manager. Reminder scheduled for
                    tomorrow 09:00.
                  </p>
                </>
              )}
            </RecordSection>

            <RecordSection
              title="Delivery"
              icon={<TruckIcon />}
              size="sm"
              contentClassName="flex flex-col gap-3"
            >
              <SlaProgress
                start={request.opened}
                due={request.dueDate}
                completed={closed ? request.updated : undefined}
              />
              <Separator />
              <SummaryRow label="Fulfillment tasks">
                {doneTasks} / {tasks.length} complete
              </SummaryRow>
              <SummaryRow label="Expected by">
                {formatDate(request.dueDate)}
              </SummaryRow>
            </RecordSection>

            <RecordSection title="Request details" size="sm">
              <DetailList
                columns={1}
                className="gap-y-3"
                items={[
                  {
                    label: "Requested for",
                    value: (
                      <UserChip
                        userId={request.requestedForId}
                        showTitle
                        size="md"
                      />
                    ),
                  },
                  { label: "Opened", value: formatDateTime(request.opened) },
                  {
                    label: "Last updated",
                    value: `${formatDateTime(request.updated)} (${timeAgo(request.updated)})`,
                  },
                  {
                    label: "Total price",
                    value:
                      request.price === 0
                        ? "Free"
                        : formatCurrency(request.price),
                  },
                ]}
              />
            </RecordSection>
          </>
        }
      >
        <RecordSection
          title="Requested items"
          count={request.items.length}
          description="Each item is fulfilled independently and tracked as a requested item (RITM)."
          contentClassName="flex flex-col gap-3"
        >
          {request.items.map((item) => {
            const cat = getCatalogItem(item.catalogItemId)
            const itemTasks = item.tasks.length
            const itemDone = item.tasks.filter((t) =>
              t.state.startsWith("Closed")
            ).length
            return (
              <div
                key={item.number}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PackageIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {item.number}
                    </span>
                    <StateBadge state={item.stage} dot={false} />
                    {itemTasks > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {itemDone}/{itemTasks} tasks
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{cat?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {cat?.description}
                  </p>
                  {Object.keys(item.variables).length > 0 && (
                    <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-md bg-muted/30 p-2.5 text-xs sm:grid-cols-3">
                      {Object.entries(item.variables).map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="truncate font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-0.5 text-sm sm:items-end">
                  <p className="font-medium tabular-nums">
                    {cat
                      ? cat.price === 0
                        ? "Free"
                        : formatCurrency(cat.price * item.quantity)
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Qty {item.quantity}
                  </p>
                  <GroupChip
                    groupId={item.assignmentGroupId}
                    className="text-xs text-muted-foreground"
                  />
                </div>
              </div>
            )
          })}
        </RecordSection>

        <RecordTabs
          tabs={[
            {
              value: "tasks",
              label: "Fulfillment tasks",
              count: tasks.length,
              content: (
                <RelatedList
                  title="Catalog tasks"
                  description={`${doneTasks} of ${tasks.length} complete`}
                  rows={tasks}
                  getKey={(t) => t.number}
                  emptyMessage="Tasks are generated once the request is approved."
                  columns={[
                    {
                      header: "Number",
                      cell: (t) => (
                        <span className="font-mono text-xs">{t.number}</span>
                      ),
                    },
                    {
                      header: "Short description",
                      cell: (t) => (
                        <span className="line-clamp-1">
                          {t.shortDescription}
                        </span>
                      ),
                    },
                    {
                      header: "Item",
                      cell: (t) => (
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.item}
                        </span>
                      ),
                      hideOnMobile: true,
                    },
                    {
                      header: "Group",
                      cell: (t) => <GroupChip groupId={t.assignmentGroupId} />,
                      hideOnMobile: true,
                    },
                    {
                      header: "Assigned to",
                      cell: (t) => (
                        <UserChip userId={t.assignedToId} size="xs" />
                      ),
                    },
                    {
                      header: "State",
                      cell: (t) => <StateBadge state={t.state} />,
                    },
                    {
                      header: "Due",
                      cell: (t) => (
                        <span className="text-muted-foreground">
                          {formatDate(t.due)}
                        </span>
                      ),
                      hideOnMobile: true,
                    },
                  ]}
                />
              ),
            },
            {
              value: "activity",
              label: "Activity",
              content: (
                <ActivityStream
                  entries={buildActivity(request.number)}
                  defaultMode="comment"
                />
              ),
            },
          ]}
        />
      </RecordLayout>
    </>
  )
}
