"use client"

import * as React from "react"
import { cn } from "cn"

import { useQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface RecordTab {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
  disabled?: boolean
  content: React.ReactNode
}

export interface RecordTabsProps {
  tabs: RecordTab[]
  defaultValue?: string
  className?: string
  contentClassName?: string
  /**
   * Query parameter that mirrors the active tab (`?tab=...`) so record tabs
   * are shareable. Pass `null` to keep the selection local.
   */
  syncParam?: string | null
}

/** Underline tabs with counts for the lower half of a record form. */
export function RecordTabs({ syncParam = "tab", ...props }: RecordTabsProps) {
  if (syncParam === null) return <RecordTabsView {...props} />
  return (
    <React.Suspense fallback={<RecordTabsView {...props} />}>
      <SyncedRecordTabs param={syncParam} {...props} />
    </React.Suspense>
  )
}

function SyncedRecordTabs({
  param,
  tabs,
  defaultValue,
  ...rest
}: Omit<RecordTabsProps, "syncParam"> & { param: string }) {
  const [fromUrl, setParam] = useQueryParam(param)
  const initial =
    fromUrl && tabs.some((t) => t.value === fromUrl && !t.disabled)
      ? fromUrl
      : (defaultValue ?? tabs[0]?.value)
  const [value, setValue] = React.useState(initial)

  function onValueChange(next: string) {
    setValue(next)
    // Written without a navigation so the URL stays shareable.
    setParam(next)
  }

  return (
    <RecordTabsView
      tabs={tabs}
      value={value}
      onValueChange={onValueChange}
      {...rest}
    />
  )
}

function RecordTabsView({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
  contentClassName,
}: Omit<RecordTabsProps, "syncParam"> & {
  value?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <Tabs
      defaultValue={
        value === undefined ? (defaultValue ?? tabs[0]?.value) : undefined
      }
      value={value}
      onValueChange={onValueChange}
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
                <CountPill
                  count={t.count}
                  className="transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background"
                />
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
