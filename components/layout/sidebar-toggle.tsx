"use client"

import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { siteConfig } from "@/config/site"

/** Header sidebar toggle with a contextual label and the ⌘B hint. */
export function SidebarToggle({ className }: { className?: string }) {
  const { state, isMobile } = useSidebar()
  const label = isMobile
    ? "Open menu"
    : state === "collapsed"
      ? "Expand sidebar"
      : "Collapse sidebar"
  return (
    <Tooltip>
      <TooltipTrigger
        render={<SidebarTrigger className={className} aria-label={label} />}
      />
      <TooltipContent side="bottom" className="flex items-center gap-2">
        {label}
        <KbdGroup>
          {siteConfig.shortcuts.sidebar.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  )
}
