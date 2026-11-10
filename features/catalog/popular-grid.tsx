"use client"

import * as React from "react"

import {
  CatalogItemCard,
  RequestSheet,
} from "@/features/catalog/catalog-browser"
import type { CatalogItem } from "@/lib/types"

/** Compact storefront grid used on the Employee Center; opens the same request sheet as the catalog. */
export function PopularGrid({ items }: { items: CatalogItem[] }) {
  const [ordering, setOrdering] = React.useState<CatalogItem | null>(null)
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <CatalogItemCard
            key={item.id}
            item={item}
            onOrder={() => setOrdering(item)}
            compact
          />
        ))}
      </div>
      <RequestSheet item={ordering} onClose={() => setOrdering(null)} />
    </>
  )
}
