"use client"

import { cn } from "cn"
import { CheckIcon, ChevronDownIcon, PlusCircleIcon, XIcon } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface FacetOption {
  label: string
  value: string
  icon?: React.ReactNode
}

/**
 * Pill-shaped multi-select filter. Reads as a dashed "+ Add" chip when empty
 * and as a solid chip summarising the selection once a value is picked, with
 * a dedicated clear button so a selection can be removed in one click.
 */
export function DataTableFacetedFilter({
  title,
  options,
  counts,
  selected,
  onChange,
  className,
}: {
  title: string
  options: FacetOption[]
  counts: Map<string, number>
  selected: Set<string>
  onChange: (next: Set<string>) => void
  className?: string
}) {
  const active = selected.size > 0
  const selectedOptions = options.filter((o) => selected.has(o.value))
  const summary =
    selectedOptions.length === 0
      ? null
      : selectedOptions.length <= 2
        ? selectedOptions.map((o) => o.label).join(", ")
        : `${selectedOptions.length} selected`

  return (
    <div
      data-active={active || undefined}
      className={cn(
        "inline-flex h-7 max-w-full items-stretch rounded-full border bg-background text-[0.8rem] transition-colors",
        active
          ? "border-border"
          : "border-dashed border-input hover:border-border",
        className
      )}
    >
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 font-medium whitespace-nowrap transition-colors outline-none select-none",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted",
                active && "rounded-r-none pr-2 text-foreground",
                !active && "text-muted-foreground hover:text-foreground"
              )}
              aria-label={
                active ? `${title} filter: ${summary}` : `Add ${title} filter`
              }
            />
          }
        >
          {active ? (
            <>
              <span className="text-muted-foreground">{title}</span>
              <span className="truncate">{summary}</span>
              <ChevronDownIcon
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </>
          ) : (
            <>
              <PlusCircleIcon className="size-3.5 shrink-0" aria-hidden />
              {title}
            </>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder={`Filter ${title.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selected.has(option.value)
                  const count = counts.get(option.value) ?? 0
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        const next = new Set(selected)
                        if (isSelected) next.delete(option.value)
                        else next.add(option.value)
                        onChange(next)
                      }}
                      className={cn(
                        count === 0 && !isSelected && "text-muted-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "[&_svg]:invisible"
                        )}
                      >
                        <CheckIcon className="size-3" />
                      </div>
                      {option.icon}
                      <span className="truncate">{option.label}</span>
                      <span className="ml-auto pl-2 font-mono text-xs text-muted-foreground tabular-nums">
                        {count}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {active && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onChange(new Set())}
                      className="justify-center text-center text-muted-foreground"
                    >
                      Clear {title.toLowerCase()} filter
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {active && (
        <button
          type="button"
          onClick={() => onChange(new Set())}
          aria-label={`Clear ${title} filter`}
          className="inline-flex items-center rounded-r-full border-l border-border/60 px-1.5 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
