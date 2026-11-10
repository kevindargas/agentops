"use client"

import * as React from "react"
import {
  BellIcon,
  BellOffIcon,
  BookMarkedIcon,
  GitBranchIcon,
  LightbulbIcon,
  LinkIcon,
  SearchIcon,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  RecordOverflowMenu,
  type RecordOverflowItem,
} from "@/components/record/record-overflow-menu"
import { StateBadge } from "@/components/shared/status-badge"
import { changeTypes } from "@/lib/constants"
import { NOW, daysFromNow } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import {
  changesStore,
  nextChangeNumber,
} from "@/features/changes/changes-store"
import type { ChangeType, Problem } from "@/lib/types"
import { problemsStore } from "./problems-store"

const closedStates = ["Resolved", "Closed"]

/** Current problem from the client store, falling back to the server copy. */
export function useProblem(fallback: Problem) {
  const list = problemsStore.use()
  return list.find((p) => p.number === fallback.number) ?? fallback
}

/** Header badges that follow the client store (state and known error). */
export function ProblemBadges({ problem }: { problem: Problem }) {
  const live = useProblem(problem)
  return (
    <>
      <StateBadge state={live.state} />
      {live.knownError && (
        <StateBadge
          state="Known error"
          tone="warning"
          icon={<BookMarkedIcon className="size-3" />}
        />
      )}
    </>
  )
}

export function ProblemActions({ problem: seed }: { problem: Problem }) {
  const problem = useProblem(seed)
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [workaround, setWorkaround] = React.useState("")
  const [changeOpen, setChangeOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [type, setType] = React.useState<ChangeType>("Normal")
  const [closeOpen, setCloseOpen] = React.useState(false)
  const [following, setFollowing] = React.useState(false)

  const closed = closedStates.includes(problem.state)
  const patch = (next: Partial<Problem>) =>
    problemsStore.patch(problem.number, { ...next, updated: NOW.toISOString() })

  function openPublish() {
    setWorkaround(problem.workaround ?? "")
    setPublishOpen(true)
  }

  function publish() {
    patch({
      knownError: true,
      workaround: workaround.trim() || problem.workaround,
    })
    setPublishOpen(false)
    toast.success(`Known error published for ${problem.number}`, {
      description: "Linked incidents now inherit the workaround.",
    })
  }

  function openCreateChange() {
    setTitle(`Fix: ${problem.shortDescription}`)
    setType("Normal")
    setChangeOpen(true)
  }

  function createChange() {
    const number = nextChangeNumber()
    changesStore.add({
      number,
      shortDescription: title.trim() || `Fix: ${problem.shortDescription}`,
      description: `Permanent fix for problem ${problem.number}.\n\n${problem.rootCause ?? "Root cause analysis in progress."}`,
      type,
      state: "New",
      risk: problem.priority <= 2 ? "High" : "Moderate",
      impact: problem.priority <= 2 ? 1 : 2,
      priority: problem.priority,
      category: "Software",
      assignmentGroupId: problem.assignmentGroupId,
      assignedToId: problem.assignedToId,
      requestedById: currentUser.id,
      ciId: problem.ciId,
      approval: "Not Yet Requested",
      cabRequired: type !== "Standard",
      plannedStart: daysFromNow(5),
      plannedEnd: daysFromNow(5.25),
      opened: NOW.toISOString(),
      updated: NOW.toISOString(),
      implementationPlan:
        "Apply the permanent fix identified in the problem record.",
      backoutPlan:
        "Revert to the previous configuration and re-apply the workaround.",
      testPlan: "Confirm the linked incidents no longer reproduce.",
    })
    if (!closedStates.includes(problem.state))
      patch({ state: "Fix in Progress" })
    setChangeOpen(false)
    toast.success(`Change ${number} created from ${problem.number}`, {
      description: `${type} change in state New, listed under Changes. Problem moved to Fix in Progress.`,
    })
  }

  const overflow: RecordOverflowItem[] = [
    { label: "Link incident", icon: <LinkIcon />, href: "/itsm/incidents" },
    {
      label: "Move to root cause analysis",
      icon: <SearchIcon />,
      disabled: closed || problem.state === "Root Cause Analysis",
      message: `${problem.number} moved to Root Cause Analysis`,
      onSelect: () => patch({ state: "Root Cause Analysis" }),
    },
    {
      label: following ? "Unfollow" : "Follow",
      icon: following ? <BellOffIcon /> : <BellIcon />,
      separatorBefore: true,
      message: following
        ? `You no longer follow ${problem.number}`
        : `You now follow ${problem.number} in this session`,
      onSelect: () => setFollowing((f) => !f),
    },
    {
      label: "Close problem",
      destructive: true,
      separatorBefore: true,
      disabled: closed,
      onSelect: () => {
        setCloseOpen(true)
        return false
      },
    },
  ]

  return (
    <>
      <Button
        variant="outline"
        disabled={problem.knownError}
        onClick={openPublish}
      >
        <LightbulbIcon />{" "}
        {problem.knownError ? "Known error published" : "Publish known error"}
      </Button>
      <Button disabled={closed} onClick={openCreateChange}>
        <GitBranchIcon /> Create change
      </Button>
      <RecordOverflowMenu items={overflow} number={problem.number} />

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish {problem.number} as a known error</DialogTitle>
            <DialogDescription>
              The Service Desk sees the workaround on every linked incident and
              the problem is flagged in the list.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="ke-workaround">Workaround</FieldLabel>
            <Textarea
              id="ke-workaround"
              value={workaround}
              onChange={(e) => setWorkaround(e.target.value)}
              placeholder="What should the Service Desk do until the permanent fix lands?"
              className="min-h-24"
              autoFocus
            />
            <FieldDescription>
              Optional. Leave empty to publish without a workaround.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish}>
              <LightbulbIcon /> Publish known error
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a change from {problem.number}</DialogTitle>
            <DialogDescription>
              Drafts a change for the permanent fix, linked to the same service
              and assignment group.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="change-title">Short description</FieldLabel>
              <Input
                id="change-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="change-type">Type</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as ChangeType)}
                items={changeTypes.map((t) => ({ value: t, label: t }))}
              >
                <SelectTrigger id="change-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {changeTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {type === "Standard"
                  ? "Pre-approved; no CAB review."
                  : type === "Emergency"
                    ? "Expedited CAB review."
                    : "Goes to the next CAB."}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createChange} disabled={!title.trim()}>
              <GitBranchIcon /> Create change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {problem.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Linked incidents stay in their current state. Closing the problem
              does not resolve them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep open</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setCloseOpen(false)
                patch({ state: "Closed" })
                toast(`${problem.number} closed`)
              }}
            >
              Close problem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
