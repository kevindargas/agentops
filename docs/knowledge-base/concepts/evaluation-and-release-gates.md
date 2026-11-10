# Evaluation and release gates

Evaluation is how AgentOps turns "the agent seems fine" into a number you can gate a release on. The pieces are evaluators, datasets, runs, cases and gates, all defined in `lib/data/evals.ts`.

## Evaluators

An `Evaluator` scores one property of one case. Eight types: LLM-as-judge, Rubric, Exact match, JSON schema, Embedding similarity, Regex, Custom code, Human. Each measures one of: Faithfulness, Answer relevance, Tool-call accuracy, SQL validity, Policy compliance, Tone, Latency budget, Cost budget, Output format, Semantic match, PII leak, Overall quality, on a scale of 0 to 1, 1 to 5 or pass/fail.

Judges cost money (`costPerCase`) and can be wrong. `humanAgreement` (0 to 100) and the 12-week `calibration` history tell you how much to trust a judge. Below roughly 70 percent agreement, treat its scores as a hint, not a gate. The readiness control QUA-03 covers judge calibration.

## Golden datasets

An `EvalDataset` is a versioned set of cases with a schema (input fields, expected fields, metadata), sources (production traces, human-authored, synthetic, review corrections), coverage tags and the evaluators it runs. Each `DeployedAgent.evalDataset` names the dataset used for its gate.

Review corrections flow into datasets: when a reviewer presses Correct in the Review Queue the corrected answer is saved to the eval set. This is the cheapest way to grow a dataset with real failure cases.

## Runs and cases

An `EvalRun` is one dataset evaluated against one agent, prompt version and model, triggered Manual, CI, Scheduled or Pre-deploy. It reports:

- `composite`: weighted composite of evaluator means, 0 to 100
- `scores`: mean per evaluator, 0 to 1
- `passRate`: share of cases that passed every evaluator
- `delta`: composite change versus `baselineRunId`, in points
- `regressions` and `improvements`: cases that flipped versus the baseline
- `cost`, `durationMs`

Cases are generated lazily per run (`getEvalCases`) and come with per-evaluator scores and rationales, `passed`, `baselinePassed` and `change` (regression, improvement, same). The case grid in the run record sorts regressions first; the Compare action opens another run side by side.

## Release gates

`buildGates` creates one `ReleaseGate` per agent from the latest finished run on the agent's golden dataset plus the PII probe dataset (`pii-leak-probes-v1`). The five rules:

| Rule | Requirement | Source |
| --- | --- | --- |
| Composite score | at or above 85 (`GATE_THRESHOLD` in `lib/data/deployments.ts`) | latest run composite |
| No regressions on golden set | exactly 0 | latest run regressions |
| PII-leak probes | 100 percent pass | PII probe run, else the regex PII evaluator score |
| p95 latency | at or below the agent's latency budget (2.5 s to 25 s depending on agent) | agent metrics |
| Cost per case | at or below the agent's cost budget ($0.02 to $0.40) | run cost / cases |

The gate is Passed only when all five pass. `enforced` is true for production agents (and some staging ones); an enforced Failed gate blocks promotion in Deployments. Releases carry their own `evalGate` snapshot (status, score, threshold, run id and, when failed, a `reason`) so you can see what the gate said at the time of the release, not just now. A gate can fail above the threshold: Knowledge Curator's pending release `rel-1033` scores 87 and still fails with "1 regression on kb-draft-v4". Draft releases have no snapshot until a run is attached.

## How to use this well

- Run evals Pre-deploy on every release candidate, not just Scheduled. The run's `note` field is for "why this run exists".
- Keep a stable baseline run per agent. The delta is meaningless if the baseline moves every day.
- When a run fails, fix the regressions before re-running. The run action copy says it directly: "Run failed, fix regressions first".
- Version datasets. A gate against an old dataset version can pass while the current one fails.
- Red-team runs feed guardrails: a guardrail's `bypassRate` is measured on an eval run (`lastRedTeamRunId`).
