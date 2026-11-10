# Model parameters

`ModelParams` in `lib/types.ts` is the single shape for generation and agent-loop settings. Every `DeployedAgent` has `params`; prompt versions, the playground, experiments and releases reuse the same type, and the only editor is `ParamEditor` in `features/agentops/playground/param-editor.tsx`. The field list and display formats live in `paramFields` in `lib/data/playground.ts`.

## Defaults

`defaultModelParams`: temperature 0.3, top P 0.95, max output tokens 2048, reasoning effort low, no stop sequences, tool choice auto, parallel tool calls on, response format text, timeout 60 s, max tool calls 6, max retries 2. Seed, frequency penalty and presence penalty are unset.

## Fields

| Field | Type and editor range | What it does | Safe range and notes |
| --- | --- | --- | --- |
| `temperature` | number, slider 0 to 2 step 0.1 | Sampling randomness. Lower is more deterministic. | 0 to 0.3 for extraction, classification, SQL and anything with a JSON schema. 0.5 to 0.8 for drafting. Above 1.2 is rarely useful and the playground warns. |
| `topP` | number, slider 0 to 1 step 0.01 | Nucleus sampling cut-off: only tokens within the top P probability mass are considered. | 0.9 to 1.0. Change temperature or top P, not both, when tuning. |
| `maxOutputTokens` | integer, 1 to 128000 step 64 | Hard cap on generated tokens per response. | Set from the longest legitimate answer plus margin. Below 512 the playground warns about truncation; truncated runs show `finishReason: length`. Also the main lever on output cost. |
| `reasoningEffort` | none, low, medium, high | Thinking budget before the model answers. | low for routing and short answers; medium for multi-step tool use; high only with a timeout of 90 s or more (the playground warns otherwise). Reasoning tokens are billed. |
| `stopSequences` | string[] | Generation stops when any sequence appears. | Use for structured templates such as `</final>`. Keep the list short; each entry is checked on every token. |
| `toolChoice` | auto, required, none | Whether the model may, must or must not call tools. | auto for agents; required for a first planning step that must pick a tool; none for pure summarisation. none on an agent with tools makes the playground warn and lowers estimated quality. |
| `parallelToolCalls` | boolean | Allow several tool calls in one turn. | On for read-only tools. Consider off when tools write, since ordering and compensation become harder to reason about. |
| `responseFormat` | text, json_schema | Free text, or JSON validated against a schema. | json_schema whenever a downstream system parses the output. Pair with temperature at or below 0.7 (the playground warns above). Validation failures surface as `invalid_output` outcomes. |
| `seed` | integer, optional, 0 and up | Fixed sampling seed for reproducible outputs. | Set during evals and experiments so differences come from the change under test. Not every provider honours it. |
| `frequencyPenalty`, `presencePenalty` | number, optional | Discourage repeated tokens or topics. | Leave unset unless you see repetition. Not exposed in the editor by default. |
| `timeoutMs` | integer, editor in seconds 1 to 600 | Per-request timeout. | At least 2x the agent's p95; longer with high reasoning effort. Must be longer than the routing rule's per-target timeout or fallback never engages. Exceeding it produces `timeout` outcomes. |
| `maxToolCalls` | integer, 0 to 50 | Agent-loop budget per run. | 4 to 8 for typical assistants. Below 2 on an agent with several tools lowers estimated quality. This is the loop cap; `RunLimits.maxSteps` is the overall step cap. |
| `maxRetries` | integer, 0 to 10 | Retries on transient provider errors. | 2 to 3. Each retry re-bills input tokens; budget accordingly. Retries interact with the routing rule's own retries, so count both. |

## Related, but not in ModelParams

`RunLimits` (`maxSteps`, `deadlineMs`, `costBudgetUsd`, `noProgressSteps`) bounds the whole run rather than one model call and is edited on the agent record, not in the parameter editor. When a run ends because of one of these, the trace shows a `boundHit` flag.

## Where parameters appear

- Agent record, configuration panel: the deployed `params`. "Open in playground" loads them.
- Prompt version: each `p-N` stores the `params` it was evaluated with.
- Playground: edit, run, compare A/B, "Differs from deployed" diff (`diffParams`), save as a new prompt version, apply to agent.
- Release: a change of kind `params` lists field, before and after.
- Experiments: variants may differ only in params.

## Changing parameters safely

1. Change one thing. Use the playground's compare mode with a fixed seed.
2. Run the eval on the golden dataset; the gate's composite, regressions and cost rules all react to parameter changes.
3. Ship through a release with strategy Canary, since parameter changes are cheap to roll back.
4. Watch `finishReason: length` and `timeout` outcomes on Traces for the first hours.
