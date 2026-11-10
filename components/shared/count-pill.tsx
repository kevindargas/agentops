import { cn } from "cn"

import { toneClasses, type Tone } from "@/components/shared/status-badge"

export type CountPillTone = Tone | "inverse"

export interface CountPillProps {
  count: number | string
  /** `sm` sits inside tab triggers and section titles; `default` next to h2/h3 headings. */
  size?: "sm" | "default"
  /** Semantic tint. `inverse` is the solid pill used on the active tab. */
  tone?: CountPillTone
  className?: string
  /** Screen-reader suffix, e.g. "pending" reads "6 pending". */
  label?: string
}

const sizeClasses = {
  sm: "h-4 min-w-4 px-1 text-3xs",
  default: "h-5 min-w-5 px-1.5 text-2xs",
} as const

/**
 * Small numeric badge for tab triggers, section titles and nav entries. One
 * component replaces the dozen `rounded-full bg-muted px-1.5 text-[10px]`
 * spans that used to drift in size and weight.
 */
export function CountPill({
  count,
  size = "sm",
  tone = "muted",
  className,
  label,
}: CountPillProps) {
  return (
    <span
      data-slot="count-pill"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-medium num tabular-nums",
        sizeClasses[size],
        tone === "inverse"
          ? "bg-foreground text-background"
          : toneClasses[tone].soft,
        className
      )}
    >
      {count}
      {label && <span className="sr-only"> {label}</span>}
    </span>
  )
}
