# Audit Log

The audit log is the append-only record of who changed what, when, and under which approval across the AgentOps control plane: prompt promotions, guardrail edits, releases and rollbacks, review verdicts, tool permissions, MCP server registrations, budgets, memory deletions, API key rotations, agent configuration changes and readiness snapshots. Every record carries a hash chained to the record before it, so editing or dropping an event changes every hash after it and the chain verification fails.

The page is for auditors, security and compliance reviewers, and the platform team during incident review. It answers "what changed before this broke" and "show me evidence that nobody altered the trail".

## Where to find it

- Sidebar: Govern > Audit Log. The header is `<PageHeader nav="/agentops/audit" />`, so eyebrow ("Govern"), icon and title come from `config/nav.ts`.
- Route: `/agentops/audit`.
- Query parameters:
  - `?event=aud-000123` opens the event sheet for that record. Links from other pages and the sheet's own "previous record" button use this.
  - `?range=1|7|all` sets the time window to 24 hours, 7 days or the full retention window. The default of 30 days is represented by omitting the parameter.
  - `?source=<source>` pre-selects the Source facet, e.g. `?source=release`. Valid values are listed under Reading the data.
  - `?q=<text>` pre-filters the table by a search term (id, action, summary, actor, target, agent, trace, release, approval or hash). Release toasts and the release record's "Audit history" link use `?source=release&q=<rel-id>`. A banner above the table shows the term with a `Clear` button.
- Files: route `app/(app)/agentops/audit/page.tsx` (with a `loading.tsx` rendering `TableSkeleton`), UI `features/agentops/audit/*`, data `lib/data/audit.ts`, client store `features/agentops/audit/audit-store.ts`.

The page is a static shell. `AuditRoute` (`features/agentops/audit/audit-route.tsx`) reads `?source=` and `?q=` with `useSearchParams` inside a `Suspense` boundary (fallback `TableSkeleton`) and remounts `AuditView` when a link changes them; `AuditView` reads `?event=` and `?range=` itself and writes them back with `setQueryParams` (`history.replaceState`), so every state of the page is a shareable link and the route exports statically.

## What is on the page

### Stat cards

A `StatGrid` of four cards, computed from the client audit store (seed plus anything appended this session).

| Card            | Value                                                                       | Hint                                                                          |
| --------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Events, 30d     | Events in the trailing 30 days                                              | Total events in the retention window, and how many were appended this session |
| Actors, 30d     | Distinct actor ids in the window                                            | "N people · M agents and system"                                              |
| Chain integrity | `Verified` (green) or `Broken` (red), from `verifyAuditChain()` run on load | When the last scheduled integrity check ran                                   |
| Retention       | Retention period in days                                                    | Storage class and number of records on legal hold                             |

### Event table

A compact `DataTable` of `AuditEvent`, newest first. Clicking a row opens the event sheet.

| Column  | What it shows                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When    | Relative date                                                                                                                                                                    |
| Action  | The dotted verb (`release.rolled_back`, `prompt.version.promoted`) as a monospace badge, coloured by its last segment. Header tooltip                                            |
| Summary | One-line description, with a readable target kind ("Prompt version", "MCP server", "Release gate") and id underneath; records appended this session carry a "This session" badge |
| Actor   | User chip, agent chip, or a "Control plane" system chip                                                                                                                          |
| Source  | Which subsystem produced the event, with icon                                                                                                                                    |
| Event   | The `aud-` id                                                                                                                                                                    |
| Hash    | Short form of the record hash (`a1b2c3…9f0e`). Hidden by default. Header tooltip explains the digest                                                                             |

Facets: Source (eleven values), Actor (Person, Agent, System), Action family (the first segment of the verb: prompt, guardrail, release, review, tool, mcp_server, budget, memory, api_key, agent, readiness, audit). Search covers id, action, summary, actor name, target id and label, agent id, trace id, release id, approval id and the full hash, so pasting a hash from an export finds the record.

Toolbar: a range select (Last 24 hours, Last 7 days, Last 30 days, Full retention window), `JSON` and `CSV` export buttons.

### Retention & integrity card

To the right of the table:

- A green or red banner: "Hash chain intact across N records" or "Chain broken at aud-…", with the time of the last scheduled check.
- Retention: 400 days, "then archived, never purged under hold".
- Storage: `WORM object storage`, "append-only · immutable".
- Legal hold: count of pinned records, each id clickable to open it.
- Window: first and last event timestamps, with a link to the genesis record.
- Compliance tags: `SOC 2 CC7.2`, `ISO 27001 A.8.15`, `EU AI Act Art. 12`.
- A `Verify chain` button in the card header.

Below the card a note explains that exports include `hash` and `prevHash` so an auditor can re-run the digest offline.

### Event sheet

Opens via `?event=` in the shared sheet frame (detail width, `Close` footer). Sections:

- Header: action badge, actor kind badge (Person / Agent / System), a "This session" badge for appended records, source chip, the event id with a copy button, a `Legal hold` badge when pinned, and the summary.
- Details: When (absolute, relative and raw ISO), Actor (chip and raw id), Action (copyable), Target (link to the record page or sheet it refers to, with readable kind and id), Source.
- Change: Before and After blocks when the event carries them (red minus, green plus), for example `production → v6` to `production → v7`, `Active` to `Disabled`, or a temperature value.
- Context: chips for Agent, Trace, Release, Prompt version (prompt events link to the exact prompt page carried by the target; others to the prompt list), Model, Policy version, Approval id (release approvals link to the Approvals tab); plus a Reason note when present (rollback and failure messages, rejection reasons, reasons typed into the Deployments dialogs).
- Integrity: `Chain link verified` or `Chain link broken`, computed live by re-running the digest for this record and comparing `prevHash` with the previous record's hash. Shows the full `hash` and `prevHash` with copy buttons, and a button to open the previous record (or "genesis record" for the first). A footnote states which fields the digest covers and, for session records, that they are lost on reload.

## What to check

### Every day

- **Chain integrity card.** Must read `Verified`. If it reads `Broken`, press `Verify chain`; the toast names the first bad record and offers to open it. Everything after that record is untrusted until explained. Treat this as a security incident, not a data bug.
- **Last integrity check age.** The hint on the card and the banner show when the scheduled check last ran. More than a day old means the scheduled job is not running.
- **Action family = release, last 24 hours.** `release.rolled_back` and `release.failed` are always kept and shown red. Each should have a Reason in the sheet and a matching entry on the Deployments page.
- **Danger-toned actions in the window:** `api_key.revoked`, `memory.user_deleted`, `budget.breached`, `mcp_server.disconnected`, `guardrail.violation.escalated`, `release.rejected`. Open each and confirm the actor is who you expect and the reason is recorded.
- **Actor = Agent.** Agents write events when they request tool permissions. A burst of `tool.permission.requested` from one agent is a loop or a prompt change that widened its ambitions.

### Every week

- **Actor = System events that should have a human.** Promotions, approvals and policy changes should be people. A `prompt.version.promoted` or `release.approved` with the Control plane as actor means an automation is doing governance work without a named owner.
- **`guardrail.policy.disabled` and `guardrail.threshold.changed`.** Both are always kept. Each should have a reason; a disabled guardrail that is still disabled a week later needs a decision on the Guardrails page.
- **`api_key.rotated` and `api_key.expiry_warning`.** Warnings without a following rotation within the week are a pending outage. Cross-check on Providers & Routing.
- **`agent.owner.changed`.** Ownership transfers should match the team roster; a transfer to someone who has left is a common gap.
- **Legal hold list.** Confirm the pinned records are still the ones legal asked for and that nothing that should be held (rollbacks under investigation, user deletions subject to a request) is missing.
- **Export a 7-day CSV** and keep it with your weekly change record. The hashes let anyone re-verify it later without console access.

### Before a release or model change

- **Filter by the agent id** in search and scan the last 30 days. You should be able to reconstruct the agent's current configuration from `prompt.version.promoted`, `agent.config.params_changed`, `tool.permission.granted` and `release.promoted` events. If the live config includes something the trail does not explain, find out how it got there before adding to it.
- **`prompt.version.rejected` for the candidate prompt.** A rejected version being promoted later should have a newer version with a passing eval, not the same id.
- **Approval evidence.** Release events carry an `Approval` context chip (`apr-…`). The release you are about to promote should already have `release.eval_gate.passed` and `release.approved` events before `release.deployed`.
- **Open guardrail changes on the agent.** A `guardrail.threshold.changed` or `guardrail.policy.disabled` in the last few days on a policy that covers this agent changes the safety baseline the eval was run under.
- **After the release:** confirm `release.deployed`, each `release.canary.advanced` and finally `release.promoted` appear, with the actor being the person who pressed the button. In this template the Deployments page appends them to the client log as you act (the toast's `Open audit log` lands on `?source=release&q=<rel-id>`); in production their absence means the audit hook is broken.

## Actions

| Action                             | Where                                                                         | What it does in this template                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open event                         | Table row, legal hold ids, genesis link, previous-record button, toast "Open" | Sets `?event=` and opens the sheet                                                                                                                                                                                                                                                                                                                   |
| Range select                       | Toolbar                                                                       | Sets or clears `?range=` and refilters the table. Exports use the same range and the `?q=` term                                                                                                                                                                                                                                                      |
| Clear search term                  | Banner above the table                                                        | Drops `?q=`                                                                                                                                                                                                                                                                                                                                          |
| JSON export                        | Toolbar                                                                       | Downloads `agentops-audit-<30d                                                                                                                                                                                                                                                                                                                       | 7d  | 1d  | all>[-<q>].json`, pretty-printed, every field including `hash`and`prevHash`. Real file download |
| CSV export                         | Toolbar                                                                       | Downloads `agentops-audit-<range>[-<q>].csv`, RFC 4180, 24 fixed columns (`id, at, actor_kind, actor_id, actor_name, action, source, target_kind, target_id, target_label, target_href, summary, before, after, agent_id, trace_id, prompt_version, model_id, policy_version, approval_id, release_id, reason, hash, prev_hash`). Real file download |
| Verify chain                       | Retention card                                                                | Re-runs `verifyAuditChain()` over all events, including those appended this session, and toasts the result. On failure the toast offers to open the broken record                                                                                                                                                                                    |
| Copy id / hash / prevHash / action | Event sheet                                                                   | Clipboard                                                                                                                                                                                                                                                                                                                                            |
| Target link, context chips         | Event sheet                                                                   | Navigate to the record page or sheet (`/agentops/prompts/<id>`, `/agentops/guardrails?policy=`, `/agentops/deployments/<id>`, `/agentops/agents/<id>`, `/agentops/traces/<id>`, `/agentops/tools?tab=permissions`, and so on)                                                                                                                        |

The page itself has no write actions; the log is append-only by design. Other Govern pages append to it through `recordAudit()` in `features/agentops/audit/audit-store.ts`: enabling, disabling, rescoping, retuning, duplicating or rolling back a guardrail policy; deciding a violation verdict (and undoing it); toggling a release gate; drafting, approving, rejecting, requesting changes on, starting, advancing, pausing, resuming, promoting or rolling back a release. Each appended record gets the next `aud-` id, `prevHash` equal to the current last hash and a `hash` from the same `auditDigest`, so `verifyAuditChain` stays green over the whole list. Appended records are marked "This session" and are lost on reload. A backend must persist them.

## Reading the data

### Sources

| Source value      | Label            | Fed by                                                                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `prompt`          | Prompts          | Prompt versions: created, promoted to production, rejected in review                                          |
| `guardrail`       | Guardrails       | Policy versions: created, updated, threshold changed; disabled; escalated violations                          |
| `release`         | Releases         | Every release activity event, plus rejections and change requests by approvers                                |
| `review`          | Reviews          | Human review verdicts from the review queue                                                                   |
| `tool-permission` | Tool permissions | Permission granted or revoked per agent and tool; tools deprecated or disabled; permission requests by agents |
| `mcp-server`      | MCP servers      | Server registered or disconnected                                                                             |
| `budget`          | Budgets          | Limit changed, budget breached, breach action triggered                                                       |
| `memory`          | Memory           | Store compacted, TTL changed, user memory deleted                                                             |
| `api-key`         | API keys         | Created, rotated, revoked, expiry warning                                                                     |
| `agent-config`    | Agent config     | Model and parameter changes shipped by releases, playground applies, pause and resume, owner changes          |
| `readiness`       | Readiness        | Assessment created, control status changed, snapshot taken, nightly audit integrity check                     |

The README lists eight of these (prompts, guardrails, releases, reviews, tools, budgets, memory, keys); the code also has `mcp-server`, `agent-config` and `readiness`.

### Action verbs

Actions are dotted paths, `<family>.<object>.<verb>` or `<family>.<verb>`. The badge colour is decided by the last segment:

| Tone            | Verb endings                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Red (danger)    | `rolled_back`, `failed`, `rejected`, `revoked`, `breached`, `disconnected`, `escalated`, `user_deleted` |
| Green (success) | `promoted`, `approved`, `granted`, `passed`, `verified`, `resumed`, `registered`                        |
| Amber (warning) | `disabled`, `deprecated`, `paused`, `degraded`, `expiry_warning`, `changes_requested`, `requested`      |
| Blue (info)     | `changed`, `updated`, `rotated`, `compacted`, `advanced`, `annotated`, `triggered`, `taken`             |
| Neutral         | everything else (`created`)                                                                             |

Verbs present in the sample: `prompt.version.{created,promoted,rejected}`, `guardrail.policy.{created,updated,disabled}`, `guardrail.threshold.changed`, `guardrail.violation.escalated`, `release.{created,approved,deployed,promoted,rolled_back,failed,annotated,rejected,changes_requested}`, `release.eval_gate.passed`, `release.canary.advanced`, `review.*`, `tool.permission.{granted,revoked,requested}`, `tool.{deprecated,disabled}`, `mcp_server.{registered,disconnected}`, `budget.limit.changed`, `budget.breached`, `budget.action.triggered`, `memory.{compacted,user_deleted}`, `memory.ttl.changed`, `api_key.{created,rotated,revoked,expiry_warning}`, `agent.{paused,resumed}`, `agent.owner.changed`, `agent.config.params_changed`, `readiness.assessment.created`, `readiness.control.changed`, `readiness.snapshot.taken`, `audit.integrity.verified`.

Verbs appended by the UI in a session: `guardrail.policy.{created,enabled,disabled,updated,rolled_back}`, `guardrail.threshold.changed`, `guardrail.violation.{verified,dismissed,reopened}`, `release.gate.{enforced,advisory}`, `release.{created,approved,rejected,changes_requested,deployed,promoted,rolled_back,paused,resumed}`, `release.canary.advanced`. The tone table adds `dismissed` (red), `enabled` and `enforced` (green), `advisory` and `reopened` (amber), `deployed` (blue).

### Actor kinds

`user` (a person, shown with the user chip), `agent` (a deployed agent, `agt-…`), `system` (the control plane, id `sys-control-plane`).

### Hash chain

Each record's `hash` is a 16-hex-character digest over `prevHash + id + at + action + target.id + summary`. The first record's `prevHash` is `AUDIT_GENESIS_HASH` (sixteen zeros, rendered as "genesis"). `verifyAuditChain()` walks the list from genesis and reports the first record whose `prevHash` does not match the previous hash or whose `hash` does not match its own recomputed digest. Both an edited summary and a dropped record break it (the unit test checks both).

The digest in the template is FNV-1a concatenated with djb2. It demonstrates the mechanism; it is not cryptographic. A production implementation should use SHA-256 or an HMAC with a key the application cannot read, and should anchor the chain head externally (a signed daily checkpoint, a transparency log, or WORM storage metadata).

### Legal hold

`auditRetention.legalHold` pins the first four `release.rolled_back` and `memory.user_deleted` events. Pinned records are kept past the retention period and show a `Legal hold` badge in the sheet.

### Retention

400 days, immutable, WORM object storage, last integrity check 6 hours before the fixed clock. These are constants in `auditRetention`.

## How the data gets here

`lib/data/audit.ts` builds the log at import time. Most events are derived from arrays in other data modules so the trail agrees with every record page; the rest are seeded extras that top the count up to 140.

- Types: `AuditEvent` (id `aud-000001`…, at, `actor: AuditActor`, action, `source: AuditSource`, `target: AuditTarget` with kind, id, label and href, summary, optional before and after, `context: AuditContext` with agentId, traceId, promptVersion, modelId, policyVersion, approvalId, releaseId, reason, plus `hash` and `prevHash`), `AuditRetention`.
- Builders: `fromPrompts()` reads `prompts` (`lib/data/prompts.ts`), `fromGuardrails()` reads `guardrails`, `fromReleases()` reads `releases` and `releaseApprovals`, `fromReviews()` reads `reviewItems`, `fromTools()` reads `tools`, `toolPermissions` and `mcpServers`, `fromBudgets()` reads `budgets` (`lib/data/costs.ts`), `fromMemory()` reads `memoryStores` (`lib/data/knowledge.ts`), `fromApiKeys()` reads `apiKeys` (`lib/data/providers.ts`), `fromReadiness()` reads `sampleAssessment` and `sampleSnapshots` (`lib/data/readiness.ts`), `extras()` is seeded.
- Balancing: `capBySource()` limits each source (release 26, prompt 16, guardrail 14, memory 9, api-key 9, agent-config 8, review 8, tool-permission 8, budget 8, mcp-server 6, readiness 5) but always keeps high-signal verbs (`ALWAYS_KEEP`: rollbacks, failures, rejections, user deletions, key revocations and rotations, guardrail disables and threshold changes, budget breaches, prompt promotions and rejections, tool permission grants and revocations, tool deprecations and disables, MCP disconnects). Events are then sorted by time, assigned ids, and chained.
- Exports: `auditEvents` (140, oldest first), `getAuditEvent`, `auditEventsSince(days)`, `auditRetention`, `auditSources`, `auditSourceLabel`, `auditActorKinds`, `auditActionFamily`, `auditDigest`, `verifyAuditChain`, `AUDIT_GENESIS_HASH`.
- Tests: `features/agentops/audit/audit-data.test.ts` pins 140 chronologically ordered unique ids no later than `NOW`, every source present, all three actor kinds, every target href under `/agentops/`, the chain verifying from genesis, tamper and drop detection, and resolvable legal-hold ids. The project convention is that this test must stay green and that new mutations elsewhere should get an audit event here rather than a separate history.
- Export helpers: `features/agentops/audit/export.ts` (`auditToJson`, `auditToCsv`, `downloadText`; the last is also used by the evals CSV and JSONL exports and the release-notes export).
- Client store: `features/agentops/audit/audit-store.ts` (`auditStore` from `createListStore`, `recordAudit()`, `sessionAuditIds`, `auditHref()`).
- Target kind labels: `targetKindLabel()` in `features/agentops/audit/shared.tsx` turns slugs such as `mcp-server` into "MCP server".

To wire a backend: replace `auditEvents` with a paginated, server-side filtered query (the table currently filters 140 rows client-side) and `verifyAuditChain` with a server endpoint that re-hashes the stored chain, since a client cannot verify what it cannot fully download. Keep `auditDigest` deterministic and documented so exports remain independently verifiable. Point `recordAudit()` at your append endpoint; every Govern mutation already calls it.

## Related pages

- [Guardrails](guardrails.md): source `guardrail`; targets open the policy sheet via `?policy=`.
- [Evals & Datasets](evals-and-datasets.md): `release.eval_gate.passed` events and `prompt.version.rejected` reasons reference eval results.
- [Deployments](deployments.md): source `release` and most `agent-config` events; targets link to `/agentops/deployments/<id>`.
- [Costs & Budgets](costs-and-budgets.md): source `budget`.
- [Providers & Routing](providers-and-routing.md): source `api-key`.
- [Readiness Assessment](readiness-assessment.md): source `readiness`, including the nightly `audit.integrity.verified` self-check.
- Prompts (`/agentops/prompts/<id>`), Review Queue (`/agentops/reviews`), Tools & MCP (`/agentops/tools?tab=permissions`), Knowledge & Memory (`/agentops/knowledge`), Agents (`/agentops/agents/<id>`), Traces (`/agentops/traces/<id>`): the remaining targets and context links.
