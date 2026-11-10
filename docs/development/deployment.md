# Deployment

AgentOps is a standard Next.js 16 application with no required environment variables, no database and one optional outbound call. This page covers the build, hosting options, caching and the security properties you should know before exposing it.

## Build and run

```bash
pnpm install
pnpm build     # next build -> .next/
pnpm start     # next start on port 3000
```

Run `pnpm typecheck && pnpm lint && pnpm test` before building. The build fails on type errors.

`next.config.ts` is empty. Node 20 or newer is required at runtime for `next start`.

## Hosting options

### Vercel or Netlify

Connect the repository and deploy with the default Next.js preset. No environment variables. The Model Catalog page runs as a server function with the fetch result cached for one hour by `next: { revalidate: 3600 }`, so the public OpenRouter endpoint is called at most once an hour per region.

### Self-hosted Node

`pnpm build && pnpm start` behind a reverse proxy. Set `PORT` if 3000 is taken (a Next convention, not read by app code). Health check: `GET /dashboard` returns 200. Give the process outbound HTTPS to `openrouter.ai` or accept an empty catalog.

### Container

A minimal image: Node 20 base, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm start`. `.next/` is the only build output; `.gitignore` already excludes it, `out/`, `build/`, `coverage/`, `.env*` and `*.tsbuildinfo`.

### Static export

Set `output: "export"` in `next.config.ts` and run `pnpm build`; the site lands in `out/` and can be served from GitHub Pages, S3 or any static host.

What changes:

- The readiness assessment is fully client-rendered and works unchanged.
- The Model Catalog fetch happens at build time; the exported page shows the catalog as of the build and the one-hour revalidation does not apply. If the build machine has no egress, the page exports with the empty state.
- Dynamic record routes (`[id]`, `[number]`) must be enumerable at build time; with the sample data they are, through the data modules. With a real backend you need `generateStaticParams` or a server runtime.
- The `sidebar_state` cookie is still written by the client and read on the next full load, but there is no server to honour it, so the sidebar may snap once after hydration.

## Caching

- Pages are server-rendered on request; nothing but the OpenRouter response is cached server-side.
- The OpenRouter response lives in Next's data cache for 3600 seconds. To drop it, redeploy or restart.
- Static assets under `.next/static` are content-hashed and cacheable for a year by any CDN.
- Fonts are loaded through `next/font/google` and self-hosted in the build.

## Environment variables

None are read by application code. The warm script reads `WARM_BASE` and `WARM_CONCURRENCY` in development only. Any `.env*` file is ignored by git.

## Security notes

- **No authentication.** The app has no login, session or role model. Put it behind your identity provider (a reverse proxy with OIDC, Vercel or Netlify access controls, or Next middleware you add) before exposing it outside a trusted network.
- **Readiness data never leaves the browser.** Assessments, snapshots, respondent names and imported control sets are stored in `localStorage` under `agentops.readiness.v1`. No request carries them. Share links embed the full assessment in the URL fragment (`#s=`), which browsers do not send to servers; anyone holding a link can read everything in it, so treat links as the data.
- **Assistant and theme settings** are also browser-local (`agentops:assistant`, `agentops:ai-settings`, `agentops:theme`, `theme`).
- **Outbound traffic** is limited to `https://openrouter.ai/api/v1/models` from the server and Google Fonts at build time. There is no telemetry, analytics or error reporting built in.
- **Inline script.** `app/layout.tsx` inlines `themeInitScript` to apply theme attributes before first paint. If you deploy a strict Content Security Policy, allow it with a nonce or hash; the script validates stored values against known ids before setting attributes.
- **Sample data** includes realistic-looking but fictional people, keys (masked), URLs and incidents. Replace `lib/data` before using the app with real users so nobody mistakes fixtures for records.
- **Audit log integrity** in the sample is a client-side hash chain for demonstration. When wired, verify on the server and store events in append-only storage; the retention card models 400 days on WORM storage with legal holds.
