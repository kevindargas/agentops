import type { NextConfig } from "next"

/**
 * Build contract:
 *
 * - Default (`pnpm build`): server mode, unchanged. Vercel, Netlify, `next
 *   start` and containers use this.
 * - `STATIC_EXPORT=1` (`pnpm build:static`): `output: "export"` writes a
 *   static site to `out/`. `NEXT_PUBLIC_BASE_PATH` sets the sub-path the site
 *   is served from ("" locally, "/agentops" on GitHub Pages) and is applied to
 *   both `basePath` and `assetPrefix`. Trailing slashes turn `/dashboard` into
 *   `dashboard/index.html`, which static hosts serve without rewrites, and
 *   `images.unoptimized` is required because there is no image server.
 *
 * The same two variables are read by `app/layout.tsx` (icon paths,
 * `metadataBase`), `app/(app)/layout.tsx` (skip `cookies()`) and
 * `lib/ai/openrouter.server.ts` (drop `revalidate`).
 */
const isStaticExport = process.env.STATIC_EXPORT === "1"
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  // Keep the repo free of generated agent-rules files.
  agentRules: false,
  ...(isStaticExport
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath || undefined,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
}

export default nextConfig
