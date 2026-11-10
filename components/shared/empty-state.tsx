import { cn } from "cn"
import { InboxIcon } from "lucide-react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  /** `sm` is for table bodies and side panels; `default` for whole-page states. */
  size?: "sm" | "default"
  /** Drop the dashed frame, e.g. when already inside a card. */
  bare?: boolean
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  icon,
  action,
  className,
  size = "default",
  bare = false,
}: EmptyStateProps) {
  const small = size === "sm"
  return (
    <Empty
      className={cn(
        "relative isolate overflow-hidden",
        !bare && "border border-dashed border-border/80 bg-surface/60",
        small ? "gap-3 py-8" : "py-14",
        className
      )}
    >
      {!bare && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-dotgrid [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)] opacity-60"
        />
      )}
      <EmptyHeader className={cn(small && "gap-1")}>
        <EmptyMedia
          variant="icon"
          className={cn(
            "rounded-2xl bg-linear-to-b from-card to-muted text-muted-foreground shadow-raised ring-1 ring-border/70",
            small
              ? "mb-1 size-10 [&_svg:not([class*='size-'])]:size-4.5"
              : "mb-3 size-14 rounded-2xl [&_svg:not([class*='size-'])]:size-6"
          )}
        >
          {icon ?? <InboxIcon />}
        </EmptyMedia>
        <EmptyTitle className={cn(small ? "text-sm" : "text-base")}>
          {title}
        </EmptyTitle>
        {description && (
          <EmptyDescription className={cn(small && "text-xs/relaxed")}>
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {action && (
        <EmptyContent
          className={cn("flex-row flex-wrap justify-center", small && "gap-2")}
        >
          {action}
        </EmptyContent>
      )}
    </Empty>
  )
}
