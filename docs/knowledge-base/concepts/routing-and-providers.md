# Routing and providers

Providers & Routing (`/agentops/providers`) is the gateway layer between agents and model vendors. It has four tabs: Providers, Keys, Routing and Limits. Types are in `lib/data/providers.ts`.

## Providers

A `Provider` is one vendor connection: `vendor` is the OpenRouter-style prefix used in model ids (`anthropic`, `openai`, `google` and so on), `baseUrl`, `region` and `regions`, `credentialType` (API key, Service account, IAM role, Managed identity, mTLS certificate), `enabledModels` versus `availableModels`, 24-hour requests, error rate, p95, spend today and a 14-day latency trend. Status is Connected, Degraded or Disconnected. "Test connection" returns a deterministic latency in the sample.

Provider incidents (`ProviderIncident`) are vendor-side events with severity minor or major and status Investigating, Monitoring, Resolved. They appear on the provider card.

## Keys

An `ApiKey` belongs to one provider and one environment (production or staging), has an owner, `scopes` (for example `messages`, `batches`, `embeddings`), `created`, `lastUsed`, `expires` (null means never), `monthlySpend` and a status: Active, Expiring, Revoked, Rotating. The table actions are Rotate, Revoke and Copy key; Rotate and Revoke ask for confirmation. Rotation is a two-key overlap: the new key is issued, agents are moved, the old key is revoked after `keyRotationGraceHours` (24). The Keys tab warns about keys expiring within 14 days (`expiringKeyCount`); the sample has three. See [rotate an API key](../runbooks/rotate-an-api-key.md).

## Routing rules

A `RoutingRule` applies to a list of agents and routes their requests through an ordered `chain` of targets, each a model id on a provider with an optional weight or pinned region.

| Strategy | Behaviour |
| --- | --- |
| Priority fallback | Try the chain in order; move to the next target on a matching condition |
| Weighted | Split traffic by `weight` across targets |
| Lowest latency | Pick the target with the best recent p95 |
| Lowest cost | Pick the cheapest target that satisfies the request |
| Region-pinned | Only use targets in the pinned region |

`conditions` decide when to fall over: on 429, on 5xx, on timeout, on cost over budget. `timeoutMs` and `retries` apply per target. `fallbackHits24h` tells you how often the primary failed. Status is Active, Paused or Draft; "Pause rule" disables it without deleting it. The sample has eight rules, including "Policy Answers · EU region pinned" (`rt-004`, Region-pinned) and a Lowest latency rule (`rt-006`).

`routingRuleConfig(rule)` renders the rule as gateway JSON (Portkey-style) you can copy. `simulateRoute(rule, failedIndexes)` walks the chain with chosen targets marked failed and shows the path a request would take; the Routing tab exposes it as the request simulator ("Simulated path").

## Rate limits

A `RateLimit` caps requests per minute, tokens per minute and concurrency for a scope: one agent, one provider or one key. It records current usage, an allowed `burst` above RPM and `throttled24h`. Agent-level limits protect your budget; provider-level limits mirror the vendor's quota so you fail over before the vendor returns 429; key-level limits isolate a noisy tenant.

## How this connects to the rest

- Traces record `requestedModelId` and `responseModelId` per LLM span. When they differ, a routing rule or vendor alias served a different model; drift in output quality after a silent model change shows up here first.
- Costs & Budgets attributes spend by provider from the same model pricing table.
- Recommendations of kind `deprecation` come from vendor notices; the fix is usually a routing-chain change plus an experiment.
- Readiness controls in cost-performance expect fallbacks, timeouts and rate limits to exist and be tested; the simulator is the evidence.

## Good defaults

- Every production agent has a Priority fallback rule with at least two providers and conditions on 429, 5xx and timeout.
- `timeoutMs` per target is below the agent's `ModelParams.timeoutMs`, otherwise the fallback never gets a chance.
- Production keys expire; `Expiring` within 14 days is a weekly checklist item.
- Scopes on a key are the minimum the routing chain needs.
