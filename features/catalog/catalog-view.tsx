"use client"

import { useSearchParams } from "next/navigation"

import { catalogItems } from "@/lib/data/catalog"
import type { CatalogCategory } from "@/lib/types"
import { CatalogBrowser } from "./catalog-browser"

const categories = new Set<string>(catalogItems.map((c) => c.category))

/**
 * URL reader for the Service Catalog: `?q=<text>` seeds the search box and
 * `?category=<name>` preselects a category (ignored when it is not one of the
 * catalog categories). Must sit inside `<Suspense>`; the browser is keyed on
 * both so a new deep link resets the local filter state.
 */
export function CatalogView() {
  const params = useSearchParams()
  const q = params.get("q") ?? ""
  const category = params.get("category")
  const initialCategory =
    category && categories.has(category)
      ? (category as CatalogCategory)
      : undefined
  return (
    <CatalogBrowser
      key={`${q}:${initialCategory ?? ""}`}
      initialQuery={q}
      initialCategory={initialCategory}
    />
  )
}
