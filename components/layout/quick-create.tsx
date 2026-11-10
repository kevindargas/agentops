"use client"

import * as React from "react"
import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { quickCreateItems } from "@/config/nav"
import { siteConfig } from "@/config/site"

const OPEN_EVENT = "agentops:quick-create"

/** Opens the quick-create menu from anywhere (bound to the `C` shortcut in the command menu). */
export function openQuickCreate() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function QuickCreate() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  className="gap-1.5 shadow-xs"
                  aria-keyshortcuts="C"
                />
              }
            />
          }
        >
          <PlusIcon />
          <span className="hidden sm:inline">New</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          Create a record
          <KbdGroup>
            {siteConfig.shortcuts.quickCreate.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Create a record
          </DropdownMenuLabel>
          {quickCreateItems.map((item) => (
            <DropdownMenuItem
              key={item.href}
              render={<Link href={item.href} />}
            >
              {item.icon && <item.icon className="text-muted-foreground" />}
              {item.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
