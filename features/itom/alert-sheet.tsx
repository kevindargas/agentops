"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { BellOffIcon, CheckIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useQueryParam } from "@/hooks/use-query-param"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DetailList } from "@/components/shared/detail-list"
import { MetricTile } from "@/components/shared/metric-tile"
import { RecordLink } from "@/components/shared/record-link"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { SeverityBadge, StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { getCi } from "@/lib/data/cmdb"
import { formatDateTime, timeAgo } from "@/lib/format"
import {
  acknowledgeAlerts,
  alertsStore,
  closeAlerts,
  promoteAlerts,
} from "./alerts-store"

export const ALERT_PARAM = "alert"

/**
 * Read and write the `?alert=` query param without dropping the others.
 * `replace` keeps the sheet out of the history stack.
 */
export function useAlertParam() {
  return useQueryParam(ALERT_PARAM)
}

/**
 * Detail panel for one alert, driven by `?alert=ALT0060001`. Alerts have no
 * record page, so this is where an operator reads the full description and
 * acts on a single alert.
 */
export function AlertSheet() {
  const [number, setNumber] = useAlertParam()
  const list = alertsStore.use()
  const alert = number ? list.find((a) => a.number === number) : undefined
  const [confirmClose, setConfirmClose] = React.useState(false)
  const open = Boolean(number)

  const ci = getCi(alert?.ciId)

  function acknowledge() {
    if (!alert) return
    acknowledgeAlerts([alert.number])
    toast.success(`${alert.number} acknowledged`)
  }

  function close() {
    if (!alert) return
    closeAlerts([alert.number])
    setConfirmClose(false)
    toast(`${alert.number} closed`)
  }

  function promote() {
    if (!alert) return
    const incident = promoteAlerts([alert.number])
    toast.success(`${alert.number} linked to ${incident}`, {
      description:
        "The incident number is recorded on the alert in this session.",
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setNumber(null)}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {alert ? (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5 pr-8">
                <span className="font-mono text-xs font-medium tracking-tight">
                  {alert.number}
                </span>
                <SeverityBadge severity={alert.severity} size="sm" />
                <StateBadge state={alert.state} size="sm" />
                {alert.acknowledged && (
                  <StateBadge state="Acknowledged" tone="success" size="sm" />
                )}
              </div>
              <SheetTitle className="pr-8">{alert.description}</SheetTitle>
              <SheetDescription>
                {alert.source} · {alert.metric} · last event{" "}
                {timeAgo(alert.updated)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricTile
                  label="Events"
                  value={alert.count}
                  hint="De-duplicated into this alert"
                />
                <MetricTile
                  label="Opened"
                  value={timeAgo(alert.opened)}
                  hint={formatDateTime(alert.opened)}
                />
                <MetricTile
                  label="Incident"
                  value={
                    alert.incidentNumber ? (
                      <RecordLink
                        number={alert.incidentNumber}
                        href={`/itsm/incidents/${alert.incidentNumber}`}
                        size="sm"
                      />
                    ) : (
                      "None"
                    )
                  }
                  hint={alert.incidentNumber ? "Promoted" : "Not yet promoted"}
                />
              </div>
              <DetailList
                variant="rows"
                items={[
                  { label: "Node", value: alert.node, mono: true },
                  { label: "Source", value: alert.source },
                  { label: "Metric", value: alert.metric, mono: true },
                  {
                    label: "Affected service",
                    value: ci ? (
                      <Link href="/itom/health">{ci.name}</Link>
                    ) : (
                      "Not mapped"
                    ),
                    hint: ci ? `${ci.class} · ${ci.environment}` : undefined,
                  },
                  {
                    label: "Acknowledged by",
                    value: alert.acknowledged ? (
                      <UserChip userId={alert.acknowledgedById} size="xs" />
                    ) : (
                      "Nobody yet"
                    ),
                  },
                  {
                    label: "Last event",
                    value: formatDateTime(alert.updated),
                  },
                ]}
              />
            </SheetBody>
            <SheetFooterActions
              tertiary={
                alert.state !== "Closed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-text"
                    onClick={() => setConfirmClose(true)}
                  >
                    <BellOffIcon /> Close alert
                  </Button>
                )
              }
              secondary={
                !alert.acknowledged &&
                alert.state !== "Closed" && (
                  <Button variant="outline" onClick={acknowledge}>
                    <CheckIcon /> Acknowledge
                  </Button>
                )
              }
              primary={
                alert.incidentNumber ? (
                  <Button
                    render={
                      <Link href={`/itsm/incidents/${alert.incidentNumber}`} />
                    }
                  >
                    <LinkIcon /> Open incident
                  </Button>
                ) : alert.state !== "Closed" ? (
                  <Button onClick={promote}>
                    <LinkIcon /> Create incident
                  </Button>
                ) : undefined
              }
            />
          </>
        ) : (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>Alert not found</SheetTitle>
              <SheetDescription>
                {number} is not in the current alert list.
              </SheetDescription>
            </SheetHeader>
            <SheetBody />
            <SheetFooterActions />
          </>
        )}
      </SheetContent>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Close {alert?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The alert leaves the open list. New events on the same node and
              metric will reopen it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              Close alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
