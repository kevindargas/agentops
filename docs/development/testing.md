# Testing

Unit tests run with Vitest in jsdom. `pnpm test` runs them once; `pnpm test:watch` keeps them running. The suite is 27 files and 246 tests (`find . -name "*.test.ts*" -not -path "./node_modules/*"`); it finishes in about a minute.

## Configuration

`vitest.config.ts`:

- plugins: `@vitejs/plugin-react` and `vite-tsconfig-paths` (so `@/` imports resolve)
- `environment: "jsdom"`, `globals: true`
- `setupFiles: ["./test/setup.ts"]`
- `include: ["**/*.test.{ts,tsx}"]`, excluding `node_modules` and `.next`
- `css: false`

`test/setup.ts`:

- imports `@testing-library/jest-dom/vitest` matchers and calls `cleanup()` after each test
- stubs `ResizeObserver` and `window.matchMedia`, which Base UI and Recharts touch on mount and jsdom lacks
- mocks `next/navigation` with inert `useRouter` (push, replace, prefetch, back, refresh as `vi.fn()`), `usePathname` returning `/`, `useSearchParams` returning an empty `URLSearchParams`, `useParams` returning `{}`, and `redirect` and `notFound` as `vi.fn()`

## What the suite covers

### Shell, navigation and tooling

| File | Protects |
| --- | --- |
| `config/nav.test.ts` | Every `G` chord has a unique second key (so no page shadows another), `G R` is the Review Queue and `G Q` is Requests, no href is reused except the "All ..." child of a parent, every nav and quick-create href has a `page.tsx` on disk, every `NavBadgeKey` resolves to a live count in `getNavCounts()`, `findNavItem` and `findNavGroup` resolve a page href |
| `scripts/warm.test.ts` | The warm route list derived from `app/(app)/**/page.tsx`: every static route maps to a page, every dynamic segment has a `SAMPLE_IDS` entry, every sample id exists in the data modules, static routes are warmed before record routes |
| `components/data-table/data-table.test.tsx` | `DataTable` renders rows and the total label, filters by search text, accepts multi-valued facets, shows an empty state |
| `components/shared/status-badge.test.tsx` | `StateBadge` renders tone classes and falls back to neutral for unknown states; `PriorityBadge` labels |
| `lib/format.test.ts` | `timeAgo` is relative to the fixed demo clock; compact numbers, percentages, deltas, bytes |

### Data layer

| File | Protects |
| --- | --- |
| `lib/data/barrel.test.ts` | `lib/data/index.ts` re-exports every named export of every module and resolves the pinned name collisions to the intended module |
| `test/data-barrel.test.ts` | The barrel sees every module file under `lib/data` and exposes every export of each |
| `lib/data/integrity.test.ts` | Cross-reference integrity: every id-like field in every module resolves, ids are unique per registry, audit targets and notification links resolve; relationship symmetry (problem incident counts derive from incidents, tools both ways, semantic usage from allowlists, prompts to in-scope guardrails, eval runs and releases on the agent's own prompt, gates on finished runs of the same agent, traces, reviews, violations and scheduled runs on one agent, retrieval only from granted knowledge bases, real users as readiness respondents and voters, the platform owner's identity); numeric coherence (one spend-today figure everywhere, key spend inside fleet spend, one savings figure per recommendation, drift severity matches the attention list, disconnected providers are never primary); every facet value is produced, no record is dated after the frozen clock, the agent configuration surface derives from real records, the CAB falls on the configured weekday |
| `lib/data/counts.test.ts` | Count helpers (`pendingReviewCount`, `openRecommendationCount`, `openDriftCount`, `budgetsAtRiskCount`, `pendingReleaseApprovalCount`, `openAlertCount`, `unacknowledgedAlertCount`, `pendingApprovalCount`, `unreadNotificationCount`, `expiringKeyCount`) match the selectors the pages use and accept an explicit list for optimistic recounts; `compareWindows`, `countInWindows`, `sumInWindows`, `openCountDelta` and the service-management deltas in `lib/data/metrics.ts` |
| `lib/data/playground.test.ts` | Variable extraction, config round-trip through search params, fallback for bad params, `diffParams`, deterministic `simulateRun`, response to parameter changes, ops config for every agent |
| `lib/data/prompts.test.ts` | Unique prompt and version ids, every referenced version resolves, exactly one production version per prompt with documented variables, determinism, variable extraction |
| `lib/data/schedules.test.ts` | `describeCron` fallback, `nextRun` across daily, minute steps, strict ordering, fixed timezone offsets and month rollover, `occurrences` in a window, well-formed deterministic data |
| `lib/readiness/readiness.test.ts` | Default control set: six domains, unique well-formed ids, references only catalogued tools, metrics, snippets and framework items, every failure mode maps to real controls, every OWASP item has a control. Applicability and stage filters. Scoring: mid-maturity sample with blockers and gaps, gap ordering, blocker rule, 100 and optimized when all verified, maturity thresholds, review due dates, real owners, determinism. Team votes. Codec: share round-trip, malformed input, CSV and Markdown export, diff |

### Feature data and client stores

| File | Protects |
| --- | --- |
| `features/agentops/audit/audit-data.test.ts` | 140 chronologically ordered events with unique ids, every source and both derived and seeded actors covered, every target href resolves to an existing route, the hash chain verifies and tampering is detected, legal-hold events are pinned |
| `features/agentops/audit/audit-store.test.ts` | The client audit store appends hash-chained records that keep `verifyAuditChain` green over seed plus session records; `auditLink` builds the filtered `?source=&q=` link |
| `features/agentops/deployments/deployments-data.test.ts` | Every release resolves to a real agent, author and approvers; every eval gate points at an existing run of the same agent; only Draft releases lack a gate; prompt changes resolve to the agent's own versions; approvals derive from pending releases and keep the gate `reason` |
| `features/agentops/evals/evals.test.ts` | A dataset for every agent's golden set, 30 to 50 runs with unique `ev-` ids and resolvable references, lazy cases matching counts, no cases for in-flight runs, one gate per agent with five rules |
| `features/agentops/guardrails/guardrails.test.ts` | 14 to 20 policies with unique ids and real owners, violations link to real traces, agents and policies, determinism, coverage scoring and gaps; `evaluateGuardrails` redacts PII, blocks injection, respects scope and status, passes clean text |
| `features/agentops/guardrails/store.test.ts` | One false-positive definition for the fleet and per policy (`falsePositiveRate`, `fpTone`); `computeGuardrailStats` recomputes the fleet cards from the client `policyStore` and `violationStore` |
| `features/agentops/knowledge/knowledge.test.ts` | Sources and jobs link to real knowledge bases, low-recall queries point at real traces of the same agent, unique ids; `searchKnowledgeBase` is deterministic, ranks the matching chunk first, respects top-k, returns nothing for stopword-only queries |
| `features/agentops/prompts/diff.test.ts` | Line diff: equal ops, insertions with line numbers, removals and replacements, empty sides, order preserved; side-by-side pairing |
| `features/agentops/prompts/prompt-store.test.ts` | The prompt store starts from the seed and resolves every agent's prompt; `createVersion` allocates a globally unique next `p-N`; promotion approves one version and archives the previous production; `createPrompt` registers a unique id with a first draft; penalty params diff and round-trip through the share link |
| `features/agentops/tools/tools-data.test.ts` | Unique tool names and server ids, every agent tool string registered, the `search_cmdb` alias points at `search_services`, MCP tools link to known servers both ways, well-formed metrics, one permission per agent x risk |
| `features/agentops/tools/safety-ui.test.tsx` | Identity derived from risk with short delegated tokens; MCP digests, reviewers and planted findings; security policies linked to a red-team run; the tool and server sheets render side-effect, identity, effectiveness and integrity sections and warn about uncontained HTML |

### AI layer

| File | Protects |
| --- | --- |
| `lib/ai/assistant.test.ts` | `contextFromPathname` detects every record type; `planResponse` answers every starter prompt without the generic fallback, answers workspace and agent-ops starters from any page, always ends with a text step and follow-ups, falls back to record search for unknown prompts; every agentic template produces a real answer in a context it applies to and fills the record number |
| `lib/ai/guardrails.test.ts` | `redactPii` masks e-mail, IBAN and phone numbers and counts them, leaves ordinary prompts alone; `toolCategoryFor` maps every scripted tool name onto a catalog id; workflow proposals only name prompt versions that belong to the agent they talk about |
| `lib/ai/openrouter.test.ts` | `normalizeModel`: per-token to per-million prices, capability derivation, negative router prices become variable not free, free models and variant suffixes, mandatory reasoning; price and context formatters; vendor slug to logo and label |

## Adding tests

- Put the file next to the code as `<name>.test.ts` or `<name>.test.tsx`.
- Data modules: test determinism by importing twice or comparing with a snapshot of ids, test referential integrity (every `agentId`, `ownerId`, `traceId` resolves) and any pure function you export. `lib/data/integrity.test.ts` already walks every id-like field, so a new module mostly needs its own invariants.
- New exports from a `lib/data` module must be reachable through the barrel or `lib/data/barrel.test.ts` fails; if two modules export the same name, pin the winner in the test's collision list.
- New count helpers go into `lib/data/counts.test.ts` with the page selector they must match.
- Client stores: test the factory functions (`createVersion`, `queueTraceForReview`, `auditStore.append`) against the seed, not the React components. Call `store.reset()` in `beforeEach`.
- Components: render with Testing Library, query by role or text, and assert classes only when the class is the behaviour (tones). `next/navigation` is already mocked; if a component needs a specific pathname, `vi.mock` it again in the test file.
- Navigation: a new nav entry needs a `page.tsx`, a unique chord letter (if any) and, for a badge, a `NavBadgeKey` with a line in `getNavCounts()`. A new dynamic route needs a `SAMPLE_IDS` entry in `scripts/warm-routes.mjs`.
- Assistant: if you add a starter prompt or an agentic template, add the `planResponse` branch in the same change or the suite fails.
- Readiness: adding a control requires catalog entries for every referenced tool, metric and snippet, and the sample in `lib/data/readiness.ts` must still produce blockers and gaps.
- Audit: never hand-write `hash` or `prevHash`; build seed events through `build()` and session events through `auditStore.append` so the chain is recomputed.

## Running a subset

```bash
pnpm vitest run lib/readiness
pnpm vitest run features/agentops/audit
pnpm vitest run config scripts
pnpm vitest run -t "release gate"
```
