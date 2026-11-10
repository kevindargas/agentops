import { cn } from "cn"
import { ArrowRightIcon, CornerDownLeftIcon } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { GraphNode } from "@/lib/types"
import { nodeMeta } from "./shared"

/**
 * Compact rendering of a LangGraph-style state graph: nodes in execution order
 * with edges drawn as arrows. Branches and loops are annotated rather than
 * drawn, which keeps the diagram legible at card sizes.
 */
export function AgentGraph({
  nodes,
  activeIds,
  className,
}: {
  nodes: GraphNode[]
  activeIds?: string[]
  className?: string
}) {
  const ids = new Set(nodes.map((n) => n.id))
  const indexOf = (id: string) => nodes.findIndex((n) => n.id === id)
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-y-3", className)}
      aria-label="Agent graph"
    >
      {nodes.map((n, i) => {
        const meta = nodeMeta[n.type]
        const Icon = meta.icon
        const loops = n.next.filter((t) => ids.has(t) && indexOf(t) <= i)
        const branches = n.next.filter((t) => ids.has(t) && indexOf(t) > i + 1)
        const active = activeIds?.includes(n.id) ?? true
        return (
          <li key={n.id} className="flex items-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-opacity",
                      meta.className,
                      !active && "opacity-40"
                    )}
                  />
                }
              >
                <Icon className="size-3.5" />
                {n.label}
                {loops.length > 0 && (
                  <CornerDownLeftIcon
                    className="size-3 opacity-70"
                    aria-label="loops back"
                  />
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-56">
                <p className="font-medium">{meta.label} node</p>
                {n.next.length > 0 ? (
                  <p className="mt-0.5 text-2xs opacity-80">
                    →{" "}
                    {n.next
                      .map((t) => nodes.find((x) => x.id === t)?.label ?? t)
                      .join(", ")}
                    {loops.length > 0 && " (loop)"}
                    {branches.length > 0 && " (branch)"}
                  </p>
                ) : (
                  <p className="mt-0.5 text-2xs opacity-80">Terminal node</p>
                )}
              </TooltipContent>
            </Tooltip>
            {i < nodes.length - 1 && (
              <ArrowRightIcon
                className="mx-1 size-3.5 shrink-0 text-muted-foreground/60"
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
