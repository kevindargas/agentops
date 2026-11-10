# Troubleshooting

Problems you may hit building, running or testing AgentOps, with the cause and the fix.

## Install and build

**`pnpm install` fails on native modules (`sharp`, `unrs-resolver`).**
`pnpm-workspace.yaml` allows builds for exactly these two packages. If your pnpm version ignores `allowBuilds`, run `pnpm approve-builds` and select them, or upgrade pnpm.

**TypeScript or Next complains about syntax your Node does not understand.**
Use Node 20 or newer. The project uses `structuredClone`, top-level `await` in `scripts/warm.mjs` and `Intl.RelativeTimeFormat`.

**Port 3000 is already in use.**
Next picks the next free port and prints it. If you rely on `pnpm warm`, pass the real address: `WARM_BASE=http://localhost:3001 pnpm warm`.

**The dev server serves stale or inconsistent modules.**
Turbopack caches under `.next/`. Stop the server, delete `.next/`, start again. `tsconfig.tsbuildinfo` can be deleted too if `pnpm typecheck` reports phantom errors.

**`next build` fails on a page that works in dev.**
The usual causes are a client component that calls `useSearchParams` without a `<Suspense>` boundary, or a server component that reads `params` or `searchParams` without `await` (both are Promises in this Next version). The build log names the route.

## Hydration

**"Text content does not match server-rendered HTML" on dates or relative times.**
Something rendered `Date.now()` or `new Date()` during render. Read the time through `clock()` from `lib/data/seed.ts` and format with `timeAgo()`, `formatDate()`, `formatDateTime()` or `formatUntil()` from `lib/format.ts`, which are anchored to `NOW`. If you must show wall-clock time, do it in a client component after mount, or through `useSyncExternalStore` with a server snapshot.

**Hydration mismatch on random values.**
Never call `Math.random()` in data modules. Use `createRng(seed)` with a seed unique to the module so server and client produce the same sequence.

**Hydration mismatch on persisted UI state (theme, assistant panel).**
Persisted client state must flow through `createStore` in `lib/store.ts` (which uses `useSyncExternalStore` with the initial value as the server snapshot) or through the `CustomizerProvider`. Reading `localStorage` directly in render will mismatch.

**A stat card or badge shows a different number from the table after an action.**
The card is server-rendered from `lib/data` while the table reads a client store. Move the card into the client component and compute it from `store.use()` (the count helpers in `lib/data/*.ts` accept a list for exactly this). Sidebar badges are not affected: they are computed on the server by `getNavCounts()` and describe the seed.

**My edits vanished after a reload.**
Expected. Session stores (`createListStore`) are in memory; only the readiness assessment, theme and assistant settings persist. See the FAQ entry on edits and refresh.

**A `?param=` link opens the page but nothing is selected.**
The param has no reader on that page. Check the deep-link table in [conventions](../development/conventions.md); either use the param the page reads or add a reader with `useQueryParam` in `hooks/use-query-param.ts`. Every link must point at a param that is read.

**A single-key shortcut fires while I am inside a sheet, or does not fire on a page.**
Global single keys go through `shouldIgnoreShortcut` in `components/layout/command-menu.tsx`. If a key fires inside your surface, the surface is missing `role="dialog"` or a `data-slot` the selector knows about. If your page handler and the global handler both run, the page handler must call `event.preventDefault()` on the keys it consumes.

**Dark mode flashes on load.**
`next-themes` is configured with `attribute="class"` and `<html suppressHydrationWarning>`. If you moved `ThemeProvider` or removed `suppressHydrationWarning`, restore them. The customizer attributes are applied by the inline `themeInitScript` in `app/layout.tsx`; keep it in `<head>`.

## Network

**Model Catalog shows "could not load models".**
The server-side fetch to `https://openrouter.ai/api/v1/models` failed. Check egress from the machine running `next dev` or `next start` (corporate proxy, offline). The result is cached for 3600 seconds, so after fixing connectivity either wait or restart the server to drop the data cache. The rest of the app does not depend on this call.

**Requests to `/cmdb`, `/hr/...` or `/employee-center` return 404.**
Those routes were removed on purpose. The warm script derives its route list from `app/(app)/**/page.tsx` (`scripts/warm-routes.mjs`), so it never requests them.

**`pnpm warm` prints `skip <route> (no sample id in scripts/warm-routes.mjs)`.**
A new dynamic route has no entry in `SAMPLE_IDS`. Add one real record id for the parent route; `scripts/warm.test.ts` fails until you do.

## Browser storage

**Readiness assessment will not save, or the page errors after a large import.**
`localStorage` has a per-origin quota (commonly 5 MB). Snapshots are capped at 25, but a large imported control set plus many snapshots can approach the limit. Delete old snapshots in the Share tab, or export the assessment and reset. The store wraps writes in `try/catch`, so a quota failure is silent: your last change is simply not persisted.

**Theme settings look wrong after editing `theme-presets.ts`.**
`sanitizeThemeSettings` drops any persisted value that is not a known id, so removing an accent falls back to defaults. If you renamed ids, clear `agentops:theme`.

## Checks

Each script checks one thing. Run all three before handing off: `pnpm typecheck && pnpm lint && pnpm test`.

**`pnpm typecheck` fails.**
`tsc --noEmit` with `strict: true`. Common causes: a new state string that is not in a union type, a `ModelParams` object missing a required field (all twelve non-optional fields are required), a `DeployedAgent` missing `limits`, `paused`, `slo` or `errorBudget`, or a `NavItem.badge` given a string that is not a `NavBadgeKey`.

**`pnpm lint` fails with `react-hooks/set-state-in-effect`.**
The rule is on. Do not call a state setter inside `useEffect` to derive state; compute it during render, or set it in the event handler that caused the change. The exception is `components/ai-elements/**`, where the rule is off because the code is vendored.

**`pnpm lint` fails with a `jsx-a11y` rule.**
The full recommended set is on. `anchor-has-content`, `heading-has-content` and `no-autofocus` are disabled globally because Base UI composes through `render` props; `components/ui/**` additionally disables `label-has-associated-control` and two interaction rules. Fix the markup rather than adding more exceptions.

**`pnpm test` fails in `lib/ai/assistant.test.ts`.**
Every starter prompt and every agentic template must hit a real `planResponse` branch instead of the generic fallback. If you added a template or starter, add the matching branch.

**`pnpm test` fails in `lib/readiness/readiness.test.ts`.**
Typical causes: a new control references a tool, metric, snippet or framework item that is not in the shared catalogs; duplicate or malformed control ids; a change to `lib/data/readiness.ts` that made the sample non-deterministic or removed the blockers and gaps the test expects; an OWASP item left without a control.

**`pnpm test` fails in `features/agentops/audit/audit-data.test.ts` or `audit-store.test.ts`.**
You changed an audit event after it was hashed, or inserted events out of chronological order. Rebuild seed events through `build()` in `lib/data/audit.ts`, which assigns ids and hashes in order, and append session events only through `auditStore.append`.

**`pnpm test` fails in `config/nav.test.ts`.**
Two nav items share a `G` chord letter, an href has no `page.tsx`, or a `badge` key has no line in `getNavCounts()`. The failure message names the two items or the missing page.

**`pnpm test` fails in `lib/data/barrel.test.ts` or `test/data-barrel.test.ts`.**
A new export in a `lib/data` module is not reachable through `lib/data/index.ts`, or two modules export the same name and `export *` dropped it. Rename one or pin the winner in the barrel.

**`pnpm test` fails in `lib/data/integrity.test.ts`.**
An id-like field references a record that does not exist, an id is duplicated, a record is dated after `NOW`, or a derived relationship (problem incidents, tool allowlists, prompt guardrails) disagrees between the two sides. The assertion names the module, field and id.

**`pnpm test` fails in `lib/data/counts.test.ts`.**
A count helper no longer matches the selector the page uses, or a page changed its selector without updating the helper. Keep them identical; the sidebar badge, the stat card and the page header must agree.

**`pnpm test` fails in `scripts/warm.test.ts`.**
A dynamic route has no `SAMPLE_IDS` entry, or a sample id no longer exists in the data. Update `scripts/warm-routes.mjs`.

**`pnpm test` fails in `lib/data/prompts.test.ts` or `features/agentops/evals/evals.test.ts`.**
Prompts need exactly one `production` version each and every referenced `p-N` must exist. Evals need a dataset for every `DeployedAgent.evalDataset` and one gate with five rules per agent.

**Tests fail with `ResizeObserver is not defined` or `matchMedia` errors.**
`test/setup.ts` stubs both, and is registered in `vitest.config.ts` as `setupFiles`. If you run Vitest with a different config, include it.

**Tests fail with "useRouter must be used inside a provider".**
`next/navigation` is mocked in `test/setup.ts` with inert `useRouter`, `usePathname`, `useSearchParams`, `useParams`, `redirect` and `notFound`. Import from `next/navigation`, not from a deep path, so the mock applies.
