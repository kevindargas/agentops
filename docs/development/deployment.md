# Deployment

AgentOps is a standard Next.js 16 application with no required environment variables, no database and one optional outbound call. This page covers the build, hosting options, the GitHub Pages static export, caching and the security properties you should know before exposing it.

The public demo at https://kevindargas.github.io/agentops is the static export described below, published by `.github/workflows/pages.yml` on every push to `main`.

## Build and run

```bash
pnpm install
pnpm build     # next build -> .next/
pnpm start     # next start on port 3000
```

Run `pnpm typecheck && pnpm lint && pnpm test` before building. The build fails on type errors.

`next.config.ts` only sets `agentRules: false` unless the static export flag below is present. Node 20 or newer is required at runtime for `next start`.

### Build modes and environment variables

| Variable | Read by | Effect |
| --- | --- | --- |
| `STATIC_EXPORT=1` | `next.config.ts`, `app/(app)/layout.tsx`, `app/(app)/ai/models/page.tsx`, `lib/ai/openrouter.server.ts` | Switches `next build` to `output: "export"` (static site in `out/`), enables `trailingSlash` and `images.unoptimized`, skips the `cookies()` read for the sidebar, drops the one-hour `revalidate` on the OpenRouter fetch and labels the Model Catalog as a build snapshot. Unset means server mode, identical to before the flag existed. |
| `NEXT_PUBLIC_BASE_PATH` | `next.config.ts`, `app/layout.tsx`, `app/root-redirect.tsx`, `scripts/serve-static.mjs` | Sub-path the site is served from. Empty by default; the Pages workflow sets `/agentops`. Applied as `basePath` and `assetPrefix` in export mode and used to prefix the favicon URLs in the metadata. `next/link` and the router prefix it on their own. |
| `NEXT_PUBLIC_SITE_URL` | `config/site.ts` | Public origin used for `metadataBase` and Open Graph. The Pages workflow sets `https://kevindargas.github.io/agentops`. |

`pnpm build:static` is `STATIC_EXPORT=1 next build`. `pnpm preview:static` serves `out/` on http://localhost:4173 under `NEXT_PUBLIC_BASE_PATH` the way GitHub Pages does (directory indexes, a redirect from `/x` to `/x/`, `404.html` for unknown paths).

## Hosting options

### Vercel or Netlify

Connect the repository and deploy with the default Next.js preset. No environment variables. The Model Catalog page runs as a server function with the fetch result cached for one hour by `next: { revalidate: 3600 }`, so the public OpenRouter endpoint is called at most once an hour per region.

### Self-hosted Node

`pnpm build && pnpm start` behind a reverse proxy. Set `PORT` if 3000 is taken (a Next convention, not read by app code). Health check: `GET /dashboard` returns 200. Give the process outbound HTTPS to `openrouter.ai` or accept an empty catalog.

### Container

A minimal image: Node 20 base, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm start`. `.next/` is the only build output; `.gitignore` already excludes it, `out/`, `build/`, `coverage/`, `.env*` and `*.tsbuildinfo`.

### Static export and GitHub Pages

```bash
pnpm build:static                                   # out/ served from the domain root
NEXT_PUBLIC_BASE_PATH=/agentops pnpm build:static   # out/ served from /agentops
NEXT_PUBLIC_BASE_PATH=/agentops pnpm preview:static # http://localhost:4173/agentops/
```

The export writes one `index.html` per route into `out/` (`trailingSlash: true`, so `/dashboard` becomes `out/dashboard/index.html`), plus `out/404.html`. `public/.nojekyll` is copied along so Pages serves the `_next/` folder instead of treating it as a Jekyll artefact.

**Workflow.** `.github/workflows/pages.yml` runs on every push to `main` and on manual dispatch. The `build` job installs with pnpm 10 on Node 22, runs `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm build:static` with `NEXT_PUBLIC_BASE_PATH=/agentops` and `NEXT_PUBLIC_SITE_URL=https://kevindargas.github.io/agentops`, and uploads `out/` as the Pages artifact. The `deploy` job publishes it to the `github-pages` environment. One-time repository setup: Settings > Pages > Build and deployment > Source must be "GitHub Actions". The site is public even if the repository is private only on paid plans; on the free plan the repository must be public for Pages to serve it.

**How the app changes in export mode.**

- The root page renders `RootRedirect` (client-side `router.replace("/dashboard")` with a meta refresh and a link as fallbacks) instead of a server `redirect()`. The same component is used in server mode.
- Every record route (`[id]` and `[number]`) exports `generateStaticParams` over its sample collection and `dynamicParams = false`, so there is one HTML file per sample record and unknown ids return the 404 page. Records you create in a session (new incidents, changes, problems, articles) live only in client stores and have no page in the export; following their link lands on the 404 page. Under `next start` the same ids are prerendered at build time.
- `app/(app)/layout.tsx` does not read the `sidebar_state` cookie (there is no request to read it from) and renders the sidebar open. The client still writes the cookie, so the sidebar may snap once after hydration when you had it collapsed.
- The Model Catalog fetch runs once on the build machine. The page is labelled "Build snapshot" and shows the catalog as of that build; the one-hour revalidation does not apply. If the runner has no egress or OpenRouter is slow (10 s timeout), the page exports with the empty state and the error message.
- Everything else (readiness assessment, stores, audit chain, assistant, theme) is client-rendered state and works unchanged.

Not available statically: route handlers, server actions, rewrites, redirects, headers, proxy, ISR, image optimisation and anything that reads the request. The app uses none of these outside the two cases handled above.

## Caching

- In server mode pages are server-rendered on request (record pages are prerendered at build and served from the cache); nothing but the OpenRouter response is cached server-side. In the static export everything is a file.
- The OpenRouter response lives in Next's data cache for 3600 seconds. To drop it, redeploy or restart.
- Static assets under `.next/static` are content-hashed and cacheable for a year by any CDN.
- Fonts are loaded through `next/font/google` and self-hosted in the build.

## Environment variables

Application code reads only the three build-time variables in the table above (`STATIC_EXPORT`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_SITE_URL`); none is required. The warm script reads `WARM_BASE` and `WARM_CONCURRENCY`, the static preview server `PORT` and `STATIC_DIR`, in development only. Any `.env*` file is ignored by git.

## Security notes

- **No authentication.** The app has no login, session or role model. Put it behind your identity provider (a reverse proxy with OIDC, Vercel or Netlify access controls, or Next middleware you add) before exposing it outside a trusted network.
- **Readiness data never leaves the browser.** Assessments, snapshots, respondent names and imported control sets are stored in `localStorage` under `agentops.readiness.v1`. No request carries them. Share links embed the full assessment in the URL fragment (`#s=`), which browsers do not send to servers; anyone holding a link can read everything in it, so treat links as the data.
- **Assistant and theme settings** are also browser-local (`agentops:assistant`, `agentops:ai-settings`, `agentops:theme`, `theme`).
- **Outbound traffic** is limited to `https://openrouter.ai/api/v1/models` from the server and Google Fonts at build time. There is no telemetry, analytics or error reporting built in.
- **Inline script.** `app/layout.tsx` inlines `themeInitScript` to apply theme attributes before first paint. If you deploy a strict Content Security Policy, allow it with a nonce or hash; the script validates stored values against known ids before setting attributes.
- **Sample data** includes realistic-looking but fictional people, keys (masked), URLs and incidents. Replace `lib/data` before using the app with real users so nobody mistakes fixtures for records.
- **Audit log integrity** in the sample is a client-side hash chain for demonstration. When wired, verify on the server and store events in append-only storage; the retention card models 400 days on WORM storage with legal holds.
