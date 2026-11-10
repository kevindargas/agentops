import { AppFrame } from "./app-frame"

export function AppShell({
  children,
  defaultSidebarOpen = true,
}: {
  children: React.ReactNode
  /** Initial desktop sidebar state, normally read from the `sidebar_state` cookie. */
  defaultSidebarOpen?: boolean
}) {
  return <AppFrame defaultSidebarOpen={defaultSidebarOpen}>{children}</AppFrame>
}
