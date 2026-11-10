# FAQ

Answers come from the code, with file references so you can verify them.

## Data and state

**Why does the data never change?**
Every page reads deterministic sample data from `lib/data/`. Each module seeds its own generator with `createRng(seed)` and every timestamp is computed from a fixed clock, `NOW = 2026-11-05T14:30:00Z` (`lib/data/seed.ts`). The same inputs always produce the same output, which is what keeps server and client renders identical.

**Why do my edits disappear on refresh?**
Approvals, review verdicts, drift acknowledgements, experiment promotions, pauses, created incidents and similar actions are written to module-scoped session stores (`createListStore` in `lib/store.ts`, instances in `features/agentops/stores.ts`, `features/agentops/<feature>/store.ts` and `features/<module>/<module>-store.ts`) and confirmed with a toast. Within the session every table, stat card, tab count and sidebar badge that shows the record moves together, and audit records you cause appear on the Audit Log marked "This session". The stores are in memory only: nothing is written to `lib/data/` or to `localStorage`, so a reload returns to the seed. The intended path is to replace the `patch` / `add` / `remove` call sites with mutations against your API; see [wiring real data](../development/wiring-real-data.md).

**Why did the stat card change when I acted on one row?**
Because the card reads the same store as the table. That is the rule: a count you can change on a page is computed from the client list, not server-rendered once. Deltas on stat cards come from `lib/data/metrics.ts`, not from literals.

**Which things do survive a refresh?**
Five `localStorage` keys: `agentops.readiness.v1` (readiness assessment, snapshots, respondent, imported control set), `agentops:theme` (customizer), `agentops:assistant` (panel open state and tab), `agentops:ai-settings` (assistant settings) and `theme` (light, dark, system), plus the `sidebar_state` cookie. Nothing else; session stores are not persisted.

**Where is state stored?**
In the browser. There is no database and no server-side session. The server does one outbound fetch, to OpenRouter, and caches it in Next's data cache for an hour.

**Why does "2 hours ago" never advance?**
`timeAgo()` in `lib/format.ts` is relative to `NOW`, not to the wall clock, and every module reads the time through `clock()` in `lib/data/seed.ts`. This is deliberate so that server-rendered and client-rendered text match. When you connect real data, change `clock()` to return the wall clock, or pass the real base time into `timeAgo(iso, base)` from a client-only component. Never call `new Date()` or `Date.now()` in render.

**Can I change the sample workspace or owner?**
`siteConfig.workspace` in `config/site.ts` is "Acme Corp". Users live in `lib/data/users.ts`; `u-001` is Kevin Dargas, the platform owner. Many records reference owner ids, so keep ids stable if you rename people.

## Connecting real systems

**How do I connect real telemetry?**
Replace `lib/data/agentops.ts` with a client that returns `DeployedAgent[]`, `AgentTrace[]` (with `TraceSpan[]`, `lineage`, `outcome`), `ReviewItem[]`, `DriftSignal[]`, `Experiment[]`, `ModelRecommendation[]` and `SemanticEntity[]` from `lib/types.ts`. Server components `await` the data; tables accept any array of the right type. The span shape maps directly onto OpenTelemetry GenAI attributes.

**How do I plug in a real assistant backend?**
`planResponse` in `lib/ai/assistant.ts` returns an `AssistantRun` made of steps (reasoning, tool, text, sources, actions, suggestions). Replace it with a call to your agent API that streams the same step shapes and the panel, insights cards and approval queue keep working.

**Why is the Model Catalog empty?**
`/ai/models` fetches `https://openrouter.ai/api/v1/models` server-side. If the machine running the server has no egress, the fetch fails and `lib/ai/openrouter.ts` returns `{ models: [], error }`, which renders the empty state. Check the network from the server, not the browser. The response is cached for one hour, so a temporary failure can persist until the next revalidation.

**Does the Model Catalog need an API key?**
No. The models endpoint is public and keyless. Pricing is normalised to USD per million tokens; negative prices (router models) become "Varies".

## Users, access and sharing

**How do I add a user?**
There is no create-user form. Add an entry to `users` in `lib/data/users.ts` with a unique `u-` id, then reference it from agents, budgets or keys by `ownerId`. Groups are in the same file.

**Is there authentication?**
No. The app has no login, roles or middleware. Put it behind your own identity layer before exposing it beyond a trusted network.

**How do share links work?**
Readiness share links encode the whole assessment as base64url JSON in the URL fragment after `#s=` (`lib/readiness/codec.ts`). The fragment never reaches a server. Anyone with the link can read every answer, owner and note, so treat the link as the data itself. `readShareHash` validates the payload and rejects malformed input.

**How do I reset the readiness assessment?**
Open Readiness Assessment, Share tab, Privacy & data section, and use the reset action. It calls `readinessActions.reset()`, which clears the store and removes `agentops.readiness.v1`. Alternatively clear site data in the browser.

**Can several people fill in one assessment?**
Yes, in team mode. Each respondent sets a name and votes per control; `consensusStatus` takes the majority and resolves ties to the lower status; `voteSpread` highlights disagreement. Votes travel with the share link.

## Appearance

**How do I change the brand colors?**
Tokens are in `app/globals.css`. `--brand` and `--brand-foreground` are set in `:root` and `.dark`; the accent presets override `--primary`, `--brand`, `--ring`, `--sidebar-primary` and `--chart-1` under `[data-accent="..."]`. To add a permanent brand, change the `:root` and `.dark` values. To add a selectable accent, add an entry to `accents` in `lib/theme-presets.ts` and the matching CSS block. See [theming](../development/theming.md).

**Why does the theme flash or not flash?**
`themeInitScript` in `lib/theme-presets.ts` is inlined in `<head>` and applies the persisted `data-accent|radius|density|surface` attributes before first paint. Light and dark are handled by `next-themes` with `attribute="class"` and `suppressHydrationWarning` on `<html>`.

**What does the D key do?**
Toggles dark mode (handled with the other single-key shortcuts in `components/layout/command-menu.tsx`) unless focus is in an input, textarea, select, dialog, sheet, the assistant panel or the command palette, or a page handler has already claimed the key with `event.preventDefault()`.

## Scope

**Why is there no CMDB or inventory page?**
The product is the agent operations layer. Systems and business services still exist as data in `lib/data/cmdb.ts` because incidents, changes, alerts and service health reference them by `ciId`, but there is deliberately no `/cmdb/...` route. Do not add links to one. HR cases, asset management, discovery and cloud pages were removed for the same reason.

**What is the difference between Workflow Automations and Agents?**
Agents (`/agentops/agents`) are the production agents you operate: traces, drift, evals, releases. Workflow Automations (`/ai`) are internal helper agents that act on records inside this console (triage, cost guardian, prompt hygiene) with autonomy levels and an approval queue. They are defined in `lib/ai/agents.ts`.

**Where do the sidebar badge numbers come from?**
Each `NavItem.badge` in `config/nav.ts` is a key (`approvals`, `reviews`, `recommendations`, `alerts`, `proposals`), not a number. `getNavCounts()` in `config/nav-counts.ts` resolves the keys on the server from the same selectors the target pages use (pending reviews, New recommendations, alerts that are not Closed, approvals inbox, workflow proposals) and `app/(app)/layout.tsx` passes them to the sidebar. In the sample that is 6, 36, 4, 6 and 17. When you wire data, point the selectors at your API; `config/nav.test.ts` checks every key has a count.

**Can I link straight to a sheet, a tab or a filtered list?**
Yes. Every sheet, tab and saved view has a query parameter with a reader: `?tab=`, `?tool=`, `?server=`, `?policy=`, `?byPolicy=`, `?kb=`, `?mem=`, `?entity=`, `?event=`, `?q=`, `?run=`, `?dataset=`, `?open=`, `?rec=`, `?agent=`, `?pv=`, `?version=`, `?item=`, `?key=`, `?rule=`, `?budget=`, `?schedule=`, `?trigger=`, `?alert=`, `?new=1`, `?view=`. The full table is in [conventions](../development/conventions.md). Pages write these with `history.replaceState` so opening a sheet does not reload the page; the URL in the address bar is always shareable.

**Why did a shortcut key not fire?**
Single keys (`C`, `D`, `G` then a letter) are ignored while you type, while a dialog, sheet, menu, the command palette or the assistant panel has focus, when a modifier is held, and when the page has claimed the key (`event.preventDefault()`). The Review Queue claims `A`, `F`, `C`, `S`, `1` to `5`, `Enter` and `Esc`, so `C` there corrects a run instead of opening quick create. `Cmd/Ctrl K`, `Cmd/Ctrl ,`, `Cmd/Ctrl B` and `Cmd/Ctrl J` always work. Requests is `G Q`; Review Queue is `G R`.

**Did the toast actually do what it says?**
Yes. Every toast describes something that happened in local state, a real file download (`Blob`) or a clipboard write. There is no toast that claims a send, export or audit entry that did not occur. If a toast says a record was appended to the audit log, the Audit Log shows it with a "This session" badge and "Verify chain" still passes.

## Operations

**What does the kill switch actually do here?**
In the sample app it opens a confirmation dialog, flips local state and shows the confirmation copy from `fleet-overview.tsx`. In a real deployment it should set `FleetControls.killSwitch` on your control plane; the UI already describes the intended semantics: no new runs, in-flight runs finish, schedules and triggers skipped, users see a maintenance message, event written to the audit log.

**How are release gates computed?**
`buildGates` in `lib/data/evals.ts` builds one gate per agent from the latest finished run on the agent's golden dataset and the PII probe dataset: composite at or above 85 (`GATE_THRESHOLD` in `lib/data/deployments.ts`), zero regressions, 100 percent PII pass, p95 within the agent's latency budget and cost per case within its cost budget. Production agents have gates enforced. A release snapshots its gate as `evalGate` with a `reason` when it failed (Knowledge Curator's `rel-1033`: score 87, "1 regression on kb-draft-v4"); Draft releases have no gate yet.

**What breaks the audit chain?**
Changing any of `id`, `at`, `action`, `target.id` or `summary` on an event, or reordering events. `verifyAuditChain` recomputes `auditDigest(prevHash, event)` for each event and stops at the first mismatch. Records appended in the browser through `auditStore.append` use the same digest and chain onto the last seeded hash, so "Verify chain" passes over seed plus session; they carry a "This session" badge and are gone on reload.

**Which colours may a chart use?**
`var(--chart-1)` to `var(--chart-8)` from `app/globals.css`, through the wrappers in `components/charts/`. Six to eight were added for the readiness domains and multi-series charts; do not cycle past eight and never use palette classes such as `text-red-500`. See [theming](../development/theming.md).

**When does the CAB meet?**
Thursday 09:00 UTC, from `cabSchedule` in `lib/constants.ts`; `nextCab()` in `lib/data/itsm.ts` computes the next slot and every piece of copy that mentions it interpolates the same constant.

**Why does a schedule show a different next run than I expect?**
`nextRun` in `lib/data/schedules.ts` computes from the demo clock, honours the schedule's fixed timezone offset and skips freeze windows where the scope applies. Check the calendar view for the active freeze.

**Where do I see which version of an agent is in which environment?**
Deployments, environments matrix. Each cell is an `EnvironmentState` with version, model, prompt version and the release that put it there.
