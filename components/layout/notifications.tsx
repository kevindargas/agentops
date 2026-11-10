"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  AtSignIcon,
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  ClockAlertIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserCheckIcon,
  WrenchIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { notifications as seed } from "@/lib/data/activity"
import { timeAgo } from "@/lib/format"
import type { Notification } from "@/lib/types"

const kinds: Record<
  Notification["type"],
  { icon: React.ReactNode; tone: string }
> = {
  assignment: { icon: <UserCheckIcon />, tone: "bg-brand/10 text-brand" },
  approval: {
    icon: <ShieldCheckIcon />,
    tone: "bg-warning/15 text-warning-text",
  },
  sla: {
    icon: <ClockAlertIcon />,
    tone: "bg-destructive/10 text-danger-text",
  },
  mention: { icon: <AtSignIcon />, tone: "bg-info/10 text-info-text" },
  system: { icon: <WrenchIcon />, tone: "bg-muted text-muted-foreground" },
}

type Filter = "all" | "unread"

export function Notifications() {
  const [items, setItems] = React.useState(seed)
  const [filter, setFilter] = React.useState<Filter>("all")
  const unread = items.filter((n) => !n.read).length
  const visible = filter === "unread" ? items.filter((n) => !n.read) : items

  const markAll = () =>
    setItems((all) => all.map((n) => ({ ...n, read: true })))
  const markOne = (id: string) =>
    setItems((all) => all.map((n) => (n.id === id ? { ...n, read: true } : n)))

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative text-muted-foreground hover:text-foreground"
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                />
              }
            />
          }
        >
          <BellIcon />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 size-2 rounded-full bg-destructive ring-2 ring-background"
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" sideOffset={8} className="w-[380px] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div
            className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
            role="group"
            aria-label="Filter notifications"
          >
            {(["all", "unread"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  filter === f && "bg-background text-foreground shadow-xs"
                )}
              >
                {f === "all" ? "All" : "Unread"}
                {f === "unread" && unread > 0 && (
                  <span className="ml-1 text-muted-foreground tabular-nums">
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={markAll}
                  disabled={unread === 0}
                  aria-label="Mark all as read"
                />
              }
            >
              <CheckCheckIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">Mark all as read</TooltipContent>
          </Tooltip>
        </div>
        <Separator />

        <ScrollArea className="h-80">
          {visible.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-2 px-8 text-center">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BellOffIcon className="size-4" />
              </div>
              <p className="text-sm font-medium">All caught up</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                New assignments, approvals and mentions will show up here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col p-1">
              {visible.map((n) => {
                const { icon, tone } = kinds[n.type]
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => markOne(n.id)}
                      className={cn(
                        "flex gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/60",
                        !n.read && "bg-brand/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4",
                          tone
                        )}
                      >
                        {icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn("truncate", !n.read && "font-medium")}
                          >
                            {n.title}
                          </span>
                          <span className="ml-auto shrink-0 text-2xs text-muted-foreground tabular-nums">
                            {timeAgo(n.timestamp)}
                          </span>
                          {!n.read && (
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full bg-brand"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        <Separator />
        <div className="flex items-center justify-between px-2 py-1.5">
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            render={<Link href="/settings?tab=notifications" />}
          >
            <Settings2Icon /> Notification settings
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            render={<Link href="/my-work" />}
          >
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
