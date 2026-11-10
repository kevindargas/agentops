import { cookies } from "next/headers"

import { AppShell } from "@/components/layout/app-shell"

/**
 * The sidebar persists its open/collapsed state in a cookie (see
 * `SidebarProvider`). Reading it here lets the server render the correct
 * width on first paint instead of snapping after hydration.
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
  return <AppShell defaultSidebarOpen={defaultSidebarOpen}>{children}</AppShell>
}
