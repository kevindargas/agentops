# Tools & MCP

Tools & MCP Servers lists every capability an agent can call: where it comes from (an MCP server, a built-in, an HTTP API or sandboxed code), how risky it is, which policy gates it, how it behaves on retry, what side effects it has, whose identity it runs under, and how it is performing. The MCP Servers tab adds the supply-chain view for remote tool providers: transport, auth, definition digest, review state, signature, vulnerabilities, end of life and egress allowlist. The Permissions tab is the agent by risk-level matrix that bounds the blast radius of a bad turn; the prompt does not.

Platform and security engineers use this page to approve new tools, tighten policies, review MCP servers after their tool lists change, and export the permission policy as JSON.

## Where to find it

- Sidebar: Build, Tools & MCP. Keyboard chord `G` then `T`.
- Route: `/agentops/tools`. Tabs sync to `?tab=servers` and `?tab=permissions` (the Tools tab is the default and has no parameter).
- Deep links: `?tool=<tool_name>` opens the tool sheet and forces the Tools tab; `?server=<mcp-id>` opens the server sheet and forces the MCP Servers tab. Opening a tool from a server (or a server from a tool) swaps the parameter and the tab. `?agent=<agt-id>` pre-selects the Agent facet on the Tools tab and emphasises that agent's row on the Permissions tab (the agent record links here this way). Agent records and the permissions aside link here with `?tool=`.
- Code: route `app/(app)/agentops/tools/page.tsx` and `loading.tsx`; UI in `features/agentops/tools/` (`tools-registry.tsx`, `tools-table.tsx`, `tool-sheet.tsx`, `mcp-servers.tsx`, `permissions-matrix.tsx`, `shared.tsx`); client stores in `features/agentops/tools/store.ts` (`toolStore`, `serverStore`); data in `lib/data/tools.ts`.

Tools, servers, tab counts and stat cards all read the two stores, so disabling a tool or revoking a server moves every number on the page. Nothing is persisted; a reload returns to the seed.

## What is on the page

Header: eyebrow "Build", title "Tools & MCP" (from `config/nav.ts`). Three tabs: Tools (count pill), MCP Servers (count pill), Permissions.

### Tools tab

Stat cards (`StatGrid`, computed from the store):

| Card              | Value                                                                  | Hint                                                                      |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Tools registered  | Number of tools                                                        | "N active · M from MCP servers"                                           |
| Calls 24h         | Sum of calls over tools that are not Disabled, with a 14-day sparkline | "14-day trend, Disabled tools excluded"                                   |
| Error rate        | Call-weighted error percentage, amber at or above 2 percent            | "Weighted by call volume"                                                 |
| Awaiting approval | Sum of `pendingApprovals`                                              | "N tools gated by a reviewer" (Active tools with policy Require approval) |

Table (click a row to open the tool sheet; sr-only caption; the Risk, Policy, Safety, Error rate and p95 headers carry hint tooltips):

| Column     | Content                                                                                                                                          | Default                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Tool       | `snake_case` name in mono and the description. Muted when not Active                                                                             | shown                          |
| Source     | Chip with kind icon: MCP server (name is a button that opens the server sheet), Built-in, HTTP API (label), Code                                 | shown                          |
| Risk       | Read (green), Write (amber), Destructive (red). Sorts by rank                                                                                    | shown                          |
| Policy     | Auto, Require approval, Blocked, with icon                                                                                                       | shown                          |
| Safety     | Three fixed glyph slots: idempotent, dry run, delegated identity. Lit green when on; the dry-run slot turns red when a Destructive tool lacks it | shown                          |
| Agents     | Stacked initials of allowlisted agents, `+N` overflow, tooltip with names                                                                        | shown                          |
| Calls 24h  | 14-day sparkline and the number                                                                                                                  | shown, default sort descending |
| Error rate | Error rate percent; red at or above 3, amber at or above 1.5; blank when the tool had no calls                                                   | shown                          |
| p95        | p95 latency; blank when no calls                                                                                                                 | shown                          |
| Status     | Active, Deprecated, Disabled                                                                                                                     | shown                          |
| Owner      | User chip                                                                                                                                        | hidden                         |

Search covers name, description, source label, tags, risk and policy. Facets: Source (Built-in, HTTP API, Code, and one entry per MCP server), Risk, Policy, Status, Agent (allowlisted agents; pre-selected by `?agent=`). Toolbar: "Register tool" opens a sheet with Name (normalised to snake_case, must be unique), Description, Source (Built-in, HTTP API, Code; plus an API name or runner label), Risk and Policy. "Register" adds an Active tool with an empty input schema, zero traffic and no agents to the top of the table and opens its sheet.

### Tool sheet

Header: status, risk and policy badges, source chip, tool name with copy button, description. Banners: a Deprecated tool with a successor shows "Deprecated alias. New prompts should call `<replacedBy>`" with an "Open successor" button; a Disabled tool shows that it is hidden from every agent and calls fail closed.

Sections, in order:

- Metric tiles: Calls 24h with sparkline, Error rate (red at or above 3, amber at or above 1.5), p95 latency, Awaiting approval (amber above 4).
- Input parameters: table (sr-only caption) of Name, Type (`string`, `integer`, `string[]`, `string (date-time)`), Required, Description with enum values and defaults; an empty state "No arguments" when empty. Count of fields and required fields in the header.
- JSON Schema: the full input schema with a copy button.
- Output: free-text description with inline code.
- Facts: Rate limit, Timeout, Retries, Owner.
- Side-effect safety: red banner when a hazardous output sink (renders HTML, executes code) is not contained by the sandbox. Facts: Idempotent (Yes/No plus a retry hint), Dry run (Supported / Not supported, amber when Destructive without it, with the line "Destructive calls cannot be previewed before approval"), Transaction limit (`$N / call` or none), Compensating tool (link to the undoing tool, "self (reverse call)", "Not needed" for Read, or "None, irreversible"). Output sink chips: No side effects, Fetches URLs, Writes records, Sends messages, Renders HTML, Executes code; hazardous sinks are amber, uncontained ones red, with "contained in the sandbox" when applicable.
- Identity & delegation: Service identity or Delegated badge with hint; Audience ("Internal, no token exchange" for service, "Not pinned" for delegated without audience); Scopes; Token TTL in minutes, with "long for a delegated write" when delegated and above 15 minutes.
- Allowlisted agents: each agent with "in deployed config" (the agent's own `tools` list includes it) or "allowlisted" (granted but not in the deployed config).
- Recent errors: message, time ago, agent; empty state "Nothing failed in the last 7 days".
- Tags.

Footer (shared sheet frame): Policy select on the left (Auto, Require approval, Blocked; disabled with a tooltip when the tool is Disabled), then Close, "Edit schema" and "Disable" (destructive, confirmation dialog) or "Enable". "Edit schema" opens a nested sheet with the input schema as JSON; it validates that the document is an object with `properties` and that every `required` entry exists, shows the field count, and "Save schema" writes it onto the tool.

### MCP Servers tab

Stat cards (`StatGrid`):

| Card               | Value                                                                                         | Hint                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Servers            | Count                                                                                         | "N connected · M local" (stdio transport)                                             |
| Tools exposed      | Sum of tools across servers                                                                   | "N resources · M prompts"                                                             |
| Integrity findings | Servers that need review, or are unsigned, or have a critical vulnerability. Amber above zero | "Unreviewed changes, unsigned builds or critical CVEs", or average latency when clean |
| Needs attention    | Servers not Connected. Amber above zero                                                       | Their names                                                                           |

A note states that servers are polled every `mcpPollIntervalSec` seconds (30, from `lib/data/tools.ts`) and tool lists refresh on connect and on `tools/list_changed`; the mock data does not poll. "Add server" opens a sheet with Name (id `mcp-<slug>`, must be unique), Description, Transport, Auth and Endpoint or Command; "Add server" adds a Connected server with no tools, an unverified signature and a fresh digest to the top of the grid and opens its sheet.

Server cards (grid):

- Name (button opens the sheet) with a plug icon tinted by status, status badge (Degraded pulses), actions menu: Reconnect, Refresh tool list, Mark reviewed (disabled unless the server needs review), Re-scan, Revoke credentials (confirmation).
- Transport badge (`stdio`, `Streamable HTTP`, `SSE (legacy)` in amber), auth badge (OAuth 2.1, mTLS, API key, "No auth" in amber), server version.
- Integrity row: Signed (green) or Unsigned (red), first 7 characters of the definition digest, "Changed since review" (amber) when the definitions changed after the last review or were never reviewed, vulnerability badge ("No vulns", or `<C>C · <H>H` in red when any critical, amber when any high).
- Endpoint URL or launch command.
- Mini facts (two columns on phones, four from `sm`): Tools, Resources, Prompts, Latency (red at or above 2,000 ms, amber at or above 1,000 ms).
- Operator note (amber) when present.
- Collapsible list of advertised tool names; names of non-Active tools are struck through.
- Footer: "Checked <time ago>" and attached agents.

### Server sheet

Header: status, transport and auth badges, server id with copy, name, description. Note banner (red when Disconnected, amber otherwise).

- Metric tiles: Tools, Resources, Prompts, Uptime 30d (amber below 99.5 percent).
- Connection: Transport, Endpoint or Command (copyable), Auth, Server version, Protocol (hint when older than `2025-06-18`: structured tool output and elicitation unavailable), Last health check, Avg latency, Owner.
- Integrity: Re-scan and Mark reviewed buttons (Mark reviewed is disabled with a tooltip when nothing changed since the last review); integrity badges; Definition digest (`sha256:…`, copyable, "Changed <time ago>"); Reviewed (reviewer chip and time, or "Never" in amber, with a hint when definitions changed after the review); Signature ("Verified against publisher key" or "Not verified" with the advice to pin the version and require a signed build); Vulnerabilities (critical, high, medium, scanned time); End of life (date in amber or "Not announced"); Egress allowlist (hosts, or "None declared", with "process has no pinned hosts" for stdio).
- Tools exposed: one row per tool (click opens the tool sheet) with description, calls per 24h and risk badge.
- Attached agents.

Footer (shared sheet frame): Revoke on the left (disabled with a tooltip when credentials are already revoked), then Close, Refresh tool list, Reconnect (primary when not Connected).

### Permissions tab

A `Section` titled "Agent by risk level" holds the matrix of deployed agents (rows, with team and tool count) by risk level (Read, Write, Destructive). Each cell is a three-way toggle Allow / Approval / Deny with the number of tools of that risk the agent is allowlisted for (Disabled tools excluded, counted from the tool store) and a brand dot with screen-reader text when the cell differs from the deployed policy. The row named by `?agent=` is emphasised. Below the table: "Matches the deployed policy." or "N cells differ from the deployed policy; export to review the diff."

Section actions: Reset (disabled when nothing changed), Export policy as JSON (dialog with the JSON, byte count, Copy JSON, Download).

Aside: Least privilege explainer with the three decisions; Risk levels (Read: fetches data, watch for exfiltration; Write: creates or updates records, reversible but visible; Destructive: deletes, pages, publishes or pays, never without approval); "Destructive without dry run" (amber) listing Destructive tools without dry-run support as `?tool=` links; "Destructive tools auto-allowed" (red) listing agents whose Destructive cell is Allow.

## What to check

### Every day

- Needs attention and Integrity findings stat cards on the MCP Servers tab. Open each flagged server. Disconnected with an OOM note (the `browser` server in the mock data) means agents have lost those tools; Degraded with latency at or above 1,000 ms means tool calls are slow and retries are piling up.
- Error rate column, Tools tab, sorted descending. Any tool at or above 3 percent with meaningful call volume: open the sheet, read Recent errors, check whether the source server is Degraded.
- Awaiting approval stat card and the per-tool KPI (amber above 4). A growing queue means approvers are not keeping up or a policy is too strict for the traffic; look at the Review Queue.
- Destructive tools auto-allowed box on the Permissions tab. It should be empty. If an agent is listed, set its Destructive cell to Approval or Deny and export the policy.
- "Changed since review" badges. A server's tool definitions changed after the last sign-off. Read the exposed tools list, then Mark reviewed. Never mark a server reviewed from the card menu without opening it.

### Every week

- Unsigned servers and servers with any critical vulnerability. Pin the package version, require a signed build, re-scan. In the mock data this is `browser` (unsigned, 1 critical).
- Auth badge "No auth" on anything other than a local stdio sandbox. Local stdio servers without network egress are tolerable; a remote server without auth is not.
- Transport "SSE (legacy)" and protocol older than `2025-06-18`. Plan the migration; `pagerduty` in the mock data also has an End of life date 75 days out.
- Egress allowlist "None declared" on a server that fetches URLs or sends messages. Declare the hosts or move the server behind the sandbox.
- Delegated identity with token TTL above 15 minutes on a Write or Destructive tool (the sheet flags it). Shorten the TTL.
- Deprecated tools with calls in the last 24 hours. Someone's prompt still calls the alias; the sheet's "Open successor" shows what to call instead. Prompts of type Tool description on the Prompts page are where to fix it.
- Tools allowlisted to no agent ("No agents" in the Agents column). Registered attack surface with no user; disable or remove.
- Non-idempotent Write tools with retries above 0. A retry repeats the side effect; the sheet's retry hint says so. Either make the tool idempotent or set retries to 0.

### Before a release or model change

- Permissions tab for the agent being released: every cell should match the risk the new version actually needs. Export the policy JSON and commit it with the release.
- Destructive tools without dry run on the agent's allowlist. Approvers will approve blind. Add dry-run support or require approval at the tool level too (the tool's own policy can only be stricter than the matrix).
- Hazardous output sinks outside the sandbox (red banner in the tool sheet). Fetched HTML or executed code reaches the agent loop unconfined; a new model may follow injected instructions the old one ignored.
- Compensating tool "None, irreversible" on any Write or Destructive tool the release adds. Decide whether the lack of an undo path is acceptable.
- Server review state for every MCP server the agent uses. All should be Signed, reviewed after their last definition change, and free of critical vulnerabilities.

## Actions

Every action below changes the shared client stores and shows a toast that says what changed. A reload restores the mock data. Server cards and the server sheet read tool status from the tool store, so disabling a tool strikes it through on its server immediately.

| Action                                           | Where                              | What happens in this template                                                                                                                            |
| ------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register tool                                    | Tools toolbar                      | Sheet; adds an Active tool with defaults to the store and opens its sheet                                                                                |
| Policy select                                    | Tool sheet footer                  | Sets `approval` on the tool, toast with the policy hint                                                                                                  |
| Edit schema                                      | Tool sheet footer                  | Nested sheet with a validated JSON editor; Save writes `inputSchema`                                                                                     |
| Disable                                          | Tool sheet footer                  | Confirmation dialog stating how many agents lose the tool and that queued approvals are cancelled. Sets status Disabled and `pendingApprovals` to 0      |
| Enable                                           | Tool sheet footer (Disabled tools) | Sets status Active                                                                                                                                       |
| Open successor / compensating tool / server chip | Tool sheet                         | Swaps the open sheet via the URL                                                                                                                         |
| Add server                                       | MCP tab                            | Sheet; adds a Connected server with no tools to the store and opens its sheet                                                                            |
| Reconnect                                        | Card menu, sheet footer            | Sets status Connected, clears the note and sets the health-check time to the fixed clock; toast "marked connected"                                       |
| Refresh tool list                                | Card menu, sheet footer            | Sets the health-check time to the fixed clock; toast lists the advertised counts                                                                         |
| Mark reviewed                                    | Card menu, sheet Integrity         | Sets `reviewedAt` to the fixed clock and `reviewerId` to the current user (Kevin Dargas in the mock data); toast with the digest                         |
| Re-scan                                          | Card menu, sheet Integrity         | Sets `vulnerabilities.scannedAt` to the fixed clock; toast "Scan recorded" with the unchanged counts                                                     |
| Revoke credentials                               | Card menu, sheet footer            | Confirmation dialog; sets status Disconnected with a note "Credentials revoked by an operator"                                                           |
| Allow / Approval / Deny                          | Permissions matrix                 | Updates the cell, toast "Agent · Risk: Decision" noting it applies to this session and to the export                                                     |
| Reset                                            | Permissions                        | Restores the deployed matrix                                                                                                                             |
| Export policy as JSON                            | Permissions                        | Opens the dialog with the JSON. Copy JSON copies to the clipboard. Download writes `tool-policy.json` to disk (`downloadText`) and toasts the byte count |

Export JSON shape: `{ version: 1, generatedAt, defaultDecision: "deny", agents: [{ id, name, rules: [{ risk, decision, tools: [names] }] }] }`. Tools listed per rule are the agent's allowlisted tools of that risk, excluding Disabled ones.

## Reading the data

Tool fields:

| Field                                  | Meaning                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk                                   | Read: fetches data. Write: creates or updates records. Destructive: deletes, pages, publishes, pays                                                              |
| Approval policy                        | Auto: executes within the agent's rate limit. Require approval: each call parks in the review queue. Blocked: visible to the model, every call rejected          |
| Status                                 | Active; Deprecated (has a `replacedBy` successor); Disabled (hidden from every agent, calls fail closed)                                                         |
| Source                                 | `mcp` (with `serverId`), `builtin`, `http` (with label), `code`                                                                                                  |
| idempotent                             | Calling twice with the same arguments has no further effect; retries are safe                                                                                    |
| supportsDryRun                         | The tool can validate or preview a call without applying it                                                                                                      |
| maxTransactionUsd                      | Per-call cap for tools that move money or commit amounts                                                                                                         |
| compensatingToolId                     | Tool that undoes this one; may be the tool itself                                                                                                                |
| outputSinks                            | `none`, `fetches_url` (treat results as untrusted), `writes_record`, `sends_message` (cannot be unsent), `renders_html` (hazardous), `executes_code` (hazardous) |
| Sandboxed                              | True when the source kind is `code` or the server is `mcp-filesystem-sandbox`; only then do hazardous sinks count as contained                                   |
| identity.mode                          | `service`: runs as the platform account. `delegated`: acts as the requesting user with a scoped short-lived token                                                |
| identity.audience, scopes, tokenTtlMin | Token audience, granted scopes and lifetime in minutes                                                                                                           |
| calls24h, calls14d, errorRate, p95Ms   | Volume, 14-day history, error percent, p95 latency                                                                                                               |
| pendingApprovals                       | Calls waiting in the human-approval queue                                                                                                                        |
| rateLimit, timeoutMs, retries          | Runtime limits                                                                                                                                                   |
| agentIds                               | Allowlisted agents (fleet config plus extras)                                                                                                                    |

Thresholds encoded in the UI: error rate red at or above 3 percent and amber at or above 1.5; fleet error rate amber at or above 2; pending approvals amber above 4; delegated token TTL amber above 15 minutes; server latency red at or above 2,000 ms and amber at or above 1,000; uptime amber below 99.5 percent; protocol hint below `2025-06-18`.

MCP server fields:

| Field                                          | Meaning                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| transport                                      | `stdio` (local process), `streamable-http`, `sse` (legacy)                                                               |
| auth                                           | OAuth 2.1, API key, mTLS, none                                                                                           |
| status                                         | Connected (green), Degraded (amber, pulsing), Disconnected (red)                                                         |
| endpoint                                       | URL for remote transports, launch command for stdio                                                                      |
| version, protocolVersion                       | Server package version and MCP protocol revision                                                                         |
| toolNames, resources, prompts                  | What the server advertises; `toolNames` and `agentIds` are derived from registered tools whose `source.serverId` matches |
| definitionDigest, lastDefinitionChange         | sha256 prefix of the advertised definitions and when it last changed                                                     |
| reviewedAt, reviewerId                         | Last operator sign-off; "needs review" when missing or older than `lastDefinitionChange`                                 |
| signatureVerified                              | Package or manifest signature verified against the publisher key                                                         |
| egressAllowlist                                | Hosts the server process may reach; empty means none declared                                                            |
| eolDate                                        | Vendor end of life for the version or transport                                                                          |
| vulnerabilities                                | Critical, high, medium counts and scan time                                                                              |
| uptime30d, avgLatencyMs, lastHealthCheck, note | Health                                                                                                                   |

Permission decisions: `allow` (calls run automatically), `approval` (a reviewer approves each call), `deny` (calls are rejected). Default policy: Read allow, Write allow, Destructive deny, with per-agent overrides in `permissionOverrides` (several agents require approval for Write, `agt-alert-correlator` for Write and Destructive, `agt-kb-curator` for Destructive).

## How the data gets here

Module: `lib/data/tools.ts`, seed `createRng(7401)`.

Types: `Tool`, `ToolSource`, `ToolRisk`, `ToolApproval`, `ToolStatus`, `ToolInputSchema`, `JsonSchemaProperty`, `ToolError`, `ToolOutputSink`, `ToolIdentity`, `McpServer`, `McpTransport`, `McpAuth`, `McpStatus`, `McpVulnerabilities`, `ToolPermission`, `PermissionDecision`. Constants: `toolRisks`, `toolApprovals`, `toolStatuses`.

Exports: `tools` (47 tools), `getTool`, `toolsForAgent`, `mcpServers` (9 servers), `getMcpServer`, `serverNeedsReview`, `toolIsSandboxed`, `toolPermissions`, `getPermission`, `toolStats` (aggregates excluding Disabled tools), `mcpPollIntervalSec`.

Tool `agentIds` are derived from `DeployedAgent.tools` in `lib/data/agentops.ts` plus seeded extras. Server tool lists and agent lists are derived from the tools. The digest is a hash of `<server id>@<version>`.

To wire a backend: return the same types from your tool registry and MCP gateway, then replace the store mutations (`toolStore.patch`, `toolStore.add`, `serverStore.patch`, `serverStore.add` in `tools-table.tsx`, `tool-sheet.tsx`, `mcp-servers.tsx`) and the matrix state in `permissions-matrix.tsx` with mutations. `lib/data/audit.ts` derives audit events from tool changes; a real backend should emit them.

## Related pages

- Agents (`/agentops/agents/agt-…`): deployed `tools` list; "in deployed config" versus "allowlisted".
- Review Queue (`/agentops/reviews`): where Require approval calls wait.
- Guardrails (`/agentops/guardrails`): action and data policies that sit on top of tool permissions.
- Prompts (`/agentops/prompts`): Tool description prompts for the tools listed here.
- Traces (`/agentops/traces/tr_…`): tool spans and tool errors in context.
- Semantic Layer (`/agentops/semantic-layer`): the `internal-semantic-layer` MCP server exposes governed entities.
- Audit Log (`/agentops/audit`): tool and server change events.
