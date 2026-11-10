import Link from "next/link"
import { ArrowLeftIcon, CompassIcon } from "lucide-react"

import { CommandMenuTrigger } from "@/components/layout/command-menu"
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
import { navigation } from "@/config/nav"

export default function NotFound() {
  const suggestions = navigation[0].items.slice(0, 4)
  return (
    <Empty className="flex-1 animate-in border border-dashed py-16 duration-300 fade-in-0 motion-reduce:animate-none">
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
          The page you are looking for does not exist, was moved, or you do not
          have access to it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button render={<Link href="/dashboard" />}>
            <ArrowLeftIcon /> Back to overview
          </Button>
          <CommandMenuTrigger className="h-8 w-auto rounded-lg xl:w-auto" />
        </div>
        <nav
          aria-label="Suggested pages"
          className="mt-4 flex flex-col items-center gap-1.5"
        >
          <p className="text-xs text-muted-foreground">Or jump to</p>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {suggestions.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </EmptyContent>
    </Empty>
  )
}
