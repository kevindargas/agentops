"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  CheckIcon,
  LayersIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector"
import { useAi } from "@/components/ai/ai-provider"
import { DataTable, type FacetDef } from "@/components/data-table"
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StatusDot } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  capabilityMeta,
  formatContext,
  formatPrice,
  modalityMeta,
  priceBandMeta,
  providerLogo,
  type Capability,
  type CatalogModel,
  type Modality,
  type PriceBand,
} from "@/lib/ai/openrouter"
import { formatDate, formatNumber, formatPercent } from "@/lib/format"
import {
  CapabilityChips,
  ModalityChips,
  capabilityIcon,
  catalogColumns,
  modalityIcon,
} from "./columns"

interface ModelCatalogProps {
  models: CatalogModel[]
  fetchedAt: string
  error?: string
}

const contextBands = [
  {
    value: "small",
    label: "Up to 32K",
    test: (n: number) => n > 0 && n <= 32_768,
  },
  {
    value: "medium",
    label: "33K to 200K",
    test: (n: number) => n > 32_768 && n <= 200_000,
  },
  {
    value: "large",
    label: "201K to 1M",
    test: (n: number) => n > 200_000 && n <= 1_048_576,
  },
  { value: "xl", label: "Over 1M", test: (n: number) => n > 1_048_576 },
]

function contextBand(n: number) {
  return contextBands.find((b) => b.test(n))?.value ?? "unknown"
}

/** Header actions for the catalog page. */
export function ModelCatalogActions() {
  const { setOpen, setTab } = useAi()
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        render={
          <a
            href="https://openrouter.ai/docs/api-reference/list-available-models"
            target="_blank"
            rel="noreferrer"
          />
        }
      >
        <ArrowUpRightIcon /> API reference
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setTab("chat")
          setOpen(true)
        }}
      >
        <SparklesIcon /> Open Assist
      </Button>
    </>
  )
}

export function ModelCatalog({ models, fetchedAt, error }: ModelCatalogProps) {
  const [selected, setSelected] = React.useState<CatalogModel | null>(null)

  const stats = React.useMemo(() => {
    const providers = new Set(models.map((m) => m.provider)).size
    const free = models.filter((m) => m.isFree).length
    const tools = models.filter((m) => m.capabilities.includes("tools")).length
    const reasoning = models.filter((m) =>
      m.capabilities.includes("reasoning")
    ).length
    const multimodal = models.filter((m) =>
      m.inputModalities.some((x) => x !== "text")
    ).length
    const priced = models
      .map((m) => m.promptPrice)
      .filter((p): p is number => p !== null && p > 0)
      .sort((a, b) => a - b)
    const median = priced.length ? priced[Math.floor(priced.length / 2)] : 0
    return { providers, free, tools, reasoning, multimodal, median }
  }, [models])

  const facets = React.useMemo<FacetDef<CatalogModel>[]>(() => {
    const providerCounts = new Map<string, { label: string; n: number }>()
    for (const m of models)
      providerCounts.set(m.provider, {
        label: m.providerLabel,
        n: (providerCounts.get(m.provider)?.n ?? 0) + 1,
      })
    const providers = [...providerCounts.entries()].sort(
      (a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label)
    )
    return [
      {
        id: "provider",
        title: "Provider",
        options: providers.map(([value, { label }]) => ({
          value,
          label,
          icon: (
            <ModelSelectorLogo
              provider={providerLogo(value)}
              className="size-3"
            />
          ),
        })),
        getValue: (r) => r.provider,
      },
      {
        id: "capability",
        title: "Capability",
        options: (Object.keys(capabilityMeta) as Capability[]).map((c) => {
          const Icon = capabilityIcon[c]
          return {
            value: c,
            label: capabilityMeta[c].label,
            icon: <Icon className="size-3.5" />,
          }
        }),
        getValue: (r) => r.capabilities,
      },
      {
        id: "modality",
        title: "Input",
        options: (Object.keys(modalityMeta) as Modality[]).map((m) => {
          const Icon = modalityIcon[m]
          return {
            value: m,
            label: modalityMeta[m],
            icon: <Icon className="size-3.5" />,
          }
        }),
        getValue: (r) => r.inputModalities,
      },
      {
        id: "price",
        title: "Price",
        options: (Object.keys(priceBandMeta) as PriceBand[]).map((b) => ({
          value: b,
          label: priceBandMeta[b].label,
        })),
        getValue: (r) => r.priceBand,
      },
      {
        id: "context",
        title: "Context",
        options: contextBands.map((b) => ({ value: b.value, label: b.label })),
        getValue: (r) => contextBand(r.contextLength),
      },
    ]
  }, [models])

  if (models.length === 0) {
    return (
      <EmptyState
        icon={<LayersIcon />}
        title="The catalog could not be loaded"
        description={
          error
            ? `OpenRouter did not return a model list: ${error}. Reload the page to try again; on a static deployment the list is a build-time snapshot and refreshes with the next deploy.`
            : "OpenRouter returned an empty model list."
        }
        action={
          <Button variant="outline" render={<Link href="/ai/models" />}>
            <RefreshCwIcon /> Try again
          </Button>
        }
      />
    )
  }

  return (
    <>
      <StatGrid columns={4}>
        <StatCard
          label="Models"
          value={formatNumber(models.length)}
          hint={`Across ${stats.providers} providers`}
        />
        <StatCard
          label="Tool calling"
          value={formatNumber(stats.tools)}
          hint={`${formatPercent((stats.tools / models.length) * 100, 0)} of the catalog · ${stats.reasoning} expose reasoning`}
        />
        <StatCard
          label="Multimodal"
          value={formatNumber(stats.multimodal)}
          hint="Accept image, file, audio or video input"
        />
        <StatCard
          label="Free to use"
          value={formatNumber(stats.free)}
          hint={`Median paid input price ${formatPrice(stats.median)} per 1M tokens`}
        />
      </StatGrid>

      <DataTable
        columns={catalogColumns}
        data={models}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.id} ${r.providerLabel} ${r.description}`
        }
        searchPlaceholder="Search models, vendors or capabilities"
        facets={facets}
        initialSorting={[{ id: "createdAt", desc: true }]}
        initialColumnVisibility={{ maxOutput: false, moderated: false }}
        pageSize={25}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={setSelected}
        totalLabel="models"
        caption="OpenRouter model catalog with context, pricing per million tokens, input modalities and capabilities"
        selectionLabel={(n) => (n === 1 ? "model" : "models")}
        toolbar={
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex">
            <StatusDot tone="success" pulse label="Live" />
            Live from OpenRouter ·{" "}
            {formatDate(fetchedAt, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        }
      />

      <ModelDetailSheet model={selected} onClose={() => setSelected(null)} />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

function ModelDetailSheet({
  model,
  onClose,
}: {
  model: CatalogModel | null
  onClose: () => void
}) {
  const { settings, updateSettings, setOpen, setTab } = useAi()
  const active = model !== null && settings.modelId === model.id

  const pin = () => {
    if (!model) return
    const firstSentence =
      model.description.split(/(?<=\.)\s/)[0]?.slice(0, 140) ?? ""
    updateSettings({
      modelId: model.id,
      catalogModel: {
        id: model.id,
        name: model.name,
        provider: model.provider,
        description: firstSentence,
      },
    })
    toast.success(`${model.name} is now the Assist model`, {
      description: "Pinned under From model catalog in the model picker.",
      action: {
        label: "Open Assist",
        onClick: () => {
          setTab("chat")
          setOpen(true)
        },
      },
    })
  }

  return (
    <Sheet open={model !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {model && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <ModelSelectorLogo
                    provider={providerLogo(model.provider)}
                    className="size-5"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <Eyebrow>{model.providerLabel}</Eyebrow>
                  <SheetTitle className="truncate text-lg leading-tight">
                    {model.name}
                  </SheetTitle>
                  <div className="mt-1 flex items-center gap-1">
                    <code className="truncate font-mono text-xs text-muted-foreground">
                      {model.id}
                    </code>
                    <CopyButton value={model.id} label="Copy model id" />
                  </div>
                </div>
              </div>
              <SheetDescription className="sr-only">
                Model details from OpenRouter
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-muted-foreground">
                  {priceBandMeta[model.priceBand].label}
                </Badge>
                {model.moderated && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Moderated
                  </Badge>
                )}
                {model.variant && (
                  <Badge
                    variant="outline"
                    className="font-mono text-muted-foreground"
                  >
                    {model.variant}
                  </Badge>
                )}
                <Badge variant="outline" className="text-muted-foreground">
                  Added {formatDate(model.createdAt)}
                </Badge>
              </div>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {model.description || "No description provided."}
                </p>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fact
                    label="Context"
                    value={formatContext(model.contextLength)}
                  />
                  <Fact
                    label="Max output"
                    value={
                      model.maxOutput
                        ? formatContext(model.maxOutput)
                        : "Not reported"
                    }
                  />
                  <Fact
                    label="Tokenizer"
                    value={model.tokenizer ?? "Not reported"}
                  />
                  <Fact
                    label="Cutoff"
                    value={
                      model.knowledgeCutoff
                        ? formatDate(model.knowledgeCutoff, {
                            month: "short",
                            year: "numeric",
                          })
                        : "Not reported"
                    }
                  />
                </dl>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Pricing</h3>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        Pricing for {model.name}
                      </caption>
                      <tbody className="divide-y">
                        <PriceRow
                          label="Input"
                          value={formatPrice(model.promptPrice)}
                          unit="per 1M tokens"
                        />
                        <PriceRow
                          label="Output"
                          value={formatPrice(model.completionPrice)}
                          unit="per 1M tokens"
                        />
                        {model.cacheReadPrice !== null &&
                          model.promptPrice !== null && (
                            <PriceRow
                              label="Cached input"
                              value={formatPrice(model.cacheReadPrice)}
                              unit="per 1M tokens"
                            />
                          )}
                        {model.imagePrice !== null && model.imagePrice > 0 && (
                          <PriceRow
                            label="Image input"
                            value={`$${model.imagePrice.toFixed(4)}`}
                            unit="per image"
                          />
                        )}
                        {model.webSearchPrice !== null &&
                          model.webSearchPrice > 0 && (
                            <PriceRow
                              label="Web search"
                              value={`$${model.webSearchPrice.toFixed(3)}`}
                              unit="per request"
                            />
                          )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Inputs</h3>
                    <ModalityChips
                      modalities={model.inputModalities}
                      className="inline-flex flex-wrap items-center gap-1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Outputs {model.outputModalities.join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Capabilities</h3>
                    <CapabilityChips
                      capabilities={model.capabilities}
                      compact={false}
                    />
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Supported parameters
                  </h3>
                  {model.supportedParameters.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Not reported.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {model.supportedParameters.map((p) => (
                        <code
                          key={p}
                          className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
                        >
                          {p}
                        </code>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </SheetBody>

            <SheetFooterActions
              secondary={
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={`https://openrouter.ai/${model.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ArrowUpRightIcon /> View on OpenRouter
                </Button>
              }
              primary={
                <Button size="sm" onClick={pin} disabled={active}>
                  {active ? (
                    <>
                      <CheckIcon /> Active in Assist
                    </>
                  ) : (
                    <>
                      <SparklesIcon /> Use in AgentOps Assist
                    </>
                  )}
                </Button>
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <Eyebrow as="span">{label}</Eyebrow>
      <dd
        className="mt-0.5 truncate text-sm font-medium tabular-nums"
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}

function PriceRow({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit: string
}) {
  return (
    <tr>
      <td className="px-3 py-2 text-muted-foreground">{label}</td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">{value}</td>
      <td className="w-32 px-3 py-2 text-right text-xs text-muted-foreground">
        {unit}
      </td>
    </tr>
  )
}
