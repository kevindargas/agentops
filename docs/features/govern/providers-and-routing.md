# Providers & Routing

Providers & Routing is the gateway layer between deployed agents and model vendors. It shows which provider connections are healthy, which credentials exist and when they expire, how requests are routed (primary target, fallbacks, weights, region pins) and which quotas keep one agent from starving the rest. It is the page you open when a provider is degraded, when a key is about to expire, or when you want to know what happens to an agent's traffic if its primary model fails.

Used by the platform operator (health, incidents, fallbacks), the security owner (key inventory and rotation) and the people who tune routing and quotas per agent.

## Where to find it

- Route: `/agentops/providers`
- Nav: Govern group, "Providers & Routing"; the page header reads the same title and the Govern eyebrow from `config/nav.ts`
- Tabs sync to `?tab=`: `providers` (default), `keys`, `routing`, `limits`. Switching tabs writes the parameter back with `history.replaceState`, so local changes (a rotated key, a paused rule) survive
- Deep links: `?key=<id>` opens the key detail sheet on the Keys tab, `?rule=<id>` opens the rule sheet on the Routing tab. Closing a sheet clears its parameter
- Header action: "Costs & Budgets" button, links to `/agentops/costs`
- Record ids: providers `prv-…`, keys `key-001` to `key-016`, routing rules `rt-001` to `rt-008`, rate limits `rl-…`, vendor incidents `inc-prv-…`

## What is on the page

### Stat cards

The four cards and the tab counts are rendered client-side from the same stores the tabs mutate (`features/agentops/providers/store.ts`), so disabling a provider, revoking a key or pausing a rule moves the numbers immediately.

| Card                   | Value                                                                                           | Hint / link                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Connections            | Providers with status Connected, out of the total (9 in the sample)                             | "All providers healthy" or the names of providers that are Degraded or Disconnected. Links to `?tab=providers`                                 |
| Gateway requests · 24h | Sum of `requests24h` across providers                                                           | Spend today summed over each provider's `spendToday`, which `lib/data/providers.ts` derives from `spendTodayByProvider` in `lib/data/costs.ts` |
| Fallback hits · 24h    | Sum of `fallbackHits24h` across routing rules                                                   | Count of Active rules. Links to `?tab=routing`                                                                                                 |
| Keys expiring < 14d    | `expiringKeyCount(14, keys)`: non-revoked keys whose expiry is within 14 days of the demo clock | Key names, or "No credentials due for rotation". Links to `?tab=keys`                                                                          |

Tab labels carry count pills: all providers, keys that are not Revoked, Active routing rules, all quotas.

### Providers tab

**Vendor status.** A section headed "Vendor status" with a count pill of open incidents, every provider as a small logo with a status dot, a one-line summary ("All providers operational" or "N of M connections impaired"), and the vendor incident list. Each incident row shows the provider, title, how long ago it started and a badge: Investigating (red, pulsing), Monitoring (amber) or Resolved (muted). Severity `major` gets a red warning icon, `minor` an amber one. Sample incidents: Google Vertex AI elevated latency and 5xx (Investigating, major), vLLM cluster health check failing (Investigating, major), OpenAI intermittent 429s (Monitoring, minor), Anthropic eu-west-1 maintenance (Resolved).

**Provider cards.** One card per provider:

- Logo, name, primary region and credential type (API key, Service account, IAM role, Managed identity, mTLS certificate), status badge (Connected, Degraded with pulse, Disconnected). Disconnected cards get a red border.
- Metrics: Models (enabled count), Requests · 24h, Error rate (red at 5% or more, amber at 2% or more), p95 latency.
- 14-day p95 latency sparkline, coloured by status, and a Spend today tile.
- Up to three enabled model chips plus a "+N" badge.
- "Checked <time ago>" from `lastHealthCheck`, and buttons Test, Configure, and an enable/disable power toggle.
- Each card carries the provider id as its anchor (`#prv-anthropic`). Provider chips in the keys table, the quotas table and routing chains link to `?tab=providers#<prv-id>`, so a key or a rule can hop to its connection.

**Test.** The button spins for a moment, then toasts "<name> reachable (simulated)" with the provider's fixed `testLatencyMs` and model count, or "<name>: connection failed (simulated)" for a Disconnected provider. It stamps `lastHealthCheck` with the demo clock. No request leaves the browser.

**Configure sheet.** Base URL, Organisation / project id, Default headers (one `Header: value` per line), Regions (multi-select toggle of the provider's known regions), Enabled models (checkbox list of `availableModels`). Save is disabled when no model or no region is selected. Saving patches local state and toasts the model and region counts.

**Disable dialog.** Confirms that in-flight requests finish, new requests skip the provider, routing rules fall through to the next target, and keys stay valid. Confirming sets status to Disconnected in local state; the toast explains that every routing target on the provider now fails over and offers Undo for eight seconds. Enabling a Disconnected provider sets it back to Connected with the toast "Routing rules that reference it resume."

### API Keys tab

Data table, default sort Spend · month descending. Clicking a row opens the key detail sheet (`?key=<id>`). Column headers for Scopes, Expires and Spend · month carry a hint tooltip.

| Column        | Content                                                                                                                                                                              | Visible by default |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Key           | Name with the masked key underneath (`sk-ant-…7f3a` style)                                                                                                                           | Yes                |
| Provider      | Provider chip                                                                                                                                                                        | Yes                |
| Owner         | User chip                                                                                                                                                                            | Yes                |
| Scopes        | First two scopes as monospace badges plus "+N" with the rest on hover                                                                                                                | Yes                |
| Env           | production or staging badge                                                                                                                                                          | Yes                |
| Created       | Absolute date                                                                                                                                                                        | No                 |
| Last used     | Relative time or empty                                                                                                                                                               | Yes                |
| Expires       | Date. Red with a shield icon when already past, amber when under 14 days away, "Never" when `expires` is null. Revoked keys show the revocation date plainly                         | Yes                |
| Spend · month | USD, muted when zero                                                                                                                                                                 | Yes                |
| Status        | Active, Expiring (amber), Rotating (pulsing), Revoked (muted)                                                                                                                        | Yes                |
| Actions       | Row menu: Details and dependents, Rotate (disabled when Revoked or Rotating), Copy key id, Audit history (links to `/agentops/audit?source=api-key`), Revoke (disabled when Revoked) | Yes                |

Facets: Provider, Environment (Production, Staging), Status (Active, Expiring, Rotating, Revoked). Search matches name, masked key, scopes and provider name.

**Key detail sheet.** Status and environment badges, the key id, name and masked value; a detail list (Provider, Owner, Scopes, Created, Last used, Expires or "Grace period ends" for a Rotating key, Spend · 30d, and the last change note if a reason was entered); "Routing rules on this provider" (every rule whose chain targets the key's provider, with status and matched agents, linking to `?tab=routing&rule=<id>`); "Quotas scoped to this key" (rate limits with `scope === "key"`, linking to `?tab=limits`). Footer: Revoke (left), Audit history, Rotate.

**Create key sheet.** Name (lowercase, hyphenated; minimum 3 characters), Provider, Environment (Staging default, or Production), Scopes (messages, responses, chat.completions, embeddings, batches, files, rerank, models.read; at least one), Expires (30, 90, 180 days, 1 year, Never; default 90). The helper text says keys older than 90 days are flagged by the security review. Creating adds the key to the top of the table with the current user as owner (Kevin Dargas) and opens a "Key created" dialog that shows the full secret once with a copy button. The secret is a deterministic fake derived from the name and provider, prefixed `sk-ant-api03-`, `sk-proj-`, `sk-or-v1-` or `key-`.

**Rotate dialog.** "A replacement key is issued now and shown once. The current key keeps working for 24 hours so deployments can roll over without downtime." plus an optional Reason field. Confirming issues a replacement key (same name, provider, scopes, environment and owner; a new deterministic secret derived from a per-session rotation counter) at the top of the table with status Active, and marks the old key Rotating with its expiry set to the end of the grace period (`keyRotationGraceHours`, 24 hours after the demo clock). A "Key rotated" dialog shows the new secret once with a copy button and names the masked previous key and the exact time it stops working. The reason is kept in local state and shown in both keys' detail sheets.

**Revoke dialog.** "Requests signed with this key are rejected from now on. Agents that depend on it fall back to the next routing target or fail." plus the optional Reason field. Confirming sets status to Revoked and the expiry to the demo clock; the toast offers Undo for eight seconds, which restores the previous status and expiry.

**Copy key id** awaits the clipboard write and toasts the id, or toasts an error pointing at the detail sheet when the clipboard is unavailable.

### Routing tab

Two columns: a "Routing rules" section (count pill of Active rules, description "N active rules · M fallbacks in the last 24h", New rule button) on the left, the request simulator on the right (sticky on wide screens).

**New rule sheet.** Name, Description (optional, defaults to the strategy explanation), Matched agent (one agent or "Any agent without an explicit rule"), Strategy (the five strategies with their one-line explanation), a Primary provider and model (models come from the provider's `enabledModels`), an optional Fallback target, Fallback conditions (`on 429`, `on 5xx`, `on timeout`, `on cost over budget`), Request timeout (ms) and Retries per target. Save draft adds the rule with status Draft, 0% traffic share and no fallback hits; Weighted rules get 70/30 weights and Region-pinned rules pin each target to its provider's primary region. The new rule's sheet opens so the gateway config can be reviewed.

**Rule card.** Strategy in uppercase (Priority fallback, Weighted, Lowest latency, Lowest cost, Region-pinned), traffic share percentage, last updated, rule name (click opens the sheet), status badge (Active, Paused, Draft). Below it the model chain: ordered targets as model chip plus provider chip, with weight ("· 40%") for weighted rules and region ("· eu-west-1") for region-pinned rules; the first target is highlighted as primary. Then the matched agents ("all unmatched" for the catch-all) and the fallback conditions as monospace badges (`on 429`, `on 5xx`, `on timeout > 20s`, `on cost over budget`). Footer: fallback hits in 24h, Details button, and Pause/Activate (not shown for Draft rules).

**Rule sheet** (`?rule=<id>`). Status, strategy, traffic share and id in the header; description; the full model chain with a one-line explanation of the strategy; a detail list with Matched agents, Fallback conditions, Request timeout, Retries per target, Fallback hits · 24h, Updated; "Keys this chain signs with" (non-revoked keys on the chain's providers, linking to `?tab=keys&key=<id>`, or an empty state asking for a key before activation); and a "Gateway config" block: the rule rendered as Portkey-style JSON by `routingRuleConfig` with a Copy JSON button. The footer carries Pause rule / Activate rule for non-draft rules. The JSON contains `match.agents`, `strategy.mode` (`fallback`, `loadbalance`, `least-latency`, `least-cost`), `on_status_codes`, `on_timeout` / `request_timeout_ms`, `on_budget_exceeded`, `retry`, and `targets` with `provider`, `override_params.model`, optional `weight` (0 to 1) and `region`.

**Simulate request panel.** Pick an agent; the panel resolves the rule that would match (an Active rule listing the agent, else any rule listing it, else the catch-all) and says so, including "(paused)" or "(draft)" when the rule is not active, then quotes the rule's strategy and its explanation. The simulation honours the strategy by ordering the chain the way the gateway would try it (`orderedChain` in `routing-rules.tsx`): Priority fallback and Region-pinned keep the authored order, Weighted tries the heaviest weight first, Lowest latency sorts by the provider's p95, Lowest cost sorts by the model's input plus output price per million tokens from `lib/data/costs.ts`; when the order differs from the card, the panel says so. Two switches, Fail first target (on by default) and Fail second target (disabled when the chain has fewer than two targets), refer to that order. The result is the list of attempted targets with a red or green marker, model, provider, weight or region when present, simulated latency and the failure reason ("provider disconnected", "429 rate limited", "503 upstream error", "timeout"), followed by "Served by <model> after N fallbacks · total <latency>" or "All targets failed: the request returns 503 to the agent." Targets on a Disconnected provider fail automatically.

### Rate Limits tab

Data table of quotas, default sort by RPM utilisation descending. Rows open an edit sheet. Scope, Requests / min, Tokens / min, Concurrency, Burst and Throttled · 24h headers carry hint tooltips.

| Column          | Content                                                                |
| --------------- | ---------------------------------------------------------------------- |
| Scope           | Target name with the scope type underneath: Agent, Provider or API key |
| Provider        | Provider chip                                                          |
| Requests / min  | Utilisation bar "used / limit" with a percentage                       |
| Tokens / min    | Utilisation bar                                                        |
| Concurrency     | Utilisation bar                                                        |
| Burst           | Extra requests allowed above RPM, shown as "+N"                        |
| Throttled · 24h | Count. Red and bold at 100 or more, amber above zero, muted at zero    |
| Updated         | Relative time                                                          |

Facets: Scope (Agent, Provider, API key), Provider, Pressure (Saturated 95% or more, High 80 to 95%, Normal). Pressure is the higher of RPM and TPM utilisation.

**New quota sheet.** Scope (Agent, Provider, API key), the target (agents from the fleet, providers, or non-revoked keys from the keys store), the provider to count against for agent quotas (key quotas inherit the key's provider), then the same four limits as the edit sheet with defaults 600 RPM, 400K TPM, 16 concurrent, +50 burst. Create adds the quota to the top of the table with zero usage.

**Edit quota sheet.** Shows the three current utilisation bars, then inputs for Requests per minute, Tokens per minute, Max concurrency and Burst allowance ("Extra requests allowed above the RPM limit for up to 10 seconds"). The description says changes apply within one minute. Save requires all four values to be finite and non-negative; it patches local state, clamps the used values to the new limits, and toasts.

## What to check

### Every day

- Connections card. Anything other than "All providers healthy" names the impaired providers. Open the Providers tab, read the vendor incident strip, and press Test on the card to confirm whether the gateway can still reach it. A Disconnected provider fails every target that uses it in every routing chain.
- Vendor status strip. Investigating incidents with severity major on a provider that is the primary target of an Active rule mean agents are living on their fallbacks right now. Cross-check with Fallback hits · 24h.
- Error rate on provider cards. Red (5% or more) on a Connected provider is a provider that should be Degraded or paused in routing. Amber (2% to 5%) warrants watching the p95 sparkline for a spike.
- Fallback hits · 24h. A jump against the previous day means a primary is failing. Open the Routing tab, find the rule with the highest hits, and run the simulator with Fail primary on to see where the traffic lands and at what latency. Make sure the landing target has quota headroom on the Rate Limits tab.
- Keys expiring < 14d. Rotate anything listed. Rotation keeps the old key valid for 24 hours (`keyRotationGraceHours`), so there is no reason to wait for the last day.
- Rate Limits, Pressure facet = Saturated. Any quota at 95% or more will throttle within the hour. Either raise the limit (Edit quota) or move traffic with a routing weight. Throttled · 24h in red (100 or more) means it already happened.

### Every week

- Keys with Last used empty or older than a month. Unused production keys are attack surface; revoke them.
- Keys with Expires = Never on production. Give them a 90 or 180 day expiry, or at least confirm the owner is still on the team.
- Keys in Rotating past their "Grace period ends" time. The 24 hour overlap is over; the old key is dead, so if anything still depends on it you would know by now. The replacement key is the Active row with the same name.
- Routing rules with status Draft or Paused. The sample "Default · catch-all" rule is Paused, which means an agent without an explicit rule has no fallback path. Decide whether that is intended.
- Weighted rules against commitments. The savings opportunity "Shift IT Helpdesk weights toward the Azure commitment" on Costs & Budgets is a routing change you make here.
- Provider cards, Models count versus `availableModels` in Configure. Models enabled but not referenced by any routing chain are dead configuration.
- Rate Limits, Pressure = High (80 to 95%) with Throttled · 24h above zero. Trend, not emergency; plan the quota increase before it becomes Saturated.

### Before a release or model change

- Run the simulator for every agent touched by the release with both Fail primary and Fail secondary on. Confirm the request is still served and the total latency is acceptable. "All targets failed" means the chain needs another target before go-live.
- Check the chain's fallback model is actually enabled on its provider (Configure sheet, Enabled models). The simulator does not check this; the gateway config does.
- Confirm the new model exists in the chain's `override_params.model` and that the provider's Regions include the pinned region for Region-pinned rules (the "Policy Answers · EU region pinned" rule, for instance, must stay inside EU regions).
- Check the agent-scoped and key-scoped quotas for the agents being changed. A model with a longer system prompt pushes Tokens / min up before Requests / min moves.
- Copy the Gateway config JSON of each affected rule into the release notes so the before/after routing is on record. Audit Log tracks key and budget mutations; routing JSON is the artefact you keep for routing.

## Actions

| Action                    | Where                        | What happens in this template                                                                                                                                                     |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test connection           | Provider card                | Spinner, then a toast marked "(simulated)" with round-trip latency and model count, or a failure toast for Disconnected providers. Updates `lastHealthCheck` in local state       |
| Configure provider        | Provider card                | Opens the sheet; Save patches local state and toasts                                                                                                                              |
| Disable / enable provider | Power icon on the card       | Disable asks for confirmation then sets Disconnected with an Undo toast; enable sets Connected. Local state only                                                                  |
| Create key                | API Keys toolbar             | Adds the key to local state and shows the one-time secret dialog                                                                                                                  |
| Open key details          | Row click, row menu, `?key=` | Opens the detail sheet with dependents                                                                                                                                            |
| Rotate key                | Row menu, key sheet          | Confirmation with optional reason, then a replacement Active key is added, the old key turns Rotating until the end of the 24 hour grace period, and the new secret is shown once |
| Revoke key                | Row menu, key sheet          | Confirmation with optional reason, then status Revoked with expiry = now; Undo toast restores it                                                                                  |
| Copy key id               | Row menu                     | Awaits the clipboard write, toasts the id or an error                                                                                                                             |
| Audit history             | Row menu, key sheet          | Links to `/agentops/audit?source=api-key`                                                                                                                                         |
| New rule                  | Routing section              | Opens the sheet; Save draft adds a Draft rule and opens its sheet                                                                                                                 |
| Pause / activate rule     | Rule card, rule sheet        | Toggles status in local state, toast with Undo                                                                                                                                    |
| Copy JSON                 | Rule sheet                   | Copies the gateway config                                                                                                                                                         |
| Simulate request          | Routing tab side panel       | Pure client-side computation (`orderedChain` then `simulateRoute`)                                                                                                                |
| New quota                 | Rate Limits toolbar          | Opens the sheet; Create adds the quota to local state and toasts                                                                                                                  |
| Edit quota                | Rate Limits row              | Opens the sheet; Save patches local state and toasts                                                                                                                              |

All mutations are in-memory and reset on reload. Nothing on this page writes an audit event; the `api-key` events on the Audit Log are sample data.

## Reading the data

### Provider status

| Status       | Meaning                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Connected    | Healthy; eligible for every routing chain that references it                                                      |
| Degraded     | Reachable but impaired (elevated error rate or latency). Badge pulses. Still used by routing                      |
| Disconnected | Not reachable or manually disabled. Every chain target on this provider fails in the simulator and in the gateway |

### Key status

| Status   | Meaning                                        |
| -------- | ---------------------------------------------- |
| Active   | In use                                         |
| Expiring | Expiry within the warning window; rotate       |
| Rotating | Replacement issued, old key valid for 24 hours |
| Revoked  | Rejected by the gateway; kept for audit        |

### Routing status and strategy

| Status | Meaning                                                                              |
| ------ | ------------------------------------------------------------------------------------ |
| Active | Applied to the gateway                                                               |
| Paused | Defined but not applied; traffic for its agents falls to whichever rule matches next |
| Draft  | Never applied; cannot be toggled from the card                                       |

| Strategy          | Gateway mode                            | Behaviour                                            |
| ----------------- | --------------------------------------- | ---------------------------------------------------- |
| Priority fallback | `fallback`                              | Try targets in order; move on when a condition fires |
| Weighted          | `loadbalance`                           | Split by weight; failed targets are skipped          |
| Lowest latency    | `least-latency`                         | Pick the best rolling p95                            |
| Lowest cost       | `least-cost`                            | Pick the cheapest healthy target each minute         |
| Region-pinned     | `fallback` with `region` on each target | Only targets in the pinned regions are eligible      |

### Thresholds encoded in the code

- Provider error rate: red at `>= 5`, amber at `>= 2` (`provider-cards.tsx`).
- Key expiry: red when days to expiry `< 0`, amber when `< 14`; the stat card and the Expires hint use the same `KEY_EXPIRY_WARNING_DAYS` (`features/agentops/providers/store.ts`). The rotation grace period is `keyRotationGraceHours` (24) in `lib/data/providers.ts`.
- Utilisation bar tone: danger at `>= 95%`, warning at `>= 80%`, otherwise brand (`pctTone` in `features/agentops/providers/shared.tsx`).
- Throttled · 24h: red at `>= 100`, amber above 0.
- Pressure facet: Saturated at `>= 95%`, High at `>= 80%`, computed from the higher of RPM and TPM utilisation.
- Simulator latency: a failed step costs `min(timeoutMs, 1800 + 400 * index)` ms; a served step costs the provider's `testLatencyMs + 900 + 120 * index` ms, where `index` is the position in the strategy-ordered chain.
- Simulated connection test delay: 600 ms (`TEST_DELAY_MS` in `provider-cards.tsx`).

## How the data gets here

Everything comes from `lib/data/providers.ts` (seed `7601`, anchored to `NOW`).

- Types: `Provider`, `ProviderStatus`, `CredentialType`, `ProviderIncident`, `ApiKey`, `ApiKeyStatus`, `KeyEnvironment`, `RoutingRule`, `RoutingTarget`, `RoutingStrategy`, `RoutingCondition`, `RoutingStatus`, `RateLimit`, `RateLimitScope`.
- Exports: `providers` (9: Anthropic, OpenAI, Google Vertex AI, AWS Bedrock, Azure OpenAI, OpenRouter, Mistral, vLLM cluster (self-hosted), Cohere), `providerIncidents` (4), `apiKeys` (16), `routingRules` (8), `rateLimits` (13: 6 agent-scoped, 4 provider-scoped, 3 key-scoped), plus `getProvider`, `getApiKey`, `expiringKeyCount`, `keyRotationGraceHours`, `getRoutingRule`, `getRateLimit`, `agentsForRule`, `routingRuleConfig` and `simulateRoute`. Each provider's `spendToday` is derived from `spendTodayByProvider` in `lib/data/costs.ts`.
- Model ids are OpenRouter-style (`anthropic/claude-sonnet-5.5`, `openai/gpt-5.5`); the `ModelChip` in `features/agentops/shared.tsx` renders them, and `lib/data/costs.ts` prices them.
- The page (`app/(app)/agentops/providers/page.tsx`) renders the header and suspends into `features/agentops/providers/providers-view.tsx`, which owns the stat cards and tabs. The four seed arrays are wrapped once in `createListStore` (`features/agentops/providers/store.ts`: `providerStore`, `keyStore`, `routingStore`, `rateLimitStore`) so every tab, card and count reads the same client state. `app/(app)/agentops/providers/loading.tsx` renders the shared table skeleton.

To wire a backend, replace the five arrays with clients for a provider registry (including health check and incident feed), a key vault inventory (never return the secret after creation; rotation should return the new secret once), a routing rule store, and a quota service that reports current utilisation. Keep `routingRuleConfig` if your gateway speaks a Portkey-compatible config, otherwise swap the mapper. `orderedChain` plus `simulateRoute` is a client-side approximation and should be replaced by a gateway dry-run endpoint if one exists. Every button listed under Actions needs a mutation endpoint; today they patch the client stores and toast.

## Related pages

- Costs & Budgets (`/agentops/costs`) for spend by provider and the routing-related savings opportunities; the header button links there and Costs links back to `?tab=routing`.
- Agents (`/agentops/agents/<id>`) via agent chips on rule cards and in the simulator.
- Audit Log (`/agentops/audit`) records key events in the sample data.
- Readiness Assessment (`/agentops/readiness`) control CST-04 "Rate limits, retries, timeouts and fallbacks" and CST-06 "Model routing and right-sizing" are what this page gives you evidence for.
- Model Catalog (`/ai/models`) for the live OpenRouter model list behind the model ids.
