# Model Catalog

The Model Catalog lists every model reachable through OpenRouter with context window, max output, pricing per million tokens, input modalities and capability flags, and lets you pin any of them into the AgentOps Assist model picker. It is the one page in this template backed by live data: the server fetches the public OpenRouter models endpoint, caches the response for an hour, normalises it and renders a faceted table with a detail sheet.

Use it when choosing a model for an agent, checking what a model costs before an experiment, confirming a model supports tool calling or JSON schema output, or comparing a vendor's new release against the curated defaults in the assistant.

## Where to find it

- Sidebar: Build, Model Catalog. No keyboard chord.
- Route: `/ai/models`. The site header renders the breadcrumb (Workflow Automations / Model Catalog); the page header has none of its own. The Workflow Automations header links here with a "Model catalog" button.
- Code: route `app/(app)/ai/models/page.tsx` (server component); fetch in `lib/ai/openrouter.server.ts`; normalisation, types and formatters in `lib/ai/openrouter.ts`; UI in `features/ai/model-catalog/` (`model-catalog.tsx`, `columns.tsx`); tests in `lib/ai/openrouter.test.ts`.

## What is on the page

Header: eyebrow "Build", title "Model Catalog" (from `config/nav.ts`), a badge reading "Live · OpenRouter" (green dot) or "Unavailable · OpenRouter" (amber dot) depending on whether the fetch returned an error. There is no cached copy in this template; when the fetch fails the table area shows the empty state described below. Actions: "API reference" (opens the OpenRouter list-models docs in a new tab) and "Open Assist" (opens the assistant panel on the chat tab).

When the model list is empty the page shows a single empty state, "The catalog could not be loaded", with the error text (`OpenRouter responded with 503 Service Unavailable`, a network error message, or "OpenRouter returned an empty model list") and a "Try again" link back to `/ai/models`.

Stat cards (`StatGrid`, computed client-side from the loaded list):

| Card         | Value                                        | Hint                                               |
| ------------ | -------------------------------------------- | -------------------------------------------------- |
| Models       | Count                                        | "Across N providers"                               |
| Tool calling | Models with the tools capability             | share of the catalog and how many expose reasoning |
| Multimodal   | Models with any non-text input modality      | "Accept image, file, audio or video input"         |
| Free to use  | Models with zero prompt and completion price | "Median paid input price $X per 1M tokens"         |

Table (click opens the detail sheet; sr-only caption):

| Column       | Content                                                                                                          | Default                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Model        | Provider logo, name, "Free" badge when free, model id in mono                                                    | shown                          |
| Provider     | Vendor label derived from the id prefix (`anthropic/…` becomes Anthropic)                                        | shown                          |
| Context      | Context length as `262K` or `1M`; header hint defines the window                                                 | shown                          |
| Max output   | Max completion tokens from the top provider                                                                      | hidden                         |
| Input $/1M   | Prompt price per million prompt tokens (header hint); "Varies" in italics when the router prices by routed model | shown                          |
| Output $/1M  | Completion price, same rules                                                                                     | shown                          |
| Inputs       | Modality icons: text, image, file, audio, video, each with a tooltip and an accessible label                     | shown                          |
| Capabilities | Chips: Tool use, Reasoning, JSON schema, Web search (Vision is implied by the Inputs column)                     | shown                          |
| Added        | Absolute date the model was created on OpenRouter                                                                | shown, default sort descending |
| Moderated    | Yes/No                                                                                                           | hidden                         |

Page size 25, options 25 / 50 / 100. Search covers name, id, provider label and description. Toolbar shows a pulsing status dot with "Live from OpenRouter · <fetch time>".

Facets: Provider (sorted by model count, with logos), Capability (Tool use, Reasoning, JSON schema, Web search, Vision), Input (Text, Image, File, Audio, Video), Price (Free, Budget, Standard, Premium, Varies), Context (Up to 32K, 33K to 200K, 201K to 1M, Over 1M).

Detail sheet (shared sheet frame, detail width):

- Header: logo, provider label eyebrow, name, id with copy button. Badges: price band, Moderated (when true), variant suffix such as `:free` or `:batch` (when present), "Added <date>".
- Description from OpenRouter, or "No description provided."
- Facts: Context, Max output, Tokenizer, Cutoff (knowledge cutoff month and year); "Not reported" when missing.
- Pricing table: Input and Output per 1M tokens; Cached input per 1M tokens when the model reports a cache-read price; Image input per image and Web search per request when priced above zero.
- Inputs (modality chips) with the output modalities underneath; Capabilities chips including Vision.
- Supported parameters: every parameter name OpenRouter reports (`temperature`, `tools`, `response_format`, `reasoning`, and so on), or "Not reported."
- Footer: Close, "View on OpenRouter" (`https://openrouter.ai/<slug>`, new tab) and "Use in AgentOps Assist". When the model is already the assistant's model the button reads "Active in Assist" and is disabled.

## What to check

### Every day

- Header badge. "Unavailable · OpenRouter" and the empty state mean the hourly fetch failed. The page retries on the next request after the revalidation window; if it persists, check outbound network access from the server and whether OpenRouter changed the response shape.
- Nothing else on this page needs daily attention; it is reference data.

### Every week

- Pricing of the models the fleet actually runs (compare `DeployedAgent.modelId` on the Agents page). OpenRouter prices change; the Playground's `modelPricing` table and the Costs page forecasts are static in this template and must be updated by hand when the catalog disagrees.
- Models the fleet uses that no longer appear in the catalog, or that now carry a variant suffix. A missing id usually means a deprecation notice has been or will be issued; the Recommendations page is where that lands.
- New models from the vendors you already use (sort by Added). Candidates for an experiment.

### Before a release or model change

- Capabilities of the target model: Tool use must be present for any agent with tools; JSON schema for agents that set response format to `json_schema`; Reasoning if the agent relies on reasoning effort above none. A model without the capability silently ignores the parameter or errors.
- Context length versus the agent's prompt size plus retrieval (`top k × chunk size`) plus max output tokens. The Prompts record shows the prompt token estimate; Knowledge & Memory shows chunking.
- Max output versus the agent's `maxOutputTokens`. The agent parameter cannot exceed what the provider serves.
- Price band and the Input and Output prices against the agent's budget on the Costs page. A move from Budget to Premium at the same traffic is a step change in spend.
- Moderated flag: moderated endpoints may refuse content the current model accepts; run the guardrail and eval suites before promoting.
- Supported parameters: confirm `tools`, `response_format`, `seed`, `stop`, `frequency_penalty`, `presence_penalty` and `reasoning` are listed if the agent's `ModelParams` set them.

## Actions

| Action                 | Where        | What happens                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API reference          | Header       | Opens the OpenRouter docs in a new tab                                                                                                                                                                                                                                                                                                                                                                |
| Open Assist            | Header       | Opens the assistant panel on the chat tab                                                                                                                                                                                                                                                                                                                                                             |
| Try again              | Empty state  | Navigates to `/ai/models` again                                                                                                                                                                                                                                                                                                                                                                       |
| Row click              | Table        | Opens the detail sheet                                                                                                                                                                                                                                                                                                                                                                                |
| Copy model id          | Sheet        | Copies the id                                                                                                                                                                                                                                                                                                                                                                                         |
| View on OpenRouter     | Sheet footer | Opens `https://openrouter.ai/<slug>` in a new tab                                                                                                                                                                                                                                                                                                                                                     |
| Use in AgentOps Assist | Sheet footer | Sets the assistant's `modelId` to the catalog id and stores `catalogModel` (id, name, provider, first sentence of the description cut at 140 characters) in the persisted settings. The model picker shows it under "From model catalog". Toast with an "Open Assist" action. This is real client state, persisted in the browser under `agentops:ai-settings`; it does not change any deployed agent |

## Reading the data

| Field                                      | Meaning and derivation                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id, slug                                   | OpenRouter id (`vendor/model[:variant]`) and canonical slug used for the OpenRouter URL                                                                                                                                                                                                                   |
| provider, providerLabel                    | Prefix of the id and a friendly label from a fixed map (unknown prefixes are title-cased)                                                                                                                                                                                                                 |
| contextLength                              | `context_length`, falling back to the top provider's context length; 0 renders as a dash                                                                                                                                                                                                                  |
| maxOutput                                  | Top provider's `max_completion_tokens`, or null                                                                                                                                                                                                                                                           |
| promptPrice, completionPrice               | USD per million tokens. OpenRouter reports per-token strings; negative values mean "depends on the routed model" and become null, shown as "Varies"                                                                                                                                                       |
| cacheReadPrice, imagePrice, webSearchPrice | Per million tokens, per image, per request                                                                                                                                                                                                                                                                |
| isFree                                     | Both prompt and completion price are 0                                                                                                                                                                                                                                                                    |
| priceBand                                  | Varies when either price is null; Free when both are 0; Budget when input is under $1 per 1M; Standard from $1 to under $5; Premium at $5 or more                                                                                                                                                         |
| inputModalities                            | From `architecture.input_modalities`, filtered to text, image, file, audio, video; defaults to text                                                                                                                                                                                                       |
| outputModalities                           | From `architecture.output_modalities`, defaults to text                                                                                                                                                                                                                                                   |
| capabilities                               | tools when `supported_parameters` includes `tools`; reasoning when it includes `reasoning` or `reasoning.mandatory` is set; structured_outputs when it includes `structured_outputs` or `response_format`; web_search when a web search price above 0 is reported; vision when image is an input modality |
| supportedParameters                        | Raw list from OpenRouter                                                                                                                                                                                                                                                                                  |
| moderated                                  | Top provider's `is_moderated`                                                                                                                                                                                                                                                                             |
| knowledgeCutoff, tokenizer                 | As reported, may be null                                                                                                                                                                                                                                                                                  |
| variant                                    | The `:suffix` part of the id, for example `:free`, `:batch`, `:thinking`                                                                                                                                                                                                                                  |
| createdAt                                  | `created` epoch converted to ISO; the default sort                                                                                                                                                                                                                                                        |

Context facet bands: up to 32,768; 32,769 to 200,000; 200,001 to 1,048,576; above 1,048,576.

Price formatting: $0 renders "Free"; under $0.01 shows four decimals; under $1 shows two; otherwise two decimals with a trailing `.00` removed.

## How the data gets here

`fetchCatalog()` in `lib/ai/openrouter.server.ts` runs in the server component. It calls `OPENROUTER_MODELS_URL` (the `OPENROUTER_MODELS_URL` environment variable when set, otherwise `https://openrouter.ai/api/v1/models`) with `next: { revalidate: 3600 }` and an `accept: application/json` header. No API key is required. A non-OK response or a thrown error returns `{ models: [], fetchedAt, error }`; a success maps each raw item through `normalizeModel` and sorts by `createdAt` descending. The result shape is `CatalogResult`. `fetchedAt` is the real server clock because the data is live.

`lib/ai/openrouter.ts` is safe to import from client components: it holds the `RawModel` and `CatalogModel` types, `normalizeModel`, `providerLabel`, `providerLogo` (maps vendor slugs to models.dev logo slugs), `priceBandMeta`, `capabilityMeta`, `modalityMeta`, `formatPrice` and `formatContext`. The server file is kept separate so server APIs stay out of the browser bundle.

The pinned model lands in `AiSettings.catalogModel` (defined in `components/ai/ai-provider.tsx`) through `lib/store.ts`, and `components/ai/model-picker.tsx` resolves it alongside the curated list in `lib/ai/agents.ts`.

To change the source: set `OPENROUTER_MODELS_URL` or swap `normalizeModel` for your gateway's model list (LiteLLM, Portkey, an internal registry) while returning `CatalogModel[]`. Keep the empty-state behaviour on failure; the page must not throw when the upstream is down. If OpenRouter adds or renames fields, extend `RawModel` and the normaliser and update `lib/ai/openrouter.test.ts`.

## Related pages

- Workflow Automations (`/ai`): its Guardrails tab selects the assistant's default model from the curated list; the catalog extends that list.
- Playground (`/agentops/playground`): model select and the static `modelPricing` table that should agree with the catalog.
- Agents (`/agentops/agents/agt-…`): `modelId` and `fallbackModelId` per agent.
- Recommendations (`/agentops/recommendations`): model change proposals and deprecation notices.
- Costs & Budgets (`/agentops/costs`): spend by model.
- Providers & Routing (`/agentops/providers`): provider connections and routing rules behind the model ids.
