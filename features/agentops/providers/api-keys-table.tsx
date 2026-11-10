"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BanIcon,
  HistoryIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PanelRightOpenIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  actionsColumnMeta,
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { setQueryParam } from "@/hooks/use-query-param"
import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  keyRotationGraceHours,
  providers,
  type ApiKey,
  type KeyEnvironment,
  type RateLimit,
  type RoutingRule,
} from "@/lib/data/providers"
import { clock, daysFromNow, hoursFromNow, NOW } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { AgentChip } from "../shared"
import { GatewayBadge, ProviderChip } from "./shared"
import {
  fakeHex,
  KEY_EXPIRY_WARNING_DAYS,
  keyPrefix,
  keyStore,
  rateLimitStore,
  routingStore,
} from "./store"

const col = createColumnHelper<DataTableFeatures, ApiKey>()
const DAY = 86_400_000

/** Counts rotations in this session so each replacement secret is distinct. */
let rotationCounter = 0

/** Days until expiry relative to the demo clock; negative when expired. */
function daysToExpiry(k: ApiKey) {
  if (!k.expires) return null
  return Math.round((new Date(k.expires).getTime() - NOW.getTime()) / DAY)
}

function ExpiryCell({ k }: { k: ApiKey }) {
  const d = daysToExpiry(k)
  if (d === null)
    return <span className="text-xs text-muted-foreground">Never</span>
  if (k.status === "Revoked") return <DateCell value={k.expires} />
  const tone =
    d < 0 ? "danger" : d < KEY_EXPIRY_WARNING_DAYS ? "warning" : "muted"
  return (
    <span className="inline-flex items-center gap-1.5">
      {tone !== "muted" && (
        <ShieldAlertIcon
          className={cn(
            "size-3.5",
            tone === "danger" ? "text-danger-text" : "text-warning-text"
          )}
          aria-hidden
        />
      )}
      <DateCell value={k.expires} tone={tone} />
    </span>
  )
}

const facets: FacetDef<ApiKey>[] = [
  {
    id: "provider",
    title: "Provider",
    options: providers.map((p) => ({ value: p.id, label: p.name })),
    getValue: (k) => k.providerId,
  },
  {
    id: "env",
    title: "Environment",
    options: [
      { value: "production", label: "Production" },
      { value: "staging", label: "Staging" },
    ],
    getValue: (k) => k.environment,
  },
  {
    id: "status",
    title: "Status",
    options: ["Active", "Expiring", "Rotating", "Revoked"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (k) => k.status,
  },
]

type ConfirmAction = "rotate" | "revoke"

interface Reveal {
  key: ApiKey
  secret: string
  /** The key that keeps working during the grace period after a rotation. */
  previous?: ApiKey
}

/** Keys whose provider is targeted by the rule's chain. */
function rulesForKey(rules: RoutingRule[], k: ApiKey) {
  return rules.filter((r) => r.chain.some((t) => t.providerId === k.providerId))
}

function limitsForKey(limits: RateLimit[], k: ApiKey) {
  return limits.filter((l) => l.scope === "key" && l.targetId === k.id)
}

async function copyKeyId(k: ApiKey) {
  try {
    await navigator.clipboard.writeText(k.id)
    toast("Key id copied", { description: k.id })
  } catch {
    toast.error("Clipboard unavailable", {
      description: `Copy ${k.id} from the key details instead`,
    })
  }
}

export function ApiKeysTab() {
  const items = keyStore.use()
  const rules = routingStore.use()
  const limits = rateLimitStore.use()
  const params = useSearchParams()
  const openId = params.get("key")
  const open = openId ? (items.find((k) => k.id === openId) ?? null) : null

  const [createOpen, setCreateOpen] = React.useState(false)
  const [reveal, setReveal] = React.useState<Reveal | null>(null)
  const [confirm, setConfirm] = React.useState<{
    key: ApiKey
    action: ConfirmAction
  } | null>(null)
  /** Reason entered on the last rotate / revoke per key, shown in the sheet. */
  const [notes, setNotes] = React.useState<Record<string, string>>({})

  const openKey = (id: string | null) => setQueryParam("key", id)

  const rotate = (k: ApiKey, reason: string) => {
    rotationCounter += 1
    const prefix = keyPrefix(k.maskedKey)
    const secret = `${prefix}${fakeHex(
      `${k.name}:${k.providerId}:rotation-${rotationCounter}`,
      40
    )}`
    const graceEnd = hoursFromNow(keyRotationGraceHours)
    const replacement: ApiKey = {
      ...k,
      id: `key-${fakeHex(`${k.id}:r${rotationCounter}`, 6)}`,
      maskedKey: `${prefix}…${secret.slice(-4)}`,
      created: clock().toISOString(),
      lastUsed: null,
      monthlySpend: 0,
      status: "Active",
      expires:
        k.expires && k.expires > clock().toISOString()
          ? k.expires
          : daysFromNow(90),
    }
    keyStore.patch(k.id, { status: "Rotating", expires: graceEnd })
    keyStore.add(replacement, "start")
    if (reason.trim())
      setNotes((prev) => ({
        ...prev,
        [k.id]: reason.trim(),
        [replacement.id]: reason.trim(),
      }))
    setReveal({ key: replacement, secret, previous: k })
    toast.success(`${k.name} rotated`, {
      description: `Replacement issued. The previous key stops working in ${keyRotationGraceHours} hours.`,
    })
  }

  const revoke = (k: ApiKey, reason: string) => {
    const before = { status: k.status, expires: k.expires }
    keyStore.patch(k.id, { status: "Revoked", expires: clock().toISOString() })
    if (reason.trim()) setNotes((prev) => ({ ...prev, [k.id]: reason.trim() }))
    toast(`${k.name} revoked`, {
      description: "Requests signed with this key are rejected from now on.",
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          keyStore.patch(k.id, before)
          toast(`${k.name} restored`, {
            description: `Status back to ${before.status}`,
          })
        },
      },
    })
  }

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("name", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Key" />
          ),
          cell: ({ row }) => (
            <TwoLineCell
              primary={row.original.name}
              secondary={row.original.maskedKey}
              mono
            />
          ),
          enableHiding: false,
          meta: { width: "min-w-56", label: "Key", skeleton: "w-40" },
        }),
        col.accessor("providerId", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Provider" />
          ),
          cell: ({ getValue }) => <ProviderChip providerId={getValue()} />,
          meta: { width: "w-44", label: "Provider", skeleton: "w-28" },
        }),
        col.accessor("ownerId", {
          header: "Owner",
          cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
          enableSorting: false,
          meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
        }),
        col.accessor("scopes", {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Scopes"
              hint="Provider API surfaces the key may call. Narrower than the routing chain needs is a finding."
            />
          ),
          cell: ({ getValue }) => (
            <span className="flex flex-wrap gap-1">
              {getValue()
                .slice(0, 2)
                .map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="h-5 px-1.5 font-mono text-3xs text-muted-foreground"
                  >
                    {s}
                  </Badge>
                ))}
              {getValue().length > 2 && (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-3xs text-muted-foreground"
                  title={getValue().slice(2).join(", ")}
                >
                  +{getValue().length - 2}
                </Badge>
              )}
            </span>
          ),
          enableSorting: false,
          meta: { width: "min-w-48", label: "Scopes", skeleton: "w-32" },
        }),
        col.accessor("environment", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Env" />
          ),
          cell: ({ getValue }) => <StateBadge state={getValue()} size="sm" />,
          meta: { width: "w-28", label: "Environment", skeleton: "w-16" },
        }),
        col.accessor("created", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Created" />
          ),
          cell: ({ getValue }) => (
            <DateCell value={getValue()} mode="absolute" />
          ),
          meta: { width: "w-28", label: "Created", skeleton: "w-16" },
        }),
        col.accessor("lastUsed", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Last used" />
          ),
          cell: ({ getValue }) =>
            getValue() ? <DateCell value={getValue()} /> : <EmptyValue />,
          meta: { width: "w-28", label: "Last used", skeleton: "w-16" },
        }),
        col.accessor("expires", {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Expires"
              hint={`Amber under ${KEY_EXPIRY_WARNING_DAYS} days, red once past. Rotating keys show the end of the ${keyRotationGraceHours} hour grace period.`}
            />
          ),
          cell: ({ row }) => <ExpiryCell k={row.original} />,
          sortFn: (a, b) => {
            const da = a.original.expires
              ? new Date(a.original.expires).getTime()
              : Infinity
            const db = b.original.expires
              ? new Date(b.original.expires).getTime()
              : Infinity
            return da === db ? 0 : da < db ? -1 : 1
          },
          meta: { width: "w-32", label: "Expires", skeleton: "w-16" },
        }),
        col.accessor("monthlySpend", {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Spend · month"
              hint="Gateway spend attributed to this key over the last 30 days"
            />
          ),
          cell: ({ getValue }) => (
            <NumericCell
              value={getValue()}
              format={(n) => formatCurrency(n)}
              muted={getValue() === 0}
            />
          ),
          meta: {
            width: "w-28",
            label: "Monthly spend",
            numeric: true,
            skeleton: "w-14",
          },
        }),
        col.accessor("status", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Status" />
          ),
          cell: ({ getValue }) => (
            <GatewayBadge
              state={getValue()}
              size="sm"
              pulse={getValue() === "Rotating"}
            />
          ),
          meta: { width: "w-28", label: "Status", skeleton: "w-16" },
        }),
        col.display({
          id: "actions",
          cell: ({ row }) => {
            const k = row.original
            return (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Actions for ${k.name}`}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => openKey(k.id)}>
                    <PanelRightOpenIcon /> Details and dependents
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={k.status === "Revoked" || k.status === "Rotating"}
                    onClick={() => setConfirm({ key: k, action: "rotate" })}
                  >
                    <RefreshCwIcon /> Rotate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void copyKeyId(k)}>
                    <KeyRoundIcon /> Copy key id
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/agentops/audit?source=api-key" />}
                  >
                    <HistoryIcon /> Audit history
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={k.status === "Revoked"}
                    onClick={() => setConfirm({ key: k, action: "revoke" })}
                  >
                    <BanIcon /> Revoke
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          },
          enableSorting: false,
          enableHiding: false,
          meta: actionsColumnMeta,
        }),
      ]),
    []
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(k) => k.id}
        getSearchText={(k) =>
          `${k.name} ${k.maskedKey} ${k.scopes.join(" ")} ${providers.find((p) => p.id === k.providerId)?.name ?? ""}`
        }
        searchPlaceholder="Search keys…"
        facets={facets}
        initialSorting={[{ id: "monthlySpend", desc: true }]}
        initialColumnVisibility={{ created: false }}
        onRowClick={(k) => openKey(k.id)}
        caption="API keys held in the gateway vault"
        totalLabel="keys"
        selectionLabel={(n) => (n === 1 ? "key" : "keys")}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon /> Create key
          </Button>
        }
      />

      <KeySheet
        apiKey={open}
        rules={open ? rulesForKey(rules, open) : []}
        limits={open ? limitsForKey(limits, open) : []}
        note={open ? notes[open.id] : undefined}
        onClose={() => openKey(null)}
        onRotate={(k) => setConfirm({ key: k, action: "rotate" })}
        onRevoke={(k) => setConfirm({ key: k, action: "revoke" })}
      />

      <CreateKeySheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(k, secret) => {
          keyStore.add(k, "start")
          setCreateOpen(false)
          setReveal({ key: k, secret })
          toast.success(`${k.name} created`, {
            description: `${k.scopes.length} scope${k.scopes.length === 1 ? "" : "s"} · ${k.environment}`,
          })
        }}
      />

      <RevealDialog reveal={reveal} onClose={() => setReveal(null)} />

      <ConfirmKeyDialog
        confirm={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (!confirm) return
          if (confirm.action === "rotate") rotate(confirm.key, reason)
          else revoke(confirm.key, reason)
          setConfirm(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Key detail sheet                                                          */
/* ------------------------------------------------------------------------ */

function KeySheet({
  apiKey: k,
  rules,
  limits,
  note,
  onClose,
  onRotate,
  onRevoke,
}: {
  apiKey: ApiKey | null
  rules: RoutingRule[]
  limits: RateLimit[]
  note?: string
  onClose: () => void
  onRotate: (k: ApiKey) => void
  onRevoke: (k: ApiKey) => void
}) {
  return (
    <Sheet open={k !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {k && (
          <>
            <SheetHeader className="gap-2 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <GatewayBadge
                  state={k.status}
                  pulse={k.status === "Rotating"}
                />
                <StateBadge state={k.environment} size="sm" />
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {k.id}
                </span>
              </div>
              <SheetTitle className="font-mono text-lg leading-tight">
                {k.name}
              </SheetTitle>
              <SheetDescription>
                {k.maskedKey}. Rotating or revoking affects every routing target
                on this provider and the quotas scoped to the key.
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-6">
              <DetailList
                columns={2}
                items={[
                  {
                    label: "Provider",
                    value: <ProviderChip providerId={k.providerId} />,
                  },
                  {
                    label: "Owner",
                    value: <UserChip userId={k.ownerId} size="xs" />,
                  },
                  {
                    label: "Scopes",
                    value: k.scopes.join(", "),
                    mono: true,
                    wide: true,
                  },
                  { label: "Created", value: formatDateTime(k.created) },
                  {
                    label: "Last used",
                    value: k.lastUsed ? formatDateTime(k.lastUsed) : "Never",
                  },
                  {
                    label:
                      k.status === "Rotating" ? "Grace period ends" : "Expires",
                    value: k.expires ? formatDateTime(k.expires) : "Never",
                  },
                  {
                    label: "Spend · 30d",
                    value: formatCurrency(k.monthlySpend),
                  },
                  ...(note
                    ? [{ label: "Last change note", value: note, wide: true }]
                    : []),
                ]}
              />

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  Routing rules on this provider
                </h3>
                {rules.length === 0 ? (
                  <EmptyState
                    size="sm"
                    bare
                    title="No routing rule targets this provider"
                    description="Nothing falls over if the key stops working."
                  />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {rules.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                      >
                        <Link
                          href={`/agentops/providers?tab=routing&rule=${r.id}`}
                          className="min-w-0 flex-1 truncate font-medium hover:underline"
                        >
                          {r.name}
                        </Link>
                        <StateBadge state={r.status} size="sm" />
                        <span className="flex w-full flex-wrap gap-2 text-xs text-muted-foreground">
                          {r.agentIds.length === 0
                            ? "Any agent without an explicit rule"
                            : r.agentIds.map((id) => (
                                <AgentChip key={id} agentId={id} size="sm" />
                              ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  Quotas scoped to this key
                </h3>
                {limits.length === 0 ? (
                  <EmptyState
                    size="sm"
                    bare
                    title="No key-scoped quota"
                    description="The provider and agent quotas still apply."
                  />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {limits.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <Link
                          href="/agentops/providers?tab=limits"
                          className="font-mono text-xs hover:underline"
                        >
                          {l.id}
                        </Link>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {l.rpm.toLocaleString("en-US")} RPM · {l.concurrency}{" "}
                          concurrent
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </SheetBody>
            <SheetFooterActions
              tertiary={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger-text"
                  disabled={k.status === "Revoked"}
                  onClick={() => onRevoke(k)}
                >
                  <BanIcon /> Revoke
                </Button>
              }
              secondary={
                <Button
                  variant="outline"
                  render={<Link href="/agentops/audit?source=api-key" />}
                >
                  <HistoryIcon /> Audit history
                </Button>
              }
              primary={
                <Button
                  disabled={k.status === "Revoked" || k.status === "Rotating"}
                  onClick={() => onRotate(k)}
                >
                  <RefreshCwIcon /> Rotate
                </Button>
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* Confirm and reveal dialogs                                                */
/* ------------------------------------------------------------------------ */

function ConfirmKeyDialog({
  confirm,
  onClose,
  onConfirm,
}: {
  confirm: { key: ApiKey; action: ConfirmAction } | null
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = React.useState("")
  const rotate = confirm?.action === "rotate"
  return (
    <AlertDialog
      open={confirm !== null}
      onOpenChange={(o) => {
        if (!o) {
          setReason("")
          onClose()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {rotate ? "Rotate" : "Revoke"} {confirm?.key.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {rotate
              ? `A replacement key is issued now and shown once. The current key keeps working for ${keyRotationGraceHours} hours so deployments can roll over without downtime.`
              : "Requests signed with this key are rejected from now on. Agents that depend on it fall back to the next routing target or fail."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="key-change-reason" className="text-xs">
            Reason (optional)
          </Label>
          <Textarea
            id="key-change-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              rotate
                ? "Scheduled rotation, owner change, suspected leak"
                : "Unused for a month, owner left, suspected leak"
            }
          />
          <p className="text-xs text-muted-foreground">
            Kept with the key in this session so the access review can read it.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={rotate ? "default" : "destructive"}
            onClick={() => {
              onConfirm(reason)
              setReason("")
            }}
          >
            {rotate ? (
              <>
                <RefreshCwIcon /> Rotate key
              </>
            ) : (
              <>
                <BanIcon /> Revoke key
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RevealDialog({
  reveal,
  onClose,
}: {
  reveal: Reveal | null
  onClose: () => void
}) {
  const rotated = Boolean(reveal?.previous)
  return (
    <Dialog open={reveal !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rotated ? "Key rotated" : "Key created"}</DialogTitle>
          <DialogDescription>
            Copy <span className="font-medium">{reveal?.key.name}</span> now. It
            is shown once and cannot be retrieved later.
          </DialogDescription>
        </DialogHeader>
        {reveal && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">
              {reveal.secret}
            </code>
            <CopyButton value={reveal.secret} label="Copy key" size="icon-sm" />
          </div>
        )}
        {reveal?.previous && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            The previous key{" "}
            <code className="font-mono">{reveal.previous.maskedKey}</code> keeps
            working for {keyRotationGraceHours} hours, until{" "}
            {formatDateTime(hoursFromNow(keyRotationGraceHours))}. Move
            consumers over before then; it shows as Rotating until it stops.
          </p>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------------ */
/* Create key                                                                */
/* ------------------------------------------------------------------------ */

const scopeOptions = [
  "messages",
  "responses",
  "chat.completions",
  "embeddings",
  "batches",
  "files",
  "rerank",
  "models.read",
]
const expiryOptions = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never" },
]
const providerItems = providers.map((p) => ({ value: p.id, label: p.name }))

const createPrefix: Record<string, string> = {
  "prv-anthropic": "sk-ant-api03-",
  "prv-openai": "sk-proj-",
  "prv-openrouter": "sk-or-v1-",
}

function CreateKeySheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (k: ApiKey, secret: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {open && <CreateKeyForm onCreate={onCreate} />}
      </SheetContent>
    </Sheet>
  )
}

function CreateKeyForm({
  onCreate,
}: {
  onCreate: (k: ApiKey, secret: string) => void
}) {
  const [name, setName] = React.useState("")
  const [providerId, setProviderId] = React.useState(providers[0].id)
  const [env, setEnv] = React.useState<KeyEnvironment>("staging")
  const [scopes, setScopes] = React.useState<string[]>(["messages"])
  const [expiry, setExpiry] = React.useState("90")
  const valid = name.trim().length >= 3 && scopes.length > 0

  return (
    <>
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-lg">Create API key</SheetTitle>
        <SheetDescription>
          Scoped credential stored in the gateway vault. The secret is shown
          once after creation.
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="create-key"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            const id = `key-${fakeHex(name, 6)}`
            const prefix = createPrefix[providerId] ?? "key-"
            const secret = `${prefix}${fakeHex(`${name}:${providerId}`, 40)}`
            onCreate(
              {
                id,
                name: name.trim(),
                providerId,
                maskedKey: `${prefix}…${secret.slice(-4)}`,
                ownerId: currentUser.id,
                scopes,
                environment: env,
                created: clock().toISOString(),
                lastUsed: null,
                expires:
                  expiry === "never" ? null : daysFromNow(Number(expiry)),
                monthlySpend: 0,
                status: "Active",
              },
              secret
            )
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="key-name">Name</FieldLabel>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="gateway-prod-anthropic"
                autoFocus
              />
              <FieldDescription>
                Lowercase, hyphenated. Shows up in traces and spend reports.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="key-provider">Provider</FieldLabel>
              <Select
                items={providerItems}
                value={providerId}
                onValueChange={(v) => v && setProviderId(String(v))}
              >
                <SelectTrigger id="key-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerItems.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Environment</FieldLabel>
              <ToggleGroup
                value={[env]}
                onValueChange={(v) => v[0] && setEnv(v[0] as KeyEnvironment)}
                aria-label="Environment"
              >
                <ToggleGroupItem value="staging" size="sm" variant="outline">
                  Staging
                </ToggleGroupItem>
                <ToggleGroupItem value="production" size="sm" variant="outline">
                  Production
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Scopes</FieldLabel>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                {scopeOptions.map((s) => {
                  const id = `scope-${s.replace(/\W/g, "-")}`
                  return (
                    <li key={s} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={scopes.includes(s)}
                        onCheckedChange={(v) =>
                          setScopes((prev) =>
                            v ? [...prev, s] : prev.filter((x) => x !== s)
                          )
                        }
                      />
                      <label htmlFor={id} className="font-mono text-xs">
                        {s}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Field>
            <Field>
              <FieldLabel htmlFor="key-expiry">Expires</FieldLabel>
              <Select
                items={expiryOptions}
                value={expiry}
                onValueChange={(v) => v && setExpiry(String(v))}
              >
                <SelectTrigger id="key-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expiryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Keys older than 90 days are flagged by the security review.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </SheetBody>
      <SheetFooterActions
        primary={
          <Button type="submit" form="create-key" disabled={!valid}>
            <KeyRoundIcon /> Create key
          </Button>
        }
      />
    </>
  )
}
