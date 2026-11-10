import * as React from "react"
import { cn } from "cn"

import { StatCard } from "@/components/shared/stat-card"

export interface StatGridProps {
  /** Number of columns at the widest breakpoint. Phones always get 2 (3 for the 6-column grid at md). */
  columns?: 2 | 3 | 4 | 5 | 6
  /** Default `StatCard` size for every child that does not set its own. */
  size?: "sm" | "default"
  className?: string
  children: React.ReactNode
}

const columnClasses: Record<NonNullable<StatGridProps["columns"]>, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
}

/**
 * KPI row. Owns the gap and the responsive column steps so every page breaks
 * at the same widths, and applies the AgentOps standard (`size="sm"`) to each
 * `StatCard` child that does not override it.
 */
export function StatGrid({
  columns = 4,
  size = "sm",
  className,
  children,
}: StatGridProps) {
  return (
    <div
      data-slot="stat-grid"
      className={cn("grid gap-4", columnClasses[columns], className)}
    >
      {React.Children.map(children, (child) => {
        if (
          React.isValidElement<{ size?: "sm" | "default" }>(child) &&
          child.type === StatCard &&
          child.props.size === undefined
        ) {
          return React.cloneElement(child, { size })
        }
        return child
      })}
    </div>
  )
}
