import { AssistantTrigger } from "@/components/ai/assistant-trigger"
import { ThemeCustomizer } from "@/components/theme/theme-customizer"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "./breadcrumbs"
import { CommandMenuTrigger } from "./command-menu"
import { Notifications } from "./notifications"
import { QuickCreate } from "./quick-create"
import { SidebarToggle } from "./sidebar-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b border-border/60 bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/65 md:group-has-data-[variant=inset]/sidebar-wrapper:rounded-t-xl">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarToggle className="-ml-1.5 text-muted-foreground hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-1 h-4 data-vertical:self-auto"
        />
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-1.5">
          <CommandMenuTrigger className="hidden md:inline-flex" />
          <AssistantTrigger />
          <QuickCreate />
          <Separator
            orientation="vertical"
            className="mx-1 h-4 data-vertical:self-auto"
          />
          <Notifications />
          <ThemeCustomizer />
        </div>
      </div>
    </header>
  )
}
