# Readiness scoring

The Readiness Assessment scores an AI system against a control set. All arithmetic lives in `lib/readiness/scoring.ts`; nothing else computes a score. This page explains every input and output of `evaluateAssessment`.

## Inputs

- A **control set** (`defaultControlSet`, id `agentops-llmops-v1`, version 1.1.0): six domains and 86 controls (53 base plus the three wave-2 files). Each control has a `risk` weight 1 to 5, an `effort`, a `requiredAt` stage, an optional `gate` flag, an optional `applicability` rule and an optional `cadence`.
- An **assessment**: a system profile (name, system type, autonomy, data sensitivity, exposure, regulatory scopes), a maturity target (prototype, pilot, production) and one `ControlResponse` per answered control with a status and optional owner, tool, evidence, last reviewed date, notes and team votes.

## Status credit

| Status | Label | Credit |
| --- | --- | --- |
| none | Not started | 0 |
| planned | Planned | 0.15 |
| partial | Partial | 0.5 |
| in-place | In place | 0.85 |
| verified | Verified | 1 |

Only In place and Verified count as "met" (`isMet`) for gates and for the met counters.

## Applicability

`applicabilityOf(control, profile)` checks every condition in the control's rule: allowed system types, minimum autonomy (assist < supervised < autonomous), minimum data sensitivity (public < internal < confidential < regulated), allowed exposure, and regulatory scopes (any match). If a condition fails the control becomes the rule's `otherwise` value, by default `not-applicable`. Results:

| Applicability | Factor | Effect |
| --- | --- | --- |
| applies | 1 | counted fully |
| reduced | 0.5 | weight halved, still shown |
| not-applicable | 0 | hidden from the lists and the score (counted in `counts.hidden`) |

Example: agentic controls (tool permissions, compensating actions) are not applicable to a plain RAG assistant; human-approval controls apply from supervised autonomy upward; sensitivity and exposure controls are reduced rather than hidden.

## Required at stage

`isRequired` is true when the control's `requiredAt` stage is at or before the assessment's target. Prototype requires the smallest set (tracing, a dataset, hard safety bounds), pilot adds evals in CI, guardrails, budgets and documentation, production adds drift monitoring, red-teaming and incident process.

## Per-control evaluation

For each control:

- `weight = risk x applicabilityFactor x (required ? 1 : 0.5)`
- `credit = statusCredit[status]`
- `blocker = applicable and gate and required and not met`
- `severity = round(min(1, (risk / 5) x (1 - credit) x (required ? 1 : 0.6) x (gate ? 1.15 : 1) x applicabilityFactor) x 100)`
- `review`: if the control has a cadence and the status is partial or better, due date is `lastReviewed` plus the cadence (weekly 7, monthly 30, quarterly 91, semiannual 182 days); without `lastReviewed` the review is due now. `overdue` is true when the due date is at or before the demo clock.

## Scores

`weightedScore(evals) = round(sum(weight x credit) / sum(weight) x 100)`, computed over applicable controls for the overall score and per domain. A domain with no applicable controls scores 0.

Per domain the result also reports applicable, in place, verified, required, required met and blocker counts.

## Maturity level

`maturityFor(overall, requiredEvals)`:

| Overall | Level |
| --- | --- |
| below 40 | ad-hoc |
| 40 to 64 | defined |
| 65 to 84 | managed |
| 85 and above | optimized if at least half of the required applicable controls are Verified, otherwise managed |

The last rule means you cannot reach Optimized by self-declaring everything In place; evidence is required.

## Gaps, blockers and reviews

- `gaps`: applicable controls not met, sorted by severity descending, then effort ascending (low first), then id. This is the "fix first" list.
- `blockers`: gate controls that are required and not met, sorted by severity. The release-gate panel on the Results tab shows these; a production target with blockers is not ready to go live.
- `reviews`: applicable controls with a cadence, sorted by due date.
- `counts`: how many applicable controls are in each status, plus hidden and applicable totals.

## Team mode

With several respondents each control may carry `votes`. `consensusStatus` picks the majority and resolves ties to the lower status; `voteSpread` is the distance between the lowest and highest vote (2 or more means real disagreement worth a conversation). The effective status used in scoring is the recorded `status`; votes inform it.

## Stability rules

- Control ids (`VIS-01`...) are stable identifiers. Exports, share links and snapshots reference them.
- The sample assessment in `lib/data/readiness.ts` is deterministic and deliberately mid-maturity so the Results tab shows gaps, blockers and overdue reviews. Respondents are real users named in full (Kevin Dargas, Amara Okafor, Diego Ramírez). The test suite checks both.
- Changing a weight or a threshold here changes every historical score. If you need a new scheme, bump the control set version.
