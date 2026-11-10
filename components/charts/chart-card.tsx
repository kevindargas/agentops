import { cn } from "cn"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Consistent card chrome for charts: title + description on the left, an
 * optional action on the right, the plot below, optional footer for insight
 * text. Cards stretch to fill their grid cell so heights align across a row.
 */
export function ChartCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col", contentClassName)}>
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="text-xs text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}
