# Build

The Build group holds the surfaces where the fleet's behaviour is defined: prompts and their versions, generation parameters, tools and MCP servers, retrieval and memory, the governed vocabulary agents may use, the model market, and the internal workflow agents that help operate the platform. Everything here is data under `lib/data/` (deterministic mock data) or `lib/ai/`, except the Model Catalog, which is fetched live from OpenRouter.

Every page uses `PageHeader` with `nav` set to its route, so the eyebrow ("Build"), icon and title come from `config/nav.ts` and match the sidebar and breadcrumb.

## Pages

| Page                 | Route                                                                            | Doc                                                | Data module                                  |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Prompts              | `/agentops/prompts` (`?agent=`), `/agentops/prompts/[id]` (`?tab=`, `?version=`) | [prompts.md](prompts.md)                           | `lib/data/prompts.ts`                        |
| Playground           | `/agentops/playground` (`?agent=`, `?pv=`, share-link params)                    | [playground.md](playground.md)                     | `lib/data/playground.ts`                     |
| Tools & MCP          | `/agentops/tools` (`?tab=`, `?tool=`, `?server=`, `?agent=`)                     | [tools-and-mcp.md](tools-and-mcp.md)               | `lib/data/tools.ts`                          |
| Knowledge & Memory   | `/agentops/knowledge` (`?tab=`, `?kb=`, `?mem=`, `?agent=`)                      | [knowledge-and-memory.md](knowledge-and-memory.md) | `lib/data/knowledge.ts`                      |
| Semantic Layer       | `/agentops/semantic-layer` (`?entity=`)                                          | [semantic-layer.md](semantic-layer.md)             | `semanticEntities` in `lib/data/agentops.ts` |
| Model Catalog        | `/ai/models`                                                                     | [model-catalog.md](model-catalog.md)               | live, `lib/ai/openrouter.server.ts`          |
| Workflow Automations | `/ai`                                                                            | [workflow-automations.md](workflow-automations.md) | `lib/ai/agents.ts`                           |

Keyboard chords: `G` then `P` Prompts, `G` then `L` Playground, `G` then `T` Tools & MCP, `G` then `X` Workflow Automations. Knowledge & Memory, Semantic Layer and Model Catalog have no chord; use `⌘K`.

## Client state and what the toasts mean

Prompts, Tools & MCP and Knowledge & Memory keep their lists in module-scoped `createListStore` instances (`features/agentops/prompts/prompt-store.ts`, `features/agentops/tools/store.ts`, `features/agentops/knowledge/store.ts`). Stat cards, tab counts, tables and sheets read the same store, so every mutation moves every number that shows it. The Playground reads prompt versions from the prompt store and writes drafts back into it; "Apply to agent" records a per-session baseline in `applied-config-store.ts`. None of this is persisted; a reload returns to the seed.

Every toast on these pages describes something that happened in that client state. Real side effects that leave the browser: the Tools & MCP "Download" of the permission policy and the Knowledge & Memory "Export config" both write a file; the Playground "Share link" and "Copy comparison for an experiment" and the Permissions "Copy JSON" write to the clipboard; the Model Catalog "Use in AgentOps Assist" and the Workflow Automations Guardrails tab write to the browser-persisted settings.

## Checklist

### Before promoting a prompt

- On the prompt record, Diff tab: read every added and removed line between the current production version and the candidate.
- Versions tab: the candidate has an eval score (not "Not run") and the delta versus the previous scored version is explained by the change note if it is negative. The promotion dialog warns when the candidate was never evaluated.
- Editor tab, Model parameters: the model and parameters the candidate was evaluated with are the ones the agent will run. Open the candidate in the Playground (more menu, "Open in Playground") and confirm "Diff vs deployed" lists only intentional differences.
- Playground: the candidate configuration produces no warnings (JSON schema with temperature above 0.7, temperature above 1.2, tool choice none, output cap below 512, high reasoning with a short timeout).
- Editor tab, Variables: no "Undocumented" variables, and every required variable is supplied by the agent runtime.
- Prompt tokens stat card: the token increase times `requests24h` fits the agent's budget on Costs & Budgets.
- Usage tab after promotion: the agent is pinned to the new version and the previous version is archived, not still carrying traffic.
- Workflow Automations: Prompt Hygiene is enabled so the nightly lint catches regressions in the new version.

### Before changing a tool or MCP server

- Tool sheet: risk level is correct for what the tool does (Write that can page or pay is Destructive).
- Policy: Destructive tools are Require approval or Blocked; the Permissions matrix shows no agent with Destructive set to Allow.
- Safety glyphs: Destructive tools support dry run; non-idempotent tools have retries set to 0 or are made idempotent; every Write or Destructive tool has a compensating tool or an accepted "irreversible" decision.
- Side-effect safety: no hazardous output sink (renders HTML, executes code) outside the sandbox.
- Identity: delegated tokens on Write or Destructive tools have a TTL of 15 minutes or less and a pinned audience.
- MCP server: Signed, reviewed after its last definition change, no critical vulnerabilities, auth other than "No auth" for remote transports, egress allowlist declared, not on legacy SSE or an end-of-life version.
- Allowlisted agents: only the agents that need the tool; "No agents" means remove it.
- Permissions tab: export the policy JSON (Download writes `tool-policy.json`) and commit it alongside the agent configuration.
- Workflow Automations: Tool Permission Auditor is enabled so the new grant is reviewed on its next run.

### Before adding a knowledge source

- Sources tab: the connector, schedule and target knowledge base are right; the first sync completes (status Synced, no errors in the Errors tooltip) and the ingestion job reaches 100 percent.
- Knowledge base sheet, Access policy: PII filter is on if the source can contain personal data; ACL inheritance is on if the source has per-user permissions; only the intended agents are attached ("Manage agents" adds or removes them).
- Retrieval settings: top k times chunk size plus the prompt and max output fit the model's context length (check the Model Catalog).
- Test retrieval: run the questions the agent is expected to answer from this source; the right chunks rank above the threshold and are not marked "Below threshold".
- Retrieval quality, next day: hit rate did not drop and the used share of retrieved chunks did not fall; no new low-recall queries against the base with outcome "Hallucination flagged".
- Semantic Layer: if the source introduces metrics or terms the agent will quote, the definitions exist and are Verified.
- Memory tab: if the agent stores what it learns from the source, the memory store's PII policy and TTL are set accordingly.
