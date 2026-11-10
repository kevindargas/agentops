# Drift and baselines

Drift is any sustained movement of a metric away from the window you consider normal for an agent. AgentOps tracks five kinds and shows them on Drift & Quality, on each agent record and as a fleet-level attention signal.

## Kinds

| Kind | What moved | Typical metric in the sample data |
| --- | --- | --- |
| `input` | What users ask | Topic mix shift measured as a population stability index (PSI) |
| `output` | What the agent answers | Answer length, citation rate, refusal rate |
| `quality` | How well it answers | Evaluator grounded or helpful score |
| `tool` | How tools behave | Tool error rate, tool call count per run |
| `cost` | What it costs | Cost per request, tokens per request |

Each `DriftSignal` has a `baseline`, a `current` value, a `unit`, a `severity` (Info, Warning, Critical), a `state` (Open, Acknowledged, Resolved), an `explanation` and a 14-day `history`.

## Baselines

The baseline is the reference the current value is compared with. In practice it is one of:

- **Release baseline**: the metric at the last promoted release. Quality and output drift use this; a new prompt version resets it.
- **Rolling baseline**: a trailing window (for example the previous 14 days) for input and cost drift, where seasonality matters more than releases.
- **Golden baseline**: the eval composite on the agent's golden dataset. This is the one release gates use.

`DeployedAgent.driftScore` is the PSI of inputs against the baseline window, 0 to 1. The fleet-level quality line on the drift board is compared against `fleetQualityBaseline` (89.5, `lib/data/agentops.ts`). A PSI under 0.1 is usually noise, 0.1 to 0.25 is worth a look, above 0.25 is a real shift. The sample Critical signal on IT Helpdesk Copilot moves from 0.04 to 0.31.

## Reading a signal

1. Kind and metric tell you where to look next: `input` points at knowledge and prompts, `quality` at evals and the review queue, `tool` at Tools & MCP, `cost` at Costs & Budgets.
2. The explanation is written for the operator and usually names the cause (a product update, a model change, a missing article).
3. The history sparkline shows whether this is a step change (a release or an upstream change) or a slope (behaviour creeping).
4. Cross-check with the agent's SLO card: a quality drift signal with a burning error budget is an incident, not a backlog item.

## States

- **Open**: nobody has looked. Critical open signals are the morning's first job.
- **Acknowledged**: someone owns it. The signal keeps updating.
- **Resolved**: the metric is back within its band or the baseline was intentionally reset. Resolve only after confirming on the chart; resolving to clear a list hides the next recurrence.

Buttons on the drift board: Acknowledge (Open signals), Resolve (anything not Resolved), and for non-cost kinds a link to Experiments to test a fix. Both actions update the shared drift store, so the Critical counter, the agent record and the fleet attention list change together; `?state=` filters the board (`Open`, `Acknowledged`, `Resolved`, `active`, `all`). A drafted experiment starts at the default 20 percent split (`defaultExperimentSplit`).

## Responses by kind

| Kind | First response |
| --- | --- |
| `input` | Check Knowledge & Memory for coverage of the new topic; check low-recall queries; consider a prompt version that handles the new intent. |
| `output` | Diff the production prompt version against the previous one; check whether a model alias resolved to a new model (`requestedModelId` vs `responseModelId` on spans). |
| `quality` | Open the latest eval run and the review queue for the agent; if a release is in Canary, pause it. |
| `tool` | Open the tool's recent errors and the MCP server health; check whether the definition digest changed. |
| `cost` | Open the cost allocation table; look for longer outputs, more tool calls or a model change; check routing fallbacks to a more expensive provider. |

## Resetting a baseline

A baseline reset is a deliberate decision that the new behaviour is the intended one. Record it: the readiness controls in the drift domain expect an owner, a reason and a date, and the audit log is where that belongs (an `agent-config` event with `reason`). Do not reset to make a signal go away.
