import { cookies } from "next/headers"

import { AppShell } from "@/components/layout/app-shell"
import { buildSearchIndex } from "@/components/layout/search-index"
import { getNavCounts } from "@/config/nav-counts"

/**
 * The sidebar persists its open/collapsed state in a cookie (see
 * `SidebarProvider`). Reading it here lets the server render the correct
 * width on first paint instead of snapping after hydration.
 *
 * Sidebar badge counts and the command-menu search index are computed here on
 * the server from the data modules and passed down as plain props, so the
 * fixtures stay out of the shared client bundle.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sidebarState = cookieStore.get("sidebar_state")?.value
  const defaultSidebarOpen =
    sidebarState === undefined ? true : sidebarState === "true"
  return (
    <AppShell
      defaultSidebarOpen={defaultSidebarOpen}
      navCounts={getNavCounts()}
      searchIndex={buildSearchIndex()}
    >
      {children}
    </AppShell>
  )
}
