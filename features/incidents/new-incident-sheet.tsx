"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { PriorityBadge } from "@/components/shared/status-badge"
import {
  calculatePriority,
  impactLabels,
  incidentCategories,
  priorityLabels,
  slaTargetHours,
  urgencyLabels,
} from "@/lib/constants"
import { configurationItems, groups, users } from "@/lib/data"
import type { Impact, Urgency } from "@/lib/types"

const channels = {
  "Self-service": "Self-service",
  Phone: "Phone",
  Email: "Email",
  Chat: "Chat",
  "Walk-in": "Walk-in",
} as const

/** Opens automatically when the URL contains ?new=1 (used by quick-create). */
export function NewIncidentSheet() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
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

  function close(next: boolean) {
    if (!next && dirty) {
      setDiscardOpen(true)
      return
    }
    setOpen(next)
    if (!next) {
      reset()
      if (params.get("new")) router.replace(pathname)
    }
  }

  function discard() {
    setDiscardOpen(false)
    setOpen(false)
    reset()
    if (params.get("new")) router.replace(pathname)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    toast.success("Incident INC0010079 created", {
      description: `P${priority} · ${String(data.get("shortDescription") ?? "")}`,
    })
    setDirty(false)
    setOpen(false)
    reset()
    if (params.get("new")) router.replace(pathname)
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New incident
      </Button>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <form
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="flex h-full flex-col"
        >
          <SheetHeader className="border-b">
            <SheetTitle>New incident</SheetTitle>
            <SheetDescription>
              Capture what is broken, who is affected and how urgently it needs
              attention.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup className="gap-6">
              <FieldSet>
                <FieldLegend variant="label">Who is affected</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="caller">Caller</FieldLabel>
                    <Select
                      name="caller"
                      defaultValue={users[0].id}
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
                  <FieldLabel htmlFor="ci">Configuration item</FieldLabel>
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
                    Optional — links the incident to monitoring alerts and the
                    dependency map.
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
                    Assignment rules may re-route based on category and CI.
                  </FieldDescription>
                </Field>
              </FieldSet>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row items-center justify-between border-t">
            <span className="text-xs text-muted-foreground">
              {dirty ? "Unsaved draft" : "Nothing entered yet"}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                <PlusIcon /> Create incident
              </Button>
            </div>
          </SheetFooter>
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
