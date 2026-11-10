import type { Metadata } from "next"
import Link from "next/link"
import { PackageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { CatalogBrowser } from "@/features/catalog/catalog-browser"
import { catalogItems } from "@/lib/data/catalog"
import type { CatalogCategory } from "@/lib/types"

export const metadata: Metadata = { title: "Service Catalog" }

const categories = new Set<string>(catalogItems.map((c) => c.category))

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { q, category } = await searchParams
  const initialCategory =
    category && categories.has(category)
      ? (category as CatalogCategory)
      : undefined
  return (
    <>
      <PageHeader
        nav="/itsm/catalog"
        description="Order hardware, software, access and services. Items with approval are routed to your manager automatically."
        actions={
          <Button variant="outline" render={<Link href="/itsm/requests" />}>
            <PackageIcon /> My requests
          </Button>
        }
      />
      <CatalogBrowser
        initialQuery={q ?? ""}
        initialCategory={initialCategory}
      />
    </>
  )
}
