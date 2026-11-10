"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Route-level error boundary for every page inside the app shell. The sidebar
 * and header stay interactive, so users can navigate away or retry in place.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Replace with your error reporter (Sentry, Datadog…). Kept as a console
    // call so the template works without any backend.
    console.error(error)
  }, [error])

  return (
    <Empty
      role="alert"
      className="flex-1 animate-in border border-dashed border-destructive/30 py-16 duration-300 fade-in-0 motion-reduce:animate-none"
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-10 rounded-xl bg-destructive/10 text-destructive [&_svg:not([class*='size-'])]:size-5"
        >
          <TriangleAlertIcon />
        </EmptyMedia>
        <p className="font-mono text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
          Something went wrong
        </p>
        <EmptyTitle className="text-base">
          This page could not be displayed
        </EmptyTitle>
        <EmptyDescription>
          An unexpected error interrupted rendering. Your other work is
          unaffected. Try again, or go back to the overview.
          {error.digest && (
            <>
              {" "}
              Reference{" "}
              <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px]">
                {error.digest}
              </code>
            </>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcwIcon /> Try again
          </Button>
          <Button variant="outline" render={<Link href="/dashboard" />}>
            <ArrowLeftIcon /> Back to overview
          </Button>
        </div>
        {process.env.NODE_ENV !== "production" && (
          <pre className="mt-4 max-h-48 max-w-2xl overflow-auto rounded-lg border bg-muted/40 p-3 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
            {error.message}
          </pre>
        )}
      </EmptyContent>
    </Empty>
  )
}
