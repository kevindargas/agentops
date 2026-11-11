import { cookies } from "next/headers"

import { AppShell } from "@/components/layout/app-shell"
import { buildSearchIndex } from "@/components/layout/search-index"
import { getNavCounts } from "@/config/nav-counts"

/**
 * The sidebar persists its open/collapsed state in a cookie (see
 * `SidebarProvider`). Reading it here lets the server render the correct
 * width on first paint instead of snapping after hydration.
 *
 * In a static export (`STATIC_EXPORT=1`) there is no request to read the
 * cookie from and calling `cookies()` would make every route dynamic, so the
 * layout falls back to the open state. The client still writes the cookie;
 * it is simply not read until the app runs behind a server again.
 */
async function readSidebarOpen(): Promise<boolean> {
  if (process.env.STATIC_EXPORT === "1") return true
  const cookieStore = await cookies()
  const sidebarState = cookieStore.get("sidebar_state")?.value
  return sidebarState === undefined ? true : sidebarState === "true"
}

/**
 * Sidebar badge counts and the command-menu search index are computed here on
 * the server from the data modules and passed down as plain props, so the
 * fixtures stay out of the shared client bundle.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const defaultSidebarOpen = await readSidebarOpen()
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
