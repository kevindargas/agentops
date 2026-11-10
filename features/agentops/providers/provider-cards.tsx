"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ActivityIcon,
  CheckIcon,
  KeyRoundIcon,
  PlugZapIcon,
  PowerIcon,
  PowerOffIcon,
  Settings2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import { StatusDot } from "@/components/shared/status-badge"
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
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  providerIncidents,
  providers as seed,
  type Provider,
} from "@/lib/data/providers"
import { NOW } from "@/lib/data/seed"
import { formatCurrency, formatNumber, timeAgo } from "@/lib/format"
import { fmtMs, ModelChip } from "../shared"
import { GatewayBadge, ProviderLogo } from "./shared"

export function ProvidersTab() {
  const [items, setItems] = React.useState<Provider[]>(seed)
  const [configureId, setConfigureId] = React.useState<string | null>(null)
  const [disableId, setDisableId] = React.useState<string | null>(null)

  const patch = (id: string, p: Partial<Provider>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const configuring = items.find((p) => p.id === configureId) ?? null
  const disabling = items.find((p) => p.id === disableId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <VendorStatusStrip providers={items} />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            onTest={() => {
              if (p.status === "Disconnected")
                toast.error(`${p.name}: connection failed`, {
                  description: "TLS handshake timed out after 10 s",
                })
              else
                toast.success(`${p.name} reachable`, {
                  description: `Round trip ${p.testLatencyMs} ms · ${p.enabledModels.length} models listed`,
                })
              patch(p.id, { lastHealthCheck: NOW.toISOString() })
            }}
            onConfigure={() => setConfigureId(p.id)}
            onToggle={() => {
              if (p.status === "Disconnected") {
                patch(p.id, { status: "Connected" })
                toast.success(`${p.name} enabled`, {
                  description: "Routing rules that reference it resume.",
                })
              } else setDisableId(p.id)
            }}
          />
        ))}
      </div>

      <ConfigureSheet
        provider={configuring}
        onClose={() => setConfigureId(null)}
        onSave={(p) => {
          patch(p.id, p)
          setConfigureId(null)
          toast.success(`${p.name} configuration saved`, {
            description: `${p.enabledModels.length} models enabled · ${p.regions.length} region${p.regions.length === 1 ? "" : "s"}`,
          })
        }}
      />

      <AlertDialog
        open={disabling !== null}
        onOpenChange={(o) => !o && setDisableId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {disabling?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              In-flight requests finish, new requests skip this provider and
              routing rules fall through to their next target. Keys stay valid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (disabling) {
                  patch(disabling.id, { status: "Disconnected" })
                  toast(`${disabling.name} disabled`)
                }
                setDisableId(null)
              }}
            >
              <PowerOffIcon /> Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Vendor status                                                             */
/* ------------------------------------------------------------------------ */

function VendorStatusStrip({ providers }: { providers: Provider[] }) {
  const open = providerIncidents.filter((i) => i.status !== "Resolved")
  const degraded = providers.filter((p) => p.status !== "Connected")
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
        <ActivityIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Vendor status</h2>
        <p className="text-xs text-muted-foreground">
          {degraded.length === 0
            ? "All providers operational"
            : `${degraded.length} of ${providers.length} connections impaired`}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {providers.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
              title={`${p.name} · ${p.status}`}
            >
              <StatusDot tone={statusTone(p.status)} />
              <ProviderLogo logo={p.logo} size="sm" className="size-4" />
              <span className="sr-only">
                {p.name} {p.status}
              </span>
            </span>
          ))}
        </div>
      </div>
      <ul className="divide-y">
        {providerIncidents.map((i) => {
          const p = providers.find((x) => x.id === i.providerId)
          return (
            <li
              key={i.id}
              className={cn(
                "flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm",
                i.status === "Resolved" && "text-muted-foreground"
              )}
            >
              {i.status === "Resolved" ? (
                <CheckIcon className="size-4 shrink-0 text-success-text" />
              ) : (
                <TriangleAlertIcon
                  className={cn(
                    "size-4 shrink-0",
                    i.severity === "major"
                      ? "text-danger-text"
                      : "text-warning-text"
                  )}
                />
              )}
              <span className="font-medium">{p?.name}</span>
              <span className="min-w-0 flex-1 truncate">{i.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {timeAgo(i.started)}
              </span>
              <GatewayBadge
                state={i.status}
                size="sm"
                pulse={i.status === "Investigating"}
              />
            </li>
          )
        })}
        {open.length === 0 && (
          <li className="px-5 py-3 text-sm text-muted-foreground">
            No active vendor incidents.
          </li>
        )}
      </ul>
    </section>
  )
}

function statusTone(s: Provider["status"]) {
  return s === "Connected" ? "success" : s === "Degraded" ? "warning" : "danger"
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */

function ProviderCard({
  provider: p,
  onTest,
  onConfigure,
  onToggle,
}: {
  provider: Provider
  onTest: () => void
  onConfigure: () => void
  onToggle: () => void
}) {
  const off = p.status === "Disconnected"
  const sparkColor =
    p.status === "Connected"
      ? "var(--chart-1)"
      : p.status === "Degraded"
        ? "var(--warning)"
        : "var(--destructive)"
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5",
        off && "border-destructive/30"
      )}
    >
      <div className="flex items-start gap-3">
        <ProviderLogo logo={p.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base leading-tight font-semibold">
            {p.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {p.region}
            <span aria-hidden> · </span>
            {p.credentialType}
          </p>
        </div>
        <GatewayBadge state={p.status} pulse={p.status === "Degraded"} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <Metric label="Models" value={formatNumber(p.enabledModels.length)} />
        <Metric
          label="Requests · 24h"
          value={formatNumber(p.requests24h, true)}
        />
        <Metric
          label="Error rate"
          value={`${p.errorRate.toFixed(1)}%`}
          tone={
            p.errorRate >= 5
              ? "danger"
              : p.errorRate >= 2
                ? "warning"
                : undefined
          }
        />
        <Metric label="p95" value={fmtMs(p.p95Ms)} />
      </dl>

      <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            p95 latency · 14d
          </p>
          <Sparkline
            data={p.latencyTrend}
            color={sparkColor}
            className="mt-1 h-8 w-full"
          />
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Spend today
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(p.spendToday)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {p.enabledModels.slice(0, 3).map((m) => (
          <ModelChip
            key={m}
            modelId={m}
            className="text-xs text-muted-foreground"
          />
        ))}
        {p.enabledModels.length > 3 && (
          <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
            +{p.enabledModels.length - 3}
          </Badge>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <KeyRoundIcon className="size-3.5" />
          Checked {timeAgo(p.lastHealthCheck)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onTest}>
            <PlugZapIcon /> Test
          </Button>
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings2Icon /> Configure
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={off ? `Enable ${p.name}` : `Disable ${p.name}`}
            onClick={onToggle}
            className={cn(!off && "text-muted-foreground")}
          >
            {off ? <PowerIcon /> : <PowerOffIcon />}
          </Button>
        </div>
      </div>
    </article>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "warning" | "danger"
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "warning" && "text-warning-text",
          tone === "danger" && "text-danger-text"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Configure sheet                                                           */
/* ------------------------------------------------------------------------ */

function ConfigureSheet({
  provider,
  onClose,
  onSave,
}: {
  provider: Provider | null
  onClose: () => void
  onSave: (p: Provider) => void
}) {
  return (
    <Sheet open={provider !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {provider && (
          <ConfigureForm
            key={provider.id}
            provider={provider}
            onSave={onSave}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ConfigureForm({
  provider: p,
  onSave,
}: {
  provider: Provider
  onSave: (p: Provider) => void
}) {
  const [baseUrl, setBaseUrl] = React.useState(p.baseUrl)
  const [orgId, setOrgId] = React.useState(p.orgId ?? "")
  const [headers, setHeaders] = React.useState(
    Object.entries(p.defaultHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
  )
  const [enabled, setEnabled] = React.useState<string[]>(p.enabledModels)
  const [regions, setRegions] = React.useState<string[]>(p.regions)
  const allRegions = Array.from(
    new Set([...seed.find((s) => s.id === p.id)!.regions, ...p.regions])
  )

  const parsedHeaders = Object.fromEntries(
    headers
      .split("\n")
      .map((l) => l.split(":"))
      .filter((parts) => parts.length >= 2 && parts[0].trim())
      .map(([k, ...v]) => [k.trim(), v.join(":").trim()])
  )

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <ProviderLogo logo={p.logo} size="lg" />
          <div className="min-w-0">
            <SheetTitle className="text-lg leading-tight">
              Configure {p.name}
            </SheetTitle>
            <SheetDescription>
              Connection settings used by the gateway. Credentials are managed
              under API keys.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <form
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            ...p,
            baseUrl,
            orgId: orgId || undefined,
            defaultHeaders: parsedHeaders,
            enabledModels: enabled,
            regions,
            region: regions[0] ?? p.region,
          })
        }}
        id={`configure-${p.id}`}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${p.id}-url`}>Base URL</FieldLabel>
            <Input
              id={`${p.id}-url`}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${p.id}-org`}>
              Organisation / project id
            </FieldLabel>
            <Input
              id={`${p.id}-org`}
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Optional"
              className="font-mono text-xs"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${p.id}-headers`}>Default headers</FieldLabel>
            <Textarea
              id={`${p.id}-headers`}
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={3}
              placeholder="Header-Name: value"
              className="font-mono text-xs"
            />
            <FieldDescription>
              One <code>Header: value</code> per line. Sent with every request
              to this provider.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Regions</FieldLabel>
            <ToggleGroup
              multiple
              value={regions}
              onValueChange={(v) => setRegions(v as string[])}
              aria-label="Enabled regions"
              className="flex-wrap"
            >
              {allRegions.map((r) => (
                <ToggleGroupItem
                  key={r}
                  value={r}
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs"
                >
                  {r}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel>Enabled models</FieldLabel>
            <ul className="divide-y rounded-lg border">
              {p.availableModels.map((m) => {
                const id = `${p.id}-${m.replace(/[^a-z0-9]/gi, "-")}`
                const checked = enabled.includes(m)
                return (
                  <li key={m} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v) =>
                        setEnabled((prev) =>
                          v ? [...prev, m] : prev.filter((x) => x !== m)
                        )
                      }
                    />
                    <label
                      htmlFor={id}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm"
                    >
                      <ModelChip modelId={m} className="text-sm" />
                    </label>
                  </li>
                )
              })}
            </ul>
            <FieldDescription>
              {enabled.length} of {p.availableModels.length} models routable
              through this connection.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button
          type="submit"
          form={`configure-${p.id}`}
          disabled={enabled.length === 0 || regions.length === 0}
        >
          <CheckIcon /> Save configuration
        </Button>
      </SheetFooter>
    </>
  )
}
