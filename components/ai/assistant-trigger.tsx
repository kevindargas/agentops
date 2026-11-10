"use client"

import { cn } from "cn"
import { SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAi } from "./ai-provider"

/** Header icon button that toggles AgentOps Assist. Pulses while proposals wait for review. */
export function AssistantTrigger() {
  const { open, toggle, proposals, status } = useAi()
  const pending = proposals.length
  const busy = status === "submitted" || status === "streaming"
  const label =
    pending > 0
      ? `AgentOps Assist · ${pending} proposal${pending === 1 ? "" : "s"} waiting`
      : "AgentOps Assist"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-pressed={open}
            aria-label={label}
            data-state={open ? "open" : "closed"}
            className={cn(
              "relative text-brand hover:bg-brand/10 hover:text-brand data-[state=open]:bg-brand/10",
              busy && "[&_svg]:animate-pulse"
            )}
          />
        }
      >
        <SparklesIcon />
        {pending > 0 && !open && (
          <span aria-hidden className="absolute top-1 right-1 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-brand ring-2 ring-background" />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        {label}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>J</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  )
}
