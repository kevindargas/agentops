"use client"

import * as React from "react"
import Link from "next/link"
import {
  BellIcon,
  BellOffIcon,
  CalendarIcon,
  CopyIcon,
  LinkIcon,
  PlayIcon,
} from "lucide-react"
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
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  RecordOverflowMenu,
  type RecordOverflowItem,
} from "@/components/record/record-overflow-menu"
import { StateBadge } from "@/components/shared/status-badge"
import { NOW, daysFromNow } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatDateTime } from "@/lib/format"
import type { Change } from "@/lib/types"
import { changesStore, nextChangeNumber } from "./changes-store"

/** Current change from the client store, falling back to the server copy. */
export function useChange(fallback: Change) {
  const list = changesStore.use()
  return list.find((c) => c.number === fallback.number) ?? fallback
}

/** State badge that follows the client store. */
export function ChangeStateBadge({ change }: { change: Change }) {
  const live = useChange(change)
  return <StateBadge state={live.state} />
}

export function ChangeActions({ change: seed }: { change: Change }) {
  const change = useChange(seed)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [following, setFollowing] = React.useState(false)

  const done = ["Closed", "Canceled"].includes(change.state)
  const canStart = change.state === "Scheduled"
  const startReason =
    change.state === "Implement"
      ? "Implementation is already in progress."
      : done
        ? "The change is closed."
        : change.approval !== "Approved"
          ? "Needs approval before it can be scheduled and started."
          : `Available once the change is Scheduled (currently ${change.state}).`

  const patch = (next: Partial<Change>) =>
    changesStore.patch(change.number, { ...next, updated: NOW.toISOString() })

  function start() {
    setConfirmOpen(false)
    patch({ state: "Implement" })
    toast.success(`${change.number} moved to Implement`, {
      description: `Window ${formatDateTime(change.plannedStart)} to ${formatDateTime(change.plannedEnd)}.`,
    })
  }

  function copyAsTemplate() {
    const number = nextChangeNumber()
    changesStore.add({
      ...change,
      number,
      shortDescription: `Copy of ${change.shortDescription}`,
      state: "New",
      approval: "Not Yet Requested",
      requestedById: currentUser.id,
      plannedStart: daysFromNow(7),
      plannedEnd: daysFromNow(7.25),
      opened: NOW.toISOString(),
      updated: NOW.toISOString(),
    })
    toast.success(`${number} drafted from ${change.number}`, {
      description: "A New change with the same plans, listed under Changes.",
    })
  }

  const overflow: RecordOverflowItem[] = [
    {
      label: "Copy as template",
      icon: <CopyIcon />,
      onSelect: () => {
        copyAsTemplate()
        return false
      },
    },
    { label: "Link incident", icon: <LinkIcon />, href: "/itsm/incidents" },
    {
      label: following ? "Unfollow" : "Follow",
      icon: following ? <BellOffIcon /> : <BellIcon />,
      separatorBefore: true,
      message: following
        ? `You no longer follow ${change.number}`
        : `You now follow ${change.number} in this session`,
      onSelect: () => setFollowing((f) => !f),
    },
    {
      label: "Cancel change",
      destructive: true,
      separatorBefore: true,
      disabled: done,
      onSelect: () => {
        setCancelOpen(true)
        return false
      },
    },
  ]

  const startButton = (
    <Button disabled={!canStart} onClick={() => setConfirmOpen(true)}>
      <PlayIcon /> Start implementation
    </Button>
  )

  return (
    <>
      <Button variant="outline" render={<Link href="/itsm/changes/calendar" />}>
        <CalendarIcon /> View in calendar
      </Button>
      {canStart ? (
        startButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            {startButton}
          </TooltipTrigger>
          <TooltipContent side="bottom">{startReason}</TooltipContent>
        </Tooltip>
      )}
      <RecordOverflowMenu items={overflow} number={change.number} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Start implementing {change.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The change moves to Implement and the window clock starts. Keep
              the backout plan to hand; you can cancel from the menu if the
              change has to be rolled back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={start}>
              <PlayIcon /> Start implementation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {change.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The maintenance window is released and the change leaves the CAB
              agenda. Linked incidents stay open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep change</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setCancelOpen(false)
                patch({ state: "Canceled" })
                toast(`${change.number} canceled`)
              }}
            >
              Cancel change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
