"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * Client-side replacement for `redirect("/dashboard")`. A server redirect
 * cannot be expressed in a static export, so the root page renders this
 * instead: `router.replace` runs as soon as the bundle is live, the meta
 * refresh covers browsers without JavaScript, and the link covers everything
 * else. `next/link` and `useRouter` apply `basePath` on their own.
 */
export function RootRedirect({ href }: { href: string }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(href)
  }, [router, href])
  const prefixed = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${href}`
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-sm text-muted-foreground">
      <meta httpEquiv="refresh" content={`1;url=${prefixed}`} />
      <p>
        Opening the overview.{" "}
        <Link href={href} className="text-foreground underline">
          Continue to the dashboard
        </Link>{" "}
        if nothing happens.
      </p>
    </main>
  )
}
