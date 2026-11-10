# Runbook: handle a drift signal

## When to use

Drift & Quality shows an Open signal, or Fleet Overview lists an agent as Drifting, or a trigger of source "Drift signal" fired.

## Steps

1. Open Drift & Quality (`/agentops/drift`, or `/agentops/drift?agent=<id>&state=Open` from an agent record). Filter to Open; cards are already sorted by severity. Start with Critical.
2. Read the card: kind, metric, baseline, current, explanation and the 14-day history. Decide whether it is a step (release or upstream change) or a slope.
3. Press Acknowledge so the fleet knows it has an owner (the toast offers Undo; the severity cards split open from acknowledged).
4. Open the agent record and check the SLO card. If the error budget is in danger (remaining at or below 10 percent or 1-hour burn above 4x), stop here and treat this as an incident: pause releases for the agent, consider Pause in the record header (it asks for confirmation and an optional reason, and the paused state follows the agent everywhere), and notify the owner now.
5. Confirm the cause by kind:
   - `input`: open Knowledge & Memory, retrieval quality and low-recall queries for the agent. Open Traces filtered by the agent and read five recent queries on the new topic.
   - `output`: open Prompts for the agent and diff the production version against the previous one. On a recent trace compare `requestedModelId` with `responseModelId`.
   - `quality`: open Evals & Datasets and look at the latest run and the gate. Open the Review Queue for the agent.
   - `tool`: open Tools & MCP, the tool's recent errors and the MCP server card; check whether `definitionDigest` changed since `reviewedAt`.
   - `cost`: open Costs & Budgets, allocation tab; check tokens per request and routing fallback hits on Providers & Routing.
6. Fix or test:
   - Content fix: add the article or re-sync the source, then watch hit rate.
   - Prompt or parameter fix: draft in the Playground, save as a version, run the eval, release with Canary.
   - Model, prompt or retrieval fix: press Start experiment on the drift card (shown for non-cost kinds). It creates a Draft experiment for the agent with the signal in its hypothesis and opens it; set the split and press Start.
   - Upstream fix (tool, provider): coordinate with the owning team; pause the affected routing rule or tool if it is doing harm.
7. When the metric has returned to its baseline band on the history chart, press Resolve. The dialog has a "This is the new normal: reset the baseline" checkbox and a reason field; tick the box when the new level is intended, and write why.

## What to record

- Acknowledge and Resolve are the state changes; the resolve reason and baseline reset are shown in the toast and kept on the signal for the session. In a wired deployment the reason belongs in an `agent-config` audit event.
- Link the experiment or release you created to the signal in the change note.

## Who to notify

- Agent owner on Acknowledge for Critical, on Resolve for everything.
- Knowledge owner for `input` drift caused by missing content.
- Platform owner (Kevin Dargas in the sample) when the fix needs a budget or routing change.
