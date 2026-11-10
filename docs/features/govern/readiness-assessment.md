# Readiness Assessment

Readiness Assessment is a self-assessment of one AI system (a chatbot, a RAG assistant, a single agent or a multi-agent system) against a control set of 86 controls in 6 domains: Visibility, Quality, Drift, Safety, Cost & Performance and Governance. You describe the system once, answer each applicable control with a status and optional owner, tool, evidence link and notes, and the page computes a weighted coverage score, a maturity level, release-gate blockers, a prioritised gap list, review due dates and framework coverage against OWASP LLM Top 10, NIST AI RMF, the EU AI Act, OTel GenAI semantic conventions and ISO/IEC 42001.

Unlike the rest of AgentOps, nothing on this page comes from `lib/data/` mock arrays except the optional sample assessment. The engine is `lib/readiness/`, the state is your browser's localStorage, and the page works with no backend at all. The people who use it are the system owner preparing for a pilot or production gate, the reviewers who vote on control status in team mode, and whoever has to hand an auditor a Markdown or CSV report.

## Where to find it

- Route: `/agentops/readiness`
- Nav: Govern group, "Readiness Assessment"
- Tabs sync to `?tab=`: `setup`, `controls`, `results` (default, omitted from the URL), `frameworks`, `tooling`, `library`, `share`
- `?control=<id>` (for example `?control=SAF-05`) opens that control's sheet on load
- A URL fragment `#s=<encoded>` is a share link. With no assessment in the browser it loads straight away, strips the fragment and toasts "Assessment loaded from link". When a different assessment is already open, a dialog previews the incoming one (name, system, type, target, responses, updated) and offers "Snapshot and replace" or "Keep current"; replacing first files the current answers as the snapshot "Before import". A link carrying the same assessment id updates it in place
- Controls, Results and Frameworks are disabled until an assessment exists; Tooling, Library and Share work without one
- Until the browser has read localStorage the page shows a table skeleton instead of the empty "Describe your system first" state

## What is on the page

The page header uses `PageHeader nav="/agentops/readiness"`, so eyebrow ("Govern"), icon and title come from `config/nav.ts`; the description reads the control count, domain count and domain names from `defaultControlSet` at render time, so it always matches the code. The route has a `loading.tsx` rendering `TableSkeleton`.

### Setup tab

The first screen for a new assessment, and the profile editor for an existing one. Fields:

- System name (required; becomes the assessment title).
- System type (radio cards): Chatbot, RAG assistant, Single agent, Multi-agent system. Retrieval and tool use decide which controls apply.
- Risk profile: Autonomy level (Assist, Supervised, Autonomous), Data sensitivity (Public, Internal, Confidential, Regulated), User exposure (Internal users, External users / customers).
- Regulatory scope (checkboxes): EU AI Act, GDPR, HIPAA, PCI DSS, SOC 2, ISO/IEC 42001. Controls tagged to a scope only count when it is selected.
- Maturity target (radio cards): Prototype, Pilot (default), Production. Each card shows how many controls are required at that stage for the current profile.

The right-hand "What this profile changes" panel updates live: Apply in full, Down-weighted, Hidden, Required at <target> (with the number of release gates), and a per-domain "required / applicable" list, followed by a one-sentence summary of the profile.

Buttons: "Start assessment" (create mode) or "Save profile" (edit mode), and in create mode "Load sample assessment", which loads the deterministic sample from `lib/data/readiness.ts` (Support Triage Agent, supervised single agent, confidential data, external users, EU AI Act and GDPR, target Production) together with one snapshot ("Pilot exit review"). The footer note reads "Stored in this browser only. Nothing is uploaded."

Once an assessment is created or loaded while you are on Setup, the view moves to Controls.

### Controls tab

Every applicable control grouped by domain in an accordion (all domains open by default).

Toolbar: search (id, title, "what" text), Status select (Any status plus the five statuses), quick filters "Only gaps" and "Only required", a "Show not-applicable (N)" switch (persisted), domain pill filters, a "N of M applicable controls" counter and a Clear button.

Domain group header: domain chip, "X of Y in place", "N shown" when filtered, a red "N blockers" marker when any required gate control in that domain is not met, and a score bar with the domain's 0 to 100 score.

Control row: id, title (click to open the sheet), Required badge, Gate badge, applicability badge (Down-weighted or Not applicable; nothing when it applies in full), risk dots (1 to 5), effort badge, then owner chip, tool name, "Reviewed <time ago>", a red "Review overdue" label, and a vote count pill (amber with a warning icon when respondents disagree by two or more steps). On the right, a five-way status toggle (Not started, Planned, Partial, In place, Verified) that saves immediately.

### Control sheet

Opens from any tab via a control id. Header: id, domain chip, Required, Gate and applicability badges, risk dots, effort badge, title, "Required at: <stage>", current status badge and owner. The footer has Previous / Next buttons that walk the controls in the order the Controls tab lists them (not-applicable controls included only when "Show not-applicable" is on), a "3 of 72" position counter, and a Close button. Opening `?control=<id>` before an assessment exists shows "No assessment yet" with a "Go to Setup" button instead of "Control not found".

Sections, in order:

1. What it is.
2. Why it matters.
3. How to implement (numbered steps).
4. Done looks like (the auditor test, green box).
5. Your response: status toggle with the hint for the selected status, Owner (select from `lib/data/users.ts`), Tool used (suggested tools for the control, Other with a free-text field, or Not selected), Evidence link (an Open button appears for `http(s)://` or `/`-relative links), Last reviewed (date), Notes. Every change saves as you type.
6. Framework mappings: one row per framework with reference chips; hover for the item title. Framework short names link to the reference URL.
7. Suggested tools: cards with name (linked), kind badge (Open source, Managed, Open source + managed), summary and a "Use this tool" button.
8. Metrics: name, direction, warn and crit thresholds with units, formula, and the OTel attribute or metric it is derived from.
9. Snippets: titles and language, with a "See Tooling tab" link.
10. Review cadence: interval and activity, "Due <date>", an Overdue badge, or "Tracked once partial or better".
11. Team votes: votes per respondent with status badges, the consensus badge, a disagreement warning when the spread is two or more steps, an "Apply consensus" button (disabled when the current status already equals the consensus), your name (persisted) and your vote toggle (disabled until a name is entered).
12. Learn more: external links where the control has them.

### Results tab

Six stat cards: Overall coverage (0 to 100, with the applicable control count), Maturity level (badge plus the level's definition), Release blockers (red when above zero), Open gaps, Reviews overdue (amber when above zero), Hidden controls.

Charts: "Coverage by domain" radar (0 to 100 per domain) with a "Compare with snapshot" select that draws a second dashed outline when snapshots exist, and a "Domain heatmap" showing score, in place / applicable and required met / required per domain, with a blocker marker.

Maturity ladder: four steps (Ad hoc, Defined, Managed, Optimized) with the current step highlighted and reached steps ticked, followed by the status distribution bar (count and share per status over applicable controls).

Release gate: "Gate is clear for <target>" or a table of blockers with Control, Domain, Status, Owner, Severity (red) and Effort. The control cell is a button that opens the sheet.

Prioritized gaps: a data table of applicable controls not yet in place, ranked by severity then effort then id.

| Column   | Content                                                |
| -------- | ------------------------------------------------------ |
| #        | Rank                                                   |
| Control  | Id, title and the "what" text                          |
| Domain   | Domain chip                                            |
| Status   | Status badge                                           |
| Severity | Bar and number. Red at 70 or more, amber at 40 or more |
| Risk     | Dots                                                   |
| Effort   | Badge                                                  |
| Required | Badge when required at the target                      |
| Gate     | Badge when a gate control                              |
| Owner    | User chip                                              |

Facets: Domain, Status, Effort. A "Quick wins" toggle keeps only low-effort gaps with severity 40 or more. The whole Results tab is wrapped in `#readiness-report` and styled for print.

### Frameworks tab

One sub-tab per framework: OWASP LLM Top 10, NIST AI RMF, EU AI Act, OTel GenAI, ISO/IEC 42001. Each shows the framework's full name, a summary line ("X/Y items have at least one applicable control · N fully covered · M partial · K with no control mapped"), CSV and Markdown export buttons (files `<assessment-slug>-<framework-slug>-coverage.csv|md`, one row per framework item with coverage, score and the mapped control ids and statuses), a Reference link, and a table:

| Column          | Content                                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item            | Framework item id and title (for example LLM06 Excessive Agency, MEASURE 2.5, Art. 12, `gen_ai.usage.input_tokens`, A.6)                                                                                                           |
| Coverage        | Bar with the weighted average credit of applicable mapped controls (0 to 100) and a label: Covered (all applicable mapped controls met), Partial (some met), Open (none met), or an empty value when nothing applicable maps to it |
| Mapped controls | Chips with id and status badge; faded when not applicable. Click opens the sheet                                                                                                                                                   |

Below the table a sanity line reports any framework references in the control set that do not resolve to a listed item ("Unmapped references"), which catches typos and framework version mismatches.

### Tooling tab

Works without an assessment. Three sub-tabs with counts:

- Tool matrix (39 tools). Columns: Tool (linked, with summary), Kind, Domains, Controls covered (count, hover for ids), In use (how many of your responses picked this tool). Facets: Kind, Domain. An "Open source only" switch hides Managed-only tools.
- Instrumentation snippets (5): LLM call span in Python (OTel GenAI semconv), LLM call span in TypeScript, Tool execution span, Starter alert rules (Prometheus-style), Eval gate in CI (promptfoo). Each card has a copy button and "Used by" control id buttons.
- Metric catalog (72 metrics). Columns: Metric (name and formula), Domain, Unit, Direction, Warn, Critical, OTel source. Buttons: "Copy as JSON" (the whole catalog) and "Copy alert thresholds (YAML)" (one `metric / warn / crit / direction` block per metric).

### Library tab

Works without an assessment. Three sub-tabs:

- Failure modes (24): recurring production failure patterns, each with a summary, a cited real-world case where there is one, and "Would have been caught by" control buttons showing your current status for each. The header counts how many patterns are fully covered (every applicable mapped control in place or verified). Domain pill filter; an empty domain offers "Show all domains".
- Review cadence: three standing reminder cards (Eval refresh: QUA-01 and DRF-07; Judge recalibration: QUA-03; Model deprecation check: DRF-05) with an Overdue / Due soon / On track badge, and a table of every applicable control that has a cadence and is at least Partial: Control, Activity, Every, Last reviewed ("never" if empty), Due with a badge, Owner, and a "Mark reviewed today" button that stamps the demo clock date (the toast names it).
- Glossary (25 terms) with a text filter.

### Share tab

Sections, top to bottom:

- Export: Download JSON, Download Markdown, Download CSV, Print / PDF. File names are `<slug>-readiness.json|md|csv`; each is a real Blob download and the toast names the file. Print switches to the Results tab, sets `data-print="report"` on `<html>`, and calls `window.print()`.
- Share link: a read-only input with the full URL (`<origin>/agentops/readiness#s=<base64url>`), the character count, and copy buttons. "Copy link" writes the full URL to the clipboard (awaited; an error toast appears when the clipboard is unavailable). Links over 2,000 characters show a warning that chat clients and proxies may cut them off; export JSON instead.
- Import: paste JSON or a share link (a full URL or just `s=…`), or choose a `.json` file. Validation errors say what was wrong: not JSON and not a share link, payload not base64url, payload not JSON, unsupported share version, missing profile, unknown system type or maturity target, response ids missing from the active control set (listed), or a control set id that differs from the active one. A preview shows the parsed assessment; with an assessment open, "Replace current assessment" asks for confirmation and files the current answers as the snapshot "Before import" before loading; with none open the button reads "Load assessment" and loads directly. "Add as snapshot" keeps the current assessment and files the import as a snapshot.
- History & compare: label input and "Take snapshot"; a list of snapshots with date, target and overall score, a Compare toggle, Restore (with confirmation) and Delete (with confirmation and an 8-second Undo on the toast). Up to 25 snapshots are kept. Comparing shows the per-domain Before / After / Δ table, the count of improved and regressed controls, a table of every control whose status changed (Control, From, To, direction) and an alert when the profile or target differs between the two.
- Team mode: your full name for votes (persisted locally; it labels your votes in share links), the respondents list, and a table of controls whose votes spread two or more steps apart (Control, Votes, Current, Consensus) with "Apply consensus to all", which confirms with the number of controls it will overwrite.
- Privacy & data: the localStorage statement (see below) and "Clear all local data" with confirmation; the toast lists what was removed.
- Customization: active control set name (with an "Imported" badge when a custom set is loaded), version, control and domain counts; "Import control set JSON", export the active control set as `<id>-v<version>.json`, and "Revert to default" (with confirmation, since responses to ids that only exist in the imported set stop counting).
- Static deploy: notes that the module is fully client-rendered and how to build with `output: "export"` for a static host.

## What to check

### Every day

Nothing on this page changes by itself; day-to-day it is a reference. The one daily item is for the person running a pilot or release:

- Release blockers card on Results. If it is above zero and the release is this week, every row in the Release gate table needs an owner today. A blocker with an empty Owner column is the first thing to fix.

### Every week

- Reviews overdue card on Results, and the Library > Review cadence table sorted by Due. Overdue means the cadence has passed since Last reviewed (or no Last reviewed is set on a control that is Partial or better). Either do the activity and press "Mark reviewed today", or downgrade the status if the evidence is stale. A control that stays Verified with an overdue review is a false green.
- Controls tab, Status = Verified, with no Evidence link. Verified means the "done looks like" test passed with evidence; without a link it is a claim. Add the link or drop to In place.
- Controls tab vote pills with the warning icon. Two or more steps of disagreement between respondents means the team does not share a definition of done for that control. Resolve it in the sheet, then "Apply consensus".
- Team mode table on Share. The same disagreements in one list; use "Apply consensus to all" only after the discussion, since consensus resolves ties to the lower status.
- Failure modes (Library). The "N of 24 patterns fully covered" count should go up over time. A pattern whose mapped controls are all Not started is a known gap you have not planned for.
- Snapshot before any review meeting (History & compare). Without a snapshot you cannot show progress or detect regressions.

### Before a release or model change

- Maturity target on Setup. The gate is evaluated against the target. If you are going from Pilot to Production, switch the target first; the required count jumps (8 controls are required at Prototype, 67 at Pilot and all 86 at Production for a profile where everything applies) and new blockers appear.
- Release gate section on Results. It must read "Gate is clear for <target>". Each blocker is a required gate control (27 controls carry the gate flag) that is Not started, Planned or Partial. Only In place or Verified clears it.
- Prioritized gaps with the Quick wins toggle. Low-effort gaps with severity 40 or more are the ones to close in the release window.
- Frameworks tab for the scopes you selected. If EU AI Act is in scope, every article in the EU AI Act sub-tab should be Covered or Partial; an Open item on Art. 12 (record-keeping) or Art. 14 (human oversight) is an audit finding waiting to happen. Also read the "Unmapped references" line; it should say all references resolve.
- Export Markdown and attach it to the release ticket or change record. The Markdown report includes coverage, domain table, blockers, ranked gaps and every control with evidence and notes.
- Take a snapshot labelled with the release and compare it with the previous one; regressions (controls that moved down) should be explained in the release notes.
- Share link hygiene. The link is the data. Do not paste it into a public channel if the notes contain internal URLs or names.

## Actions

| Action                                            | Where                                            | What happens                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start assessment / Save profile                   | Setup                                            | Writes the assessment to the store (localStorage). Saving a profile recomputes applicability and required counts immediately                           |
| Load sample assessment                            | Setup (create mode only, so nothing is replaced) | Loads `sampleAssessment` and `sampleSnapshots` from `lib/data/readiness.ts` into the store                                                             |
| Set status                                        | Controls row, control sheet                      | `readinessActions.respond`; score updates immediately                                                                                                  |
| Set owner, tool, evidence, last reviewed, notes   | Control sheet                                    | Same action, saved on every keystroke                                                                                                                  |
| Vote                                              | Control sheet                                    | `readinessActions.vote`; adds you to respondents                                                                                                       |
| Apply consensus                                   | Control sheet, Share > Team mode                 | Sets status to the majority vote (ties to the lower status); the bulk action on Share confirms with the count                                          |
| Mark reviewed today                               | Library > Review cadence                         | Sets `lastReviewed` to the demo clock (`clock()`) and toasts the date                                                                                  |
| Show not-applicable                               | Controls toolbar                                 | Persisted preference                                                                                                                                   |
| Compare with snapshot                             | Results chart, Share > History                   | Evaluates the snapshot with the active control set and overlays it                                                                                     |
| Download JSON / Markdown / CSV                    | Share > Export, Frameworks                       | Client-side Blob download; the toast names the file                                                                                                    |
| Print / PDF                                       | Share > Export                                   | Switches to Results and opens the browser print dialog                                                                                                 |
| Copy share link                                   | Share > Share link                               | Writes the full `#s=` URL to the clipboard, or toasts an error when the clipboard is unavailable                                                       |
| Open a share link                                 | URL fragment                                     | Loads directly when no assessment exists; otherwise a dialog previews it and "Snapshot and replace" files the current one as "Before import" first     |
| Import (Replace current / Load / Add as snapshot) | Share > Import                                   | Parses and validates with `decodeShareHash` / `parseAssessment` plus a control-id check against the active set; replacing confirms and snapshots first |
| Take / Restore / Delete snapshot                  | Share > History                                  | Store actions; restore and delete ask for confirmation, delete offers Undo                                                                             |
| Clear all local data                              | Share > Privacy                                  | Resets the store and removes the localStorage key                                                                                                      |
| Import control set JSON / Revert to default       | Share > Customization                            | Swaps the active control set for every tab; scores are re-evaluated against it. Revert asks for confirmation                                           |

Every action here is real in the sense that it persists in the browser. None of it reaches a server.

## Reading the data

### Status and credit

| Status   | Label       | Credit | Meaning                                                         |
| -------- | ----------- | ------ | --------------------------------------------------------------- |
| none     | Not started | 0      | Nothing exists yet                                              |
| planned  | Planned     | 0.15   | Owner and plan agreed, not built                                |
| partial  | Partial     | 0.5    | Exists for some agents, paths or environments                   |
| in-place | In place    | 0.85   | Implemented everywhere it applies                               |
| verified | Verified    | 1      | Implemented and the "done looks like" test passed with evidence |

In place and Verified count as "met" for gates, domain in-place counts and framework coverage.

### Applicability

Each control may carry an applicability rule over system type, minimum autonomy, minimum data sensitivity, exposure and regulatory scope. If any condition fails, the control becomes `otherwise`: Not applicable (hidden, weight 0) by default, or Down-weighted (weight factor 0.5) where the rule says so. 35 of the 86 controls carry a rule. Examples from the code:

- VIS-05 Inter-agent handoff tracing applies only to multi-agent systems.
- QUA-06 Retrieval quality metrics applies to RAG, single agent and multi-agent systems, not to plain chatbots.
- SAF-05 Human approval for high-impact actions applies to agentic systems with autonomy Supervised or higher.
- SAF-02 PII detection and redaction is down-weighted (not hidden) when data sensitivity is Public.
- GOV-08 User transparency and escalation is down-weighted for internal-only exposure.

### Required and maturity target

A control is required when its `requiredAt` stage is at or before the assessment's target (Prototype < Pilot < Production). In the default set 8 controls are required from Prototype, 59 more from Pilot and 19 more from Production. Required controls carry full weight; controls required at a later stage carry half weight, so they still move the score but less.

### Weight, score and severity

- Weight = risk (1 to 5) × applicability factor (1, 0.5 or 0) × stage factor (1 if required, 0.5 if not).
- Score (overall and per domain) = Σ(weight × credit) / Σ(weight) × 100 over applicable controls, rounded.
- Severity (0 to 100) = (risk / 5) × (1 - credit) × (1 if required else 0.6) × (1.15 if gate else 1) × applicability factor, capped at 1, times 100. Gaps are sorted by severity, then effort (low first), then id.
- Risk distribution in the default set: 14 controls at risk 5, 48 at risk 4, 22 at risk 3, 2 at risk 2.

### Maturity level

| Level     | Rule                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| Ad hoc    | Overall score below 40                                                        |
| Defined   | 40 to 64                                                                      |
| Managed   | 65 to 84, or 85+ without enough verification                                  |
| Optimized | 85 or more and at least half of the required applicable controls are Verified |

Score tones used by bars and heatmap cells: success at 85+, brand at 65+, warning at 40+, danger below 40.

### Release gate blockers

A blocker is a control that is applicable, flagged `gate`, required at the current target, and not met. 27 controls carry the gate flag: VIS-01, VIS-07, VIS-08, QUA-01, QUA-02, QUA-13, DRF-02, DRF-03, DRF-04, DRF-09, SAF-01, SAF-02, SAF-03, SAF-04, SAF-05, SAF-11, SAF-13, SAF-16, CST-02, CST-04, CST-10, GOV-01, GOV-02, GOV-05, GOV-07, GOV-08, GOV-12. The sample assessment deliberately leaves GOV-07 (incident response runbook) at Not started so a blocker is visible.

### Review cadence

31 controls carry a cadence (weekly 7 days, monthly 30, quarterly 91, semiannual 182). A review is tracked once the status is Partial or better. Due date = last reviewed + interval; with no last reviewed date the control is due immediately. Overdue means the due date is at or before the demo clock. The Library's Review cadence table adds "Due soon" for anything due within 14 days.

### Team votes

Votes are stored per control as `respondent name → status`. Consensus is the majority status; ties resolve to the lower status. Spread is the distance in steps between the highest and lowest vote; two or more is flagged as disagreement.

### Framework coverage

For each framework item: mapped controls are those whose `frameworks[<key>]` lists the item id; the item's score is the weighted average credit of applicable mapped controls; coverage is Covered when every applicable mapped control is met, Partial when some are, Open when none are, and unmapped when no applicable control maps to it. The item lists live in `lib/readiness/frameworks.ts`: 10 OWASP items, 34 NIST AI RMF subcategories, 13 EU AI Act articles, 19 OTel GenAI attributes and metrics, 9 ISO/IEC 42001 Annex A control groups. The test suite requires every OWASP item to have at least one control.

### Badges

| Badge                         | Meaning                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| Required                      | Required at the assessment's maturity target                         |
| Gate                          | Release-gate control; blocks go-live when required and not met       |
| Down-weighted                 | Applicability rule failed with `otherwise: "reduced"`; weight halved |
| Not applicable                | Hidden from scoring; shown only with the toggle                      |
| Low / Medium / High effort    | Implementation effort from the control definition                    |
| Risk dots                     | 1 to 5 filled dots; red at 4 or 5, amber at 3                        |
| Overdue / Due soon / On track | Review state                                                         |

## How the data gets here

The engine is `lib/readiness/` and nothing else evaluates or persists readiness state.

| Module                           | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                       | All types: `ControlDef`, `ControlSet`, `Assessment`, `ControlResponse`, `Snapshot`, `SystemProfile`, scoring outputs (`ControlEval`, `DomainScore`, `AssessmentResult`), catalog types (`ToolDef`, `MetricDef`, `SnippetDef`, `FailureMode`, `GlossaryEntry`, `FrameworkDef`) and the enum arrays (`controlStatuses`, `systemTypes`, `maturityTargets`, …)                                                                                                                                                                                          |
| `labels.ts`                      | Human labels and hints for every enum (status, system type, autonomy, sensitivity, exposure, regulatory, maturity target and level, effort, applicability, cadence)                                                                                                                                                                                                                                                                                                                                                                                 |
| `controls.ts`                    | The 6 `domains`, the 53 base controls, and `defaultControlSet` (`agentops-llmops-v1`, version 1.1.0) which merges the base controls with the wave-2 files and sorts them by domain then id                                                                                                                                                                                                                                                                                                                                                          |
| `controls-visibility-quality.ts` | 11 wave-2 controls (VIS-09 to VIS-12, QUA-09 to QUA-15) and their failure modes                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `controls-drift-safety.ts`       | 13 wave-2 controls (DRF-09 to DRF-13, SAF-12 to SAF-19) and their failure modes                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `controls-cost-governance.ts`    | 9 wave-2 controls (CST-09 to CST-12, GOV-11 to GOV-15) and their failure modes                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scoring.ts`                     | `statusCredit`, `applicabilityOf`, `isRequired`, `isMet`, `reviewState`, `evaluateControl`, `evaluateAssessment`, `maturityFor`, `consensusStatus`, `voteSpread`. The only place scores are computed                                                                                                                                                                                                                                                                                                                                                |
| `codec.ts`                       | `encodeAssessment` / `decodeAssessment` (base64url JSON, `SHARE_VERSION = 1`, empty responses dropped; decoding errors name the failing step), `shareUrl`, `decodeShareHash`, `readShareHash`, `SHARE_LINK_WARN_CHARS = 2000`, `parseAssessment` (validation for import), `toJson`, `toCsv`, `toMarkdown`, `diffAssessments`. The only place state is serialised                                                                                                                                                                                    |
| `store.ts`                       | `readinessStore` (via `createStore` in `lib/store.ts`, persisted under `agentops.readiness.v1`) holding `assessment`, `snapshots`, `showNotApplicable`, `respondent`, `customControlSet`; `readinessActions` for every mutation including `replace(assessment, label)` which snapshots first; `createAssessment`; `useReadinessHydrated` (false until the browser has hydrated, so the view can show a skeleton); `BEFORE_IMPORT_LABEL`. Ids are deterministic: prefix, demo-clock stamp and a counter continued from the highest id already stored |
| `frameworks.ts`                  | The five `FrameworkDef`s and `frameworkKey` (framework id to `FrameworkRefs` key)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tools.ts`                       | 39 tools, `getTool`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `metrics.ts`                     | 72 metrics with formula, unit, direction, warn and crit, OTel source; `getMetric`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `snippets.ts`                    | 5 instrumentation snippets; `getSnippet`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `library.ts`                     | 24 failure modes (14 base plus 10 wave-2 ones merged in) and 25 glossary entries                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `readiness.test.ts`              | Vitest coverage: 6 domains, unique `AAA-00` ids, catalog references resolve, every OWASP item mapped, applicability cases, scoring of the sample, 100/Optimized when everything is verified                                                                                                                                                                                                                                                                                                                                                         |

Control counts per domain in the default set: Visibility 12, Quality 15, Drift 13, Safety 19, Cost & Performance 12, Governance 15. Total 86.

The sample assessment in `lib/data/readiness.ts` (`sampleAssessment`, `sampleSnapshots`) is the only `lib/data` dependency. It is deterministic (seed 7101), pins a set of statuses so the results view shows gaps, blockers, an overdue review and two controls with team votes (QUA-03 and SAF-05, respondents Kevin Dargas, Amara Okafor and Diego Ramírez, resolved from `lib/data/users.ts` by id), and must keep the test file green. Respondents are stored by full name, so enter your full name in team mode.

UI components in `features/agentops/readiness/` read through `useReadiness()` in `shared.tsx`, which subscribes to the store, picks `customControlSet ?? defaultControlSet` and memoises `evaluateAssessment`. The view syncs `?tab=` and `?control=` through the shared `useQueryParam` hook in `hooks/use-query-param.ts`, which writes with `history.replaceState`. `download.ts` holds the shared `downloadText`, `copyText`, `slug` and `csvCell` helpers used by the Share, Frameworks and Tooling tabs. The coverage radar in `components/charts/coverage-radar.tsx` (the domain heatmap sits next to it in `domain-heatmap.tsx`) composes Recharts directly through `components/ui/chart` and `chart-primitives`; the Governance domain uses `var(--chart-6)`.

### localStorage and privacy

All state is one JSON blob under the localStorage key `agentops.readiness.v1`: the assessment (profile, every response including owner ids, evidence links and free-text notes, votes with respondent names), up to 25 snapshots (each a full copy of an assessment), the respondent name, the not-applicable toggle and any imported control set. Nothing is sent to a server and there is no account. The consequences:

- Anyone with access to the browser profile can read it. On a shared machine, use "Clear all local data" on the Share tab when done.
- Clearing site data, switching browsers or using a private window loses the assessment. Export JSON before that.
- Share links embed the full assessment in the URL fragment. The fragment is not sent to the server by browsers, but it is in your clipboard, chat history and anyone's browser history who opens it. Treat the link as the data itself.
- Snapshots multiply the stored data; at 25 snapshots of 86 controls with notes the blob is still well under typical localStorage limits, but importing a large custom control set adds to it.

### Swapping in a backend

The engine is designed so a backend only needs to replace `store.ts`: persist `Assessment`, `Snapshot[]` and the preferences server-side, keep the `readinessActions` surface, and leave `scoring.ts` and `codec.ts` as they are (they are pure functions of the assessment and control set). To change the catalog without a deploy, import a control set JSON on the Share tab; to change it permanently, edit `controls.ts` and the wave-2 files, keep control ids stable because exports and share links reference them, and add new tools, metrics, snippets and framework items to their catalogs first so the tests keep passing. Adding a framework means a new `FrameworkId`, a `FrameworkRefs` key and a `frameworkKey` entry.

## Related pages

- Traces (`/agentops/traces`), Evals & Datasets (`/agentops/evals`), Drift (`/agentops/drift`), Guardrails (`/agentops/guardrails`), Costs & Budgets (`/agentops/costs`) and Deployments (`/agentops/deployments`) are the default evidence links the sample assessment uses per domain, and the pages where most controls are actually implemented.
- Providers & Routing (`/agentops/providers`) for CST-04 and CST-06 evidence.
- Schedules & Triggers (`/agentops/schedules`) for scheduled review and eval refresh jobs behind the cadence controls.
- Audit Log (`/agentops/audit`) for GOV-05 (access control and audit log for configuration) and GOV-13 (decision records with tamper evidence).
- Tools & MCP (`/agentops/tools`) for SAF-04, SAF-10 and SAF-16 evidence.
