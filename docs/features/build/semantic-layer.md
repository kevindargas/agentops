# Semantic Layer

The Semantic Layer is the governed vocabulary agents are allowed to reason with: metrics, dimensions, entities and glossary terms, each with one definition, one formula where applicable, known sources and synonyms, an owner, a verification status and lint issues. Agents that generate SQL or answer "how many" questions resolve user phrases to these definitions through the `internal-semantic-layer` MCP server. An unverified definition in use is the most common cause of a confident wrong answer.

Data owners and the engineers who run analytics agents (Ops Analyst, Finance Copilot) use this page to verify definitions, resolve lint issues, manage synonyms and deprecate terms.

## Where to find it

- Sidebar: Build, Semantic Layer. No keyboard chord.
- Route: `/agentops/semantic-layer` (with `loading.tsx` rendering `TableSkeleton`). `?entity=<sem-id>` opens the detail sheet, for example `/agentops/semantic-layer?entity=sem-mttr`. There are no tabs.
- Agent records list the entities an agent may query (`semanticEntityIds`).
- Code: route `app/(app)/agentops/semantic-layer/page.tsx`; UI `features/agentops/semantic-layer.tsx`; state `semanticStore` in `features/agentops/stores.ts`; type `SemanticEntity` in `lib/types.ts`; data `semanticEntities` and `getSemanticEntity` in `lib/data/agentops.ts`.

## What is on the page

Header: eyebrow "Build" (resolved from the nav group), title "Semantic Layer".

Stat cards (`SemanticStats`, a client `StatGrid` reading the same store as the table, so verifying or creating a definition moves them):

| Card              | Value                                                                         | Hint                                            |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| Definitions       | Count                                                                         | "N verified"                                    |
| Lint issues       | Sum of `issues` across definitions                                            | "Stale, ambiguous or unowned"                   |
| Unverified in use | Definitions with status other than Verified and at least one agent using them | "Referenced by agents"                          |
| Queries 30d       | Sum of `queries30d`                                                           | "Resolutions through the semantic-layer server" |

Table (click opens the sheet; screen-reader caption "Semantic layer definitions"):

| Column      | Content                                                                                                                         | Default                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Definition  | Kind badge (metric, dimension, entity, glossary), name, definition text                                                         | shown                          |
| Domain      | ITSM, Operations, HR, Finance, Customer, Product                                                                                | shown                          |
| Status      | Verified (green), Needs review (amber), Draft (grey), Deprecated (grey); a warning triangle when the definition has lint issues | shown                          |
| Agents      | Number of agents using it (header hint explains the allowlist)                                                                  | shown                          |
| Queries 30d | Query count                                                                                                                     | shown, default sort descending |
| Synonyms    | Count                                                                                                                           | hidden                         |
| Owner       | User chip                                                                                                                       | hidden                         |
| Verified    | Last verified date; never-verified rows sort last                                                                               | shown                          |

Search covers name, definition, synonyms, sources and domain. Facets: Kind, Domain, Status, Issues (Has issues / Clean). Toolbar: "New definition" opens a create sheet (name, kind, domain, definition, optional formula for metrics); "Create draft" appends a `Draft` definition owned by you with the lint issue "No owner sign-off" and opens its sheet.

Detail sheet:

- Header: kind, status and domain badges, id with copy, name, definition.
- Lint issues (amber box) when present: one line per issue with a "Resolve" button.
- Formula: monospace block, only for definitions that have one (metrics).
- Sources: code chips with table or system names; glossary terms show "Glossary term, no physical source.", other kinds without sources show "No source recorded yet."
- Used by: agent chips, or "No agent references this definition."
- Synonyms: removable chips and an "Add a synonym" form. Copy reminds you to keep them unambiguous across domains.
- Facts (`MetricTile`s): Owner, Queries 30d, Last verified ("Never" when missing).
- Footer (standard sheet footer): Deprecate on the left (hidden when already Deprecated); then Close; Request review (when Verified) or Restore (when Deprecated) as the outline button; Mark verified as the primary button when not Verified.

## What to check

### Every day

- Unverified in use stat card. Each item is a Draft or Needs review definition that an agent is already resolving to. Open it, read the formula and sources, and either Mark verified or remove it from the agent's allowlist on the Agents page.
- Status Needs review on high-traffic definitions (sort by Queries 30d). These are the ones most likely to produce a wrong number today.

### Every week

- Issues facet set to "Has issues". Work through the list; the issue text tells you what to do. Patterns in the mock data: "Referenced by N agents while still Draft", "Ambiguous with 'change failure rate' (no inverse defined)", "Last verified 95 days ago (policy: 90)", "'tenant' also maps to Workspace in the Product domain", "No owner sign-off", "Currency conversion date not specified", "Superseded by 'Supplier' in the Procurement domain".
- Verified column older than 90 days. The 90-day policy appears in issue text only; nothing enforces it, so sort by Verified ascending and look.
- Synonyms shared across domains. The same word mapping to two definitions (for example "tenant") is a routing error waiting to happen; remove the synonym from the less common definition or qualify it.
- Deprecated definitions with Queries 30d above zero or agents still listed under Used by. Agents will stop resolving to a deprecated term only after their next sync; until then they still produce answers from it.
- Definitions with no owner sign-off. Assign an owner before verification.

### Before a release or model change

- Every entity in the released agent's `semanticEntityIds` should be Verified with no lint issues and a formula that matches the warehouse. A new model will phrase SQL differently but still relies on these definitions.
- Finance definitions (Spend, Cost center, Vendor): check the currency and period rules in the definition text; the Finance Copilot prompt instructs the model to state currency and period in every answer and relies on these being defined.
- New synonyms introduced by the release: test them against the glossary for collisions.

## Actions

All actions update the shared `semanticStore` and show a toast. A reload restores the mock data.

| Action             | Where                            | What happens in this template                                                                                                                  |
| ------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| New definition     | Toolbar                          | Opens the create sheet; "Create draft" adds a `Draft` definition (`sem-<slug>`) to the store, toasts and opens it                              |
| Resolve            | Issues box                       | Removes that issue string from the definition; toast names the issue                                                                           |
| Remove synonym (x) | Synonyms                         | Removes the chip                                                                                                                               |
| Add                | Synonyms form                    | Adds the trimmed synonym if not already present                                                                                                |
| Deprecate          | Footer                           | Sets status Deprecated; toast "Definition deprecated" explains agents keep resolving until their next sync and offers Undo                     |
| Request review     | Footer, Verified definitions     | Sets status Needs review; toast "Marked for review" with Undo (nothing is sent)                                                                |
| Mark verified      | Footer, non-Verified definitions | Sets status Verified, `lastVerified` to the demo clock (`clock()` from `lib/data/seed.ts`), and removes issues that start with "Last verified" |
| Restore            | Footer, Deprecated definitions   | Sets status Draft                                                                                                                              |
| Copy id            | Header                           | Copies `sem-…`                                                                                                                                 |

## Reading the data

| Field          | Meaning                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sem-…`        | Entity id, referenced by `DeployedAgent.semanticEntityIds` and by the entity's own `usedByAgentIds`                                                                 |
| kind           | metric (has a formula), dimension (a grouping attribute), entity (a business object), glossary (a term with no physical source)                                     |
| domain         | ITSM, Operations, HR, Finance, Customer, Product                                                                                                                    |
| status         | Verified: approved by the owner. Needs review: verification requested or expired. Draft: not yet approved. Deprecated: do not use; agents stop resolving after sync |
| definition     | Plain-language meaning                                                                                                                                              |
| formula        | SQL or pseudo-formula for metrics                                                                                                                                   |
| sources        | Tables, views or systems the definition reads from                                                                                                                  |
| synonyms       | Phrases that resolve to this definition                                                                                                                             |
| ownerId        | Accountable owner                                                                                                                                                   |
| usedByAgentIds | Agents that reference the definition; drives the Agents column and "Unverified in use"                                                                              |
| queries30d     | Resolutions in the last 30 days                                                                                                                                     |
| lastVerified   | Last owner sign-off; missing means never                                                                                                                            |
| issues         | Free-text lint findings. The UI only counts and lists them; there is no rule engine                                                                                 |

Kind badge colours: metric brand, dimension chart colour 4, entity chart colour 3, glossary grey.

## How the data gets here

Type: `SemanticEntity`, `SemanticKind`, `SemanticStatus`, `SemanticDomain` in `lib/types.ts`.

Data: `semanticEntities` (15 definitions) and `getSemanticEntity(id)` in `lib/data/agentops.ts`, the same module that holds agents and traces, seeded into `semanticStore`. Agents reference entities through `DeployedAgent.semanticEntityIds`; the entity's `usedByAgentIds` is derived from those allowlists at build time and is what this page displays.

To wire a backend: return `SemanticEntity[]` from your semantic layer (dbt semantic layer, Cube, LookML, or a custom catalog), replace the `semanticStore.patch` and `semanticStore.add` calls in `features/agentops/semantic-layer.tsx` with mutations for create, verify, review, deprecate, restore, synonyms and issue resolution, and generate `issues` from real lint rules (verification age, ambiguous synonyms, missing owner, drafts in use). "Mark verified" stamps `lastVerified` with `clock()`, which returns the frozen demo clock until real data is wired.

## Related pages

- Agents (`/agentops/agents/agt-…`): `semanticEntityIds` allowlist per agent; Ops Analyst and Finance Copilot are the main consumers.
- Tools & MCP (`/agentops/tools?server=mcp-semantic-layer`): the server that exposes these definitions to agents.
- Prompts (`/agentops/prompts/prm-finance-sql`, `/agentops/prompts/prm-ops-sql`): prompts that instruct the model to stay within the semantic layer.
- Traces (`/agentops/traces`): SQL spans that used a definition.
- Guardrails (`/agentops/guardrails`): row-level access and read-only SQL policies.
