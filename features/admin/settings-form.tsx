"use client"

import * as React from "react"
import { cn } from "cn"
import {
  AlertTriangleIcon,
  BellIcon,
  BuildingIcon,
  DownloadIcon,
  KeyRoundIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  ShieldIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { currentUser, initials } from "@/lib/data/users"

export type SettingsSection =
  | "profile"
  | "appearance"
  | "notifications"
  | "security"
  | "platform"
  | "danger"

const sections: {
  id: SettingsSection
  label: string
  icon: LucideIcon
  description: string
}[] = [
  {
    id: "profile",
    label: "Profile",
    icon: UserIcon,
    description: "Name, contact and locale",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: PaletteIcon,
    description: "Theme and list density",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: BellIcon,
    description: "What reaches you, and where",
  },
  {
    id: "security",
    label: "Security",
    icon: KeyRoundIcon,
    description: "Sessions, MFA and API access",
  },
  {
    id: "platform",
    label: "Platform",
    icon: BuildingIcon,
    description: "Instance-wide configuration",
  },
  {
    id: "danger",
    label: "Danger zone",
    icon: AlertTriangleIcon,
    description: "Irreversible actions",
  },
]

const timeZones: Record<string, string> = {
  "America/Los_Angeles": "Pacific — Los Angeles",
  "America/New_York": "Eastern — New York",
  "Europe/London": "GMT — London",
  "Europe/Berlin": "CET — Berlin",
  "Asia/Kolkata": "IST — Kolkata",
  "Asia/Tokyo": "JST — Tokyo",
}

function SwitchRow({
  label,
  description,
  defaultChecked = true,
  badge,
}: {
  label: string
  description: string
  defaultChecked?: boolean
  badge?: string
}) {
  const id = React.useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <label
          htmlFor={id}
          className="flex items-center gap-2 text-sm font-medium"
        >
          {label}
          {badge && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {badge}
            </Badge>
          )}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  )
}

function SectionCard({
  id,
  title,
  description,
  children,
  footer,
  destructive = false,
}: {
  id: SettingsSection
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
  destructive?: boolean
}) {
  return (
    <Card
      id={id}
      className={cn("scroll-mt-24", destructive && "border-destructive/40")}
    >
      <CardHeader className={cn(destructive && "text-destructive")}>
        <CardTitle>{title}</CardTitle>
        <CardDescription className={cn(destructive && "text-destructive/80")}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="justify-end gap-2 border-t pt-4">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}

export function SettingsForm({
  initialSection = "profile",
}: {
  initialSection?: SettingsSection
}) {
  const { theme, setTheme } = useTheme()
  const [active, setActive] = React.useState<SettingsSection>(initialSection)
  const [confirm, setConfirm] = React.useState<"reset" | "purge" | null>(null)
  // Deep links (?section=platform) land on the requested card.
  React.useEffect(() => {
    if (initialSection !== "profile")
      document
        .getElementById(initialSection)
        ?.scrollIntoView({ block: "start" })
  }, [initialSection])

  // Track the section nearest the top of the viewport for the anchor nav.
  React.useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n))
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id as SettingsSection)
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav
        aria-label="Settings sections"
        className="lg:sticky lg:top-20 lg:self-start"
      >
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {sections.map((s) => {
            const Icon = s.icon
            const isActive = active === s.id
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    s.id === "danger" &&
                      !isActive &&
                      "text-destructive/80 hover:text-destructive"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      s.id === "danger" && "text-destructive"
                    )}
                  />
                  <span className="flex flex-col leading-tight">
                    {s.label}
                    <span className="hidden text-[11px] font-normal text-muted-foreground lg:inline">
                      {s.description}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard
          id="profile"
          title="Profile"
          description="Your details as shown to colleagues and on records you touch."
          footer={
            <Button onClick={() => toast.success("Profile saved")}>
              Save changes
            </Button>
          }
        >
          <FieldGroup>
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-brand/10 text-lg font-semibold text-brand">
                  {initials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentUser.title} · {currentUser.department}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="xs">
                    Upload photo
                  </Button>
                  <Button variant="ghost" size="xs">
                    Remove
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <Input id="name" defaultValue={currentUser.name} />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  defaultValue={currentUser.email}
                />
                <FieldDescription>
                  Used for notifications and approvals.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" defaultValue={currentUser.title} />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <Input id="location" defaultValue={currentUser.location} />
                <FieldDescription>
                  Drives default routing for facilities requests.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="tz">Time zone</FieldLabel>
                <Select defaultValue="America/Los_Angeles" items={timeZones}>
                  <SelectTrigger id="tz" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(timeZones).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Dates and SLA timers are shown in this zone.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="lang">Language</FieldLabel>
                <Select
                  defaultValue="en-US"
                  items={{
                    "en-US": "English (US)",
                    "en-GB": "English (UK)",
                    "de-DE": "Deutsch",
                    "es-ES": "Español",
                    "ja-JP": "日本語",
                  }}
                >
                  <SelectTrigger id="lang" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="de-DE">Deutsch</SelectItem>
                    <SelectItem value="es-ES">Español</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </SectionCard>

        <SectionCard
          id="appearance"
          title="Appearance"
          description="Theme, density and how lists render. Use the theme customizer in the header for accent and radius."
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Theme</FieldLabel>
              <ToggleGroup
                multiple={false}
                value={[theme ?? "system"]}
                onValueChange={(v) => v[0] && setTheme(v[0])}
                variant="outline"
                spacing={0}
              >
                <ToggleGroupItem value="light" className="gap-1.5 px-3">
                  <SunIcon className="size-3.5" /> Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" className="gap-1.5 px-3">
                  <MoonIcon className="size-3.5" /> Dark
                </ToggleGroupItem>
                <ToggleGroupItem value="system" className="gap-1.5 px-3">
                  <MonitorIcon className="size-3.5" /> System
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                Press <Kbd>D</Kbd> anywhere to toggle quickly.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="landing">Default landing page</FieldLabel>
              <Select
                defaultValue="/dashboard"
                items={{
                  "/dashboard": "Overview",
                  "/my-work": "My Work",
                  "/itsm/incidents": "Incidents",
                  "/approvals": "Approvals",
                }}
              >
                <SelectTrigger id="landing" className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/dashboard">Overview</SelectItem>
                  <SelectItem value="/my-work">My Work</SelectItem>
                  <SelectItem value="/itsm/incidents">Incidents</SelectItem>
                  <SelectItem value="/approvals">Approvals</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Where you land after signing in.
              </FieldDescription>
            </Field>
            <div className="divide-y">
              <SwitchRow
                label="Compact tables"
                description="Reduce row height on list views"
                defaultChecked={false}
              />
              <SwitchRow
                label="Show record numbers"
                description="Display numbers next to titles in lists and breadcrumbs"
              />
              <SwitchRow
                label="Sticky table headers"
                description="Keep column headers visible while scrolling long lists"
              />
              <SwitchRow
                label="Reduce motion"
                description="Minimize animations and transitions"
                defaultChecked={false}
              />
            </div>
          </FieldGroup>
        </SectionCard>

        <SectionCard
          id="notifications"
          title="Notifications"
          description="Choose what reaches you and where."
          footer={
            <Button
              onClick={() => toast.success("Notification preferences saved")}
            >
              Save
            </Button>
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="channel">Delivery channel</FieldLabel>
              <Select
                defaultValue="both"
                items={{
                  both: "In-app and email",
                  app: "In-app only",
                  email: "Email only",
                  slack: "Slack DM",
                }}
              >
                <SelectTrigger id="channel" className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">In-app and email</SelectItem>
                  <SelectItem value="app">In-app only</SelectItem>
                  <SelectItem value="email">Email only</SelectItem>
                  <SelectItem value="slack">Slack DM</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Major incidents always page you regardless of this setting.
              </FieldDescription>
            </Field>
            <div className="divide-y">
              <SwitchRow
                label="Assignments"
                description="When a record is assigned to you or your group"
              />
              <SwitchRow
                label="Approvals"
                description="When your approval is requested"
              />
              <SwitchRow
                label="SLA warnings"
                description="15 minutes before a resolution SLA breaches"
              />
              <SwitchRow
                label="Mentions"
                description="When someone @mentions you in a work note"
              />
              <SwitchRow
                label="Major incidents"
                description="Bridge invitations and status updates"
                badge="Always on"
              />
              <SwitchRow
                label="AI agent proposals"
                description="When an agent proposes an action that needs your sign-off"
              />
              <SwitchRow
                label="Weekly digest"
                description="Summary of your groups' performance every Monday"
                defaultChecked={false}
              />
            </div>
          </FieldGroup>
        </SectionCard>

        <SectionCard
          id="security"
          title="Security"
          description="Protect your account and the integrations that act on your behalf."
        >
          <FieldGroup>
            <div className="divide-y">
              <SwitchRow
                label="Multi-factor authentication"
                description="Authenticator app with number matching"
                badge="Enforced"
              />
              <SwitchRow
                label="Sign out idle sessions"
                description="End sessions after 8 hours without activity"
              />
              <SwitchRow
                label="Approve from email"
                description="Allow one-click approvals from notification emails"
                defaultChecked={false}
              />
            </div>
            <div className="rounded-lg border">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Active sessions</p>
                  <p className="text-xs text-muted-foreground">
                    Devices currently signed in as you
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast("Other sessions signed out")}
                >
                  Sign out others
                </Button>
              </div>
              <ul className="divide-y text-sm">
                {[
                  {
                    device: "MacBook Pro · Chrome",
                    where: "San Francisco, US",
                    when: "This device",
                  },
                  {
                    device: "iPhone · AgentOps app",
                    where: "San Francisco, US",
                    when: "Active 2 hours ago",
                  },
                  {
                    device: "Windows · Edge",
                    where: "Austin, US",
                    when: "Active 3 days ago",
                  },
                ].map((s) => (
                  <li
                    key={s.device}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.device}</p>
                      <p className="text-xs text-muted-foreground">{s.where}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        s.when === "This device"
                          ? "font-medium text-success-text"
                          : "text-muted-foreground"
                      )}
                    >
                      {s.when}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Field>
              <FieldLabel htmlFor="apikey">Personal API token</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="apikey"
                  readOnly
                  value="kui_live_••••••••••••••••••••7f3a"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.success("New token generated", {
                      description:
                        "The previous token stops working in 24 hours.",
                    })
                  }
                >
                  Rotate
                </Button>
              </div>
              <FieldDescription>
                Grants the same permissions as your user. Store it in a secret
                manager.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </SectionCard>

        <SectionCard
          id="platform"
          title="Platform"
          description="Instance-wide settings. Changes apply to all users and are recorded in the audit log."
          footer={
            <Button onClick={() => toast.success("Platform settings saved")}>
              Save
            </Button>
          }
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="workspace">Workspace name</FieldLabel>
                <Input id="workspace" defaultValue="Acme Corp" />
              </Field>
              <Field>
                <FieldLabel htmlFor="prefix">Incident number prefix</FieldLabel>
                <Input id="prefix" defaultValue="INC" className="font-mono" />
                <FieldDescription>
                  Existing records keep their numbers.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="autoclose">
                  Auto-close resolved incidents after
                </FieldLabel>
                <Select
                  defaultValue="3"
                  items={{
                    "1": "1 day",
                    "3": "3 days",
                    "5": "5 days",
                    "7": "7 days",
                  }}
                >
                  <SelectTrigger id="autoclose" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "3", "5", "7"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d} day{d === "1" ? "" : "s"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="cab">CAB meeting day</FieldLabel>
                <Select
                  defaultValue="thu"
                  items={{
                    mon: "Monday",
                    tue: "Tuesday",
                    wed: "Wednesday",
                    thu: "Thursday",
                    fri: "Friday",
                  }}
                >
                  <SelectTrigger id="cab" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mon">Monday</SelectItem>
                    <SelectItem value="tue">Tuesday</SelectItem>
                    <SelectItem value="wed">Wednesday</SelectItem>
                    <SelectItem value="thu">Thursday</SelectItem>
                    <SelectItem value="fri">Friday</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Normal changes with moderate or higher risk are queued for
                  this meeting.
                </FieldDescription>
              </Field>
            </div>
            <div className="divide-y">
              <SwitchRow
                label="Require CI on P1/P2 incidents"
                description="Agents must link a configuration item before resolving"
              />
              <SwitchRow
                label="Major incident approval"
                description="Promotion to major incident requires a manager"
              />
              <SwitchRow
                label="Virtual agent"
                description="Enable the AI assistant in the Employee Center"
              />
              <SwitchRow
                label="Agent autonomy"
                description="Let AI agents execute low-risk, reversible actions without approval"
                defaultChecked={false}
                badge="Preview"
              />
            </div>
          </FieldGroup>
        </SectionCard>

        <SectionCard
          id="danger"
          title="Danger zone"
          description="These actions are irreversible. Make sure you have a recent export before continuing."
          destructive
        >
          <ul className="divide-y">
            <li className="flex flex-col gap-3 py-3.5 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Export all data</p>
                <p className="text-xs text-muted-foreground">
                  Download a JSON archive of every record, attachment and audit
                  entry.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.success("Export started", {
                    description: "We'll email you when the archive is ready.",
                  })
                }
              >
                <DownloadIcon /> Export
              </Button>
            </li>
            <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Reset demo data</p>
                <p className="text-xs text-muted-foreground">
                  Restore all mock incidents, changes and requests to their
                  seeded state.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirm("reset")}
              >
                <ShieldIcon /> Reset data
              </Button>
            </li>
            <li className="flex flex-col gap-3 py-3.5 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Delete workspace</p>
                <p className="text-xs text-muted-foreground">
                  Permanently remove this workspace, its users and all records.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirm("purge")}
              >
                <Trash2Icon /> Delete workspace
              </Button>
            </li>
          </ul>
        </SectionCard>
      </div>

      <AlertDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "purge"
                ? "Delete this workspace?"
                : "Reset demo data?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "purge"
                ? "This permanently deletes Acme Corp, all 24 users and every record. This cannot be undone."
                : "All records return to their seeded state. Anything you created in this session will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                toast(
                  confirm === "purge"
                    ? "Workspace deletion scheduled"
                    : "Demo data reset",
                  {
                    description:
                      confirm === "purge"
                        ? "Admins have 24 hours to cancel from the audit log."
                        : "Reload the page to see the seeded records.",
                  }
                )
                setConfirm(null)
              }}
            >
              {confirm === "purge" ? "Delete workspace" : "Reset data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
