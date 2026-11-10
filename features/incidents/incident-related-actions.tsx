"use client"

import * as React from "react"
import Link from "next/link"
import {
  GitBranchIcon,
  LightbulbIcon,
  LinkIcon,
  ServerIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RelatedRecordCard,
  RelatedRecordEmpty,
} from "@/components/record/related-record-card"
import { UserChip } from "@/components/shared/user-chip"
import { getCi } from "@/lib/data/cmdb"
import { NOW } from "@/lib/data/seed"
import { currentUser, users } from "@/lib/data/users"
import { formatDateTime } from "@/lib/format"
import { changesStore } from "@/features/changes/changes-store"
import { problemsStore } from "@/features/problems/problems-store"
import type { Incident } from "@/lib/types"
import { useIncident } from "./incident-actions"
import { incidentsStore } from "./incidents-store"

type LinkKind = "Problem" | "Change"

const openProblemStates = [
  "New",
  "Assess",
  "Root Cause Analysis",
  "Fix in Progress",
]
const openChangeStates = [
  "New",
  "Assess",
  "Authorize",
  "Scheduled",
  "Implement",
]

/**
 * Related records sidebar for an incident. Reads the linked problem, change
 * and affected service from the client stores so links made in this session
 * (including "Create problem" from the actions menu) show up immediately.
 */
export function IncidentRelatedRecords({
  incident: seed,
}: {
  incident: Incident
}) {
  const incident = useIncident(seed)
  const problems = problemsStore.use()
  const changes = changesStore.use()
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState<LinkKind>("Problem")
  const [target, setTarget] = React.useState<string>("")

  const problem = incident.problemId
    ? problems.find((p) => p.number === incident.problemId)
    : undefined
  const change = incident.changeId
    ? changes.find((c) => c.number === incident.changeId)
    : undefined
  const ci = getCi(incident.ciId)

  const options =
    kind === "Problem"
      ? problems
          .filter((p) => openProblemStates.includes(p.state))
          .map((p) => ({
            value: p.number,
            label: `${p.number} · ${p.shortDescription}`,
          }))
      : changes
          .filter((c) => openChangeStates.includes(c.state))
          .map((c) => ({
            value: c.number,
            label: `${c.number} · ${c.shortDescription}`,
          }))

  function openDialog() {
    setKind("Problem")
    setTarget("")
    setOpen(true)
  }

  function link() {
    if (!target) return
    incidentsStore.patch(incident.number, {
      ...(kind === "Problem" ? { problemId: target } : { changeId: target }),
      updated: NOW.toISOString(),
    })
    setOpen(false)
    toast.success(`${target} linked to ${incident.number}`, {
      description: `Shown under Related records as the ${kind.toLowerCase()}.`,
    })
  }

  function unlink(which: LinkKind) {
    const number = which === "Problem" ? incident.problemId : incident.changeId
    incidentsStore.patch(incident.number, {
      ...(which === "Problem"
        ? { problemId: undefined }
        : { changeId: undefined }),
      updated: NOW.toISOString(),
    })
    toast(`${number} unlinked from ${incident.number}`)
  }

  return (
    <>
      <div className="-mt-1 flex justify-end">
        <Button variant="ghost" size="xs" onClick={openDialog}>
          <LinkIcon /> Link
        </Button>
      </div>
      {problem ? (
        <div className="group/linked relative">
          <RelatedRecordCard
            number={problem.number}
            type="Problem"
            title={problem.shortDescription}
            href={`/itsm/problems/${problem.number}`}
            state={problem.state}
            icon={<LightbulbIcon />}
          />
          <UnlinkButton
            label={`Unlink ${problem.number}`}
            onClick={() => unlink("Problem")}
          />
        </div>
      ) : (
        <RelatedRecordEmpty>
          No problem linked.{" "}
          <Link
            href="/itsm/problems"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Find a matching problem
          </Link>
        </RelatedRecordEmpty>
      )}
      {change && (
        <div className="group/linked relative">
          <RelatedRecordCard
            number={change.number}
            type="Change"
            title={change.shortDescription}
            href={`/itsm/changes/${change.number}`}
            state={change.state}
            icon={<GitBranchIcon />}
            meta={`Planned ${formatDateTime(change.plannedStart)}`}
          />
          <UnlinkButton
            label={`Unlink ${change.number}`}
            onClick={() => unlink("Change")}
          />
        </div>
      )}
      {ci && (
        <RelatedRecordCard
          number={ci.id.toUpperCase()}
          type={ci.class}
          title={ci.name}
          href="/itom/health"
          state={ci.status}
          icon={<ServerIcon />}
          meta={`Affected service · ${ci.environment} · ${ci.businessCriticality}`}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link a record to {incident.number}</DialogTitle>
            <DialogDescription>
              Attach an open problem or change. The link is kept in this session
              and shown under Related records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="link-kind">Record type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(v) => {
                  if (!v) return
                  setKind(v as LinkKind)
                  setTarget("")
                }}
                items={{ Problem: "Problem", Change: "Change" }}
              >
                <SelectTrigger id="link-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Problem">Problem</SelectItem>
                  <SelectItem value="Change">Change</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-target">{kind}</FieldLabel>
              <Select
                value={target}
                onValueChange={(v) => setTarget(v ?? "")}
                items={options}
              >
                <SelectTrigger id="link-target" className="w-full">
                  <SelectValue
                    placeholder={`Select an open ${kind.toLowerCase()}`}
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {kind === "Problem"
                  ? "The incident inherits the problem's workaround and known-error status."
                  : "The incident is listed on the change as an affected record."}
              </FieldDescription>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={link} disabled={!target}>
              <LinkIcon /> Link {kind.toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function UnlinkButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute top-1.5 right-1.5 text-muted-foreground opacity-0 transition-opacity group-hover/linked:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
    >
      <XIcon />
    </Button>
  )
}

/** Watch list with an "Add watcher" dialog; the list lives in component state. */
export function IncidentWatchers({ incident }: { incident: Incident }) {
  const initial = Array.from(
    new Set([currentUser.id, incident.assignedToId].filter(Boolean) as string[])
  )
  const [watchers, setWatchers] = React.useState<string[]>(initial)
  const [open, setOpen] = React.useState(false)
  const [userId, setUserId] = React.useState("")

  const candidates = users
    .filter((u) => !watchers.includes(u.id))
    .map((u) => ({ value: u.id, label: u.name }))

  function add() {
    if (!userId) return
    setWatchers((w) => [...w, userId])
    setOpen(false)
    setUserId("")
    const name = users.find((u) => u.id === userId)?.name ?? "Watcher"
    toast.success(`${name} added as a watcher`, {
      description: `Now watching ${incident.number} in this session.`,
    })
  }

  function remove(id: string) {
    setWatchers((w) => w.filter((x) => x !== id))
    toast(`${users.find((u) => u.id === id)?.name ?? "Watcher"} removed`)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Watch list
      </span>
      {watchers.length === 0 && (
        <p className="text-xs text-muted-foreground">Nobody is watching yet.</p>
      )}
      {watchers.map((id) => (
        <div
          key={id}
          className="group/watcher flex items-center justify-between gap-2"
        >
          <UserChip userId={id} size="xs" />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${users.find((u) => u.id === id)?.name ?? "watcher"}`}
            onClick={() => remove(id)}
            className="text-muted-foreground opacity-0 transition-opacity group-hover/watcher:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="mt-1 w-full"
        onClick={() => setOpen(true)}
      >
        <UserPlusIcon /> Add watcher
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a watcher</DialogTitle>
            <DialogDescription>
              Watchers see {incident.number} in My Work and receive its updates.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="watcher">Person</FieldLabel>
            <Select
              value={userId}
              onValueChange={(v) => setUserId(v ?? "")}
              items={candidates}
            >
              <SelectTrigger id="watcher" className="w-full">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={add} disabled={!userId}>
              <UserPlusIcon /> Add watcher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
