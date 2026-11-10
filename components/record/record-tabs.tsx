"use client"

import { cn } from "cn"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface RecordTab {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
  disabled?: boolean
  content: React.ReactNode
}

/** Underline tabs with counts for the lower half of a record form. */
export function RecordTabs({
  tabs,
  defaultValue,
  className,
  contentClassName,
}: {
  tabs: RecordTab[]
  defaultValue?: string
  className?: string
  contentClassName?: string
}) {
  return (
    <Tabs
      defaultValue={defaultValue ?? tabs[0]?.value}
      className={cn("gap-4", className)}
    >
      <div className="-mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6">
        <TabsList
          variant="line"
          className="h-9 w-full min-w-max justify-start gap-0 border-b p-0"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              disabled={t.disabled}
              className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
            >
              {t.icon && (
                <span className="text-muted-foreground group-data-active/tab:text-foreground [&_svg]:size-3.5">
                  {t.icon}
                </span>
              )}
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background">
                  {t.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className={contentClassName}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
