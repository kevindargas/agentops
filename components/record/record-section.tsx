import { cn } from "cn"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Consistent card section for record pages (Description, Details, Related…).
 * Pass `id` so a table of contents can link to it.
 */
export function RecordSection({
  title,
  description,
  count,
  icon,
  action,
  id,
  size = "default",
  className,
  contentClassName,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  count?: number
  icon?: React.ReactNode
  action?: React.ReactNode
  id?: string
  size?: "default" | "sm"
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card id={id} size={size} className={cn("scroll-mt-28", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon && (
            <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
          )}
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

/** Simple key/value row for compact sidebar summaries. */
export function SummaryRow({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm",
        className
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right tabular-nums">
        {children}
      </span>
    </div>
  )
}
