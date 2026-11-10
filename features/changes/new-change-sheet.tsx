"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "cn"
import { PlusIcon, ShieldCheckIcon } from "lucide-react"
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
import { setQueryParam } from "@/hooks/use-query-param"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { RiskBadge } from "@/components/shared/status-badge"
import {
  cabSchedule,
  calculatePriority,
  changeRisks,
  changeTypes,
} from "@/lib/constants"
import { configurationItems } from "@/lib/data/cmdb"
import { changes } from "@/lib/data/itsm"
import { NOW } from "@/lib/data/seed"
import { currentUser, groups } from "@/lib/data/users"
import type { Change, ChangeRisk, ChangeType, Impact } from "@/lib/types"
import { changesStore, nextChangeNumber } from "./changes-store"

const categories = Array.from(new Set(changes.map((c) => c.category))).sort()

const impactForRisk: Record<ChangeRisk, Impact> = {
  Low: 3,
  Moderate: 2,
  High: 1,
  "Very High": 1,
}

/** Default planned window: the next evening at 18:00 UTC for two hours. */
function defaultWindow() {
  const start = new Date(NOW.getTime())
  start.setUTCDate(start.getUTCDate() + 1)
  start.setUTCHours(18, 0, 0, 0)
  const end = new Date(start.getTime() + 2 * 3_600_000)
  return { start, end }
}

/** `datetime-local` value (minute precision, UTC). */
const toLocalInput = (d: Date) => d.toISOString().slice(0, 16)

/**
 * Create sheet for changes. Opens from `?new=1` (quick create, command menu,
 * calendar and list header) and appends the record to `changesStore`, so the
 * table and the calendar show it immediately.
 */
export function NewChangeSheet() {
  const params = useSearchParams()
  const [openState, setOpenState] = React.useState<boolean | null>(null)
  const open = openState ?? params.get("new") === "1"
  const setOpen = (next: boolean) => setOpenState(next)
  const [type, setType] = React.useState<ChangeType>("Normal")
  const [risk, setRisk] = React.useState<ChangeRisk>("Moderate")
  const [shortDescription, setShortDescription] = React.useState("")
  const [dirty, setDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const plannedWindow = React.useMemo(() => defaultWindow(), [])

  const effectiveRisk: ChangeRisk = type === "Standard" ? "Low" : risk
  const cabRequired = type === "Normal" && effectiveRisk !== "Low"
  const impact = impactForRisk[effectiveRisk]
  const priority = calculatePriority(impact, type === "Emergency" ? 1 : 2)

  function reset() {
    setType("Normal")
    setRisk("Moderate")
    setShortDescription("")
    setDirty(false)
  }

  function leave() {
    setOpen(false)
    reset()
    if (params.get("new")) setQueryParam("new", null)
  }

  function close(next: boolean) {
    if (!next && dirty) {
      setDiscardOpen(true)
      return
    }
    if (next) setOpen(true)
    else leave()
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const number = nextChangeNumber()
    const now = NOW.toISOString()
    const plannedStart = new Date(
      `${String(data.get("plannedStart") || toLocalInput(plannedWindow.start))}:00Z`
    )
    const plannedEndRaw = new Date(
      `${String(data.get("plannedEnd") || toLocalInput(plannedWindow.end))}:00Z`
    )
    const plannedEnd =
      plannedEndRaw > plannedStart
        ? plannedEndRaw
        : new Date(plannedStart.getTime() + 3_600_000)
    const ciId = String(data.get("ci") ?? "")
    const change: Change = {
      number,
      shortDescription: shortDescription.trim(),
      description: String(data.get("description") ?? "").trim(),
      type,
      state: "New",
      risk: effectiveRisk,
      impact,
      priority,
      category: String(data.get("category") || categories[0]),
      assignmentGroupId: String(data.get("group") || "g-infra"),
      requestedById: currentUser.id,
      ciId: ciId || undefined,
      approval: "Not Yet Requested",
      cabRequired,
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      opened: now,
      updated: now,
      implementationPlan: String(data.get("implementationPlan") ?? "").trim(),
      backoutPlan: String(data.get("backoutPlan") ?? "").trim(),
      testPlan: String(data.get("testPlan") ?? "").trim(),
    }
    changesStore.add(change)
    toast.success(`Change ${number} created as draft`, {
      description: change.shortDescription,
    })
    setDirty(false)
    leave()
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New change
      </Button>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        <form
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="flex h-full min-h-0 flex-col"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>New change</SheetTitle>
            <SheetDescription>
              Describe what will change, how risky it is and when it is planned.
              The draft starts in New and can be sent for approval from its
              record.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup className="gap-6">
              <FieldSet>
                <FieldLegend variant="label">What is changing</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="chg-short">Short description</FieldLabel>
                  <Input
                    id="chg-short"
                    name="shortDescription"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="e.g. Rotate TLS certificates on the API gateway"
                    maxLength={160}
                    required
                    autoFocus
                  />
                  <div className="flex items-start justify-between gap-3">
                    <FieldDescription>
                      One line that reads well on the CAB agenda.
                    </FieldDescription>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {shortDescription.length}/160
                    </span>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="chg-description">Description</FieldLabel>
                  <Textarea
                    id="chg-description"
                    name="description"
                    placeholder="Why the change is needed and what it touches."
                    className="min-h-20"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="chg-category">Category</FieldLabel>
                    <Select name="category" defaultValue={categories[0]}>
                      <SelectTrigger id="chg-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="chg-ci">Affected service</FieldLabel>
                    <Select
                      name="ci"
                      items={configurationItems.map((ci) => ({
                        value: ci.id,
                        label: ci.name,
                      }))}
                    >
                      <SelectTrigger id="chg-ci" className="w-full">
                        <SelectValue placeholder="Select a service or system" />
                      </SelectTrigger>
                      <SelectContent>
                        {configurationItems.map((ci) => (
                          <SelectItem key={ci.id} value={ci.id}>
                            {ci.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Used for conflict detection and Service Health.
                    </FieldDescription>
                  </Field>
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Type and risk</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="chg-type">Type</FieldLabel>
                    <Select
                      value={type}
                      onValueChange={(v) => v && setType(v as ChangeType)}
                    >
                      <SelectTrigger id="chg-type" className="w-full">
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
                      Standard changes are pre-approved and always low risk.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="chg-risk">Risk</FieldLabel>
                    <Select
                      value={effectiveRisk}
                      onValueChange={(v) => v && setRisk(v as ChangeRisk)}
                      disabled={type === "Standard"}
                    >
                      <SelectTrigger id="chg-risk" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {changeRisks.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <ShieldCheckIcon className="mt-0.5 size-4 text-brand" />
                    <div>
                      <p className="text-sm font-medium">
                        {cabRequired
                          ? "CAB authorization required"
                          : type === "Standard"
                            ? "Pre-approved standard change"
                            : type === "Emergency"
                              ? "Expedited emergency review"
                              : "Change manager approval"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cabRequired
                          ? `Next CAB: ${cabSchedule.label} · priority P${priority}`
                          : `Priority P${priority} from impact and urgency`}
                      </p>
                    </div>
                  </div>
                  <RiskBadge risk={effectiveRisk} />
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Schedule and routing</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="chg-start">
                      Planned start (UTC)
                    </FieldLabel>
                    <Input
                      id="chg-start"
                      name="plannedStart"
                      type="datetime-local"
                      defaultValue={toLocalInput(plannedWindow.start)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="chg-end">Planned end (UTC)</FieldLabel>
                    <Input
                      id="chg-end"
                      name="plannedEnd"
                      type="datetime-local"
                      defaultValue={toLocalInput(plannedWindow.end)}
                      required
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="chg-group">Assignment group</FieldLabel>
                  <Select
                    name="group"
                    defaultValue="g-infra"
                    items={groups
                      .filter((g) => g.type === "itil")
                      .map((g) => ({ value: g.id, label: g.name }))}
                  >
                    <SelectTrigger id="chg-group" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups
                        .filter((g) => g.type === "itil")
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Plans</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="chg-impl">
                    Implementation plan
                  </FieldLabel>
                  <Textarea
                    id="chg-impl"
                    name="implementationPlan"
                    placeholder="Numbered steps, who runs them and how completion is announced."
                    className="min-h-20"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="chg-backout">Backout plan</FieldLabel>
                    <Textarea
                      id="chg-backout"
                      name="backoutPlan"
                      placeholder="How to restore the previous state and how long it takes."
                      className="min-h-20"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="chg-test">Test plan</FieldLabel>
                    <Textarea
                      id="chg-test"
                      name="testPlan"
                      placeholder="Checks that prove the change worked."
                      className="min-h-20"
                    />
                  </Field>
                </div>
              </FieldSet>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            tertiary={
              <span className="text-xs text-muted-foreground">
                {dirty ? "Unsaved draft" : "Nothing entered yet"}
              </span>
            }
            primary={
              <Button type="submit">
                <PlusIcon /> Create change
              </Button>
            }
          />
        </form>
      </SheetContent>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this change?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved details. They will be lost if you close the form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                leave()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
