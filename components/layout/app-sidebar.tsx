"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "cn"
import { ChevronRightIcon, HexagonIcon, SearchIcon } from "lucide-react"
import { motion } from "motion/react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { navigation, type NavItem } from "@/config/nav"
import { siteConfig } from "@/config/site"
import { openCommandMenu } from "./command-menu"
import { NavUser } from "./nav-user"

function isActivePath(pathname: string, href: string) {
  const base = href.split("?")[0]
  if (base === "/dashboard") return pathname === base
  return pathname === base || pathname.startsWith(base + "/")
}

/**
 * Which child of a collapsible entry is active. An exact URL match (including
 * the query string, e.g. `?view=major`) wins; otherwise the plain-path child
 * ("All incidents") is active while we are on its page.
 */
function activeChildHref(items: NavItem[], pathname: string, url: string) {
  return (
    items.find((s) => s.href === url)?.href ??
    items.find((s) => !s.href.includes("?") && s.href === pathname)?.href
  )
}

function Keys({ shortcut }: { shortcut: string }) {
  return (
    <KbdGroup>
      {shortcut.split(" ").map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </KbdGroup>
  )
}

const navButtonClass = cn(
  "gap-2.5 text-sidebar-foreground/80 transition-colors duration-150 motion-reduce:transition-none",
  "[&>svg]:text-sidebar-foreground/60 hover:[&>svg]:text-sidebar-foreground",
  "data-active:text-sidebar-foreground data-active:[&>svg]:text-sidebar-primary"
)

/** Thin accent bar that slides between active entries (shared layout animation). */
function ActiveIndicator() {
  return (
    <motion.span
      layoutId="sidebar-active-indicator"
      aria-hidden
      className="pointer-events-none absolute inset-y-2 left-0 z-10 w-0.5 rounded-full bg-sidebar-primary"
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    />
  )
}

function NavEntry({
  item,
  pathname,
  url,
}: {
  item: NavItem
  pathname: string
  url: string
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const active = isActivePath(pathname, item.href)
  const children = item.items ?? []
  const hasChildren = children.length > 0
  // Open when the section is active; a manual toggle overrides until the route changes.
  const [override, setOverride] = React.useState<{
    path: string
    open: boolean
  } | null>(null)
  const open = override?.path === pathname ? override.open : active
  const setOpen = (next: boolean) => setOverride({ path: pathname, open: next })
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const tooltip = item.shortcut
    ? {
        children: (
          <>
            {item.title}
            <Keys shortcut={item.shortcut} />
          </>
        ),
      }
    : item.title

  const button = (
    <SidebarMenuButton
      tooltip={tooltip}
      isActive={active}
      className={navButtonClass}
      render={<Link href={item.href} onClick={closeMobile} />}
    >
      {item.icon && <item.icon />}
      <span>{item.title}</span>
    </SidebarMenuButton>
  )

  const badge = item.badge ? (
    <SidebarMenuBadge
      className={cn(
        "h-5 min-w-5 rounded-full bg-sidebar-primary/10 px-1.5 text-[11px] text-sidebar-primary",
        hasChildren && "right-7"
      )}
    >
      {item.badge}
    </SidebarMenuBadge>
  ) : null

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        {active && <ActiveIndicator />}
        {button}
        {badge}
      </SidebarMenuItem>
    )
  }

  const activeChild = activeChildHref(children, pathname, url)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
      className="group/collapsible"
    >
      {active && <ActiveIndicator />}
      {button}
      {badge}
      <CollapsibleTrigger
        render={
          <SidebarMenuAction
            showOnHover
            className="text-sidebar-foreground/50 transition-[transform,opacity,color] duration-150 hover:text-sidebar-foreground aria-expanded:rotate-90 motion-reduce:transition-none"
          />
        }
      >
        <ChevronRightIcon />
        <span className="sr-only">Toggle {item.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
        <SidebarMenuSub className="mx-4 gap-0.5 border-sidebar-border/80 py-1">
          {children.map((sub) => (
            <SidebarMenuSubItem key={sub.href}>
              <SidebarMenuSubButton
                isActive={activeChild === sub.href}
                render={<Link href={sub.href} onClick={closeMobile} />}
                className="text-sidebar-foreground/70 transition-colors duration-150 motion-reduce:transition-none data-active:font-medium data-active:text-sidebar-foreground"
              >
                <span>{sub.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Reads the current URL (needs useSearchParams, hence the Suspense boundary around it). */
function SidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  const url = qs ? `${pathname}?${qs}` : pathname

  return navigation.map((group, i) => (
    <React.Fragment key={group.label}>
      {/* Group labels fade out in icon mode; a hairline keeps the groups legible. */}
      {i > 0 && (
        <div
          aria-hidden
          className="mx-3 hidden h-px shrink-0 bg-sidebar-border group-data-[collapsible=icon]:block"
        />
      )}
      <SidebarGroup className="py-1.5">
        <SidebarGroupLabel className="text-[11px] font-medium text-sidebar-foreground/50">
          {group.label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-px">
            {group.items.map((item) => (
              <NavEntry
                key={item.href}
                item={item}
                pathname={pathname}
                url={url}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </React.Fragment>
  ))
}

/** Deterministic placeholder (widths derive from titles, so SSR and CSR agree). */
function SidebarNavSkeleton() {
  return navigation.map((group) => (
    <SidebarGroup key={group.label} className="py-1.5">
      <SidebarGroupLabel>
        <Skeleton className="h-3 w-20" />
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">
          {group.items.map((item) => (
            <SidebarMenuItem
              key={item.href}
              className="flex h-8 items-center gap-2.5 px-2"
            >
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton
                className="h-3.5 group-data-[collapsible=icon]:hidden"
                style={{
                  width: `${Math.min(80, 30 + item.title.length * 5)}%`,
                }}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={siteConfig.name}
              render={<Link href="/dashboard" />}
              className="transition-colors data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-b from-brand to-brand/85 text-brand-foreground shadow-sm ring-1 ring-black/5 ring-inset dark:ring-white/10">
                <HexagonIcon className="size-4" strokeWidth={2.25} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">
                  {siteConfig.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {siteConfig.workspace}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={openCommandMenu}
              aria-keyshortcuts="Meta+K"
              tooltip={{
                children: (
                  <>
                    Search
                    <KbdGroup>
                      {siteConfig.shortcuts.commandMenu.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </KbdGroup>
                  </>
                ),
              }}
              className="h-8 border border-sidebar-border/80 bg-background/70 text-muted-foreground shadow-xs transition-[background-color,border-color,box-shadow,color] duration-150 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none hover:border-sidebar-border hover:bg-background hover:text-foreground motion-reduce:transition-none"
            >
              <SearchIcon />
              <span>Search</span>
              <KbdGroup className="ml-auto group-data-[collapsible=icon]:hidden">
                {siteConfig.shortcuts.commandMenu.map((k) => (
                  <Kbd
                    key={k}
                    className="h-4.5 min-w-4.5 bg-muted/80 text-[10px]"
                  >
                    {k}
                  </Kbd>
                ))}
              </KbdGroup>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="py-1">
        <React.Suspense fallback={<SidebarNavSkeleton />}>
          <SidebarNav />
        </React.Suspense>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
