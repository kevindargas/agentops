"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { CheckIcon, GaugeIcon } from "lucide-react"
import { toast } from "sonner"

import { AvailabilityBar } from "@/components/charts/availability-bar"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
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
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import {
  getApiKey,
  getProvider,
  providers,
  type RateLimit,
  type RateLimitScope,
} from "@/lib/data/providers"
import { clock } from "@/lib/data/seed"
import { formatNumber, formatTokens } from "@/lib/format"
import { pctTone, ProviderChip } from "./shared"
import { fakeHex, keyStore, rateLimitStore } from "./store"

const col = createColumnHelper<DataTableFeatures, RateLimit>()

const scopeLabel: Record<RateLimit["scope"], string> = {
  agent: "Agent",
  provider: "Provider",
  key: "API key",
}

export function limitTargetName(l: RateLimit) {
  if (l.scope === "agent")
    return getDeployedAgent(l.targetId)?.name ?? l.targetId
  if (l.scope === "provider") return getProvider(l.targetId)?.name ?? l.targetId
  return (
    keyStore.get().find((k) => k.id === l.targetId)?.name ??
    getApiKey(l.targetId)?.name ??
    l.targetId
  )
}

function Utilisation({
  used,
  limit,
  format,
}: {
  used: number
  limit: number
  format: (n: number) => string
}) {
  const pct = limit ? (used / limit) * 100 : 0
  return (
    <AvailabilityBar
      value={pct}
      tone={pctTone(pct)}
      size="sm"
      label={
        <span className="tabular-nums">
          {format(used)} / {format(limit)}
        </span>
      }
      valueLabel={`${Math.round(pct)}%`}
      className="min-w-32"
    />
  )
}

const columns = col.columns([
  col.accessor((l) => limitTargetName(l), {
    id: "target",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Scope"
        hint="What the quota is attached to: one agent, one provider connection, or one API key"
      />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={limitTargetName(row.original)}
        secondary={scopeLabel[row.original.scope]}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-48", label: "Scope", skeleton: "w-32" },
  }),
  col.accessor("providerId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ getValue }) => <ProviderChip providerId={getValue()} />,
    meta: { width: "w-44", label: "Provider", skeleton: "w-28" },
  }),
  col.accessor((l) => l.usedRpm / l.rpm, {
    id: "rpm",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Requests / min"
        hint="Current requests per minute against the RPM limit"
      />
    ),
    cell: ({ row }) => (
      <Utilisation
        used={row.original.usedRpm}
        limit={row.original.rpm}
        format={(n) => formatNumber(n, true)}
      />
    ),
    meta: { width: "w-44", label: "RPM", skeleton: "w-32" },
  }),
  col.accessor((l) => l.usedTpm / l.tpm, {
    id: "tpm",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Tokens / min"
        hint="Current tokens per minute against the TPM limit; moves before RPM when prompts get longer"
      />
    ),
    cell: ({ row }) => (
      <Utilisation
        used={row.original.usedTpm}
        limit={row.original.tpm}
        format={formatTokens}
      />
    ),
    meta: { width: "w-44", label: "TPM", skeleton: "w-32" },
  }),
  col.accessor((l) => l.usedConcurrency / l.concurrency, {
    id: "concurrency",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Concurrency"
        hint="Requests in flight at once against the cap"
      />
    ),
    cell: ({ row }) => (
      <Utilisation
        used={row.original.usedConcurrency}
        limit={row.original.concurrency}
        format={(n) => String(n)}
      />
    ),
    meta: { width: "w-40", label: "Concurrency", skeleton: "w-28" },
  }),
  col.accessor("burst", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Burst"
        hint="Extra requests allowed above the RPM limit for up to 10 seconds"
      />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => `+${formatNumber(n)}`}
        muted
      />
    ),
    meta: {
      width: "w-24",
      label: "Burst allowance",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("throttled24h", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Throttled · 24h"
        hint="Requests the gateway answered with 429 because this quota was exhausted"
      />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        className={
          getValue() >= 100
            ? "font-medium text-danger-text"
            : getValue() > 0
              ? "text-warning-text"
              : undefined
        }
        muted={getValue() === 0}
      />
    ),
    meta: {
      width: "w-28",
      label: "Throttled 24h",
      numeric: true,
      skeleton: "w-10",
    },
  }),
  col.accessor("updated", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Updated", skeleton: "w-16" },
  }),
])

const facets: FacetDef<RateLimit>[] = [
  {
    id: "scope",
    title: "Scope",
    options: (Object.keys(scopeLabel) as RateLimit["scope"][]).map((k) => ({
      value: k,
      label: scopeLabel[k],
    })),
    getValue: (l) => l.scope,
  },
  {
    id: "provider",
    title: "Provider",
    options: providers.map((p) => ({ value: p.id, label: p.name })),
    getValue: (l) => l.providerId,
  },
  {
    id: "pressure",
    title: "Pressure",
    options: [
      { value: "saturated", label: "Saturated (95% or more)" },
      { value: "high", label: "High (80 to 95%)" },
      { value: "normal", label: "Normal" },
    ],
    getValue: (l) => {
      const pct = Math.max(l.usedRpm / l.rpm, l.usedTpm / l.tpm) * 100
      return pct >= 95 ? "saturated" : pct >= 80 ? "high" : "normal"
    },
  },
]

export function RateLimitsTab() {
  const items = rateLimitStore.use()
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const open = items.find((l) => l.id === openId) ?? null

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(l) => l.id}
        getSearchText={(l) =>
          `${limitTargetName(l)} ${scopeLabel[l.scope]} ${getProvider(l.providerId)?.name ?? ""}`
        }
        searchPlaceholder="Search quotas…"
        facets={facets}
        initialSorting={[{ id: "rpm", desc: true }]}
        onRowClick={(l) => setOpenId(l.id)}
        caption="Rate limit quotas by agent, provider and key"
        totalLabel="quotas"
        selectionLabel={(n) => (n === 1 ? "quota" : "quotas")}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <GaugeIcon /> New quota
          </Button>
        }
      />
      <Sheet
        open={open !== null || createOpen}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null)
            setCreateOpen(false)
          }
        }}
      >
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          {(open || createOpen) && (
            <LimitForm
              key={open?.id ?? "new"}
              limit={open}
              onSave={(next) => {
                if (open) {
                  rateLimitStore.patch(next.id, next)
                  toast.success("Quota updated", {
                    description: `${limitTargetName(next)} · ${formatNumber(next.rpm)} RPM · ${formatTokens(next.tpm)} TPM`,
                  })
                } else {
                  rateLimitStore.add(next, "start")
                  toast.success("Quota created", {
                    description: `${limitTargetName(next)} · ${formatNumber(next.rpm)} RPM · ${formatTokens(next.tpm)} TPM`,
                  })
                }
                setOpenId(null)
                setCreateOpen(false)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

const scopeOptions = (Object.keys(scopeLabel) as RateLimitScope[]).map((k) => ({
  value: k,
  label: scopeLabel[k],
}))
const providerOptions = providers.map((p) => ({ value: p.id, label: p.name }))

function targetOptions(scope: RateLimitScope) {
  if (scope === "agent")
    return deployedAgents.map((a) => ({ value: a.id, label: a.name }))
  if (scope === "provider") return providerOptions
  return keyStore
    .get()
    .filter((k) => k.status !== "Revoked")
    .map((k) => ({ value: k.id, label: k.name }))
}

/** Edit an existing quota, or create one when `limit` is null. */
function LimitForm({
  limit: l,
  onSave,
}: {
  limit: RateLimit | null
  onSave: (l: RateLimit) => void
}) {
  const creating = l === null
  const [scope, setScope] = React.useState<RateLimitScope>(l?.scope ?? "agent")
  const [targetId, setTargetId] = React.useState(
    l?.targetId ?? deployedAgents[0].id
  )
  const [providerId, setProviderId] = React.useState(
    l?.providerId ?? providers[0].id
  )
  const [rpm, setRpm] = React.useState(String(l?.rpm ?? 600))
  const [tpm, setTpm] = React.useState(String(l?.tpm ?? 400_000))
  const [concurrency, setConcurrency] = React.useState(
    String(l?.concurrency ?? 16)
  )
  const [burst, setBurst] = React.useState(String(l?.burst ?? 50))
  const nums = [rpm, tpm, concurrency, burst].map(Number)
  const valid = nums.every((n) => Number.isFinite(n) && n >= 0) && targetId
  const targets = targetOptions(scope)
  const name = l ? limitTargetName(l) : undefined

  const changeScope = (next: RateLimitScope) => {
    setScope(next)
    const first = targetOptions(next)[0]
    if (first) setTargetId(first.value)
    if (next === "provider" && first) setProviderId(first.value)
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-lg">
          {creating ? "New quota" : `Edit quota · ${name}`}
        </SheetTitle>
        <SheetDescription>
          {creating
            ? "Caps requests, tokens and concurrency for one agent, provider or key. Applies within one minute."
            : `${scopeLabel[l.scope]} scope on ${getProvider(l.providerId)?.name ?? l.providerId}. Changes apply within one minute.`}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="limit-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            const resolvedProvider =
              scope === "provider"
                ? targetId
                : scope === "key"
                  ? (keyStore.get().find((k) => k.id === targetId)
                      ?.providerId ?? providerId)
                  : providerId
            onSave({
              id: l?.id ?? `rl-${fakeHex(`${scope}:${targetId}`, 3)}`,
              scope,
              targetId,
              providerId: resolvedProvider,
              rpm: nums[0],
              tpm: nums[1],
              concurrency: nums[2],
              burst: nums[3],
              usedRpm: Math.min(l?.usedRpm ?? 0, nums[0]),
              usedTpm: Math.min(l?.usedTpm ?? 0, nums[1]),
              usedConcurrency: Math.min(l?.usedConcurrency ?? 0, nums[2]),
              throttled24h: l?.throttled24h ?? 0,
              updated: clock().toISOString(),
            })
          }}
        >
          <FieldGroup>
            {l ? (
              <div className="grid gap-4 rounded-lg border bg-muted/30 p-3">
                <Utilisation
                  used={l.usedRpm}
                  limit={l.rpm}
                  format={(n) => `${formatNumber(n)} rpm`}
                />
                <Utilisation
                  used={l.usedTpm}
                  limit={l.tpm}
                  format={formatTokens}
                />
                <Utilisation
                  used={l.usedConcurrency}
                  limit={l.concurrency}
                  format={(n) => `${n} conc.`}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="limit-scope">Scope</FieldLabel>
                    <Select
                      items={scopeOptions}
                      value={scope}
                      onValueChange={(v) =>
                        v && changeScope(v as RateLimitScope)
                      }
                    >
                      <SelectTrigger id="limit-scope" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scopeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="limit-target">
                      {scopeLabel[scope]}
                    </FieldLabel>
                    <Select
                      items={targets}
                      value={targetId}
                      onValueChange={(v) => v && setTargetId(String(v))}
                    >
                      <SelectTrigger id="limit-target" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {targets.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {scope === "agent" && (
                  <Field>
                    <FieldLabel htmlFor="limit-provider">Provider</FieldLabel>
                    <Select
                      items={providerOptions}
                      value={providerId}
                      onValueChange={(v) => v && setProviderId(String(v))}
                    >
                      <SelectTrigger id="limit-provider" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      The connection this agent quota counts against.
                    </FieldDescription>
                  </Field>
                )}
              </>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="limit-rpm">Requests per minute</FieldLabel>
                <Input
                  id="limit-rpm"
                  inputMode="numeric"
                  value={rpm}
                  onChange={(e) => setRpm(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="limit-tpm">Tokens per minute</FieldLabel>
                <Input
                  id="limit-tpm"
                  inputMode="numeric"
                  value={tpm}
                  onChange={(e) => setTpm(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="limit-conc">Max concurrency</FieldLabel>
                <Input
                  id="limit-conc"
                  inputMode="numeric"
                  value={concurrency}
                  onChange={(e) => setConcurrency(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="limit-burst">Burst allowance</FieldLabel>
                <Input
                  id="limit-burst"
                  inputMode="numeric"
                  value={burst}
                  onChange={(e) => setBurst(e.target.value)}
                  className="tabular-nums"
                />
                <FieldDescription>
                  Extra requests allowed above the RPM limit for up to 10
                  seconds.
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </form>
      </SheetBody>
      <SheetFooterActions
        primary={
          <Button type="submit" form="limit-form" disabled={!valid}>
            <CheckIcon /> {creating ? "Create quota" : "Save quota"}
          </Button>
        }
      />
    </>
  )
}
