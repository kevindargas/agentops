import { cn } from "cn"

/**
 * Two-column record body: main content on the left, a details sidebar on the
 * right that collapses underneath on narrow viewports (see `.record-grid`).
 */
export function RecordLayout({
  children,
  aside,
  className,
  asideClassName,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
  className?: string
  asideClassName?: string
}) {
  return (
    <div className={cn("record-grid items-start", className)}>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {aside && (
        <aside className={cn("flex min-w-0 flex-col gap-4", asideClassName)}>
          {aside}
        </aside>
      )}
    </div>
  )
}
