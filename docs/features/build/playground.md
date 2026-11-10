# Playground

The Playground is where you change generation and agent-loop parameters for a deployed agent without touching production. You pick an agent, a prompt version from the Prompt Registry and a model, edit every field of `ModelParams`, run a prompt, read latency, tokens, cost and an estimated quality score, and compare two configurations side by side. From there you can save the configuration as a draft prompt version, apply it as the session baseline, copy a comparison summary for an experiment, or copy a share link that reproduces the setup.

In this template runs are simulated. The transcript and metrics are deterministic functions of the configuration and the input, so the same setup always produces the same result and the page can be used to learn the parameter model without an API key.

## Where to find it

- Sidebar: Build, Playground. Keyboard chord `G` then `L`.
- Route: `/agentops/playground`. Deep-link contract: `?agent=<agt-id>` selects the agent, `?pv=<p-N>` selects the prompt version (`prompt=<p-N>` is accepted as an alias; a version that does not belong to the agent falls back to the deployed one). The full configuration can be encoded in the query string (see "Share link" below); opening a shared URL restores the exact setup for column A.
- Code: route `app/(app)/agentops/playground/page.tsx` and `loading.tsx`; UI in `features/agentops/playground/` (`playground.tsx`, `config-panel.tsx`, `param-editor.tsx`, `param-fields.ts`, `applied-config-store.ts`, `metrics-strip.tsx`, `run-transcript.tsx`, `runs-list.tsx`, `playground-skeleton.tsx`, `use-simulated-run.ts`); data and simulation in `lib/data/playground.ts`; parameter type `ModelParams` in `lib/types.ts`; prompt versions from `features/agentops/prompts/prompt-store.ts`.

## What is on the page

Header: eyebrow "Build", title "Playground" (from `config/nav.ts`). The route skeleton and the Suspense fallback share one `PlaygroundSkeleton` so the page does not flash two shapes.

Two-column layout: a sticky Configuration panel on the left (a `Section` with the A/B toggle as its action in compare mode), the run area on the right.

### Configuration panel

- Agent select: every deployed agent with its environment badge. Below it: agent version, framework and an "open record" link. Changing the agent resets prompt version, model and parameters to that agent's deployed values. If the prompt text is still the sample prompt it switches to the new agent's sample.
- Prompt version select: every version of the prompt the agent serves, newest first, read from the Prompt Registry store (`versionsForAgent`): `p-41 · production · deployed`, `p-42 · staging`, drafts saved in this session, and so on. A version named in the URL that is not in the list is appended as-is.
- Model select: the curated models from `lib/ai/agents.ts` that have an `openRouterId`, grouped by provider with the tier (fast, balanced, reasoning) on the right.
- Parameter editor (`ParamEditor`, compact density). A small brand-coloured dot after a label (with screen-reader text "changed from deployed") means the value differs from the baseline.
- Diff vs deployed card: "in sync" or "N changed" badge and one row per difference (Model, Prompt, then each parameter) with the baseline value struck through and the new value next to it. After "Apply to agent" the card reads "Diff vs applied".
- Buttons: Reset to deployed (or applied), Save as version, Apply to agent, Share link.

In compare mode an A / B toggle in the Configuration header chooses which configuration you are editing; the panel reads "Editing configuration A" or "B".

### Parameter editor fields

| Field               | Control                  | Range and step          | Notes                                                                                                                                                                  |
| ------------------- | ------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temperature         | Slider plus number input | 0 to 2, step 0.1        | Hint "0 = deterministic, 2 = very creative"                                                                                                                            |
| Top P               | Slider plus number input | 0 to 1, step 0.01       | Nucleus sampling cut-off                                                                                                                                               |
| Max output tokens   | Number                   | 1 to 128,000, step 64   | Hard cap per response                                                                                                                                                  |
| Timeout (s)         | Number                   | 1 to 600                | Stored as `timeoutMs`                                                                                                                                                  |
| Seed                | Number, optional         | 0 and up                | Empty means none                                                                                                                                                       |
| Max tool calls      | Number                   | 0 to 50                 | Agent-loop budget per run                                                                                                                                              |
| Max retries         | Number                   | 0 to 10                 | Retries on transient provider errors                                                                                                                                   |
| Frequency penalty   | Number, optional         | -2 to 2, step 0.1       | Empty means none                                                                                                                                                       |
| Presence penalty    | Number, optional         | -2 to 2, step 0.1       | Empty means none                                                                                                                                                       |
| Reasoning effort    | Segmented                | none, low, medium, high |                                                                                                                                                                        |
| Tool choice         | Segmented                | auto, required, none    |                                                                                                                                                                        |
| Parallel tool calls | Switch                   | on/off                  | Disabled when tool choice is none                                                                                                                                      |
| Response format     | Segmented                | Text, JSON schema       | Selecting JSON schema reveals a collapsible schema editor                                                                                                              |
| JSON schema         | Textarea                 | free text               | Starts from a sample triage schema; badge shows "valid" or "invalid JSON". The schema is editor-local: it is not part of the configuration, the diff or the share link |
| Stop sequences      | Chip input               | any strings             | Enter or comma adds, Backspace on an empty input removes the last chip, blur adds the pending text                                                                     |

The number grid is two columns in the compact panel and two columns stepping to three at `sm` elsewhere, so it fits inside the agent configuration sheet on a phone.

The two penalties are not yet in the shared `paramFields` list in `lib/data/playground.ts`; `features/agentops/playground/param-fields.ts` extends that list (`allParamFields`, `diffAllParams`) and reads and writes them on share links (`freq_penalty`, `presence_penalty`). The prompt record's parameter grid uses the same labels.

### Run area

- Mode toggle: Single, Compare A/B. Switching to compare clones A into B and clears B's result. Switching back keeps editing A.
- "Copy comparison for an experiment" (compare mode only) and an "Agent record" link to agent A.
- Prompt input: a textarea for the user turn. `{{variable}}` placeholders produce one input per variable below the textarea, prefilled from the agent's sample prompt where a sample value exists. The rendered input is the prompt with variables substituted; unfilled variables stay as literal `{{name}}`. Footer shows the model chip, prompt version badge and `T <temperature> · <reasoning effort>` (in compare mode, the A and B model chips). Submit button reads "Run" or "Run both"; while streaming it becomes "Stop" and the keyboard hint switches from "Enter run, Shift+Enter newline" to "Esc stop".
- Results. Single mode: one card with a metrics strip and the transcript. Compare mode: two cards (A and B); the one being edited has a ring. Each header shows the column badge, model chip, prompt version and either "same as B" or "N differ from B" (parameters plus model).
- Metrics strip: four `MetricTile`s, Latency, Tokens in / out, Cost (four decimals), Est. quality (score bar, hint "Heuristic, 0 to 100"). In compare mode each tile shows a signed delta versus the other column: latency, tokens and cost as a percentage where lower is better, quality in points where higher is better. Warnings from the configuration are listed under the tiles once the run finishes.
- Transcript (loaded on first run with `next/dynamic` so the markdown stack stays out of the initial bundle): the user message, then the agent's reply built from a collapsible reasoning block (empty when reasoning effort is none), one collapsible card per tool call with input and output, and the answer in markdown. The reveal is animated to roughly 60 percent of the simulated latency, clamped between 1.1 and 4.2 seconds.
- Runs: a `Section` with a count pill listing the last 8 runs of this browser session, newest first. Each row shows `#n`, the A/B badge when run in compare mode, agent, model, prompt version, a parameter summary (`T 0.2 · top_p 0.95 · low · auto · text`), latency, cost, `Q <quality>` tinted by score, and a Re-run button.

### Keyboard

- Enter in the prompt textarea runs; Shift+Enter inserts a newline.
- Escape while a run is streaming stops the reveal (the result is already computed; stopping just shows the whole transcript). The footer hint shows "Esc stop" while streaming.
- Global chords still work: `G` then `L` returns here, `⌘K` opens the command menu.

## What to check

### Every day

- Diff vs deployed badge before you apply anything. "in sync" means the panel equals the baseline; any other number is a list of what you are about to change. Read it.
- Warnings under the metrics strip. Each one maps to a concrete rule in `configWarnings` (see Reading the data). A configuration that produces a warning should not be applied to an agent.
- Est. quality below 80 (red) for a configuration that matches production. The simulation penalises specific settings; find which one in the quality rules and fix the setting rather than the prompt.
- Truncation marker "[output truncated at max tokens]" at the end of an answer. The output cap is lower than the reasoning budget plus the answer. Raise Max output tokens or lower Reasoning effort.

### Every week

- Agents whose deployed parameters trip a warning. Select each agent and look at the warnings with the panel in sync. The common ones: tool choice none on an agent that has tools, output cap below 512, high reasoning effort with a timeout under 90 seconds.
- Prompt version select. The entry marked "deployed" is the agent's `promptVersion`; if it is not the registry's production version, the agent record is stale.
- Runs list, Q values across a comparison. If B beats A on quality by 3 points or more and costs the same or less, draft the experiment instead of applying directly; the Playground proves nothing about real traffic.

### Before a release or model change

- Compare A/B with A in sync and B as the candidate. Confirm all four tiles move the way you expect: lower latency and cost are green, fewer tokens are green, higher quality is green.
- Model change: check the pricing table in `modelPricing` covers the new model id. Unknown ids fall back to $2 input and $8 output per million tokens, which makes the cost tile wrong.
- Response format JSON schema with temperature above 0.7. The simulation adds an off-schema field some of the time and docks 12 quality points; a real model will do the same.
- Reasoning effort high: the simulation adds 1,200 output tokens and 900 ms. Make sure Max output tokens and Timeout are sized for it.
- Max tool calls below the number of tools the agent actually needs per turn. The agent will stop mid-task; the simulation docks points when the budget is below 2 and the agent has more than one tool.
- Seed set: fine for the Playground, but a fixed seed in production hides variance. Remove it before Apply.

## Actions

| Action                            | Where                     | What happens in this template                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run / Run both                    | Prompt footer, Enter      | Computes `simulateRun(config, input)` synchronously per column, adds one run record per column to the Runs list (capped at 8), plays the reveal                                                                                                                                                                                          |
| Stop                              | Prompt footer, Escape     | Ends the reveal and shows the full result                                                                                                                                                                                                                                                                                                |
| Re-run                            | Runs list                 | Restores that run's configuration and prompt into A (or B when it was a B run in compare mode), clears variable overrides, runs again                                                                                                                                                                                                    |
| Single / Compare A/B              | Toolbar                   | Toggles compare mode; B is cloned from A when enabled                                                                                                                                                                                                                                                                                    |
| A / B                             | Configuration header      | Chooses which column the panel edits                                                                                                                                                                                                                                                                                                     |
| Reset to deployed                 | Configuration             | Sets model, prompt version and parameters back to the baseline (deployed, or applied this session). Disabled when in sync                                                                                                                                                                                                                |
| Save as version                   | Configuration             | Creates a `draft` version on the agent's prompt in the Prompt Registry store with this model and these parameters and the selected version's template; the change note lists what differs from the baseline. The new `p-N` is selected in the panel and the toast offers "Open in registry" (`/agentops/prompts/<prm-id>?version=<p-N>`) |
| Apply to agent                    | Configuration             | Confirmation dialog listing every difference. Confirm records the configuration as the agent's baseline for this browser session (`applied-config-store.ts`): the diff reads "Diff vs applied", Reset returns to it. The deployed agent record in `lib/data` is not changed. Disabled when in sync                                       |
| Share link                        | Configuration             | Writes `/agentops/playground?agent=…&model=…&pv=…&temp=…` (plus `freq_penalty` and `presence_penalty` when set) to the clipboard and toasts; falls back to a "Clipboard unavailable" toast containing the URL                                                                                                                            |
| Copy comparison for an experiment | Toolbar, compare mode     | Copies a plain-text summary of A vs B (versions, models, parameter differences and the last run's quality and latency) to the clipboard; toast with an "Open experiments" action. Experiments are created on the Experiments page                                                                                                        |
| Agent record / open record        | Toolbar and configuration | Navigates to `/agentops/agents/agt-…`                                                                                                                                                                                                                                                                                                    |

Share link parameters: `agent`, `model`, `pv`, `temp`, `top_p`, `max_tokens`, `effort`, `tool_choice`, `parallel` (`1` or `0`), `format`, `stop` (comma separated), `seed`, `timeout` (milliseconds), `max_tools`, `retries`, `freq_penalty`, `presence_penalty`. Missing values fall back to the agent's deployed values; numbers are clamped to the editor ranges; an unknown `model` falls back to the agent's model; an unknown `pv` falls back to the deployed version.

## Reading the data

Metrics (`RunMetrics`):

| Tile         | How it is computed in the simulation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latency      | `380 ms + tokensOut × ms per token (reasoning 26, balanced 16, fast 8) + tool time + 120 ms per tool + 900 ms if reasoning effort is high + jitter`. Tool time is divided by 1.8 when parallel tool calls is on and more than one tool ran                                                                                                                                                                                                                                                                           |
| Tokens in    | `820 + 160 × number of agent tools + input chars / 4 + tool input and output chars / 4`, with small jitter                                                                                                                                                                                                                                                                                                                                                                                                           |
| Tokens out   | Answer chars / 4 plus the reasoning budget (none 0, low 140, medium 460, high 1,200), capped at Max output tokens. Exceeding the cap sets `truncated`                                                                                                                                                                                                                                                                                                                                                                |
| Cost         | `(tokensIn × input price + tokensOut × output price) / 1,000,000` from `modelPricing` (USD per million tokens), fallback 2 and 8                                                                                                                                                                                                                                                                                                                                                                                     |
| Est. quality | Base by model tier (reasoning 92, balanced 88, fast 82), then: minus 12 for JSON schema with temperature above 0.7; minus 6 for temperature above 1.2; minus 4 for top_p below 0.5; minus 4 for reasoning effort none; plus 3 for medium or high effort on a reasoning-tier model; minus 8 if truncated; minus 7 for tool choice none on an agent that has tools; minus 3 for max tool calls below 2 on an agent with more than one tool; minus 5 for max output tokens below 512; small jitter; clamped to 40 to 99 |

Score bar colours use the shared `scoreTone`: green at or above 90, amber at or above 80, red below.

Compare deltas: latency, tokens and cost are relative percentages where lower is better (green when the column is lower). Quality is an absolute point difference where higher is better; differences under 0.5 percent read as 0.

Configuration warnings (`configWarnings`):

| Condition                                    | Message                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| JSON schema and temperature above 0.7        | High temperature with a JSON schema raises malformed-output risk |
| Temperature above 1.2                        | Temperature above 1.2 is rarely useful                           |
| Tool choice none                             | Tools are disabled; the agent will answer from context only      |
| Max output tokens below 512                  | Low output cap may truncate answers                              |
| Reasoning effort high and timeout below 90 s | High reasoning effort with a short timeout risks timeouts        |

Simulated behaviour worth knowing: temperature at or above 0.9 appends a chatty closing sentence to the answer; tool calls are skipped when tool choice is none or max tool calls is 0, otherwise 1 to 3 tools (2 to 3 when required) up to the budget and the agent's tool list; JSON schema mode replaces the answer with a fenced JSON block.

Parameter labels and formats used in the diff come from `paramFields` in `lib/data/playground.ts` plus the two penalty fields in `features/agentops/playground/param-fields.ts`.

## How the data gets here

Module: `lib/data/playground.ts`.

Types: `PlaygroundConfig` (agentId, promptVersion, modelId, params), `RunMetrics`, `SimulatedToolCall`, `PlaygroundResult`, `PlaygroundRunRecord`, `ParamDiff`, `ParamField`. Exports used by the UI: `modelPricing`, `getModelPricing`, `estimateCost`, `getPlaygroundModel`, `reasoningEffortOptions`, `toolChoiceOptions`, `paramFields`, `defaultModelParams`, `cloneParams`, `defaultPlaygroundConfig`, `sampleJsonSchema`, `configToSearchParams`, `configFromSearchParams`, `extractVariables`, `renderPrompt`, `getSamplePrompt`, `estimateQuality`, `configWarnings`, `simulateRun`. `promptVersionOptions` (synthetic drafts) is no longer used by the Playground.

The deployed baseline comes from `DeployedAgent.params`, `modelId` and `promptVersion` in `lib/data/agentops.ts`, overridden per session by `applied-config-store.ts`. Prompt versions come from `features/agentops/prompts/prompt-store.ts`. Models come from `models` in `lib/ai/agents.ts`.

To wire a backend: replace `simulateRun` with a call to your gateway that returns `PlaygroundResult` (keep `useSimulatedRun` for the streaming reveal or swap it for a real stream), replace `createVersion` in the prompt store with your registry API, replace `applyConfig` with a deployment mutation, and keep `ParamEditor` as the only editor for `ModelParams`; the agent configuration sheet and releases reuse it.

## Related pages

- Prompts (`/agentops/prompts/prm-…?version=p-N`): the registry the saved version lands in; version `p-N` ids.
- Agents (`/agentops/agents/agt-…`): deployed `params`, `modelId`, `promptVersion` that the diff compares against.
- Experiments (`/agentops/experiments`): where a compare result becomes a traffic split.
- Model Catalog (`/ai/models`): context, pricing and capabilities of the models in the select.
- Evals & Datasets (`/agentops/evals`): the real quality signal; the Playground score is a heuristic.
- Deployments (`/agentops/deployments`): releases carry the same `ModelParams`.
