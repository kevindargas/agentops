import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { PackageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/skeletons"
import { CatalogView } from "@/features/catalog/catalog-view"

export const metadata: Metadata = { title: "Service Catalog" }

export default function CatalogPage() {
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
      <Suspense fallback={<TableSkeleton />}>
        <CatalogView />
      </Suspense>
    </>
  )
}
