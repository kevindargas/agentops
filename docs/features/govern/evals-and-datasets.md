# Evals & Datasets

Evals are the regression tests for prompts, models and agents. A candidate configuration runs against a golden set, every case is scored by a set of evaluators (LLM judges, rubrics, schema checks, code), the run is compared with the last completed run on the same agent and dataset, and a per-agent release gate decides whether the candidate may be promoted.

The page is for whoever owns agent quality: platform engineers who maintain the datasets and evaluators, agent owners who run candidates before a release, and reviewers whose corrections feed new golden cases. The release gate is the contract between this page and Deployments.

## Where to find it

- Sidebar: Govern > Evals & Datasets. Keyboard shortcut `G` then `E`. The header is `<PageHeader nav="/agentops/evals" />`, so eyebrow ("Govern"), icon and title come from `config/nav.ts`.
- Routes:
  - `/agentops/evals`, the list page with four tabs.
  - `/agentops/evals/<ev-id>`, the run record (ids look like `ev-2145`).
- Query parameters on the list page:
  - `?tab=runs|datasets|evaluators|gates`. Default `runs`.
  - `?dataset=<dataset-id>` opens the dataset sheet. If `tab` is missing it forces the Datasets tab. Tab and dataset changes are mirrored back into the URL with `setQueryParams` (`history.replaceState`, no navigation).
  - `?run=<ev-id>` (Runs tab) shows a "linked run" banner above the table with the run's agent, prompt version, status and composite plus an `Open run` button, highlights the run id in the grid and scrolls it into view. Release gate chips and the release record link here. The banner's clear button drops the parameter.
  - `?agent=<agt-id>` (Runs tab) pre-selects the Agent facet. The release record links here when a Draft has no gate.
- Files: routes `app/(app)/agentops/evals/page.tsx` and `app/(app)/agentops/evals/[id]/page.tsx` (each with a `loading.tsx`: `TableSkeleton` for the list, `RecordSkeleton` for the record), UI `features/agentops/evals/*`, data `lib/data/evals.ts`.

## What is on the page

### Stat cards (list page)

A `StatGrid` of five cards rendered by the client `EvalsStats`. Run figures are static sample data; Datasets and the gates-failing figure read the client stores (`datasetStore`, `gateStore` in `features/agentops/evals/store.ts`), so adding cases or toggling a gate moves them.

| Card               | Value                                                  | Hint                                                                              |
| ------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Eval runs, 7d      | Runs started in the last 7 days                        | How many are Running or Queued                                                    |
| Pass rate, 7d      | Passed divided by (Passed + Failed) among those runs   | "N of M completed runs passed"                                                    |
| Regressions caught | Sum of `regressions` over completed runs in the window | How many runs were blocked and how many gates are failing; links to the Gates tab |
| Datasets           | Number of datasets                                     | Total golden cases; links to the Datasets tab                                     |
| Judge cost, 7d     | Sum of run cost in the window                          | Cost per run                                                                      |

### Tabs

The tab strip shows a `CountPill` on Runs, Datasets and Evaluators, and the number of failing gates in red on Gates.

#### Runs

A `DataTable` of `EvalRun`, newest first. Rows link to the run record.

| Column     | What it shows                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Run        | `ev-…` id                                                                                                                                                    |
| Target     | Agent chip, prompt version chip (`p-N`), model chip                                                                                                          |
| Dataset    | Dataset name                                                                                                                                                 |
| Trigger    | `Manual`, `CI`, `Scheduled`, `Pre-deploy`                                                                                                                    |
| Scores     | Composite score bar (0 to 100) plus up to four per-evaluator score cells; `+N` for the rest. Blank for in-flight runs. Header tooltip explains the composite |
| Pass rate  | Share of cases that passed every evaluator. Green at 90%+, red below 80%. Header tooltip                                                                     |
| Δ baseline | Composite delta in points against the baseline run, coloured by direction. Header tooltip explains the baseline                                              |
| Cases      | passed / failed with a two-colour bar, or "N queued"                                                                                                         |
| Duration   | Hidden by default                                                                                                                                            |
| Cost       | Judge plus model cost for the run                                                                                                                            |
| Status     | `Passed`, `Failed`, `Running` (pulsing), `Queued`, `Cancelled`                                                                                               |
| Started    | Relative date                                                                                                                                                |
| By         | Hidden by default                                                                                                                                            |

Facets: Agent, Dataset, Trigger, Status. Search covers id, agent, dataset, prompt version, model, trigger and status. Toolbar: `New run`, disabled with a tooltip explaining there is no eval service to call.

#### Datasets

A `DataTable` of `EvalDataset`, most recently updated first. Rows open the dataset sheet.

| Column     | What it shows                                     |
| ---------- | ------------------------------------------------- |
| Dataset    | Name (mono) and description                       |
| Cases      | Case count                                        |
| Size trend | Sparkline of case count over the last 12 versions |
| Sources    | `Prod`, `Human`, `Synthetic`, `Corrections` chips |
| Version    | e.g. `v12`                                        |
| Updated    | Relative date                                     |
| Agents     | First two linked agents, `+N more`                |
| Coverage   | First four tags (intents, risks, languages), `+N` |

Facets: Source, Agent. Toolbar: `New dataset` (disabled with a tooltip; grow a dataset from its sheet instead).

The dataset sheet (shared sheet frame, editor width) shows: version, source and owner badges; four metric tiles (Cases, Runs, Agents, Growth sparkline); Sample cases (six cases from the latest completed run on this dataset with input, expected and last result, or an empty state); Schema (input, expected and metadata fields); Evaluators attached; Coverage tags; Versions with case counts and notes; Recent runs (five, linked). Footer: `Export JSONL` (left), `Add from review queue` (shows how many Corrected or Flagged review items exist for the dataset's agents), `Run eval` (disabled with a tooltip), `Close`.

#### Evaluators

A `DataTable` of `Evaluator`, sorted by how many datasets use them. Rows open the evaluator sheet.

| Column          | What it shows                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evaluator       | Name and description                                                                                                                                                             |
| Type            | `LLM-as-judge`, `Rubric`, `Exact match`, `JSON schema`, `Embedding similarity`, `Regex`, `Custom code`, `Human`; judge model chip when applicable                                |
| Measures        | Faithfulness, Answer relevance, Tool-call accuracy, SQL validity, Policy compliance, Tone, Latency budget, Cost budget, Output format, Semantic match, PII leak, Overall quality |
| Scoring         | Scale: `0-1`, `1-5` or `pass/fail`                                                                                                                                               |
| Cost / case     | USD, or `free`                                                                                                                                                                   |
| Human agreement | Percent agreement with human labels. Green at 90+, amber below 80. "reference" for the Human evaluator                                                                           |
| Datasets        | How many datasets use it                                                                                                                                                         |
| Updated         | Relative date                                                                                                                                                                    |

Facets: Type, Scoring. Headers for Scoring, Cost / case and Human agreement carry tooltips. Toolbar: `New evaluator` (disabled with a tooltip).

The evaluator sheet shows four metric tiles (Human agreement, Cost / case, Datasets, Owner), a 12-week Calibration chart of agreement with human labels anchored to the demo clock (with an amber warning box when agreement is below 80%), the judge prompt / rubric / implementation / reviewer rubric text, and the datasets it is used in. Footer: `Recalibrate` (not for Human) and `Edit`, both disabled with a tooltip, plus `Close`.

#### Gates

One card per deployed agent (`ReleaseGate`). Header: agent chip, `Passed` / `Failed` badge, the agent's current prompt version, model and environment. Body: five rules, each with a pass/fail icon, the requirement and the current value:

| Rule                         | Requirement                       | Current value comes from                                                                                   |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Composite score              | 85 or above                       | Latest completed run on the agent's golden dataset                                                         |
| No regressions on golden set | 0                                 | Same run                                                                                                   |
| PII-leak probes              | 100% pass                         | Latest completed run on `pii-leak-probes-v1` for the agent, else the PII evaluator score on the golden run |
| p95 latency                  | Per-agent budget (2.5 s to 25 s)  | The agent's live p95                                                                                       |
| Cost per case                | Per-agent budget ($0.02 to $0.40) | Run cost divided by cases                                                                                  |

Footer: when it was evaluated, a link to the run, "Ready to promote" or "N rules failing, promotion blocked / advisory", and an `Enforce` switch. Above the grid: how many gates pass and how many are enforced. The empty state (only when filtered to an agent without a gate) links to the runs tab.

### Run record (`/agentops/evals/<id>`)

Header: `<agent> · <dataset>`, the run note (why the candidate exists) or a default description, status badge, trigger badge, and a red `N regressions` badge when applicable. Meta row: Agent, Prompt (`p-N`), Model, Dataset (links to the Datasets tab with the sheet open), Baseline (links to the baseline run, or "none"), Gate (`Passed` / `Failed`, with "advisory" when not enforced; green, red if enforced and failing, amber if advisory and failing).

Actions: `Compare to…` select listing other completed runs for the agent, `Export CSV` (completed runs), `Re-run` (disabled with a tooltip), `Promote to production`. Overflow menu: Open dataset, Show in runs list (`?run=<id>`).

Left column: Run details (Trigger with explanation, Started, Duration, Cost with per-case figure, Started by, Cases "N of M" sampled from the dataset version), Model parameters (temperature, top-p, max output, reasoning, tool choice, response format, max tool calls, timeout), Evaluators used.

Main column, for completed runs:

- A `StatGrid` of four `StatCard`s: Composite (score bar, delta, baseline value), Pass rate (with delta in points, passed and failed counts), Regressions ("passed on baseline, fail now", red when above 0), Improvements ("failed on baseline, pass now", green when above 0).
- Scores by evaluator: one `MetricTile` per evaluator with the mean score on the evaluator's own scale, a score bar, and the delta against the baseline in points. The "measures" label and scale are shown under the name.
- Score distribution: stacked bars of cases per score bin (0-0.2 to 0.8-1.0) for every graded evaluator; pass/fail evaluators are excluded.
- Test cases grid, with a filter toggle `Regressions` / `Failures` / `All`. The default is Regressions when the run has any, otherwise Failures, otherwise All. Columns: `#`, Input, Expected, Actual (red when the case failed and the text differs), one score cell per evaluator (the first five visible), Result (`Pass` / `Fail`), Baseline (Pass / Fail), Changed (`Regression`, `Improvement` or "Same"; sorted regressions first), Latency and Cost (hidden). Compact rows, 25 per page. Clicking a row opens the case sheet.

Case sheet (shared sheet frame): Pass/Fail and change badges, `Flagged` and `In golden set` badges once you act, baseline result, tags, latency and cost; Input; Expected output next to Actual output (red frame when failing and different); Evaluator scores with each evaluator's rationale; the linked production trace with span count, duration and status (or an empty state saying the case was authored or synthesised). Footer: `Flag case`, `Add to golden set`, `Open in playground`, `Close`.

Queued and Running runs show an empty state ("Waiting for a worker" / "Run in progress") instead of results.

## What to check

### Every day

- **Runs tab, Status = Failed, last 24 hours.** Open each one. If `Regressions` is above 0 the candidate broke something that used to work; the grid opens on the Regressions filter so read the rationales first. If regressions are 0 but pass rate is below 80%, the dataset got harder or the agent degraded; check whether the baseline pass rate was also low.
- **Runs stuck in Running or Queued.** Anything in flight for more than an hour or so is a worker problem, not a quality problem. The sample has two Running and one Queued run, all started within the hour.
- **Gates tab, red count on the tab.** Every failing gate on a production agent with `Enforce` on is a blocked promotion. Read which rule fails: composite or regressions means go fix the candidate; PII probes means a safety fix before anything else; p95 or cost means the agent's live metrics are over budget regardless of the candidate.
- **Judge cost, 7d.** A jump without a matching jump in run count means someone attached an expensive LLM judge to a large dataset. Check the Evaluators tab Cost / case column.

### Every week

- **Pass rate, 7d** trending down across several agents points at a shared dependency (model provider, retrieval index, a fleet-wide prompt fragment) rather than one agent.
- **Evaluators tab, Human agreement.** Below 80% is amber and the sheet shows a warning. Below 80% an LLM judge should not be the sole gate on anything; pair it with a code evaluator and `Recalibrate` from recent review-queue labels. Watch the 12-week calibration chart for a downward slope; judge drift is slow and silent. In the sample, `Tone judge` (76%) and `Embedding similarity` (71%) are below the floor.
- **Datasets tab, Size trend.** Flat sparklines on production datasets mean nobody is adding cases from review corrections. Open the sheet and use `Add from review queue` when the count badge is above 0.
- **Datasets tab, Updated.** A golden set that has not changed in months while the agent's prompt has changed several times is testing the wrong thing.
- **Gates tab, Enforce switches.** Every production agent should be enforced. Advisory gates on production agents are a decision somebody made; confirm it is still the right one.

### Before a release or model change

- **Run a Pre-deploy eval of the exact candidate** (prompt version and model) against the agent's golden set. The run note should name the candidate; `Promote to production` is disabled when the target matches what production already serves, when the composite is below the 85 threshold, or when a release already tracks the run.
- **Regressions must be 0.** This is a gate rule. Improvements elsewhere do not offset a regression; a case that passed and now fails is a user who gets a worse answer.
- **Composite at or above 85** on the golden set.
- **PII-leak probes at 100%.** Run `pii-leak-probes-v1` against the candidate, not just the golden set. One leaked SSN in 60 cases is a 98.3% that fails the gate.
- **Red-team run for a model change.** `red-team-injections-v2` feeds the bypass rate shown on the Guardrails page. A new model can be more susceptible to injection than the old one with the same prompt.
- **Per-evaluator deltas.** A composite that holds steady while Faithfulness drops and Tone rises is a hidden regression. Read the Scores by evaluator cards, not just the headline.
- **Cost per case and p95** against the agent's budget. A smarter model that doubles cost per case fails the gate even if quality improves; that is a budget conversation to have before the release, not after.
- **Gate status on the run record** should read `Passed`, and the gate should be enforced. If the record says "advisory", the promote button will work even with failing rules.

## Actions

| Action                           | Where                                                                                   | What it does in this template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New run                          | Runs toolbar                                                                            | Disabled; tooltip says there is no eval service in the template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Open run                         | Runs row, dataset sheet recent runs, gate card link, guardrail sheet, linked-run banner | Navigates to `/agentops/evals/<id>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Compare to…                      | Run record                                                                              | Toast titled `<run> vs <other>` with composite, regression and pass-rate differences and an `Open <other>` action. No comparison view exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Export CSV                       | Run record (completed runs)                                                             | Real download of `<run>-cases.csv`: one row per case with input, expected, actual, result, baseline, change, latency, cost, trace id and every evaluator score                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Re-run                           | Run record                                                                              | Disabled; tooltip names what would be queued                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Promote to production            | Run record                                                                              | Confirmation dialog, then drafts a real release in the shared release store (`draftReleaseFromRun` in `features/agentops/deployments/store.ts`): next `rel-` id, Canary 5% then 25% then 100%, stage `Pending approval`, eval gate = this run with threshold 85 (`GATE_THRESHOLD`), appends `release.created` to the audit log. The toast names the release and offers `Open release`; the button then turns into `Open rel-N`. Disabled with a tooltip when the run is in flight, Failed, below the threshold, the enforced gate is failing, the target already matches production, or a release already tracks it |
| Flag case                        | Case sheet                                                                              | Marks the case in this session (flag icon in the grid, `Flagged` badge in the sheet). Nothing is sent anywhere and the toast says so                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Add to golden set                | Case sheet                                                                              | Adds one case to the run's dataset in `datasetStore`: a session draft version is created (or grown), case count, version and size trend update on the Datasets tab and stat card                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Open in playground               | Case sheet                                                                              | Links to `/agentops/playground?agent=<id>&pv=<p-N>` (the playground reads `pv`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| New dataset                      | Datasets toolbar                                                                        | Disabled; tooltip points at the sheet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Export JSONL                     | Dataset sheet                                                                           | Real download of `<dataset>-<version>.jsonl` with the cases the template can materialise (the sampled cases of the latest completed run); the toast says the full set lives in the eval service                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Add from review queue            | Dataset sheet                                                                           | Adds the Corrected and Flagged review count to the dataset as a session draft version (once per session per dataset); disabled when there is nothing to add                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Run eval                         | Dataset sheet                                                                           | Disabled; tooltip names what would run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| New evaluator, Edit, Recalibrate | Evaluators tab and sheet                                                                | Disabled with tooltips                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Enforce switch                   | Gate card                                                                               | Flips `enforced` in `gateStore`, appends `release.gate.enforced` or `release.gate.advisory` to the audit log, toasts with the event id. Resets on reload                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Runs and evaluators are never mutated. Dataset growth, gate toggles and drafted releases live in client stores until reload; gate toggles and promotions append to the client audit log.

## Reading the data

### Run status

| Status    | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| Passed    | Completed, 0 regressions and pass rate at or above 80%         |
| Failed    | Completed with at least one regression, or pass rate below 80% |
| Running   | Scoring in progress; pulsing badge; no results yet             |
| Queued    | Waiting for a worker                                           |
| Cancelled | Stopped before completion; never becomes a baseline            |

### Baseline and deltas

The baseline is the most recent completed, non-cancelled run on the same agent and dataset. `Δ baseline` is composite minus baseline composite, in points. A regression is a case that passed on the baseline and fails now; an improvement is the reverse. Runs with no earlier run on that agent and dataset show "none" and no deltas.

### Scores

Every evaluator score is stored normalised 0 to 1 and rendered on the evaluator's scale: `0-1` as two decimals, `1-5` as `1 + score * 4`, `pass/fail` as Pass at 0.5 and above. Composite is the unweighted mean across evaluators times 100. Score cells and bars are green at 0.85 (85) and above, amber from 0.70, red below.

### Pass rate colour

Green at 90% and above, plain between 80 and 89, red below 80.

### Trigger

| Trigger    | Hint shown in the run record                  |
| ---------- | --------------------------------------------- |
| Manual     | Started by a person from the console          |
| CI         | Triggered by a pull request on the agent repo |
| Scheduled  | Nightly regression run                        |
| Pre-deploy | Required check before promoting a candidate   |

### Human agreement

Percent of cases where the evaluator agrees with a human label. Green at 90 and above, amber below 80 (also the warning threshold in the sheet). Deterministic evaluators (schema, exact match, latency, cost) sit at 100 and the Human evaluator is the reference.

### Gate

`Passed` when all five rules pass. `enforced: true` means promotions are blocked while failing; `false` means advisory. Budgets per agent are in `gateBudgets` in the data module; agents not listed fall back to 6 s and $0.10.

### Dataset sources

`Production traces` (sampled from real runs), `Human-authored`, `Synthetic`, `Review corrections` (from the review queue). Cases with a `traceId` were sampled from traffic; the case sheet says so when they were not.

## How the data gets here

All of it is in `lib/data/evals.ts`, seeded with `createRng(7701)` (evaluators), `7702` (runs) and `7703` (gates); per-run cases use a hash of the run id.

- `Evaluator` (13): type, optional judge `modelId`, `measures`, `scale`, `prompt` text, `costPerCase`, `humanAgreement`, 12-week `calibration`, `usedInDatasetIds`, owner.
- `EvalDataset` (12, including `red-team-injections-v2`, `pii-leak-probes-v1`, `tool-call-accuracy-v3`, `tone-escalations-v2`): cases, sources, version, agentIds, tags, `sizeTrend`, `evaluatorIds`, `schema`, `versions`. Every `DeployedAgent.evalDataset` resolves to one of these.
- `EvalRun` (46, ids `ev-2100` upward in chronological order): target (agent, prompt version, model), dataset, trigger, status, composite, per-evaluator `scores`, pass rate, delta, `baselineRunId`, case counts, regressions, improvements, duration, cost, started, `byId`, `evaluatorIds`, optional `note`. The three most recent runs are forced to Running, Running and Queued.
- `EvalCase`: built lazily by `getEvalCases(runId)` and memoised, so 46 x 80 cases are never materialised at once. Fields: input, expected, actual, per-evaluator scores and rationales, passed, baselinePassed, change, optional traceId, latency, cost, tags.
- `ReleaseGate` (one per agent, `gate-<agent>`): five `GateRule`s, status, enforced, lastEvaluated, lastRunId.
- Exports: `evaluators`, `getEvaluator`, `evalDatasets`, `getDataset`, `evalRuns`, `getEvalRun`, `getEvalCases`, `releaseGates`, `getReleaseGate`.
- Pure helpers live in `features/agentops/evals/format.ts` (`formatEvalScore`, `triggerHint`, `isEvalsTab`); money, latency and duration come from `@/lib/format` (`formatCost`, `formatMs`, `formatDurationMs`).
- Client stores in `features/agentops/evals/store.ts`: `datasetStore`, `gateStore`, `addCasesToDataset()`, `bumpVersion()`.
- Tests: `features/agentops/evals/evals.test.ts` pins 30 to 50 runs with resolvable references, lazy case counts matching the run, no cases for in-flight runs, and one five-rule gate per agent.

To wire a backend: return the same shapes from your eval service. The run record is a server component that reads the module directly; the list page is a static shell whose `EvalsRoute` (`features/agentops/evals/evals-route.tsx`) reads `?tab=`, `?dataset=`, `?run=` and `?agent=` on the client inside `<Suspense fallback={<TableSkeleton />}>` and drives `EvalsTabs` with them; `EvalsStats`, `EvalsTabs`, `ReleaseGates` and the tables are client components; dataset and gate edits go through `datasetStore` and `gateStore`. Replace the store mutations in `gates.tsx`, `datasets-table.tsx` and `cases-grid.tsx`, the release drafting in `run-actions.tsx`, and the disabled `NotInDemoButton`s with real calls. `getEvalCases` should become a paginated fetch.

## Related pages

- [Deployments](deployments.md): releases carry an eval gate (threshold 85) and link back to the run via `?run=`; approvals are disabled until the gate passes; `Promote to production` drafts a release there.
- [Guardrails](guardrails.md): the red-team bypass rate in each policy sheet links to the eval run it was measured on.
- [Audit Log](audit-log.md): prompt version rejections cite "Eval score below the promotion gate"; release `eval_gate.passed` events come from release activity.
- [Readiness Assessment](readiness-assessment.md): the quality domain controls expect golden sets, judge calibration and release gates to exist.
- Review Queue (`/agentops/reviews`): Corrected and Flagged items are the source for `Add from review queue`.
- Prompts (`/agentops/prompts/<id>`): prompt versions carry eval scores from these runs.
- Playground (`/agentops/playground?agent=<id>&pv=<p-N>`): the case sheet opens the agent and prompt version there.
- Traces (`/agentops/traces/<id>`): cases sampled from production link to their trace.
