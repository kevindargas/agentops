"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "cn"
import { PlusIcon, SparklesIcon } from "lucide-react"
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
import { PriorityBadge } from "@/components/shared/status-badge"
import {
  calculatePriority,
  impactLabels,
  incidentCategories,
  priorityLabels,
  slaTargetHours,
  urgencyLabels,
} from "@/lib/constants"
import { configurationItems } from "@/lib/data/cmdb"
import { NOW } from "@/lib/data/seed"
import { currentUser, groups, users } from "@/lib/data/users"
import type { Impact, Incident, Urgency } from "@/lib/types"
import { incidentsStore, nextIncidentNumber } from "./incidents-store"

const channels = {
  "Self-service": "Self-service",
  Phone: "Phone",
  Email: "Email",
  Chat: "Chat",
  "Walk-in": "Walk-in",
} as const

/**
 * Create sheet for incidents. Opens automatically when the URL contains
 * `?new=1` (quick create and the command menu link there) and appends the new
 * record to `incidentsStore`, so it appears at the top of the list.
 */
export function NewIncidentSheet() {
  const params = useSearchParams()
  // Opens from ?new=1 until the user closes it; the button opens it manually.
  const [openState, setOpenState] = React.useState<boolean | null>(null)
  const open = openState ?? params.get("new") === "1"
  const setOpen = (next: boolean) => setOpenState(next)
  const [impact, setImpact] = React.useState<Impact>(2)
  const [urgency, setUrgency] = React.useState<Urgency>(2)
  const [category, setCategory] = React.useState<string>("Software")
  const [shortDescription, setShortDescription] = React.useState("")
  const [dirty, setDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const priority = calculatePriority(impact, urgency)

  function reset() {
    setImpact(2)
    setUrgency(2)
    setCategory("Software")
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

  function discard() {
    setDiscardOpen(false)
    leave()
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const number = nextIncidentNumber()
    const subcategory =
      String(data.get("subcategory") ?? "") || incidentCategories[category][0]
    const ciId = String(data.get("ci") ?? "")
    const now = NOW.toISOString()
    const incident: Incident = {
      number,
      shortDescription: shortDescription.trim(),
      description: String(data.get("description") ?? "").trim(),
      callerId: String(data.get("caller") ?? currentUser.id),
      category,
      subcategory,
      impact,
      urgency,
      priority,
      state: "New",
      assignmentGroupId: String(data.get("group") ?? "g-sd"),
      ciId: ciId || undefined,
      channel: (String(data.get("channel")) ||
        "Self-service") as Incident["channel"],
      opened: now,
      updated: now,
      slaDue: new Date(
        NOW.getTime() + slaTargetHours[priority] * 3_600_000
      ).toISOString(),
      slaBreached: false,
      majorIncident: false,
      reopenCount: 0,
    }
    incidentsStore.add(incident)
    toast.success(`Incident ${number} created`, {
      description: `P${priority} · ${incident.shortDescription}`,
    })
    setDirty(false)
    leave()
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New incident
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
            <SheetTitle>New incident</SheetTitle>
            <SheetDescription>
              Capture what is broken, who is affected and how urgently it needs
              attention.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup className="gap-6">
              <FieldSet>
                <FieldLegend variant="label">Who is affected</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="caller">Caller</FieldLabel>
                    <Select
                      name="caller"
                      defaultValue={currentUser.id}
                      items={users.map((u) => ({ value: u.id, label: u.name }))}
                    >
                      <SelectTrigger id="caller" className="w-full">
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
                      VIP callers raise the default urgency.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="channel">Contact channel</FieldLabel>
                    <Select
                      name="channel"
                      defaultValue="Self-service"
                      items={channels}
                    >
                      <SelectTrigger id="channel" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(channels).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">What happened</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="shortDescription">
                    Short description
                  </FieldLabel>
                  <Input
                    id="shortDescription"
                    name="shortDescription"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="e.g. Unable to connect to VPN from home office"
                    maxLength={160}
                    required
                    autoFocus
                  />
                  <div className="flex items-start justify-between gap-3">
                    <FieldDescription>
                      One line, as the caller would say it. This becomes the
                      ticket title.
                    </FieldDescription>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {shortDescription.length}/160
                    </span>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="What happened, when did it start, what have you tried?"
                    className="min-h-24"
                  />
                  <FieldDescription>
                    Include error messages, timestamps and anything already
                    attempted.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ci">Affected service</FieldLabel>
                  <Select
                    name="ci"
                    items={configurationItems.map((ci) => ({
                      value: ci.id,
                      label: ci.name,
                    }))}
                  >
                    <SelectTrigger id="ci" className="w-full">
                      <SelectValue placeholder="Select the affected service or system" />
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
                    Optional. Links the incident to monitoring alerts and
                    Service Health.
                  </FieldDescription>
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Classification</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="category">Category</FieldLabel>
                    <Select
                      value={category}
                      onValueChange={(v) => v && setCategory(v)}
                    >
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(incidentCategories).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="subcategory">Subcategory</FieldLabel>
                    <Select
                      name="subcategory"
                      defaultValue={incidentCategories[category][0]}
                      key={category}
                    >
                      <SelectTrigger id="subcategory" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {incidentCategories[category].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="impact">Impact</FieldLabel>
                    <Select
                      value={String(impact)}
                      onValueChange={(v) => v && setImpact(Number(v) as Impact)}
                      items={([1, 2, 3] as Impact[]).map((v) => ({
                        value: String(v),
                        label: `${v} - ${impactLabels[v]}`,
                      }))}
                    >
                      <SelectTrigger id="impact" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {([1, 2, 3] as Impact[]).map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v} - {impactLabels[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      How many people or services are affected.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="urgency">Urgency</FieldLabel>
                    <Select
                      value={String(urgency)}
                      onValueChange={(v) =>
                        v && setUrgency(Number(v) as Urgency)
                      }
                      items={([1, 2, 3] as Urgency[]).map((v) => ({
                        value: String(v),
                        label: `${v} - ${urgencyLabels[v]}`,
                      }))}
                    >
                      <SelectTrigger id="urgency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {([1, 2, 3] as Urgency[]).map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v} - {urgencyLabels[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      How quickly the business needs it fixed.
                    </FieldDescription>
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="mt-0.5 size-4 text-brand" />
                    <div>
                      <p className="text-sm font-medium">
                        Priority {priority} · {priorityLabels[priority]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Impact × urgency · resolution target{" "}
                        {slaTargetHours[priority]}h
                      </p>
                    </div>
                  </div>
                  <PriorityBadge priority={priority} short />
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Routing</FieldLegend>
                <Field>
                  <FieldLabel htmlFor="group">Assignment group</FieldLabel>
                  <Select
                    name="group"
                    defaultValue="g-sd"
                    items={groups
                      .filter((g) => g.type === "itil")
                      .map((g) => ({ value: g.id, label: g.name }))}
                  >
                    <SelectTrigger id="group" className="w-full">
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
                  <FieldDescription>
                    Assignment rules may re-route based on category and affected
                    service.
                  </FieldDescription>
                </Field>
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
                <PlusIcon /> Create incident
              </Button>
            }
          />
        </form>
      </SheetContent>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this incident?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved details. They will be lost if you close the form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
