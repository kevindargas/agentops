# Runbook: triage a flagged trace

## When to use

A trace arrived in the Review Queue with reason Evaluator flag, Policy match, Low confidence or User thumbs-down, or a guardrail violation with a Pending verdict points at a trace, or someone reports a bad answer and gives you a `tr_` id.

## Steps

1. Open the Review Queue (`/agentops/reviews`, chord G then R). The list is already sorted by priority. Pick the item (or arrive with `?item=<rev-id>` from the trace's "In review queue" button); the workspace shows the user query, the final answer, the retrieved context (the retriever span) and the agent.
2. Open the trace in a second tab from the item's "Open trace" button (`/agentops/traces/[id]`). If a bad answer reached you by id and is not in the queue yet, press "Send to review" on the trace; it adds a pending item assigned to you. Read the waterfall top to bottom:
   - Check `outcome` and any bound-hit flag. `timeout`, `tool_error` and `invalid_output` are configuration problems, not reviewer problems.
   - Find the LLM span and compare `requestedModelId` with `responseModelId`. A difference means a fallback or alias served the call.
   - Check `finishReason`. `length` means the answer was truncated by `maxOutputTokens`.
   - Read the retriever span output. If no relevant chunk was retrieved, the agent could not have answered well; this is a knowledge gap, not a prompt gap.
   - Check `lineage.promptVersion` and `lineage.policyVersion` against the production version on the prompt record and the Guardrails Policies tab (both are links in the Lineage section).
3. If a guardrail fired, the trace shows a "Guardrail violations" section; follow the policy link to Guardrails, Violations tab, and set the verdict: Verified for a true positive, Dismissed for a false positive.
4. Back in the Review Queue, score the rubric with keys 1 to 5 (accuracy, grounding, tone, safety, in order), add a note, then decide:
   - A: Approve. The answer was acceptable.
   - F: Flag. The answer was wrong and you cannot write the right one now.
   - C: Correct. Write the better answer, then press Enter (Cmd/Ctrl+Enter inside the textarea) to save it, or Esc to cancel. The correction is kept on the item; a wired deployment writes it to the eval set.
   - S: Skip. Leave it for someone with the domain knowledge.
   Every verdict toast offers Undo for a few seconds, and the stat cards above the queue move with each decision.
5. Decide whether the trace is one of many. On Traces, filter by the agent and the same flag or outcome (`/agentops/traces?agent=<id>&flag=<flag>` or `&outcome=<outcome>` preselects the facets). Three or more similar traces is a pattern: open Drift & Quality for the agent (`/agentops/drift?agent=<id>`) and look for a matching signal; if there is none, this is early.
6. Route the fix:
   - Knowledge gap: Knowledge & Memory, check low-recall queries, add or re-sync the source.
   - Prompt gap: Prompts, draft a new version, run the eval, release through Deployments.
   - Tool failure: Tools & MCP, open the tool's recent errors and the server health.
   - Model regression: Recommendations and Experiments.

## What to record

- The review decision and rubric (automatic on Approve, Flag or Correct; in this template it is recorded on the review item for the session, and a wired deployment writes a `review` audit event).
- The violation verdict (writes a `guardrail` audit event once wired).
- If you change configuration, the reason in the release or prompt change note, so the audit context carries it.

## Who to notify

- The agent owner (`ownerId` on the agent record) for anything that becomes a prompt or configuration change.
- The guardrail owner for a false positive on a Block-mode policy.
- The service desk lead if the trace is linked to an open incident (`INC` numbers appear in the answer text when the agent referenced one).
