"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BanIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
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
import { CopyButton } from "@/components/shared/copy-button"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  apiKeys as seed,
  providers,
  type ApiKey,
  type KeyEnvironment,
} from "@/lib/data/providers"
import { daysFromNow, NOW } from "@/lib/data/seed"
import { formatCurrency } from "@/lib/format"
import { GatewayBadge, ProviderChip } from "./shared"

const col = createColumnHelper<DataTableFeatures, ApiKey>()
const DAY = 86_400_000

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
  const tone = d < 0 ? "danger" : d < 14 ? "warning" : "muted"
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

export function ApiKeysTab() {
  const [items, setItems] = React.useState<ApiKey[]>(seed)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [reveal, setReveal] = React.useState<{
    key: ApiKey
    secret: string
  } | null>(null)
  const [confirm, setConfirm] = React.useState<{
    key: ApiKey
    action: "rotate" | "revoke"
  } | null>(null)

  const patch = (id: string, p: Partial<ApiKey>) =>
    setItems((prev) => prev.map((k) => (k.id === id ? { ...k, ...p } : k)))

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
          header: "Scopes",
          cell: ({ getValue }) => (
            <span className="flex flex-wrap gap-1">
              {getValue()
                .slice(0, 2)
                .map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {s}
                  </Badge>
                ))}
              {getValue().length > 2 && (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground"
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
            <DataTableColumnHeader column={column} title="Expires" />
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
            <DataTableColumnHeader column={column} title="Spend · month" />
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
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    disabled={k.status === "Revoked" || k.status === "Rotating"}
                    onClick={() => setConfirm({ key: k, action: "rotate" })}
                  >
                    <RefreshCwIcon /> Rotate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard?.writeText(k.id)
                      toast("Key id copied")
                    }}
                  >
                    <KeyRoundIcon /> Copy key id
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
        totalLabel="keys"
        selectionLabel={(n) => (n === 1 ? "key" : "keys")}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon /> Create key
          </Button>
        }
      />

      <CreateKeySheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(k, secret) => {
          setItems((prev) => [k, ...prev])
          setCreateOpen(false)
          setReveal({ key: k, secret })
        }}
      />

      <Dialog
        open={reveal !== null}
        onOpenChange={(o) => !o && setReveal(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Key created</DialogTitle>
            <DialogDescription>
              Copy <span className="font-medium">{reveal?.key.name}</span> now.
              For security it is shown once and cannot be retrieved later.
            </DialogDescription>
          </DialogHeader>
          {reveal && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">
                {reveal.secret}
              </code>
              <CopyButton
                value={reveal.secret}
                label="Copy key"
                size="icon-sm"
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReveal(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "rotate" ? "Rotate" : "Revoke"}{" "}
              {confirm?.key.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "rotate"
                ? "A replacement key is issued immediately. The current key keeps working for 24 hours so deployments can roll over without downtime."
                : "Requests signed with this key are rejected from now on. Agents that depend on it fall back to the next routing target or fail."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.action === "revoke" ? "destructive" : "default"}
              onClick={() => {
                if (!confirm) return
                if (confirm.action === "rotate") {
                  patch(confirm.key.id, { status: "Rotating" })
                  toast.success(`Rotating ${confirm.key.name}`, {
                    description: "New key issued · old key expires in 24 hours",
                  })
                } else {
                  patch(confirm.key.id, {
                    status: "Revoked",
                    expires: NOW.toISOString(),
                  })
                  toast(`${confirm.key.name} revoked`)
                }
                setConfirm(null)
              }}
            >
              {confirm?.action === "rotate" ? (
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
    </>
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

/** Deterministic hex derived from a string so a demo secret is stable. */
function fakeHex(input: string, length: number) {
  let h = 2166136261
  let out = ""
  for (let i = 0; out.length < length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i % input.length), 16777619) >>> 0
    out += h.toString(16).padStart(8, "0")
  }
  return out.slice(0, length)
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
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
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
      <form
        id="create-key"
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          const id = `key-${fakeHex(name, 6)}`
          const prefix =
            providerId === "prv-anthropic"
              ? "sk-ant-api03-"
              : providerId === "prv-openai"
                ? "sk-proj-"
                : providerId === "prv-openrouter"
                  ? "sk-or-v1-"
                  : "key-"
          const secret = `${prefix}${fakeHex(`${name}:${providerId}`, 40)}`
          onCreate(
            {
              id,
              name: name.trim(),
              providerId,
              maskedKey: `${prefix}…${secret.slice(-4)}`,
              ownerId: "u-001",
              scopes,
              environment: env,
              created: NOW.toISOString(),
              lastUsed: null,
              expires: expiry === "never" ? null : daysFromNow(Number(expiry)),
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
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
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
      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button type="submit" form="create-key" disabled={!valid}>
          <KeyRoundIcon /> Create key
        </Button>
      </SheetFooter>
    </>
  )
}
