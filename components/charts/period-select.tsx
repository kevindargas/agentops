"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { periodOptions, type PeriodValue } from "./period"

/**
 * Date-range preset selector that writes `?period=` to the URL so the server
 * page re-renders every chart against the same slice. Must be rendered inside
 * a <Suspense> boundary (it reads useSearchParams).
 */
export function PeriodSelect({
  param = "period",
  value,
}: {
  param?: string
  value: PeriodValue
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const items = periodOptions.map((p) => ({ value: p.value, label: p.label }))

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set(param, String(next))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }}
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
