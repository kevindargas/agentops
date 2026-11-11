# Costs & Budgets

Costs & Budgets is the FinOps view over the agent fleet: where the money goes by agent, model and provider, how spend is pacing against the month, which budgets are at risk or already breached and what happens when they breach, and which savings are still on the table without a quality regression. It is the page the platform owner opens on the first working day of the month, and the page an agent owner opens when a budget alert fires.

## Where to find it

- Route: `/agentops/costs`
- Nav: Govern group, "Costs & Budgets"
- Tabs sync to `?tab=`: `budgets` (default), `allocation`, `savings`. Switching tabs writes the param back without a navigation.
- `?agent=<agt-id>` preselects the Agent facet on the Budgets and Allocation tabs. The agent configuration panel links here with it.
- `?budget=<bud-id>` opens that budget's sheet on load; opening or closing a sheet writes the param back.
- Header action: "Providers & routing" button, links to `/agentops/providers?tab=routing`
- Record ids: budgets `bud-001` to `bud-013` (`bud-006` is "Policy Answers · monthly"), savings opportunities `sav-001` to `sav-006`
- Tab counts come from the same client store as the tables, so they move when you edit, create or dismiss something.

## What is on the page

### Overview (always visible above the tabs)

Six small stat cards in one row (`StatGrid`). "Spend today" reads `costToday`; the budget counts in the Forecast hint come from the live budget store (`budgetsAtRiskCount`).

| Card                       | Value                                                                           | Delta / hint                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Spend today                | Today's cost (partial day) with a 14-day sparkline                              | Percent vs yesterday; up is bad                                                                                             |
| Month to date              | MTD spend out of the sum of monthly team budgets                                | Bar with a pace marker; "N% of team budgets · M% of month elapsed". Bar turns amber when MTD% exceeds pace by more than 10% |
| Forecast · end of month    | Linear forecast from the trailing 14 full days                                  | Percent vs team budgets; "N budgets exceeded · M at risk" or "All budgets on track"                                         |
| Cost / 1K requests         | Blended unit cost over the last 7 days                                          | Percent vs prior week; request count over the `costByAgentWindowDays` window                                                |
| Cached-token savings       | Share of input spend saved by cache reads, last 7 days                          | Point delta vs prior week; USD saved and cache-read token count                                                             |
| Top mover · week over week | Agent with the largest absolute week-over-week change, linked to its agent page | Its delta and 7-day cost                                                                                                    |

Charts:

- Daily spend, last 30 days, stacked bar. A toggle stacks by Agent or by Provider. The top four series are shown by name and the rest are folded into "Other".
- Spend by model, donut of the last 7 days across production agents, centre label "7 days".
- Tokens, stacked bar per day: Input, Output, Cache reads.
- Cost per 1K requests, line over the last 30 days.

### Budgets tab

Data table of budgets, default sort by status (Exceeded first, then At risk, then On track).

| Column    | Content                                                                                                | Visible by default |
| --------- | ------------------------------------------------------------------------------------------------------ | ------------------ |
| Budget    | Name with the scope underneath: agent chip, or "<name> · Team" / "<name> · Project" with a people icon | Yes                |
| Period    | Daily or Monthly                                                                                       | Yes                |
| Limit     | USD cap for the period                                                                                 | Yes                |
| Spent     | Current-period spend (header hint explains today vs month to date)                                     | Yes                |
| Used      | Bar with a pace marker at the expected share of the period elapsed, percentage label (header hint)     | Yes                |
| Alerts at | Thresholds such as "50% · 80% · 100%"                                                                  | No                 |
| On breach | Action badge: Alert only, Throttle, Downgrade model (amber), Pause agent (red); header hint            | Yes                |
| Owner     | User chip                                                                                              | Yes                |
| Status    | On track, At risk (amber), Exceeded (red); header hint states the rules                                | Yes                |
| Updated   | Relative time                                                                                          | No                 |

Facets: Status, Scope (Team, Agent, Project), Agent (preselected by `?agent=`), Period (Daily, Monthly), On breach.

"New budget" opens the same sheet in create mode: name, scope (Agent, Team or Project) and target, period, limit, alert thresholds, action on breach and a note. Spend and history for the scope are read from the shared cost series (`spendTodayByAgent` for daily agent budgets, `costDaily` otherwise), the status is computed with the same rules as the seed, and the row is added to the top of the table with id `bud-0NN`.

Clicking a row opens the budget sheet (`?budget=<id>`):

- Header: status badge, period badge, breach-action badge, owner chip, name, scope.
- Summary block: spent of limit, "projected $X", the pace bar, and a sentence: "Breached: <action> is in effect", "On current pace this budget will be exceeded", or "Pacing within limit".
- Related: Allocation (`?tab=allocation&agent=<id>` for agent scopes), Traces (`/agentops/traces?agent=<id>`, agent scopes only), Routing (`/agentops/providers?tab=routing`) and Audit history (`/agentops/audit?source=budget`).
- Daily spend chart: last 14 days for daily budgets, last 30 for monthly, split into Within limit and Over limit against the daily limit (monthly limit divided by 30).
- Edit form: Daily or Monthly limit (USD), Alert thresholds (toggle 50, 80, 90, 100; at least one), Action on breach (select with a one-line explanation of each action) and a Note. Save recomputes status (Exceeded when spent is at or over the new limit, At risk when projected is at or over 90% of it). The toast lists only what changed ("limit $4,200 to $5,000 · alerts at 50%, 80% · on breach: Throttle · note recorded"); an unchanged save toasts "<name> unchanged". The last note is shown under the field next time the sheet opens.
- Confirmation: switching an At risk or Exceeded budget to Throttle or Pause agent opens an AlertDialog naming the scope and the budget owner before saving, because the action applies as soon as the limit is reached (or immediately when already breached).

### Allocation tab

Data table of cost per agent over the last `costByAgentWindowDays` (7) days, default sort Cost · 7d descending, no pagination. Rows link to `/agentops/agents/<id>` and the Agent cell is an agent chip linking to the same record.

| Column              | Content                                                                                                         | Visible by default |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| Agent               | Agent chip (link) with team underneath                                                                          | Yes                |
| Model               | Model chip                                                                                                      | Yes                |
| Requests            | Request count over the window (header hint)                                                                     | Yes                |
| Tokens in           | Input tokens                                                                                                    | Yes                |
| Tokens out          | Output tokens                                                                                                   | No                 |
| Cached              | Cache-read tokens and their share of input ("1.2M · 38%"); header hint explains cache pricing                   | Yes                |
| Cost · 7d           | USD; the header is built from `costByAgentWindowDays` and its hint says budgets use the calendar period instead | Yes                |
| Cost / request      | USD per request with 3 to 4 significant digits                                                                  | Yes                |
| Change vs last week | Percent. Red when positive, green when negative, muted when under 1% either way                                 | Yes                |
| Share               | Bar and percent of fleet cost                                                                                   | Yes                |

Facets: Agent (preselected by `?agent=`), Team, Model. The toolbar "Export CSV" button builds the CSV client-side and saves it through a Blob download as `agentops-cost-allocation.csv` with columns `agent, agent_id, team, model, requests_7d, tokens_in, tokens_out, tokens_cached, cost_usd_7d, cost_per_request_usd, delta_vs_last_week_pct, share_pct`, then toasts "agentops-cost-allocation.csv downloaded" with the row count.

### Savings tab

A summary bar with the total estimated monthly savings across Open opportunities, the open count, the amount applied this session, and an "All recommendations" button to `/agentops/recommendations`.

Cards, one per opportunity:

- Kind label (Routing, Prompt caching, Output tokens, Batch API, Commitment), agent chip, effort (low or medium).
- Title and a summary explaining the evidence.
- "Saves about $N/mo" badge. When `recommendationId` resolves to a model recommendation the amount is the recommendation's `savingsPerMonth` and a "Recommendation" button links to `/agentops/recommendations`; when that recommendation has an `experimentId` an "Experiment" button links to `/agentops/experiments?open=<exp-id>`. Open items have an Apply button and a dismiss (X) button. Applied and Dismissed items show a status badge; dismissed cards are faded.
- Apply and Dismiss toast what left the open total and offer Undo for 8 seconds. The summary bar and the Savings tab count update immediately because they read the same store.

## What to check

### Every day

- Forecast · end of month hint. "N budgets exceeded" above zero means a breach action is in effect somewhere. Open the Budgets tab (Exceeded sorts to the top) and read the On breach column: Pause agent and Throttle are user-visible right now; Downgrade model is a quality risk; Alert only means nothing has changed yet.
- Spend today delta. A jump of more than about 20% versus yesterday with no release behind it is usually one agent looping or a provider fallback to a more expensive model. Check Top mover and the Daily spend chart stacked by Provider.
- Month to date bar. The bar turns amber when MTD percent is more than 10% ahead of the elapsed-month pace. That is the early signal before any individual budget goes At risk.
- Budgets with status At risk. Projected spend is at or above 90% of the limit. Decide today whether to raise the limit, change the breach action, or fix the agent, because the breach action will fire on its own.
- Daily budgets (Period = Daily). The sample has daily caps on Support Triage, Ops Analyst and Alert Correlator. A daily budget that reads Exceeded at midday means the agent is Throttled or downgraded for the rest of the day.

### Every week

- Allocation tab, Δ vs last week. Red deltas above about 10% on agents with no change in request count are unit-cost regressions: longer prompts, less caching, or a routing fallback. Compare the Cached column with the agent's history.
- Cached column share. Agents under roughly 10% cache share with a large static system prompt are the first caching candidates; the sample calls out IT Helpdesk Copilot at 6% versus 38% on Support Triage.
- Cost / request. Rank by this column, not by total cost, to find the agents to right-size. The Spend by model donut tells you whether the expensive requests are on the expensive model.
- Cached-token savings card delta. A negative point delta means caching regressed, often after a prompt change broke the cacheable prefix.
- Savings tab. Apply or dismiss what is Open so the total means something. Each applied item is a routing, caching or parameter change on another page; the Apply button here only records the decision.
- Export CSV from the Allocation tab for the finance share-out.

### Before a release or model change

- Budgets scoped to the agent being changed (Scope = Agent). If the new model is more expensive per token, raise the limit or expect Downgrade model to undo the change on the first breach.
- Alert thresholds on those budgets. A budget with only 100% will not warn you; add 50 and 80 before the release so you see the pace change.
- Daily spend chart stacked by Provider after the release. A new provider series appearing where there was none means routing is falling through, which is a cost and a reliability signal.
- Cost / 1K requests chart in the days after release. Compare the level before and after; this is the cleanest unit-cost view because it is independent of volume.
- Savings opportunities tied to the agent. A model change can make an open opportunity obsolete (or realised); dismiss or apply accordingly.

## Actions

| Action                                               | Where                 | What happens in this template                                                                                                                                  |
| ---------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack daily spend by Agent or Provider               | Overview chart toggle | Client-side regrouping                                                                                                                                         |
| Edit budget (limit, thresholds, breach action, note) | Budget sheet          | Patches the shared budget store, recomputes status, toasts the changes; AlertDialog before escalating an at-risk or exceeded budget to Throttle or Pause agent |
| New budget                                           | Budgets toolbar       | Opens the sheet in create mode and adds the row to the store                                                                                                   |
| Export CSV                                           | Allocation toolbar    | Builds the CSV client-side from `costByAgent` and saves it as a Blob download                                                                                  |
| Apply savings opportunity                            | Savings card          | Sets status Applied in the shared store, toasts with Undo                                                                                                      |
| Dismiss savings opportunity                          | Savings card          | Sets status Dismissed in the shared store, toasts with Undo                                                                                                    |
| Recommendation / Experiment / All recommendations    | Savings tab           | Navigates to `/agentops/recommendations` or `/agentops/experiments?open=<id>`                                                                                  |

No action changes a limit, a route or a quota anywhere else; all mutations are in-memory.

## Reading the data

### Budget status

Computed in `lib/data/costs.ts` from spent, projected and limit:

| Status   | Rule                       | Meaning                                                        |
| -------- | -------------------------- | -------------------------------------------------------------- |
| Exceeded | `spent >= limit`           | The breach action is in effect                                 |
| At risk  | `projected >= 0.9 * limit` | Linear projection ends the period at or above 90% of the limit |
| On track | otherwise                  | Pacing within limit                                            |

Projection: for daily budgets `spent / max(0.2, fractionOfDayElapsed)`; for monthly budgets `spent / (dayOfMonth - 1 + fractionOfDayElapsed) * daysInMonth`.

### Used bar tone

`budgetTone` in `features/agentops/costs/shared.ts`: danger at 100% or more; warning when the percentage used is at or above the highest configured threshold under 100 (default 80 when none), or when the status is At risk; otherwise brand. The pace marker on the bar is the share of the period that has elapsed.

### Breach actions

| Action          | Effect described in the product                       |
| --------------- | ----------------------------------------------------- |
| Alert only      | Notify the owner; keep serving                        |
| Throttle        | Halve the agent's RPM quota until the period resets   |
| Downgrade model | Route to the next cheaper model in the chain          |
| Pause agent     | Stop serving requests until the owner lifts the pause |

### Other thresholds and formulas

- Month to date bar: amber when `mtdPct > pace * 1.1`.
- Δ vs last week colour: muted when `|delta| < 1`, red when positive, green when negative.
- Forecast: MTD spend plus the average of the trailing 14 full days multiplied by the remaining days (including the rest of today).
- Monthly budget total on the Month to date card is the sum of limits of monthly, team-scoped budgets only (Platform, Service Desk, People Ops, Site Reliability, Change Management in the sample).
- Cost / 1K requests is total cost divided by total requests times 1000 over the window.
- Cached-token savings percent is `cachedSavings / (cost + cachedSavings)` over 7 days.
- Model pricing (USD per 1M tokens) lives in `modelPricing`; cached input is priced separately so savings can be computed.

### Savings kinds

| Kind           | Where you act on it                                              |
| -------------- | ---------------------------------------------------------------- |
| Routing        | Providers & Routing, Routing tab (chain, weights)                |
| Prompt caching | Prompts and the agent's model parameters                         |
| Output tokens  | Agent `params.maxOutputTokens` via the param editor              |
| Batch API      | Schedules & Triggers (move the scheduled job to batch)           |
| Commitment     | Providers & Routing, weighted rule toward the committed provider |

## How the data gets here

Everything comes from `lib/data/costs.ts` (seed `7651`, anchored to `NOW`).

- Types: `CostDay`, `Budget`, `BudgetScope`, `BudgetPeriod`, `BudgetScopeKind`, `BudgetAction`, `BudgetStatus`, `AgentCost`, `SavingsOpportunity`, `SavingsKind`.
- Exports: `costDaily` (30 days, derived from each deployed agent's `metrics.costPerDay` with weekend dips, a partial today, per-agent drift and a fixed provider mix), `costToday`, `spendTodayByAgent`, `spendTodayByProvider`, `costByAgent` (one row per deployed agent with spend) with `costByAgentWindowDays = 7`, `budgets` (13), `budgetsAtRiskCount`, `savingsOpportunities` (6), `modelPricing`, `forecastMonthEnd()`, `monthlyBudgetTotal`, `monthToDateSpend`, `getBudget`.
- Daily series are derived from `deployedAgents` in `lib/data/agentops.ts`, so the numbers agree with the fleet overview. Provider names come from `lib/data/providers.ts`.
- Formatting and CSV helpers are in `features/agentops/costs/shared.ts` (`fmtUsd`, `fmtPerRequest`, `budgetPct`, `budgetTone`, `periodPace`, `toCsv`, `downloadText`).
- The page (`app/(app)/agentops/costs/page.tsx`) is a static shell: it renders `PageHeader nav="/agentops/costs"` and, inside `<Suspense fallback={<TableSkeleton />}>`, `CostsRoute` (`features/agentops/costs/costs-route.tsx`), a client component that reads `?tab=`, `?agent=` and `?budget=` with `useSearchParams` (the tab guard lives in `tabs.ts`) so the page never touches `searchParams` and exports statically. `costs-view.tsx` renders the overview and the three tabs from those props and writes tab and sheet changes back with `setQueryParam`, so the URL is the source of truth. Client state lives in `features/agentops/costs/store.ts` (`budgetStore`, `savingsStore`, `budgetNoteStore` built on `createListStore` / `createStore` from `lib/store.ts`), so the overview, tab counts, tables and cards stay in sync; a reload returns to the seed. `loading.tsx` renders the shared `TableSkeleton`.

To wire a backend you need: a daily cost series with per-agent and per-provider breakdowns and token counts (the gateway or trace store can produce this), a per-agent 7-day aggregate with the previous 7 days for deltas, a budget service that returns spent and projected per budget and accepts limit, threshold and action updates, and a recommendations source for savings. Keep the pricing table server-side so historical cost survives price changes. The Apply and Dismiss actions on savings should write back to the recommendations service rather than local state.

## Related pages

- Providers & Routing (`/agentops/providers`) for the routing chains and commitments behind the Routing and Commitment savings kinds; the header button links to `?tab=routing`.
- Recommendations (`/agentops/recommendations`) for the full list behind the Savings tab.
- Agents (`/agentops/agents/<id>`) via Allocation rows and the Top mover card.
- Schedules & Triggers (`/agentops/schedules`) for per-run budgets on scheduled jobs and the "Budget threshold" trigger source.
- Audit Log (`/agentops/audit`) records budget changes in the sample data.
- Readiness Assessment (`/agentops/readiness`) controls CST-01 (cost attribution), CST-02 (budgets with alerts and hard caps) and CST-05 (caching) point at this page as evidence.
