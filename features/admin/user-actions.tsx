"use client"

import * as React from "react"
import { cn } from "cn"
import { PlusIcon, UserPlusIcon, UsersRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { pad } from "@/lib/data/seed"
import {
  currentUser,
  SAMPLE_EMAIL_DOMAIN,
  users as seedUsers,
  type Role,
} from "@/lib/data/users"
import type { Group } from "@/lib/types"
import { groupTypeLabel } from "./groups-grid"
import { groupsStore, roles, usersStore } from "./users-store"

const departments = Array.from(
  new Set(seedUsers.map((u) => u.department))
).sort()
const locations = Array.from(new Set(seedUsers.map((u) => u.location))).sort()

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

/**
 * "Invite user" sheet. Adds a Pending user to the shared directory store so
 * the table, the Users stat and the tab count all move; nothing is e-mailed.
 */
export function InviteUserSheet({
  variant = "default",
  size,
}: {
  variant?: "default" | "outline"
  size?: "sm" | "default"
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [department, setDepartment] = React.useState(departments[0])
  const [location, setLocation] = React.useState(currentUser.location)
  const [role, setRole] = React.useState<Role>("readonly")
  const list = usersStore.use()

  const emailHandle = email || (name ? slug(name).replace(/-/g, ".") : "")

  function reset() {
    setName("")
    setEmail("")
    setTitle("")
    setDepartment(departments[0])
    setLocation(currentUser.location)
    setRole("readonly")
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = `u-${pad(list.length + 1, 3)}`
    usersStore.add(
      {
        id,
        name: name.trim(),
        email: `${emailHandle}@${SAMPLE_EMAIL_DOMAIN}`,
        title: title.trim() || "New Hire",
        department,
        location,
        status: "Pending",
        roleOverride: [role],
      },
      "end"
    )
    toast.success(`${name.trim()} added as Pending`, {
      description: `${id} · ${role} · no invitation e-mail is sent in this template.`,
    })
    setOpen(false)
    reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <UserPlusIcon /> Invite user
      </Button>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Invite user</SheetTitle>
            <SheetDescription>
              Creates a Pending directory entry. The person becomes Active once
              provisioning completes.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-name">Full name</FieldLabel>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Natarajan"
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
                <div className="flex items-center gap-1">
                  <Input
                    id="invite-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailHandle || "first.last"}
                    className="font-mono"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    @{SAMPLE_EMAIL_DOMAIN}
                  </span>
                </div>
                <FieldDescription>
                  Derived from the name when left empty.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-title">Title</FieldLabel>
                <Input
                  id="invite-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="New Hire"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="invite-department">
                    Department
                  </FieldLabel>
                  <Select
                    value={department}
                    onValueChange={(v) => v && setDepartment(v)}
                    items={departments.map((d) => ({ value: d, label: d }))}
                  >
                    <SelectTrigger id="invite-department" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-location">Location</FieldLabel>
                  <Select
                    value={location}
                    onValueChange={(v) => v && setLocation(v)}
                    items={locations.map((l) => ({ value: l, label: l }))}
                  >
                    <SelectTrigger id="invite-location" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                <Select
                  value={role}
                  onValueChange={(v) => v && setRole(v as Role)}
                  items={roles.map((r) => ({ value: r, label: r }))}
                >
                  <SelectTrigger id="invite-role" className="w-full font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r} className="font-mono">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Roles control what the user can see and do; admin should stay
                  rare.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button type="submit" disabled={!name.trim()}>
                <UserPlusIcon /> Add user
              </Button>
            }
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}

const groupTypes = Object.keys(groupTypeLabel) as Group["type"][]

/** "New group" sheet. Appends to the shared groups store so the Groups tab shows the card. */
export function NewGroupSheet() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<Group["type"]>("itil")
  const [manager, setManager] = React.useState(currentUser.id)
  const [description, setDescription] = React.useState("")
  const users = usersStore.use()
  const groups = groupsStore.use()

  function reset() {
    setName("")
    setType("itil")
    setManager(currentUser.id)
    setDescription("")
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const base = `g-${slug(name) || "group"}`
    const id = groups.some((g) => g.id === base)
      ? `${base}-${groups.length + 1}`
      : base
    groupsStore.add(
      {
        id,
        name: name.trim(),
        type,
        manager,
        members: 1,
        description:
          description.trim() ||
          `${groupTypeLabel[type]} group created in this session.`,
      },
      "end"
    )
    toast.success(`Group ${name.trim()} created`, {
      description: `${groupTypeLabel[type]} · managed by the selected user · 1 member.`,
    })
    setOpen(false)
    reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UsersRoundIcon /> New group
      </Button>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>New group</SheetTitle>
            <SheetDescription>
              Groups route incidents, changes and fulfillment tasks. The manager
              receives escalations and approvals for the group.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="group-name">Name</FieldLabel>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Data Platform"
                  required
                  autoFocus
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="group-type">Type</FieldLabel>
                  <Select
                    value={type}
                    onValueChange={(v) => v && setType(v as Group["type"])}
                    items={groupTypes.map((t) => ({
                      value: t,
                      label: groupTypeLabel[t],
                    }))}
                  >
                    <SelectTrigger id="group-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groupTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {groupTypeLabel[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="group-manager">Manager</FieldLabel>
                  <Select
                    value={manager}
                    onValueChange={(v) => v && setManager(v)}
                    items={users.map((u) => ({ value: u.id, label: u.name }))}
                  >
                    <SelectTrigger id="group-manager" className="w-full">
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
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="group-description">Description</FieldLabel>
                <Textarea
                  id="group-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this group owns and when work is routed to it"
                  className="min-h-20"
                />
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button type="submit" disabled={!name.trim()}>
                <PlusIcon /> Create group
              </Button>
            }
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** Header action pair for the Users & Groups page. */
export function UserActions() {
  return (
    <>
      <NewGroupSheet />
      <InviteUserSheet />
    </>
  )
}
