"use client"

import { createColumnHelper } from "@tanstack/react-table"
import {
  AudioLinesIcon,
  BrainIcon,
  BracesIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  TypeIcon,
  VideoIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector"
import {
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  NumericCell,
  type DataTableFeatures,
} from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  capabilityMeta,
  formatContext,
  formatPrice,
  modalityMeta,
  providerLogo,
  type Capability,
  type CatalogModel,
  type Modality,
} from "@/lib/ai/openrouter"

const col = createColumnHelper<DataTableFeatures, CatalogModel>()

export const modalityIcon: Record<Modality, LucideIcon> = {
  text: TypeIcon,
  image: ImageIcon,
  file: FileIcon,
  audio: AudioLinesIcon,
  video: VideoIcon,
}
export const capabilityIcon: Record<Capability, LucideIcon> = {
  tools: WrenchIcon,
  reasoning: BrainIcon,
  structured_outputs: BracesIcon,
  web_search: GlobeIcon,
  vision: ImageIcon,
}

/** Capabilities shown as chips in the table (vision is already implied by the modality column). */
const tableCapabilities: Capability[] = [
  "tools",
  "reasoning",
  "structured_outputs",
  "web_search",
]

export function ModalityChips({
  modalities,
  className,
}: {
  modalities: Modality[]
  className?: string
}) {
  return (
    <span className={className ?? "inline-flex items-center gap-1"}>
      {(["text", "image", "file", "audio", "video"] as Modality[])
        .filter((m) => modalities.includes(m))
        .map((m) => {
          const Icon = modalityIcon[m]
          return (
            <Tooltip key={m}>
              <TooltipTrigger
                render={
                  <span className="inline-flex size-6 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground" />
                }
              >
                <Icon className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{modalityMeta[m]} input</TooltipContent>
            </Tooltip>
          )
        })}
    </span>
  )
}

export function CapabilityChips({
  capabilities,
  dense = true,
}: {
  capabilities: Capability[]
  dense?: boolean
}) {
  const list = tableCapabilities.filter((c) => capabilities.includes(c))
  if (list.length === 0) return <EmptyValue />
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {list.map((c) => {
        const Icon = capabilityIcon[c]
        return (
          <Tooltip key={c}>
            <TooltipTrigger
              render={
                <Badge
                  variant="outline"
                  className={
                    dense
                      ? "h-5 gap-1 px-1.5 text-[10px] font-medium text-muted-foreground"
                      : "gap-1"
                  }
                />
              }
            >
              <Icon className="size-3" /> {capabilityMeta[c].label}
            </TooltipTrigger>
            <TooltipContent>{capabilityMeta[c].hint}</TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

function PriceCell({ value }: { value: number | null }) {
  if (value === null)
    return (
      <span className="block text-right text-xs text-muted-foreground italic">
        Varies
      </span>
    )
  return <NumericCell value={value} format={formatPrice} muted={value === 0} />
}

export const catalogColumns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => {
      const m = row.original
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
            <ModelSelectorLogo
              provider={providerLogo(m.provider)}
              className="size-3.5"
            />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium" title={m.name}>
                {m.name}
              </span>
              {m.isFree && (
                <Badge
                  variant="outline"
                  className="h-4 border-success/30 bg-success/10 px-1 text-[10px] font-medium text-success-text"
                >
                  Free
                </Badge>
              )}
            </span>
            <span
              className="block truncate font-mono text-[11px] text-muted-foreground"
              title={m.id}
            >
              {m.id}
            </span>
          </span>
        </span>
      )
    },
    enableHiding: false,
    meta: { width: "min-w-72 max-w-md", label: "Model", skeleton: "w-56" },
  }),
  col.accessor("providerLabel", {
    id: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue()}</span>
    ),
    meta: { width: "w-32", label: "Provider", skeleton: "w-20" },
  }),
  col.accessor("contextLength", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Context" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue() || null} format={formatContext} />
    ),
    meta: { width: "w-32", label: "Context", numeric: true, skeleton: "w-12" },
  }),
  col.accessor("maxOutput", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Max output" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={formatContext} muted />
    ),
    meta: {
      width: "w-28",
      label: "Max output",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor("promptPrice", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Input $/1M" />
    ),
    cell: ({ getValue }) => <PriceCell value={getValue()} />,
    sortUndefined: "last",
    meta: {
      width: "w-32",
      label: "Input price",
      numeric: true,
      skeleton: "w-14",
    },
  }),
  col.accessor("completionPrice", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Output $/1M" />
    ),
    cell: ({ getValue }) => <PriceCell value={getValue()} />,
    sortUndefined: "last",
    meta: {
      width: "w-32",
      label: "Output price",
      numeric: true,
      skeleton: "w-14",
    },
  }),
  col.accessor("inputModalities", {
    id: "modalities",
    header: "Inputs",
    cell: ({ getValue }) => <ModalityChips modalities={getValue()} />,
    enableSorting: false,
    meta: { width: "w-36", label: "Inputs", skeleton: "w-20" },
  }),
  col.accessor("capabilities", {
    header: "Capabilities",
    cell: ({ getValue }) => <CapabilityChips capabilities={getValue()} />,
    enableSorting: false,
    meta: { width: "min-w-56", label: "Capabilities", skeleton: "w-40" },
  }),
  col.accessor("createdAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Added" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} mode="absolute" />,
    meta: { width: "w-28", label: "Added", skeleton: "w-20" },
  }),
  col.accessor("moderated", {
    header: "Moderated",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {getValue() ? "Yes" : "No"}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-24", label: "Moderated", skeleton: "w-8" },
  }),
])
