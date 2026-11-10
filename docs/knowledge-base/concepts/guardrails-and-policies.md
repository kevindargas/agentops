# Guardrails and policies

A guardrail is a policy-as-code rule that bounds what an agent may read, say or do. Guardrails sit next to the agent at runtime; evals test quality before release. You need both.

## The policy

`Guardrail` in `lib/data/guardrails.ts`:

| Field | Values and meaning |
| --- | --- |
| `category` | Input (what reaches the model), Output (what reaches the user), Action (tool calls), Data (what leaves the boundary) |
| `mode` | Block (reject the turn), Flag (allow and record), Redact (rewrite and allow), Require approval (hold the action for a human) |
| `engine` | regex, classifier, llm-judge, schema, policy-engine |
| `modelId` | judge or classifier model for the two model-backed engines |
| `scope` | `"all"` or a list of agent ids |
| `threshold` | the one slider the policy exposes (for example classifier confidence) |
| `policy` | the YAML source shown in the sheet |
| `failMode` | `fail_closed` rejects when the engine errors or times out; `fail_open` lets the turn through |
| `p95Ms` | latency the policy adds to a turn |
| `falsePositiveRate` | share of reviewed triggers that were wrong |
| `bypassRate`, `lastRedTeamRunId` | share of red-team attack cases that got through on the last eval run |
| `languages` | ISO codes the engine is validated for; empty means language-agnostic |
| `status` | Active, Disabled, Draft |

`modeToAction` maps mode to the recorded violation action: Block to Blocked, Flag to Flagged, Redact to Redacted, Require approval to Approval requested.

## Violations

Every trigger becomes a `GuardrailViolation` with a severity (Critical, Warning, Info), a redacted snippet, the trace it fired on and a verdict: Pending until a human marks it Verified (true positive) or Dismissed (false positive). Verdicts are how `falsePositiveRate` is learned; a policy nobody verifies is a policy nobody trusts.

## Coverage

`guardrailCoverage` scores each agent 0 to 100 on how many categories are covered and how deeply, and lists the categories with gaps. The Coverage tab renders the agent x category matrix. An agent with write tools and no Action policy is the gap that matters most; an external-facing agent with no Input policy is next.

## The tester

The Test tab runs `evaluateGuardrails` locally against the policies that can be evaluated offline (`locallyEvaluable`: regex and schema engines). Paste a user message, a draft answer or a tool call; it returns, per policy, the action, what matched (already redacted) and an explanation. Presets cover common attacks (prompt injection, PII, secrets). Classifier and judge engines are not evaluated offline.

## Fail mode, latency and bypass

These three fields decide whether a guardrail protects you when it matters.

- `fail_closed` on anything that gates an Action or Data policy. `fail_open` is acceptable only for Flag-mode policies where availability matters more than coverage.
- `p95Ms` adds up. Four judge-based policies at 400 ms each cost 1.6 s of p95, which can fail the latency gate. Prefer regex and schema engines on the hot path and judges on sampled traffic.
- `bypassRate` should be measured, not assumed. Policies that are attack surfaces (injection, jailbreak, exfiltration) carry a red-team run id; a policy with no run has an unknown bypass rate.

## Relationship to tools

Tools declare `outputSinks` (renders_html, executes_code, fetches_url, sends_message, writes_record). A tool whose output renders HTML or executes code needs an Output policy in front of the sink, and Write or Destructive tools need an Action policy or a permission matrix decision of approval or deny. The tools safety sheet warns about uncontained HTML rendering for this reason.

## Versioning and audit

Guardrails have `versions` with author and summary. Enabling, disabling (with a confirmation dialog) or editing a policy writes a `guardrail` audit event to the client audit store, hash-chained onto the seed and shown as "This session"; traces record `lineage.policyVersion`, so you can tell which policy version was live for any run. Policies are deep-linkable with `?policy=<grd-id>` and violations filter by `?byPolicy=`.
