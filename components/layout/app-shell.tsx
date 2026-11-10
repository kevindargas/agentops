import type { NavCounts } from "@/config/nav"
import { AppFrame } from "./app-frame"
import type { SearchEntry } from "./search-index"

export function AppShell({
  children,
  defaultSidebarOpen = true,
  navCounts,
  searchIndex,
}: {
  children: React.ReactNode
  /** Initial desktop sidebar state, normally read from the `sidebar_state` cookie. */
  defaultSidebarOpen?: boolean
  /** Live sidebar badge counts from `getNavCounts()`. */
  navCounts?: NavCounts
  /** Record search index for the command menu from `buildSearchIndex()`. */
  searchIndex?: SearchEntry[]
}) {
  return (
    <AppFrame
      defaultSidebarOpen={defaultSidebarOpen}
      navCounts={navCounts}
      searchIndex={searchIndex}
    >
      {children}
    </AppFrame>
  )
}
