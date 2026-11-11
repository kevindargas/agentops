"use client"

import { CalendarIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQueryParam } from "@/hooks/use-query-param"

import { periodOptions, resolvePeriod, type PeriodValue } from "./period"

/**
 * Date-range preset selector bound to `?period=` through `useQueryParam`, so
 * every chart reading the same param re-renders without a navigation. Must be
 * rendered inside a <Suspense> boundary (it reads useSearchParams).
 */
export function PeriodSelect({
  param = "period",
  fallback = "90d",
}: {
  param?: string
  /** Period used when the param is missing or not one of the presets. */
  fallback?: PeriodValue
}) {
  const [raw, setPeriod] = useQueryParam(param)
  const value = resolvePeriod(raw ?? undefined, fallback).value
  const items = periodOptions.map((p) => ({ value: p.value, label: p.label }))

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => setPeriod(String(next))}
    >
      <SelectTrigger aria-label="Reporting period" className="min-w-40">
        <CalendarIcon className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {items.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
