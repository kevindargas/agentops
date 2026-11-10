# Workspace

The Workspace group is the personal layer of AgentOps: the pages you open before going into a module. They aggregate data from Agent Operations, Service Management and Service Health and link out to where the work is done.

| Page                                          | Route        | Chord | What it is for                                                                                                                               |
| --------------------------------------------- | ------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Overview dashboard](./overview-dashboard.md) | `/dashboard` | `G D` | Morning read of fleet health, spend, review backlog, drift, failing evals, incidents, SLA, services, approvals, changes, alerts and requests |
| [My Work](./my-work.md)                       | `/my-work`   | `G W` | Everything assigned to, owned by or requested by the current user, plus approvals and recently viewed records                                |
| [Approvals](./approvals.md)                   | `/approvals` | `G A` | Decide on change and request approvals, singly or in bulk                                                                                    |
| [Analytics](./analytics.md)                   | `/analytics` | `G N` | Incident flow, demand mix, change throughput and SLA attainment per group over 7, 30 or 90 days                                              |

All four pages are read-mostly. The only mutations are approving or rejecting (approvals and agent proposals). Approval decisions go through a shared client store (`features/workspace/approvals-store.ts`) that the approvals inbox, the change record's approval card and the request record read together, so a decision taken anywhere shows everywhere in the session; a reload restores the seed.

Every page uses `PageHeader` with `nav` (eyebrow "Workspace", the nav icon and title) and `StatGrid` rows of compact stat cards without icons, the same dialect as Agent Operations. Deltas on stat cards are derived from `lib/data/metrics.ts`, never typed in.

Data comes from `lib/data/` (`itsm.ts`, `itom.ts`, `agentops.ts`, `activity.ts`, `users.ts`, `catalog.ts`) with a fixed clock `NOW` in `lib/data/seed.ts`. The current user is `currentUser` in `lib/data/users.ts` (Kevin Dargas, kevin.dargas@agentops.dev).

See also [Assistant and shell](../assistant-and-shell.md) for the command menu, sidebar, notifications and AgentOps Assist that wrap these pages.
