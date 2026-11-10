"use client"

import * as React from "react"
import { createColumnHelper, type RowData } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BracesIcon,
  CodeIcon,
  FileCode2Icon,
  GaugeIcon,
  WrenchIcon,
} from "lucide-react"
import {
  DataTable,
  DataTableColumnHeader,
  EmptyValue,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { CopyButton } from "@/components/shared/copy-button"
import { CountPill } from "@/components/shared/count-pill"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { metrics } from "@/lib/readiness/metrics"
import { snippets } from "@/lib/readiness/snippets"
import { tools } from "@/lib/readiness/tools"
import type {
  ControlSet,
  DomainDef,
  DomainId,
  MetricDef,
  SnippetDef,
  ToolDef,
} from "@/lib/readiness/types"
import { copyText } from "./download"
import { DomainChip, useReadiness } from "./shared"

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

const kindLabel: Record<ToolDef["kind"], string> = {
  "open-source": "Open source",
  managed: "Managed",
  both: "Open source + managed",
}

const languageLabel: Record<SnippetDef["language"], string> = {
  python: "Python",
  typescript: "TypeScript",
  yaml: "YAML",
  json: "JSON",
}

const directionLabel: Record<MetricDef["direction"], string> = {
  "higher-is-better": "Higher is better",
  "lower-is-better": "Lower is better",
}

function plainNumber(n: number) {
  return String(n)
}

function domainFacet<T extends RowData>(
  domains: DomainDef[],
  getValue: (row: T) => string | string[]
): FacetDef<T> {
  return {
    id: "domain",
    title: "Domain",
    options: domains.map((d) => ({ value: d.id, label: d.title })),
    getValue,
  }
}

/* ------------------------------------------------------------------------ */
/* Tool matrix                                                               */
/* ------------------------------------------------------------------------ */

interface ToolRow extends ToolDef {
  /** Control ids whose `tools` list this tool. */
  covered: string[]
  /** Responses that selected this tool (0 without an assessment). */
  inUse: number
}

const toolCol = createColumnHelper<DataTableFeatures, ToolRow>()

function buildToolColumns(domainById: Map<DomainId, DomainDef>) {
  return toolCol.columns([
    toolCol.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tool" />
      ),
      cell: ({ row }) => (
        <TwoLineCell
          primary={
            <a
              href={row.original.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.name}
              <ArrowUpRightIcon className="size-3 text-muted-foreground" />
            </a>
          }
          secondary={row.original.summary}
          title={row.original.name}
        />
      ),
      enableHiding: false,
      meta: { width: "min-w-72 max-w-md", label: "Tool", skeleton: "w-56" },
    }),
    toolCol.accessor("kind", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kind" />
      ),
      cell: ({ getValue }) => (
        <StateBadge state={kindLabel[getValue()]} size="sm" dot={false} />
      ),
      meta: { width: "w-44", label: "Kind", skeleton: "w-20 rounded-full" },
    }),
    toolCol.accessor((r) => r.domains.length, {
      id: "domains",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Domains" />
      ),
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {row.original.domains.map((id) => {
            const domain = domainById.get(id)
            return domain ? <DomainChip key={id} domain={domain} short /> : null
          })}
        </span>
      ),
      meta: { width: "min-w-48", label: "Domains", skeleton: "w-32" },
    }),
    toolCol.accessor((r) => r.covered.length, {
      id: "covered",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Controls covered"
          hint="Controls whose suggested-tool list includes this tool"
        />
      ),
      cell: ({ row }) => {
        const ids = row.original.covered
        if (ids.length === 0) return <NumericCell value={null} />
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="block cursor-default text-right tabular-nums underline decoration-dotted underline-offset-3" />
              }
            >
              {ids.length}
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <span className="font-mono text-xs">{ids.join(", ")}</span>
            </TooltipContent>
          </Tooltip>
        )
      },
      meta: {
        width: "w-32",
        label: "Controls covered",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    toolCol.accessor("inUse", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="In use"
          hint="Responses in the current assessment that picked this tool"
        />
      ),
      cell: ({ getValue }) => {
        const n = getValue()
        return n > 0 ? (
          <NumericCell value={n} className="font-medium" />
        ) : (
          <NumericCell value={null} />
        )
      },
      meta: { width: "w-24", label: "In use", numeric: true, skeleton: "w-8" },
    }),
  ])
}

function ToolMatrix({ controlSet }: { controlSet: ControlSet }) {
  const { assessment } = useReadiness()
  const [openSourceOnly, setOpenSourceOnly] = React.useState(false)

  const domainById = React.useMemo(
    () => new Map(controlSet.domains.map((d) => [d.id, d])),
    [controlSet]
  )
  const columns = React.useMemo(
    () => buildToolColumns(domainById),
    [domainById]
  )
  const rows = React.useMemo<ToolRow[]>(() => {
    const responses = assessment ? Object.values(assessment.responses) : []
    return tools.map((t) => ({
      ...t,
      covered: controlSet.controls
        .filter((c) => c.tools.includes(t.id))
        .map((c) => c.id),
      inUse: responses.filter((r) => r.tool === t.id).length,
    }))
  }, [assessment, controlSet])
  const data = React.useMemo(
    () => (openSourceOnly ? rows.filter((r) => r.kind !== "managed") : rows),
    [rows, openSourceOnly]
  )
  const facets = React.useMemo<FacetDef<ToolRow>[]>(
    () => [
      {
        id: "kind",
        title: "Kind",
        options: (Object.keys(kindLabel) as ToolDef["kind"][]).map((k) => ({
          value: k,
          label: kindLabel[k],
        })),
        getValue: (r) => r.kind,
      },
      domainFacet<ToolRow>(controlSet.domains, (r) => r.domains),
    ],
    [controlSet]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      getSearchText={(r) => `${r.name} ${r.summary} ${r.id}`}
      searchPlaceholder="Search tools…"
      facets={facets}
      initialSorting={[{ id: "covered", desc: true }]}
      totalLabel="tools"
      caption="Tool matrix: which tools cover which controls"
      emptyIcon={<WrenchIcon />}
      toolbar={
        <Label className="flex items-center gap-2 text-xs font-medium whitespace-nowrap">
          <Switch
            size="sm"
            checked={openSourceOnly}
            onCheckedChange={(v) => setOpenSourceOnly(Boolean(v))}
          />
          Open source only
        </Label>
      }
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Instrumentation snippets                                                  */
/* ------------------------------------------------------------------------ */

function SnippetCard({
  snippet,
  usedBy,
  onOpen,
}: {
  snippet: SnippetDef
  usedBy: string[]
  onOpen: (controlId: string) => void
}) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {snippet.title}
          <Badge variant="secondary" className="font-mono text-3xs">
            {languageLabel[snippet.language]}
          </Badge>
        </CardTitle>
        <CardDescription>{snippet.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative rounded-lg border bg-muted/40">
          <CopyButton
            value={snippet.code}
            label="Copy snippet"
            className="absolute top-1.5 right-1.5 bg-background/80"
          />
          <pre className="max-h-80 overflow-auto p-3 pr-10 font-mono text-xs leading-relaxed">
            <code>{snippet.code}</code>
          </pre>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Used by</span>
          {usedBy.length === 0 ? (
            <EmptyValue />
          ) : (
            usedBy.map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="xs"
                className="font-mono"
                onClick={() => onOpen(id)}
              >
                {id}
              </Button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SnippetLibrary({
  controlSet,
  onOpen,
}: {
  controlSet: ControlSet
  onOpen: (controlId: string) => void
}) {
  const usedBy = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of controlSet.controls)
      for (const s of c.snippets ?? [])
        map.set(s, [...(map.get(s) ?? []), c.id])
    return map
  }, [controlSet])

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {snippets.map((s) => (
        <SnippetCard
          key={s.id}
          snippet={s}
          usedBy={usedBy.get(s.id) ?? []}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Metric catalog                                                            */
/* ------------------------------------------------------------------------ */

const metricCol = createColumnHelper<DataTableFeatures, MetricDef>()

function buildMetricColumns(domainById: Map<DomainId, DomainDef>) {
  return metricCol.columns([
    metricCol.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Metric" />
      ),
      cell: ({ row }) => (
        <TwoLineCell
          primary={row.original.name}
          secondary={row.original.formula}
          mono
        />
      ),
      enableHiding: false,
      meta: { width: "min-w-72 max-w-lg", label: "Metric", skeleton: "w-56" },
    }),
    metricCol.accessor("domain", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Domain" />
      ),
      cell: ({ getValue }) => {
        const domain = domainById.get(getValue())
        return domain ? <DomainChip domain={domain} short /> : <EmptyValue />
      },
      meta: { width: "w-32", label: "Domain", skeleton: "w-16" },
    }),
    metricCol.accessor("unit", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Unit" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue()}</span>
      ),
      meta: { width: "w-20", label: "Unit", skeleton: "w-8" },
    }),
    metricCol.accessor("direction", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Direction" />
      ),
      cell: ({ getValue }) => {
        const d = getValue()
        const Icon = d === "higher-is-better" ? ArrowUpIcon : ArrowDownIcon
        return (
          <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
            <Icon className="size-3" aria-hidden />
            {directionLabel[d]}
          </span>
        )
      },
      meta: { width: "w-36", label: "Direction", skeleton: "w-24" },
    }),
    metricCol.accessor("warn", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Warn" />
      ),
      cell: ({ getValue }) => (
        <NumericCell
          value={getValue()}
          format={plainNumber}
          className="text-warning-text"
        />
      ),
      meta: { width: "w-20", label: "Warn", numeric: true, skeleton: "w-8" },
    }),
    metricCol.accessor("crit", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Critical" />
      ),
      cell: ({ getValue }) => (
        <NumericCell
          value={getValue()}
          format={plainNumber}
          className="text-danger-text"
        />
      ),
      meta: {
        width: "w-20",
        label: "Critical",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    metricCol.accessor((r) => r.otel ?? "", {
      id: "otel",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="OTel source"
          hint="OpenTelemetry GenAI attribute or metric the value is derived from"
        />
      ),
      cell: ({ row }) =>
        row.original.otel ? (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.otel}
          </span>
        ) : (
          <EmptyValue />
        ),
      meta: { width: "w-56", label: "OTel source", skeleton: "w-32" },
    }),
  ])
}

function metricsYaml(list: MetricDef[]) {
  return list
    .map(
      (m) =>
        `- metric: ${m.id}\n  warn: ${m.warn}\n  crit: ${m.crit}\n  direction: ${m.direction}`
    )
    .join("\n")
}

function MetricCatalog({ controlSet }: { controlSet: ControlSet }) {
  const domainById = React.useMemo(
    () => new Map(controlSet.domains.map((d) => [d.id, d])),
    [controlSet]
  )
  const columns = React.useMemo(
    () => buildMetricColumns(domainById),
    [domainById]
  )
  const facets = React.useMemo<FacetDef<MetricDef>[]>(
    () => [domainFacet<MetricDef>(controlSet.domains, (r) => r.domain)],
    [controlSet]
  )

  return (
    <DataTable
      columns={columns}
      data={metrics}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        `${r.name} ${r.id} ${r.formula} ${r.unit} ${r.otel ?? ""}`
      }
      searchPlaceholder="Search metrics…"
      facets={facets}
      initialSorting={[{ id: "domain", desc: false }]}
      pageSize={50}
      totalLabel="metrics"
      caption="Metric catalog with warn and critical thresholds"
      emptyIcon={<GaugeIcon />}
      toolbar={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              copyText(JSON.stringify(metrics, null, 2), "Metric catalog")
            }
          >
            <BracesIcon /> Copy as JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText(metricsYaml(metrics), "Alert thresholds")}
          >
            <FileCode2Icon /> Copy alert thresholds (YAML)
          </Button>
        </>
      }
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Tab                                                                       */
/* ------------------------------------------------------------------------ */

type Section = "tools" | "snippets" | "metrics"

export function ToolingTab({
  onOpen,
}: {
  onOpen: (controlId: string) => void
}) {
  const { controlSet } = useReadiness()
  const [section, setSection] = React.useState<Section>("tools")

  return (
    <Tabs
      value={section}
      onValueChange={(v) => setSection(v as Section)}
      className={cn("gap-4")}
    >
      <TabsList variant="line">
        <TabsTrigger value="tools">
          <WrenchIcon data-icon="inline-start" /> Tool matrix
          <CountPill count={tools.length} label="tools" />
        </TabsTrigger>
        <TabsTrigger value="snippets">
          <CodeIcon data-icon="inline-start" /> Instrumentation snippets
          <CountPill count={snippets.length} label="snippets" />
        </TabsTrigger>
        <TabsTrigger value="metrics">
          <GaugeIcon data-icon="inline-start" /> Metric catalog
          <CountPill count={metrics.length} label="metrics" />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tools">
        <ToolMatrix controlSet={controlSet} />
      </TabsContent>
      <TabsContent value="snippets">
        <SnippetLibrary controlSet={controlSet} onOpen={onOpen} />
      </TabsContent>
      <TabsContent value="metrics">
        <MetricCatalog controlSet={controlSet} />
      </TabsContent>
    </Tabs>
  )
}
