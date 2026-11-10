import Link from "next/link"
import { cn } from "cn"
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  MinusIcon,
} from "lucide-react"

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDelta } from "@/lib/format"

export interface StatCardProps {
  label: string
  value: React.ReactNode
  /** Signed delta vs the named period, e.g. -12 means down 12% */
  delta?: number
  deltaLabel?: string
  /** Unit appended to the delta figure. Defaults to "%"; pass "" for raw counts or "pt" for points. */
  deltaUnit?: string
  /** Whether an increase is good (green) or bad (red). */
  upIsGood?: boolean
  hint?: React.ReactNode
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
  /** Small unit or suffix rendered after the value (e.g. "h", "%", "/ 120"). */
  unit?: string
  /** Sparkline or mini-chart rendered under the value, full width. */
  sparkline?: React.ReactNode
  /** Makes the whole card clickable and shows a trailing arrow on hover. */
  href?: string
  /** Compact padding for dense dashboards. */
  size?: "default" | "sm"
  /** Renders skeleton placeholders in place of the value and delta. */
  loading?: boolean
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs last period",
  deltaUnit = "%",
  upIsGood = true,
  hint,
  icon,
  className,
  children,
  unit,
  sparkline,
  href,
  size = "default",
  loading = false,
}: StatCardProps) {
  const direction =
    delta === undefined
      ? undefined
      : delta > 0
        ? "up"
        : delta < 0
          ? "down"
          : "flat"
  const good =
    direction === "flat" ? undefined : direction === "up" ? upIsGood : !upIsGood
  const hasFooter = Boolean(hint || children || direction || loading)
  const deltaText = delta === undefined ? "" : formatDelta(delta, deltaUnit)

  return (
    <Card
      size={size}
      data-stat-card=""
      className={cn(
        "group/stat @container/card relative gap-3 transition-[box-shadow,background-color] duration-200",
        href && "lift focus-within:ring-ring/50 hover:ring-foreground/15",
        className
      )}
    >
      <CardHeader className="gap-1.5">
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-muted-foreground @[220px]/card:text-sm">
          {icon && (
            <span className="inline-flex shrink-0 text-muted-foreground/80 [&_svg]:size-3.5">
              {icon}
            </span>
          )}
          <span className="truncate">{label}</span>
        </CardDescription>
        <CardTitle className="flex items-baseline gap-1 text-2xl font-semibold num tracking-tight tabular-nums @[220px]/card:text-3xl">
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <>
              {href ? (
                <Link
                  href={href}
                  className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
                >
                  {value}
                </Link>
              ) : (
                value
              )}
              {unit && (
                <span className="text-sm font-medium text-muted-foreground">
                  {unit}
                </span>
              )}
            </>
          )}
        </CardTitle>
        {(direction || loading) && (
          <CardAction>
            {loading ? (
              <Skeleton className="h-5 w-12 rounded-full" />
            ) : (
              direction && (
                <DeltaPill direction={direction} good={good} text={deltaText} />
              )
            )}
          </CardAction>
        )}
        {href && !loading && (
          <ArrowRightIcon
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-(--card-spacing) right-(--card-spacing) size-4 -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 group-hover/stat:translate-x-0 group-hover/stat:opacity-100",
              direction && "hidden"
            )}
          />
        )}
      </CardHeader>
      {sparkline && (
        <div className="px-(--card-spacing) [&_svg]:overflow-visible">
          {sparkline}
        </div>
      )}
      {hasFooter && (
        <CardFooter className="flex-col items-start gap-2 text-xs text-muted-foreground">
          {children}
          {loading ? (
            <Skeleton className="h-3 w-32" />
          ) : hint ? (
            <div className="flex items-center gap-1 [&_a]:underline-offset-4 [&_a]:hover:underline">
              {hint}
            </div>
          ) : (
            direction && (
              <span className="text-muted-foreground/70">{deltaLabel}</span>
            )
          )}
        </CardFooter>
      )}
    </Card>
  )
}

/** Delta chip: tinted pill with a directional glyph. Exported for use in custom KPI tiles. */
export function DeltaPill({
  direction,
  good,
  text,
  className,
}: {
  direction: "up" | "down" | "flat"
  /** undefined = neutral (flat or no judgement) */
  good?: boolean
  text: string
  className?: string
}) {
  const Icon =
    direction === "up"
      ? ArrowUpRightIcon
      : direction === "down"
        ? ArrowDownRightIcon
        : MinusIcon
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 text-[11px] leading-none font-semibold tabular-nums",
        good === undefined
          ? "border-border bg-muted/60 text-muted-foreground"
          : good
            ? "border-success/25 bg-success/10 text-success-text"
            : "border-destructive/25 bg-destructive/10 text-danger-text",
        className
      )}
    >
      <Icon className="size-3" strokeWidth={2.25} />
      {text}
    </span>
  )
}
