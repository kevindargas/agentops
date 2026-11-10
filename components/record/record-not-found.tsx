import Link from "next/link"
import { ArrowLeftIcon, FileQuestionIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

/** Full-width placeholder for a record that does not exist or is not visible to the user. */
export function RecordNotFound({
  number,
  backHref,
  backLabel,
  description = "The record may have been deleted, renumbered, or you may not have permission to view it.",
}: {
  number: string
  backHref: string
  backLabel: string
  description?: string
}) {
  return (
    <Empty className="min-h-[60vh] border bg-card">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-xl [&_svg:not([class*='size-'])]:size-6"
        >
          <FileQuestionIcon />
        </EmptyMedia>
        <span className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs font-medium tracking-tight">
          {number}
        </span>
        <EmptyTitle className="text-base">
          We could not find that record
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button render={<Link href={backHref} />}>
            <ArrowLeftIcon /> Back to {backLabel}
          </Button>
          <Button variant="outline" render={<Link href="/dashboard" />}>
            Back to overview
          </Button>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <SearchIcon className="size-3.5" /> Press
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          to search every record
        </p>
      </EmptyContent>
    </Empty>
  )
}
