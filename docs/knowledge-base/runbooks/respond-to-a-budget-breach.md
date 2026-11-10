# Runbook: respond to a budget breach

## When to use

A budget on Costs & Budgets, Budgets tab is At risk (linear projection at or above 90 percent of the limit) or Exceeded (spend has reached the limit and the `onBreach` action has fired), or a trigger of source "Budget threshold" fired.

## Steps

1. Open Costs & Budgets (`/agentops/costs`), Budgets tab, or follow the link from the alert (`/agentops/costs?budget=<bud-id>` opens the sheet directly). Read scope (team, agent or project), period (daily or monthly), `limit`, `spent`, `projected`, `thresholds` and `onBreach`.
2. Understand what already happened. If the status is Exceeded, the breach action has run:
   - Alert only: nothing changed, people were told.
   - Throttle: the agent's rate limit was reduced; expect `rate_limited` outcomes on Traces.
   - Downgrade model: the routing rule moved traffic to a cheaper model; expect a quality drift signal soon.
   - Pause agent: the agent is Paused; users get no answers.
     Decide whether that action is acceptable for the service right now. Pausing a customer-facing agent to save money is a service decision; involve the agent owner.
3. Find the driver. Use the Related row in the budget sheet: Allocation opens the Allocation tab filtered to the agent (`?tab=allocation&agent=<id>`). Sort by "Change vs last week" and Share, then open the top agent through its chip. Compare cost per request, tokens in and out and cached tokens with last week (the Cost column covers the last 7 days; the budget covers the calendar period). Common causes: a prompt version with a longer system prompt, `maxOutputTokens` raised, a model change, a routing fallback to a premium provider, a retry storm, or simply more traffic.
4. Cross-check from the same Related row: Traces (`/agentops/traces?agent=<id>`) for `rate_limited` outcomes and retries; Routing (`/agentops/providers?tab=routing`) for `fallbackHits24h`; Audit history (`/agentops/audit?source=budget`) for earlier limit changes. Drift & Quality may also hold a `cost` signal with an explanation.
5. Fix the driver, in order of least user impact:
   - Savings tab: apply the low-effort opportunities (caching, output-token caps, batch).
   - Playground: lower `maxOutputTokens` or `reasoningEffort` for the agent, run the eval, release.
   - Routing: repair the primary so fallbacks stop; add an "on cost over budget" condition.
   - Recommendations: start the experiment for a cheaper model if quality evidence exists.
6. Decide about the budget itself. If the forecast (`forecastMonthEnd`) is above the sum of team budgets because traffic legitimately grew, raise the limit with the budget owner's approval; otherwise leave it and let the breach action stand. Adjust the alert thresholds in the same form if the budget only warned at 100%. Changing the action on an At risk or Exceeded budget to Throttle or Pause agent asks for confirmation and names the owner, because it applies as soon as the limit is reached.
7. If the breach action paused or throttled an agent and the driver is fixed, resume the agent on its record or restore the rate limit.

## What to record

- The driver you found and the fix, in the Note field of the budget sheet; it is kept with the budget in this session and shown as "Last note" the next time the sheet opens. The save toast confirms "note recorded".
- In a real deployment budget changes also write a `budget` audit event; the sample data shows earlier ones under `/agentops/audit?source=budget`.

## Who to notify

- Budget `ownerId` (team lead or platform owner) on At risk; immediately on Exceeded.
- Agent owner whenever the breach action changed the agent's behaviour.
- Service desk lead if an agent was paused and users are affected.
