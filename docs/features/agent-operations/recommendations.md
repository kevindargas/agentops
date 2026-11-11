# Recommendations

Recommendations are proposed model or configuration changes for a specific agent, each backed by evidence: a before and after value per metric, a confidence score, an estimated monthly saving where relevant, and a link to the experiment that is testing it. They come from shadow evaluations, running experiments, cost telemetry and provider deprecation notices. A person decides what ships.

Agent owners and the platform team review them weekly; nothing is applied automatically.

## Where to find it

- Nav group: Agent Operations, "Recommendations". The sidebar badge is the live count of `New` items (`getNavCounts().recommendations`). No keyboard chord.
- Route: `/agentops/recommendations`. The page title matches the nav entry, "Recommendations". `?open=<rec-id>` scrolls to and outlines one card (switching the filter to `all` if the card is not open); `?agent=<agt-id>` scopes the list and the title to one agent. Code: `app/(app)/agentops/recommendations/page.tsx` (static header), URL reader in `features/agentops/recommendations-view.tsx` (client, inside `Suspense`; also accepts the older `?rec=`), scoped title in `features/agentops/agent-scoped-title.tsx`, list in `features/agentops/recommendations-list.tsx`, state in `features/agentops/stores.ts` (`recommendationStore`).
- The same list is embedded, scoped to one agent, in the Recommendations tab of an agent record, and open recommendations are listed in the record's aside.
- Entry points: "Needs a decision" on the fleet overview and recommendation titles on an agent record (both carry `?open=`); the "Tests recommendation" chip in an experiment sheet.

## What is on the page

**Filter row.** Toggle group: `open` (default; status `New` or `Testing`), `New`, `Testing`, `Applied`, `Dismissed`, `all`. On the right, when the open set has savings: "$N / month identified in open recommendations" (sum of `savingsPerMonth` over `New` and `Testing` items).

**Cards**, sorted by confidence descending, two per row on wide screens. Empty state: "Nothing to recommend. Recommendations appear when shadow evaluations, experiments or provider notices show a better configuration for an agent.", with a "Show all" button when a filter is active.

| Element | Content |
| --- | --- |
| Kind icon and label | Cost (coins), Quality (sparkles), Latency (gauge), Deprecation (warning triangle), Context (layers) |
| Agent chip and age | Links to the agent record |
| Title | For example "Move IT Helpdesk Copilot to Claude Haiku 5.5" |
| Status badge | `New`, `Testing`, `Applied`, `Dismissed` |
| Model change row | From-model → to-model chips with provider names. Hidden when both models are the same (context and quality recommendations that keep the model) |
| Summary | One paragraph of reasoning |
| Evidence list | One row per metric: name, from value → to value. The target value is green when the change is good and red when it is a trade-off (for example cost going up) |
| Confidence badge | Percentage |
| Savings badge | "Saves $N/mo", only when `savingsPerMonth` is set |
| Actions | View experiment, Start A/B test, Apply, Dismiss (see below) |

Dismissed cards are dimmed.

## What to check

### Every day

- Nothing on this page needs daily attention on its own. Open it when the fleet overview's "Needs a decision" count changes or a deprecation notice arrives.
- **Deprecation recommendations.** These have a date in the title (the seeded one says the model reaches end of life on Dec 15). Treat them as incidents with a deadline: either Apply or Start A/B test now so the switch happens before the provider turns the model off.

### Every week

- **Open count and the savings line.** Every `New` item should become `Testing` (via an experiment), `Applied` or `Dismissed` within a week or two. Old `New` items are a sign nobody owns the decision.
- **Confidence.** Items at 90% or above with all-green evidence (the seeded deprecation swap shows no regression) can be applied directly. Items between 70 and 90%, or with any red evidence row, should go through an experiment first.
- **Red evidence rows.** A latency or quality gain that costs more per request (the seeded Change Risk and Ops Analyst items) must be accepted by whoever owns the budget. Read the Budgets card on the agent record before applying.
- **Testing items.** Click "View experiment" and check the verdict. If the experiment is at 95% or above with B winning (the seeded helpdesk Haiku experiment), promote it there and then Apply here so the statuses agree.
- **Dismissed items.** Read the summary once; a dismissed quality recommendation such as "Keep Policy Answers on Gemini 3 Flash" records why a cheaper model was rejected, which saves the next person from retrying it.

### Before a release or model change

- Search this page for the agent you are changing. If there is an open recommendation pointing at a different model or configuration, either fold it into the release or dismiss it with a reason so there is one direction of travel.
- If the release is itself the result of a recommendation, mark the recommendation `Applied` after rollout and link the release to the experiment id so the evidence trail is complete.
- Check for a `Deprecation` item on the target model; do not release onto a model the provider has scheduled for removal.

## Actions

| Action | Shown when | Effect in this template |
| --- | --- | --- |
| View experiment | `experimentId` is set | Link to `/agentops/experiments?open=<exp-id>` |
| Start A/B test | No `experimentId` and status `New` | Creates a `Draft` experiment in the shared experiment store via `draftExperiment` (kind `model` when the models differ, otherwise `prompt`; primary metric from the recommendation kind; hypothesis is the summary; variant B carries `toModelId`), sets the recommendation to `Testing` with the new `experimentId`, and toasts "A/B test drafted with a 20% split" (`defaultExperimentSplit`) with an "Open experiment" action |
| Apply | Status `New` or `Testing` | Status becomes `Applied`; toast "Marked applied: <title before the colon>" explains that the change still ships through Deployments; Undo action |
| Dismiss (X) | Status `New` or `Testing` | Status becomes `Dismissed`; toast "Recommendation dismissed" with Undo |
| Filter toggles | always | Filter the cards; the savings line always reflects the open set |

Changes live in `recommendationStore` for the browser session; the fleet overview's "Needs a decision" list reads the same store.

## Reading the data

**Kind** (`RecommendationKind`):

| Kind | Meaning | Typical evidence |
| --- | --- | --- |
| `cost` | Cheaper model or routing for the same quality | Quality score, Cost / 1K requests or Cost / day, p95 |
| `quality` | Keep or change a model for quality reasons | Quality score, Thumbs-up |
| `latency` | Faster model or parallel tooling | p95 latency, Quality, Cost / request |
| `deprecation` | Provider is retiring the current model | Quality and cost of the drop-in successor |
| `context` | Use a larger context window instead of retrieval | Validation failures, p95, Cost / request |

**Status** (`RecommendationStatus`): `New` (blue), `Testing` (accent, an experiment is running), `Applied` (green), `Dismissed` (grey). "Open" in the UI and on the fleet overview means `New` or `Testing`.

**Evidence** (`evidence[]`): `metric`, `from`, `to` as display strings, `good` boolean controlling the green/red tint of the target value. Values are pre-formatted by the producer (for example "$13.30" or "2.9 s").

**Confidence** (`confidence`, 0 to 1): the producer's confidence in the recommendation; shown as a percentage and used as the sort key.

**Savings** (`savingsPerMonth`, USD): only on cost recommendations in the seed; summed into the savings line.

**fromModelId / toModelId**: OpenRouter-style ids such as `anthropic/claude-haiku-5.5`. The model-change row is hidden when they are equal.

## How the data gets here

- `modelRecommendations` from `lib/data/agentops.ts` (`ModelRecommendation`, `RecommendationKind`, `RecommendationStatus` in `lib/types.ts`), seeded into `recommendationStore`. Six seeded items: one `Testing` linked to the running helpdesk experiment, four `New` (two cost, one latency, one deprecation, one context), one `Dismissed` linked to the stopped Policy Answers experiment. `defaultExperimentSplit` (20) from the same module is the split a drafted A/B test starts with.
- Agent and model chips come from `features/agentops/shared.tsx`; badge colours from `stateTone` in `components/shared/status-badge.tsx`.

To wire a backend: replace `modelRecommendations` with the output of your recommendation producers (shadow eval jobs comparing candidate models on the golden set, the experimentation service, cost telemetry, provider deprecation feeds). Replace the `recommendationStore.patch` calls in `RecommendationCard` with mutations: "Start A/B test" already drafts an experiment through `draftExperiment` and stores its id, so point that factory at your experimentation service; "Apply" should trigger a release or configuration change for the agent, and "Dismiss" should record a reason.

## Related pages

- [Experiments](experiments.md), the evidence engine behind `Testing` recommendations.
- [Agents](agents.md) for the Recommendations tab and the model, budgets and run limits a change touches.
- [Drift & Quality](drift-and-quality.md); several seeded recommendations answer a drift signal on the same agent.
- [Fleet Overview](fleet-overview.md) for the "Needs a decision" list and spend by model.
- Build: Model Catalog (`/ai/models`) for pricing and context size of the proposed model; Playground (`/agentops/playground`) to try it. Govern: Deployments (`/agentops/deployments`) for shipping an applied recommendation; Costs & Budgets (`/agentops/costs`) for the savings opportunities view.
