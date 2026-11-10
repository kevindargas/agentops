"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Tiny clipboard button that swaps to a check mark for a moment after copying.
 * Pure client component so it can sit inside server-rendered lists.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "icon-xs",
}: {
  value: string
  label?: string
  className?: string
  size?: "icon-xs" | "icon-sm"
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable (insecure context): fail silently */
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={size}
            aria-label={copied ? "Copied" : label}
            onClick={copy}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              copied && "text-success-text hover:text-success-text",
              className
            )}
          />
        }
      >
        {copied ? (
          <CheckIcon className="animate-in duration-150 zoom-in-75" />
        ) : (
          <CopyIcon />
        )}
      </TooltipTrigger>
      <TooltipContent side="top">{copied ? "Copied" : label}</TooltipContent>
    </Tooltip>
  )
}

/** Inline value with a copy affordance that appears on hover/focus. */
export function CopyableValue({
  value,
  children,
  className,
  mono = false,
}: {
  value: string
  children?: React.ReactNode
  className?: string
  mono?: boolean
}) {
  return (
    <span
      className={cn(
        "group/copy inline-flex min-w-0 items-center gap-1",
        className
      )}
    >
      <span className={cn("min-w-0 truncate", mono && "font-mono text-xs")}>
        {children ?? value}
      </span>
      <CopyButton
        value={value}
        className="-my-1 opacity-0 transition-opacity group-hover/copy:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      />
    </span>
  )
}
