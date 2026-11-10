import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"

/**
 * State progression for a record (New → Assess → … → Closed).
 * Horizontal variant is a stepper bar; vertical variant fits a sidebar card.
 */
export function LifecycleTracker({
  stages,
  current,
  terminal,
  orientation = "horizontal",
  className,
}: {
  stages: readonly string[]
  current: string
  /** A terminal, off-path state such as "Canceled", shown as a stopped marker. */
  terminal?: readonly string[]
  orientation?: "horizontal" | "vertical"
  className?: string
}) {
  const stopped = terminal?.includes(current) ?? false
  const idx = stopped ? -1 : stages.indexOf(current)
  const complete = idx === stages.length - 1

  if (orientation === "vertical") {
    return (
      <ol className={cn("relative flex flex-col gap-0 text-sm", className)}>
        {stages.map((s, i) => {
          const done = i < idx || complete
          const isCurrent = i === idx && !complete
          const last = i === stages.length - 1
          return (
            <li
              key={s}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex gap-3 pb-3 last:pb-0"
            >
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 left-[7px] h-[calc(100%-0.5rem)] w-px",
                    done ? "bg-success" : "bg-border"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 bg-background",
                  done
                    ? "border-success bg-success text-success-foreground"
                    : isCurrent
                      ? "border-brand ring-4 ring-brand/15"
                      : "border-muted-foreground/30"
                )}
              >
                {done && <CheckIcon className="size-2.5" strokeWidth={3} />}
                {isCurrent && (
                  <span className="size-1.5 rounded-full bg-brand" />
                )}
              </span>
              <span
                className={cn(
                  "leading-tight",
                  isCurrent
                    ? "font-medium text-foreground"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70"
                )}
              >
                {s}
                {isCurrent && (
                  <span className="ml-2 text-3xs font-medium tracking-wide text-brand uppercase">
                    Current
                  </span>
                )}
              </span>
            </li>
          )
        })}
        {stopped && (
          <li className="relative flex gap-3 pt-1">
            <span className="flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 bg-muted">
              <XIcon className="size-2.5" strokeWidth={3} />
            </span>
            <span className="font-medium">{current}</span>
          </li>
        )}
      </ol>
    )
  }

  return (
    <ol
      className={cn(
        "flex items-stretch gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 text-xs",
        className
      )}
      aria-label="Lifecycle"
    >
      {stages.map((s, i) => {
        const done = i < idx || complete
        const isCurrent = i === idx && !complete
        return (
          <li
            key={s}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap",
              isCurrent
                ? "bg-brand/10 font-medium text-brand"
                : done
                  ? "text-foreground"
                  : "text-muted-foreground/70"
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums",
                done
                  ? "bg-success text-success-foreground"
                  : isCurrent
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {done ? (
                <CheckIcon className="size-2.5" strokeWidth={3} />
              ) : (
                i + 1
              )}
            </span>
            {s}
          </li>
        )
      })}
      {stopped && (
        <li className="flex min-w-fit items-center justify-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 font-medium whitespace-nowrap text-muted-foreground">
          <XIcon className="size-3" /> {current}
        </li>
      )}
    </ol>
  )
}
