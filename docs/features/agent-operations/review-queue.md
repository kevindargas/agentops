# Review Queue

The Review Queue is the human-in-the-loop workspace. Answers that an evaluator flagged, a user disliked, a policy matched, or a random sample picked wait here for a person to score them on a four-criterion rubric and approve, flag or correct them. Approvals become positive examples, corrections go to the agent's eval set, flags go to the agent owner.

Reviewers (service-desk leads, domain experts, the agent owner) work through it; platform engineers watch the backlog, the approval rate and the rubric average as quality signals.

## Where to find it

- Nav group: Agent Operations, "Review Queue". The sidebar badge is the live pending count (`getNavCounts().reviews`, 36 in the seed).
- Route: `/agentops/reviews`. `?item=<rev-id>` opens that item first (the "In review queue" button on a trace uses it); `?agent=<agt-id>` scopes the queue and the title to one agent ("Pending reviews" on an agent record uses it). Code: `app/(app)/agentops/reviews/page.tsx`, stats and workspace in `features/agentops/review-queue.tsx`, state in `features/agentops/stores.ts` (`reviewStore`).
- Keyboard chord: `G` then `R` opens this page (Requests uses `G Q`).
- Entry points: the "Awaiting review" card on the fleet overview, "In review queue" on a trace, "Pending reviews" on an agent record.

## What is on the page

Four stat cards (`ReviewStats`, a client `StatGrid` reading the same `reviewStore` as the queue, so every verdict moves them):

| Card | Value | Hint |
| --- | --- | --- |
| Pending | `pendingReviewCount` over the store | "N high priority" (priority 1 or 2) |
| Reviewed | Items not `Pending` | "N approved · N corrected · N flagged" |
| Approval rate | approved / reviewed, as % | "Share of reviewed items approved" |
| Avg rubric score | Mean of the four rubric criteria over reviewed items that have a rubric, out of 5 | "Mean of 4 criteria on reviewed items" |

Below them, a two-column workspace.

**Left: pending list.**

- Header: "Pending" with a count pill and "N reviewed this session · N total" (total is all non-pending items including seeded ones). When scoped with `?agent=`, a line names the agent with an "All agents" link.
- Reason filter chips with counts: All, Low confidence, User thumbs-down, Evaluator flag, Policy match, Random sample.
- The list is sorted by priority (1 first) then by creation time. Each entry shows the priority badge, reason, age, the user's query (two lines), the agent name and the assignee chip if assigned. The selected entry has an accent bar.
- Empty state "Queue is clear" when the filter has nothing pending, with a "Clear filter" button when a reason chip is active.
- Below the `xl` breakpoint the list is capped at 40% of the viewport and scrolls, so the workspace stays reachable on a phone.

**Right: review workspace** for the selected item (or "All caught up" when nothing is pending).

- Header: agent chip, model chip, channel, duration, cost, reason badge, position "i of N", and "Open trace" (link to `/agentops/traces/<tr-id>`).
- Conversation column: the user turn; a "Retrieved context" box with the first retriever span's output plus "top k" and "score threshold" when the trace has a retriever; the agent's answer with a thumbs icon if the user gave feedback; and the trace's flags as amber badges. When correcting, the answer is replaced by an editable "Corrected answer" textarea prefilled with the original, a hint "Cmd+Enter saves · Esc cancels", and the note "The correction is kept on the review item next to the original answer; in a wired deployment it becomes the preferred answer in <evalDataset>."
- Scoring column: Evaluator scores (Grounded, Helpful, Safe, 0 to 1 bars), "Your rubric" with four 1 to 5 toggle rows (Accuracy: facts and steps are correct; Grounding: claims trace back to retrieved sources; Tone: clear, appropriate for the audience; Safety: no PII leak, policy respected), and a "Note for the agent owner" textarea.
- Action bar: Approve (`A`), Flag (`F`), Correct (`C`) and Skip (`S`). While correcting, the last two become Save correction (`Enter`) and Cancel (`Esc`). Approve, Flag and Save correction stay disabled with the message "Score all 4 criteria to approve, flag or save a correction." until every rubric row has a value; Save correction is also disabled until the text differs from the original answer, and its tooltip says which condition is missing.

## What to check

### Every day

- **Pending count and its high-priority hint.** Priority 1 items are policy matches (potential PII), priority 2 are user thumbs-downs. Clear these first; filter by "Policy match" and work top to bottom.
- **Reviewed.** If it stays at the seeded value while Pending grows, nobody is reviewing. Assign reviewers (the assignee chip shows who has what).
- **Approval rate.** A sudden drop on one agent (filter the list by reason, read the agent names) means a regression users have not reported yet. A rate near 100% with many "Random sample" items means sampling is wasting reviewer time and `reviewRate` on the agent can come down.
- **Each item you review:** compare the evaluator's Grounded bar to what the retrieved context actually says. If the answer cites something not in the context, score Grounding low and Flag it; if the answer is right but phrased badly, Correct it.
- **Flags on the item.** "Policy: PII" with a Safe score below 0.99 should never be approved without checking the guard span on the trace ("Open trace").

### Every week

- **Avg rubric score.** Below 4 out of 5 across reviewed items is a quality problem independent of the automatic evaluators. Compare the per-criterion pattern: low Grounding points at retrieval, low Accuracy at the model or prompt, low Tone at the prompt, low Safety at guardrails.
- **Reason mix.** Count the chips. "Evaluator flag" and "Low confidence" rising together with a quality drift signal confirms the drift; "User thumbs-down" rising alone means the evaluators are missing something and the eval set needs the corrected examples.
- **Flagged items** (Reviewed hint). Each flag should have produced a note for the owner and an action: a prompt change, an index refresh (the seeded note says a cited article was retired) or a guardrail change.
- **Corrections written this week** should show up in the agent's golden set before the next release.

### Before a release or model change

- Drain the pending queue for the affected agent so the pre-release baseline for approval rate and rubric average is complete.
- Make sure corrections were added to the eval set the release is evaluated against (the agent record's Evaluation section names it).
- After the release, review the first items with reason "Random sample" rather than only flagged ones, so the sample is unbiased.

## Actions

| Action | Key | Preconditions | Effect in this template |
| --- | --- | --- | --- |
| Approve | `A` | All four rubric criteria scored | Item becomes `Approved` in the shared store, reviewer set to `currentUser`, selection moves to the next item, success toast "Approved · <trace id>: Recorded as approved with your rubric" with an Undo action |
| Flag | `F` | All four scored | Item becomes `Flagged`, warning toast "Flagged · <trace id>: Marked for the agent owner; the note is kept on the item", Undo |
| Correct | `C` | none | Switches the answer into an editable textarea |
| Save correction | `Enter` (or `Cmd/Ctrl+Enter` inside the textarea) | All four scored and the text changed | Item becomes `Corrected` with the correction stored, success toast "Corrected · <trace id>: Correction and rubric recorded on the item for this session", Undo |
| Cancel correction | `Esc` | Correcting | Restores the original answer and leaves correction mode |
| Skip | `S` | none | Moves to the next pending item without a verdict, wrapping around at the end |
| Score rubric | `1` to `5` | none | Fills the next unscored criterion in order Accuracy, Grounding, Tone, Safety (the hint next to the rubric says so); clicking a toggle sets a specific row |
| Reason chips | | | Filter the pending list |
| Open trace | | | Navigation to the trace detail |

Keyboard handling details: shortcuts are ignored while focus is in a text field (except `Esc`, which cancels a correction from anywhere, and `Cmd/Ctrl+Enter` in the correction textarea) and when a modifier key is held. Every consumed key calls `preventDefault`, so the app-wide `C` quick-create and `G` chords in `components/layout/command-menu.tsx` stand down while the workspace handles them.

All verdicts live in `reviewStore` (`features/agentops/stores.ts`), which the stat cards, the fleet overview's "Awaiting review" card and the trace record's "In review queue" button also read, so they move as you review. Every verdict toast offers Undo for six seconds. Reloading resets the queue to the seed.

## Reading the data

**Reason** (`ReviewReason`) and the priority it implies in the mock:

| Reason | Priority | Source |
| --- | --- | --- |
| Policy match | 1 | Trace flag "Policy: PII" |
| User thumbs-down | 2 | `userFeedback === "down"` |
| Low confidence | 3 | Trace flag "Low confidence" |
| Evaluator flag | 4 | Any other trace flag |
| Random sample | 4 | Sampled by the agent's `reviewRate` with no flags |

**Status** (`ReviewStatus`): `Pending` (grey), `Approved` (green), `Flagged` (red), `Corrected` (blue).

**Rubric** (`ReviewRubric`): `accuracy`, `grounding`, `tone`, `safety`, each 1 to 5. The page's average is the mean of all four over reviewed items.

**Evaluator scores**: the trace's `evals.grounded`, `helpful`, `safe`. Grounded and Helpful are green at 0.85, amber at 0.70; Safe is green only at 0.99, amber at 0.90.

**Retrieved context**: output of the first span with type `retriever` on the trace, plus its `top_k` and `min_score` attributes.

**Correction** and **note**: free text stored on the item. In the seeded data, corrected items carry a sample correction and flagged items carry a note about a retired article.

**Position "i of N"**: index in the filtered, sorted pending list.

## How the data gets here

- `reviewItems` from `lib/data/agentops.ts` (`ReviewItem` in `lib/types.ts`), seeded into `reviewStore`. The module creates one item per trace whose status is `Needs review` or `Reviewed` (58 items, 36 of them `Pending`), derives reason and priority from the trace's flags and feedback, marks `Reviewed` traces as `Approved`, `Flagged` or `Corrected` with a seeded rubric, and leaves the rest `Pending`, some with an assignee. Traces sent to review from the Traces pages are appended as `rev-s001`, `rev-s002`, and so on.
- The workspace resolves `getTrace(item.traceId)` and `getDeployedAgent(item.agentId)` from the same module for the conversation, retriever span, flags, evaluator scores and golden-set name.
- Priority badges come from `components/shared/status-badge.tsx`.

To wire a backend: replace `reviewItems` with a query for pending and recent items, and replace `reviewStore.patch` in the `decide` callback with a mutation that stores status, rubric, note, correction and reviewer, then writes the correction to the eval set and notifies the owner. The stat cards already read the same store. The reviewer is `currentUser` from `lib/data/users.ts`; take it from the session instead.

## Related pages

- [Traces](traces.md) for the full span waterfall behind each item.
- [Agents](agents.md) for `reviewRate`, thumbs-down rate and the golden set a correction lands in.
- [Drift & Quality](drift-and-quality.md) to confirm whether a cluster of flags is a drift signal.
- [Fleet Overview](fleet-overview.md) for the "Awaiting review" backlog card.
- Govern: Evals & Datasets (`/agentops/evals`) where corrections should appear; Guardrails (`/agentops/guardrails`) for the policies behind "Policy match".
