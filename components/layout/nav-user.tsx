"use client"

import Link from "next/link"
import {
  BadgeCheckIcon,
  BellIcon,
  ChevronsUpDownIcon,
  CommandIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { siteConfig } from "@/config/site"
import { currentUser, initials } from "@/lib/data/users"
import { openCommandMenu } from "./command-menu"

function UserAvatar({ className }: { className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="rounded-[inherit] bg-linear-to-br from-brand to-brand/75 text-xs font-semibold text-brand-foreground">
        {initials(currentUser.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const user = currentUser
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={user.name}
                className="transition-colors data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <span className="relative shrink-0">
              <UserAvatar className="size-8 rounded-lg" />
              {/* Presence dot. Static in this mock; wire to a presence source when available. */}
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-sidebar"
              />
            </span>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.title}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 px-1.5 py-1.5 text-left text-sm">
                  <UserAvatar className="size-9 rounded-lg" />
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <UserIcon /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/approvals" />}>
                <BadgeCheckIcon /> My approvals
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href="/settings?tab=notifications" />}
              >
                <BellIcon /> Notifications
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <SettingsIcon /> Settings
                <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openCommandMenu}>
              <CommandIcon /> Command menu
              <DropdownMenuShortcut>
                {siteConfig.shortcuts.commandMenu.join("")}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOutIcon /> Log out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              {siteConfig.name} v{siteConfig.version} · {siteConfig.workspace}
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
