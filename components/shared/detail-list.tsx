import { cn } from "cn"

import { CopyButton } from "@/components/shared/copy-button"

export interface DetailItem {
  label: string
  value: React.ReactNode
  /** span both columns */
  wide?: boolean
  /** Show a copy button; copies `copyValue` or the value when it is a string/number. */
  copyable?: boolean
  copyValue?: string
  /** Render the value in monospace (ids, hostnames, IPs). */
  mono?: boolean
  /** Secondary line under the value. */
  hint?: React.ReactNode
}

export interface DetailListProps {
  items: DetailItem[]
  columns?: 1 | 2 | 3
  className?: string
  /**
   * `grid` (default) stacks label over value in columns.
   * `rows` puts label and value side by side with hairlines between rows, best in narrow side panels.
   */
  variant?: "grid" | "rows"
  /** Tighter vertical rhythm. */
  dense?: boolean
}

function copyTextFor(item: DetailItem) {
  if (item.copyValue) return item.copyValue
  if (typeof item.value === "string" || typeof item.value === "number")
    return String(item.value)
  return undefined
}

/** Label/value grid used on record forms and side panels. */
export function DetailList({
  items,
  columns = 2,
  className,
  variant = "grid",
  dense = false,
}: DetailListProps) {
  if (variant === "rows") {
    return (
      <dl
        data-slot="detail-list"
        className={cn("divide-y divide-border/70", className)}
      >
        {items.map((item) => {
          const copy = item.copyable ? copyTextFor(item) : undefined
          return (
            <div
              key={item.label}
              className={cn(
                "group/row grid grid-cols-[minmax(7rem,1fr)_minmax(0,2fr)] items-baseline gap-x-4",
                dense ? "py-1.5" : "py-2.5"
              )}
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {item.label}
              </dt>
              <dd
                className={cn(
                  "flex min-w-0 items-baseline gap-1 text-sm [&_a]:underline-offset-4 [&_a:hover]:underline",
                  item.mono && "font-mono text-xs"
                )}
              >
                <span className="min-w-0 flex-1 break-words">
                  {item.value ?? (
                    <span aria-label="Empty" className="text-muted-foreground">
                      -
                    </span>
                  )}
                </span>
                {copy && (
                  <CopyButton
                    value={copy}
                    className="-my-1 shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  />
                )}
              </dd>
              {item.hint && (
                <dd className="col-start-2 text-xs text-muted-foreground">
                  {item.hint}
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    )
  }

  return (
    <dl
      data-slot="detail-list"
      className={cn(
        "grid gap-x-6",
        dense ? "gap-y-3" : "gap-y-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {items.map((item) => {
        const copy = item.copyable ? copyTextFor(item) : undefined
        return (
          <div
            key={item.label}
            className={cn(
              "group/row min-w-0 space-y-1",
              item.wide && "sm:col-span-full"
            )}
          >
            <dt className="text-xs font-medium text-muted-foreground">
              {item.label}
            </dt>
            <dd
              className={cn(
                "flex min-w-0 items-baseline gap-1 text-sm leading-snug [&_a]:underline-offset-4 [&_a:hover]:underline",
                item.mono && "font-mono text-xs"
              )}
            >
              <span className="min-w-0 break-words">
                {item.value ?? (
                  <span aria-label="Empty" className="text-muted-foreground">
                    -
                  </span>
                )}
              </span>
              {copy && (
                <CopyButton
                  value={copy}
                  className="-my-1 shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                />
              )}
            </dd>
            {item.hint && (
              <dd className="text-xs text-muted-foreground">{item.hint}</dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}
