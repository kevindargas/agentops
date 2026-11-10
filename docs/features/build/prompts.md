# Prompts

The Prompt Registry is the system of record for every prompt the fleet runs: system prompts, user-turn templates, tool descriptions and evaluator rubrics. Each prompt belongs to one deployed agent and carries an immutable list of versions (`p-N`). A version has a label (`production`, `staging`, `draft`, `archived`), a review state, the model and generation parameters it was evaluated with, an eval score against the agent's golden set, and 24h traffic and cost. Promotion is an explicit, confirmed action, so a quality regression can always be traced back to a line-level diff between two versions.

Prompt owners and the people on call for an agent use this page to see which version is live, what changed between versions, whether the new version scored better on the golden set, and which agents and experiments reference each version.

## Where to find it

- Sidebar: Build, Prompts. Keyboard chord `G` then `P`. Also reachable from the command menu (`⌘K`).
- List: `/agentops/prompts`. `?agent=<agt-id>` pre-selects the Agent facet (the agent and trace records link here this way when the agent has no prompt record).
- Record: `/agentops/prompts/<prm-id>`, for example `/agentops/prompts/prm-support-system`. `?tab=versions|editor|diff|usage` selects the workspace tab and `?version=<p-N>` selects that version in the Editor and emphasises its row on the Versions tab (the Playground, experiments and "New version" link here this way). Unknown ids render a not-found card with a link back to the list.
- Code: route files `app/(app)/agentops/prompts/page.tsx` and `app/(app)/agentops/prompts/[id]/page.tsx` (plus `loading.tsx` skeletons); UI in `features/agentops/prompts/`; client state in `features/agentops/prompts/prompt-store.ts`; data in `lib/data/prompts.ts`.

**Client state.** Every prompt surface reads from `promptStore` (`createListStore` over `lib/data/prompts.ts`): the list page stats and table, the record header, the stat cards, the workspace tabs and the Playground's prompt-version select. A draft saved from the Playground, a prompt registered from the list or a promotion on the record therefore moves every number and list that shows it. The store is not persisted; a reload returns to the seed.

## What is on the page

### List page (`/agentops/prompts`)

Header: eyebrow "Build" and title "Prompts" resolved from `config/nav.ts`; the primary action "New prompt" sits in the header.

Four stat cards (`StatGrid`, computed from the store):

| Card            | Value                                                               | Hint                                                                                                                                 |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Prompts         | Number of prompts                                                   | "across N agents" (distinct `agentId`)                                                                                               |
| Versions        | Total versions across all prompts                                   | "N in production"                                                                                                                    |
| Awaiting review | Versions with `review === "Pending Approval"`, whatever their label | Counts per label, for example "3 draft · 1 staging with review Pending Approval"; "no version has review Pending Approval" when zero |
| Avg eval score  | Mean `evalScore` of production versions that have a score           | "production versions, golden sets"                                                                                                   |

Table (one row per prompt, click opens the record; sr-only caption describes the table):

| Column    | Content                                                                                                             | Sortable                     | Default |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------- |
| Prompt    | Name, slug in mono underneath                                                                                       | yes                          | shown   |
| Agent     | Agent chip, links to `/agentops/agents/agt-…`                                                                       | no                           | shown   |
| Type      | System, User template, Tool description, Evaluator rubric                                                           | yes                          | shown   |
| Latest    | `vN` tag of the newest version plus every label present on the prompt except `archived` (header hint explains this) | yes (by version number)      | shown   |
| Variables | Count of `{{variables}}` in the production template (latest template if no production version); header hint         | yes                          | shown   |
| Model     | Production version's model chip and `t=<temperature>`; "None" without a production version                          | no                           | shown   |
| Eval      | Production version's eval score as a tinted score bar; header hint defines the composite                            | yes                          | shown   |
| Updated   | `updatedAt` (creation time of the newest version)                                                                   | yes, default sort descending | shown   |
| Editor    | Author of the latest version                                                                                        | no                           | hidden  |

Search covers name, slug, description, type label, agent name and every version id (so typing `p-41` finds the prompt that owns it). Facets: Agent, Type, Label (a prompt matches a label if any of its versions carries it, including `archived`).

"New prompt" opens a sheet (editor width, shared sheet frame) with Name, Agent, Type and a Template textarea. Variables are extracted live from `{{name}}` placeholders and shown as chips with a token estimate. "Create draft" is enabled once the name has two or more characters and the template is non-empty; it adds the prompt to the top of the list with a first `draft` version (id `prm-<slug>`, model and parameters copied from the agent) and the toast offers "Open".

### Record page (`/agentops/prompts/<id>`)

The record is a client component (`prompt-record.tsx`) reading the store, so prompts created in this session resolve and promotions move the header.

Record header: prompt id, name, description, badges for each label present on the prompt, type badge, slug badge. Meta row: Owner, Agent, Versions ("N · latest vM"), Updated, and a warning-toned "Review: N awaiting approval" item when any version is pending.

Header actions: "Agent" (links to the agent record) and "New version". Overflow menu: "Run evals on latest" (links to `/agentops/evals?tab=runs`), "Duplicate prompt", "Archive prompt" (confirmation dialog, destructive).

Left column (aside):

- Details: Owner, Agent, Type, Created, Labels, Production (model chip of the production version or "None"), Slug (copyable).
- Linked evals: the agent's golden set (`agent.evalDataset`, links to the agent record) plus every experiment whose variants reference one of this prompt's versions (links to `/agentops/experiments?open=exp-…` with the experiment status badge).
- Guardrails: one row per `prompt.guardrailIds` entry, showing the policy name from `prompt.guardrails` and linking to `/agentops/guardrails?policy=<grd-id>`, each with an "Active" badge. Empty state says policies attach at the agent level until the prompt gets its own.

Four stat cards (`StatGrid`): Production eval (score bar or "Not run", hint `vN · p-N`), Requests 24h (sum over all versions; hint counts versions with traffic), Variables (count in the production template, or the latest template when there is no production version), Prompt tokens (`~chars/4`, "before variables").

Workspace tabs (synced to `?tab=`; the active tab's count uses `CountPill`): Versions (with count), Editor, Diff, Usage.

**Versions tab.** One row per version, newest first; the row named by `?version=` is emphasised.

| Column     | Content                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version    | `vN` tag, label badge, "Pending Approval" badge when applicable, `p-N` id                                                                                                                                                                                                           |
| Change     | Change note, author chip, created date and time                                                                                                                                                                                                                                     |
| Eval score | Score (green at or above 90, amber at or above 80, red below) and delta versus the closest earlier version that has a score; "Not run" when `null`                                                                                                                                  |
| Model      | Model chip and a one-line parameter summary: `t 0.2 · top_p 0.95 · 2,048 tok · low reasoning`                                                                                                                                                                                       |
| Actions    | Compare (always); Promote (staging and draft) or Rollback (archived); a more menu with "Open in Playground" (`/agentops/playground?agent=<id>&pv=<p-N>`), "Mark as staging" (drafts) and "Archive version" (drafts and staging). Production rows have no promote or rollback button |

Archived rows are rendered in muted text.

Promote and Rollback open a confirmation dialog that names the current production version and its eval score, the target version and its score, the target's change note, a warning when the target has never been evaluated, and an optional change note. Confirming relabels the target `production` with review `Approved`, archives the previous production version and, when a note was entered, appends "Promotion note: …" to the target's change note.

**Editor tab.** Version select (newest first, "vN · label"; changing it writes `?version=`), label badge, and `~tokens · lines · chars` for the selected version. The template renders read-only with `{{variables}}` as chips. A footer explains that edits happen by creating a new version. Right side:

- Variables: one entry per `{{variable}}` in the selected template with description, example and an "optional" marker. Variables that are used in the template but not documented on the prompt show "Undocumented".
- Model parameters: Model, Temperature, Top P, Max output tokens, Reasoning effort, Tool choice, Parallel tool calls, Stop sequences, Response format, Seed, Frequency penalty, Presence penalty, Timeout, Tool-call budget, Max retries (optional values show "None").

**Diff tab.** "From" and "To" version pickers, counts of added, removed and unchanged lines, and a Side by side / Unified toggle. The diff is line-level (longest common subsequence over lines, `features/agentops/prompts/diff.ts`; `DiffOp` is a discriminated union over equal, add and remove). Added lines are tinted green, removed lines red. With fewer than two versions the tab shows "Nothing to compare". Identical templates show "No differences" and explain that only metadata or parameters changed. The default pair is production to newest non-production version; "Compare" on a row sets the pair to production (or the previous version) versus that row and switches to this tab.

**Usage tab.** One row per version, newest first.

| Column        | Content                                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version       | `vN` tag and label badge                                                                                                                                                                                                    |
| Requests 24h  | Bar relative to the busiest version (production bar uses chart colour 1, others colour 5) and the number                                                                                                                    |
| Cost share    | Percentage of the prompt's total `cost24h` ("None" when zero), and the cost itself ("no spend" when zero)                                                                                                                   |
| Referenced by | Agents pinned to this exact version (`agent.promptVersion === version.id`) with their environment badge, and experiments whose variants reference the version. "Not pinned yet" or, for archived versions, "Not referenced" |

Idle rows (no traffic, no agent, no experiment) are muted. If no version has any traffic or reference the tab shows "No traffic yet".

## What to check

### Every day

- Awaiting review stat card on the list page. Anything above zero that has been pending for more than a day is a stalled change. Open the record, check the Versions tab for the pending row and either promote it or archive it.
- Production eval card on each record you own. Below 80 (red) means the production version fails the agent's golden set at the current threshold. Compare it with the previous version in the Diff tab and roll back if the regression lines up with the change note.
- Usage tab, Referenced by column. A production version with zero agents pinned, or an agent pinned to an archived version, means the registry and the fleet disagree. Fix the agent's `promptVersion` (Agents page) or promote the right version.
- Usage tab, Requests 24h. Traffic on a `draft` or `staging` version outside an experiment means something is calling an unreviewed template.

### Every week

- Versions tab, Eval score column. Any version promoted with "Not run" has never been evaluated; the promotion dialog warns about this. Run evals before it reaches production.
- Eval delta versus previous. A promotion with a negative delta should carry a change note explaining the trade-off (for example a safety rule that costs a few points). The promotion dialog's note field is where to write it.
- Editor tab, Variables panel. "Undocumented" variables mean the template references an input nobody has described. Add the description and example to the prompt before the next version.
- Guardrails section on records of customer-facing agents. "No guardrails attached" is acceptable only if the agent itself carries the policies (check the Guardrails page; each listed policy links to its sheet).
- Cost share. One archived version still carrying cost means an agent or experiment is still pointing at it.

### Before a release or model change

- Diff tab between the current production version and the candidate. Read every added and removed line; the counts alone are not a review.
- Editor tab, Model parameters. Confirm the candidate was evaluated with the model and parameters that will actually be deployed. A version evaluated at temperature 0.2 and deployed at 0.7 has not been evaluated.
- Prompt tokens stat card. A jump of several hundred tokens per request multiplies across `requests24h`; check the Costs page before promoting.
- Linked evals. The golden set should belong to the same agent; experiments referencing the candidate should be concluded, not running.
- Variables stat card versus the agent's runtime. A new required variable the agent does not supply will render as a literal `{{name}}` in production.

## Actions

All of these update the shared client store and show a toast that describes exactly what changed. Nothing is persisted; a reload restores the mock data.

| Action                   | Where                                         | What happens in this template                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New prompt, Create draft | List header sheet                             | Adds the prompt with a `draft` v1 to the top of the list and the stats; toast with type, agent, variable count, token estimate and an "Open" action                                                                 |
| New version              | Record header                                 | Creates a `draft` version copying the production (or latest) template and parameters, opens it in the Editor tab (`?tab=editor&version=p-N`); toast offers "Tune in Playground"                                     |
| Agent                    | Record header                                 | Navigates to `/agentops/agents/<agentId>`                                                                                                                                                                           |
| Run evals on latest      | Record overflow                               | Navigates to `/agentops/evals?tab=runs`; the toast says runs are started there                                                                                                                                      |
| Duplicate prompt         | Record overflow                               | Creates a new prompt "<name> (copy)" with a draft copy of the current version; toast offers "Open"                                                                                                                  |
| Archive prompt           | Record overflow                               | Confirmation dialog, then every version is labelled `archived`; rollback from the Versions tab restores one                                                                                                         |
| Promote                  | Versions tab, staging or draft rows           | Confirmation dialog with scores and an optional note; target becomes `production` with review `Approved`, the previous production version becomes `archived`. Reflected in every tab, the header and the list stats |
| Rollback                 | Versions tab, archived rows                   | Same dialog and mechanics as Promote; the toast notes the replaced version was archived, not deleted                                                                                                                |
| Mark as staging          | Versions tab, more menu on drafts             | Relabels the version `staging`                                                                                                                                                                                      |
| Archive version          | Versions tab, more menu on drafts and staging | Relabels the version `archived`                                                                                                                                                                                     |
| Open in Playground       | Versions tab, more menu                       | Navigates to `/agentops/playground?agent=<id>&pv=<p-N>`                                                                                                                                                             |
| Compare                  | Versions tab                                  | Sets the diff pair and switches to the Diff tab                                                                                                                                                                     |
| Version select           | Editor and Diff tabs                          | Changes which version is rendered; the Editor writes `?version=`                                                                                                                                                    |
| Side by side / Unified   | Diff tab                                      | Diff layout                                                                                                                                                                                                         |
| Copy slug                | Details                                       | Copies to clipboard                                                                                                                                                                                                 |

## Reading the data

| Field or badge           | Meaning                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prm-…`                  | Prompt id. `p-N` is a version id; ids are global, so `p-41` is unique across all prompts and agents and experiments reference it directly. New versions take the next free number across the whole registry                                                                                                                       |
| `vN`                     | Display form of `p-N`                                                                                                                                                                                                                                                                                                             |
| production (green)       | The version agents serve. At most one per prompt                                                                                                                                                                                                                                                                                  |
| staging (blue)           | Candidate under evaluation                                                                                                                                                                                                                                                                                                        |
| draft (grey)             | Work in progress. Defaults to review "Pending Approval"                                                                                                                                                                                                                                                                           |
| archived (grey)          | Replaced. Still available for rollback                                                                                                                                                                                                                                                                                            |
| Pending Approval (amber) | Review state; drives the "Awaiting review" stat regardless of label                                                                                                                                                                                                                                                               |
| Type                     | System, User template, Tool description, Evaluator rubric                                                                                                                                                                                                                                                                         |
| Eval score               | Evaluator composite 0 to 100 on the agent's golden set. Tinted by `scoreTone`: green at or above 90, amber at or above 80, red below. `null` renders "Not run"                                                                                                                                                                    |
| Delta vs prev            | Difference to the closest earlier version that has a score                                                                                                                                                                                                                                                                        |
| Requests 24h             | Share of the agent's 24h requests served by the version. Production gets 100 percent unless an explicit traffic share is set                                                                                                                                                                                                      |
| Cost 24h                 | `requests × agent cost per request × type factor`, where the factor is 1 for system, 0.35 for user template, 0.12 for tool description, 0.22 for evaluator rubric                                                                                                                                                                 |
| Prompt tokens            | `ceil(chars / 4)`, before variable substitution                                                                                                                                                                                                                                                                                   |
| Variables                | Unique `{{name}}` placeholders in order of first appearance. Pattern: letters, digits, underscore and dots, optional inner whitespace                                                                                                                                                                                             |
| Model parameters         | `ModelParams` from `lib/types.ts`: temperature 0 to 2, top_p 0 to 1, max output tokens, reasoning effort none/low/medium/high, tool choice auto/required/none, parallel tool calls, response format text/json_schema, stop sequences, timeout, max tool calls, max retries, optional seed, frequency penalty and presence penalty |
| Linked experiments       | Any experiment with a variant whose `promptVersion` matches one of this prompt's versions                                                                                                                                                                                                                                         |

## How the data gets here

Module: `lib/data/prompts.ts`, re-exported from `lib/data/index.ts`.

Types: `Prompt`, `PromptVersion`, `PromptVariable`, `PromptType`, `PromptLabel`, `PromptReviewState`. Constants: `promptTypeLabel`, `promptLabels`, `promptGuardrailNames`.

Helpers used by the UI: `extractVariables`, `estimateTokens`, `getPromptVariables`, `productionVersion`, `latestVersion`, `getPrompt`, `getPromptVersion`, `getPromptForAgent`, `getPromptsForAgent`, `agentsUsingVersion`.

Client store (`features/agentops/prompts/prompt-store.ts`): `promptStore`, `allVersions`, `nextVersionNumber`, `findVersion`, `promptForAgent`, `versionsForAgent`, `createVersion`, `setVersionLabel`, `createPrompt`, `awaitingReviewByLabel`. `features/agentops/prompts/prompt-store.test.ts` covers id uniqueness, promotion and prompt creation.

Generation: 14 prompt specs produce 45 versions with `createRng(7301)`. Each version's template is the previous template with a list of edits applied (add after an anchor line, replace, remove), so diffs are real. `requests24h` and `cost24h` derive from the owning agent's metrics in `lib/data/agentops.ts`; `params` is the agent's deployed `ModelParams` with per-version overrides; `modelId` defaults to the agent's model. Eval scores get a small deterministic jitter.

To wire a backend, replace the module with an API client that returns the same types, keep the helper signatures, and replace the store mutations in `prompt-store.ts` (`createVersion`, `setVersionLabel`, `createPrompt`) with calls to your API. `lib/data/audit.ts` derives audit events from prompt versions; a real backend should emit those events itself.

## Related pages

- Playground (`/agentops/playground?agent=<id>&pv=<p-N>`): reads versions from the same store, "Save as version" creates a draft here; see `playground.md`.
- Agents (`/agentops/agents/agt-…`): `promptVersion` pins the served version; the Usage tab reads it.
- Experiments (`/agentops/experiments?open=exp-…`): variants reference `p-N`.
- Evals & Datasets (`/agentops/evals`): golden sets and eval runs behind the score.
- Deployments (`/agentops/deployments`): releases carry the prompt version and `ModelParams`.
- Guardrails (`/agentops/guardrails?policy=grd-…`): the policies listed in the Guardrails section.
- Audit Log (`/agentops/audit`): hash-chained events derived from prompt versions.
