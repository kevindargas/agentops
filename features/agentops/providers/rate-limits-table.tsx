"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
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
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getDeployedAgent } from "@/lib/data"
import {
  getApiKey,
  getProvider,
  providers,
  rateLimits as seed,
  type RateLimit,
} from "@/lib/data/providers"
import { formatNumber } from "@/lib/format"
import { fmtTokens } from "../shared"
import { pctTone, ProviderChip } from "./shared"

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
  return getApiKey(l.targetId)?.name ?? l.targetId
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
      <DataTableColumnHeader column={column} title="Scope" />
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
      <DataTableColumnHeader column={column} title="Requests / min" />
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
      <DataTableColumnHeader column={column} title="Tokens / min" />
    ),
    cell: ({ row }) => (
      <Utilisation
        used={row.original.usedTpm}
        limit={row.original.tpm}
        format={fmtTokens}
      />
    ),
    meta: { width: "w-44", label: "TPM", skeleton: "w-32" },
  }),
  col.accessor((l) => l.usedConcurrency / l.concurrency, {
    id: "concurrency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Concurrency" />
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
      <DataTableColumnHeader column={column} title="Burst" />
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
      <DataTableColumnHeader column={column} title="Throttled · 24h" />
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
      { value: "saturated", label: "Saturated (≥ 95%)" },
      { value: "high", label: "High (80–95%)" },
      { value: "normal", label: "Normal" },
    ],
    getValue: (l) => {
      const pct = Math.max(l.usedRpm / l.rpm, l.usedTpm / l.tpm) * 100
      return pct >= 95 ? "saturated" : pct >= 80 ? "high" : "normal"
    },
  },
]

export function RateLimitsTab() {
  const [items, setItems] = React.useState<RateLimit[]>(seed)
  const [openId, setOpenId] = React.useState<string | null>(null)
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
        totalLabel="quotas"
        selectionLabel={(n) => (n === 1 ? "quota" : "quotas")}
        toolbar={
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast("Quota editor opened")}
          >
            <GaugeIcon /> New quota
          </Button>
        }
      />
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          {open && (
            <EditLimitForm
              key={open.id}
              limit={open}
              onSave={(next) => {
                setItems((prev) =>
                  prev.map((l) => (l.id === next.id ? next : l))
                )
                setOpenId(null)
                toast.success("Quota updated", {
                  description: `${limitTargetName(next)} · ${formatNumber(next.rpm)} RPM · ${fmtTokens(next.tpm)} TPM`,
                })
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function EditLimitForm({
  limit: l,
  onSave,
}: {
  limit: RateLimit
  onSave: (l: RateLimit) => void
}) {
  const [rpm, setRpm] = React.useState(String(l.rpm))
  const [tpm, setTpm] = React.useState(String(l.tpm))
  const [concurrency, setConcurrency] = React.useState(String(l.concurrency))
  const [burst, setBurst] = React.useState(String(l.burst))
  const nums = [rpm, tpm, concurrency, burst].map(Number)
  const valid = nums.every((n) => Number.isFinite(n) && n >= 0)
  const name = limitTargetName(l)

  return (
    <>
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-lg">Edit quota · {name}</SheetTitle>
        <SheetDescription>
          {scopeLabel[l.scope]} scope on{" "}
          {getProvider(l.providerId)?.name ?? l.providerId}. Changes apply
          within one minute.
        </SheetDescription>
      </SheetHeader>
      <form
        id={`limit-${l.id}`}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          onSave({
            ...l,
            rpm: nums[0],
            tpm: nums[1],
            concurrency: nums[2],
            burst: nums[3],
            usedRpm: Math.min(l.usedRpm, nums[0]),
            usedTpm: Math.min(l.usedTpm, nums[1]),
            usedConcurrency: Math.min(l.usedConcurrency, nums[2]),
          })
        }}
      >
        <FieldGroup>
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-3">
            <Utilisation
              used={l.usedRpm}
              limit={l.rpm}
              format={(n) => `${formatNumber(n)} rpm`}
            />
            <Utilisation used={l.usedTpm} limit={l.tpm} format={fmtTokens} />
            <Utilisation
              used={l.usedConcurrency}
              limit={l.concurrency}
              format={(n) => `${n} conc.`}
            />
          </div>
          <Field>
            <FieldLabel htmlFor={`${l.id}-rpm`}>Requests per minute</FieldLabel>
            <Input
              id={`${l.id}-rpm`}
              inputMode="numeric"
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${l.id}-tpm`}>Tokens per minute</FieldLabel>
            <Input
              id={`${l.id}-tpm`}
              inputMode="numeric"
              value={tpm}
              onChange={(e) => setTpm(e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${l.id}-conc`}>Max concurrency</FieldLabel>
            <Input
              id={`${l.id}-conc`}
              inputMode="numeric"
              value={concurrency}
              onChange={(e) => setConcurrency(e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${l.id}-burst`}>Burst allowance</FieldLabel>
            <Input
              id={`${l.id}-burst`}
              inputMode="numeric"
              value={burst}
              onChange={(e) => setBurst(e.target.value)}
              className="tabular-nums"
            />
            <FieldDescription>
              Extra requests allowed above the RPM limit for up to 10 seconds.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button type="submit" form={`limit-${l.id}`} disabled={!valid}>
          <CheckIcon /> Save quota
        </Button>
      </SheetFooter>
    </>
  )
}
