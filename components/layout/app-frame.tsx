"use client"

import dynamic from "next/dynamic"
import { MotionConfig } from "motion/react"

import { useCustomizer } from "@/components/theme/customizer-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { CommandMenu } from "./command-menu"
import { SiteHeader } from "./site-header"

/**
 * The assistant pulls in the markdown/streaming stack (Streamdown, Shiki…).
 * Loading it on demand keeps those chunks out of every page's first paint; the
 * closed panel renders nothing, so there is no layout shift.
 */
const AssistantPanel = dynamic(
  () => import("@/components/ai/assistant-panel").then((m) => m.AssistantPanel),
  { ssr: false }
)

export function AppFrame({
  children,
  defaultSidebarOpen = true,
}: {
  children: React.ReactNode
  defaultSidebarOpen?: boolean
}) {
  const { settings } = useCustomizer()
  return (
    // `reducedMotion="user"` makes every motion.* animation honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <SidebarProvider
        defaultOpen={defaultSidebarOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 64)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <AppSidebar variant={settings.sidebar} />
        <SidebarInset className="min-w-0">
          <SiteHeader />
          <div
            id="main-content"
            tabIndex={-1}
            className="@container/main flex flex-1 flex-col gap-6 p-4 pb-12 outline-none lg:p-6 lg:pb-16"
          >
            {children}
          </div>
        </SidebarInset>
        <AssistantPanel />
        <CommandMenu />
      </SidebarProvider>
    </MotionConfig>
  )
}
