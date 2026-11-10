# Govern

The Govern group is the control layer of AgentOps: the pages that decide what agents are allowed to do, prove that a change is safe before it ships, control how it ships, and keep the evidence. Agent Operations tells you what the fleet is doing; Build is where you change it; Govern is where you decide whether the change may go live and show your work afterwards.

All eight pages live under `app/(app)/agentops/<feature>/`, read deterministic mock data from `lib/data/<feature>.ts` (the readiness engine is the exception, in `lib/readiness/`), and keep their edits in module-scoped client stores (`createListStore` in `lib/store.ts`) with a toast, so stat cards, tables and tab counts on a page move together. Each page document below says exactly which actions are local-only and what to swap for a real backend. Page headers use `<PageHeader nav=... />`, so titles match the sidebar: Guardrails, Evals & Datasets, Deployments, Audit Log.

## Pages

| Page | Route | Document | What it governs |
| --- | --- | --- | --- |
| Guardrails | `/agentops/guardrails` | [guardrails.md](guardrails.md) | Input, output, action and data policies; violations linked to traces; agent x category coverage; offline policy tester |
| Evals & Datasets | `/agentops/evals`, `/agentops/evals/<ev-id>` | [evals-and-datasets.md](evals-and-datasets.md) | Eval runs with per-evaluator scores and baseline deltas; golden datasets; evaluator calibration; per-agent release gates |
| Deployments | `/agentops/deployments`, `/agentops/deployments/<rel-id>` | [deployments.md](deployments.md) | Releases with config diffs, canary / blue-green / shadow rollouts, environments matrix, release approvals |
| Audit Log | `/agentops/audit` | [audit-log.md](audit-log.md) | Append-only, hash-chained record of every governance change, with export and chain verification |
| Schedules & Triggers | `/agentops/schedules` | [schedules-and-triggers.md](schedules-and-triggers.md) | Cron schedules, event and webhook triggers, freeze windows, run history |
| Providers & Routing | `/agentops/providers` | [providers-and-routing.md](providers-and-routing.md) | Provider connections and health, scoped API keys and rotation, routing rules, rate limits |
| Costs & Budgets | `/agentops/costs` | [costs-and-budgets.md](costs-and-budgets.md) | Spend by agent, model and provider; budgets with alert thresholds and breach actions; forecast |
| Readiness Assessment | `/agentops/readiness` | [readiness-assessment.md](readiness-assessment.md) | Control self-assessment across visibility, quality, drift, safety, cost and governance, with release-gate blockers |

How the pages connect:

- Evals produce the gate score a release needs (threshold 85); the release record links back to the run (`/agentops/evals?run=<ev-id>` highlights it) and `Promote to production` on a passed run drafts a release.
- Guardrails coverage is reported per release and per approval; gaps are fixed on the Guardrails page.
- Every change on Guardrails, Evals (gates), Deployments, Costs (budgets), Providers (keys) and Readiness should land in the Audit Log. Guardrails, Evals and Deployments append to the shared client audit store (`features/agentops/audit/audit-store.ts`) in this template, hash-chained onto the seed; the other pages still only toast.
- Schedules define freeze windows that constrain when rollouts may start; Costs defines the budgets a release's cost delta is judged against.

## Release gate checklist

Run this before promoting any prompt, model, tool, parameter or retrieval change to production. Each line names the page and the exact thing to look at. Thresholds are the ones encoded in the code.

### Guardrails (`/agentops/guardrails`)

- [ ] The agent has at least one Active policy in every category (Coverage tab: no amber cells on its row) and a coverage score of 85 or above.
- [ ] No policy in the agent's scope has a red-team bypass rate above 5% (Policies tab, Bypass column; policy sheet, Effectiveness).
- [ ] The last red-team run on each attack-surface policy is newer than the candidate's model or prompt change. If not, re-run `red-team-injections-v2` against the candidate first.
- [ ] No policy protecting the agent is `Disabled` without a documented reason, and no security-relevant policy is `Fail open`.
- [ ] False-positive rate on policies in scope is below 15%, or the plan to retune is written down. A `Block` policy above 30% will block real users.
- [ ] Run the Test tab as the agent with the PII, injection, secrets and destructive presets. Injection and secrets must be blocked or redacted; destructive actions must request approval.
- [ ] Pending Critical violations on the agent are decided (Violations tab: Severity = Critical, Verdict = Pending, Agent = this agent should be empty).

### Evals & Datasets (`/agentops/evals`)

- [ ] A `Pre-deploy` run exists for the exact candidate (prompt version and model shown in the run header match the release), on the agent's golden dataset, with status `Passed`.
- [ ] Regressions = 0 on that run. Read the Regressions filter in the case grid anyway; zero is the only acceptable number.
- [ ] Composite is 85 or above, and no single evaluator dropped more than a few points against the baseline (Scores by evaluator cards).
- [ ] `pii-leak-probes-v1` run against the candidate is at 100% pass.
- [ ] The agent's release gate card reads `Passed` on all five rules (composite, regressions, PII, p95 latency, cost per case) and `Enforce` is on for a production agent.
- [ ] Every LLM-judge or rubric evaluator used by the gate has human agreement of 80% or more. If not, the gate is only as trustworthy as that judge.
- [ ] The golden dataset has been updated since the last release of this agent (Datasets tab, Updated and Size trend), or you accept that it does not cover the new behaviour.

### Deployments (`/agentops/deployments`)

- [ ] The release record shows Eval gate `Passed` with a score at or above the threshold (85) and the run id resolves to the run above (follow the gate chip; it highlights the run). A failed gate shows its reason, for example "1 regression on kb-draft-v4" on `rel-1033`.
- [ ] Risk is correct for the change: any model change is High and requires Agent owner, Platform lead and AI governance sign-off.
- [ ] All approvers show `approved` in the Details panel, and the approval was granted after the gate passed (Activity: `eval` before `approval`).
- [ ] Guardrail coverage on the release is 80% or above.
- [ ] Cost delta estimate is +10% per day or less, or the overage is approved against the agent's budget on Costs & Budgets.
- [ ] If the release came from an experiment, `P(B > A)` is 95% or more.
- [ ] Strategy is Canary for production (5% → 25% → 100%). Blue-green or Direct need a written reason.
- [ ] Rollback target in Details equals the version production currently serves in the Environments tab (the chip links there).
- [ ] No freeze window on Schedules & Triggers covers the planned rollout time.
- [ ] During the canary: at each step, quality of the new version tracks or beats the baseline line and the error-rate delta stays at or below +0.2 points before you advance. Roll back on red.

### Audit Log (`/agentops/audit`)

- [ ] Chain integrity reads `Verified` and the last scheduled check is less than a day old. Do not ship on a broken chain.
- [ ] Searching the agent id for the last 30 days reconstructs its current configuration: the live prompt version has a `prompt.version.promoted` event, params changes have `agent.config.params_changed`, tool access has `tool.permission.granted`.
- [ ] No `guardrail.policy.disabled` or `guardrail.threshold.changed` in the last week on a policy covering this agent that the eval run did not account for.
- [ ] No open `api_key.expiry_warning` on a provider the agent routes to without a later `api_key.rotated`.
- [ ] After promotion: `release.deployed`, `release.canary.advanced` and `release.promoted` appear with the right human actor (use the release's "Audit history" link, `?source=release&q=<rel-id>`). Export the window as CSV and attach it to the change record.

### Also confirm

- [ ] Costs & Budgets: the agent is not already over its budget or forecast to breach this month.
- [ ] Providers & Routing: the target model's provider is healthy and the routing rule has a fallback.
- [ ] Readiness Assessment: no release-gate control for this system is at `none` or `planned`.
