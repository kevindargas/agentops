import Link from "next/link"
import { ArrowLeftIcon, CompassIcon } from "lucide-react"

import { Eyebrow } from "@/components/shared/eyebrow"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { siteConfig } from "@/config/site"

export default function RootNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Empty className="w-full max-w-md animate-in border border-dashed py-16 duration-300 fade-in-0 motion-reduce:animate-none">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-10 rounded-xl [&_svg:not([class*='size-'])]:size-5"
          >
            <CompassIcon />
          </EmptyMedia>
          <Eyebrow mono>Error 404</Eyebrow>
          <EmptyTitle className="text-base">Page not found</EmptyTitle>
          <EmptyDescription>
            This address does not exist in {siteConfig.name}. It may have been
            moved or removed.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/dashboard" />}>
            <ArrowLeftIcon /> Back to overview
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
