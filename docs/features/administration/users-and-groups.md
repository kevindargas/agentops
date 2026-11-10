# Users & Groups

Users & Groups is the directory behind every chip in the app: the people records that appear as callers, assignees, approvers and owners, and the assignment groups that route incidents, changes and fulfillment tasks. Roles shown here control what users can see and do. It is for the platform owner and whoever administers the service desk.

## Where to find it

- Route: `/admin/users`. Sidebar: Administration, Users & Groups (no chord). Also linked from the Settings header ("Users & Groups").
- Code: `app/(app)/admin/users/page.tsx`, `features/admin/users-tabs.tsx` (stat row and tabs), `features/admin/users-table.tsx`, `features/admin/groups-grid.tsx`, `features/admin/user-actions.tsx` (Invite user and New group sheets), `features/admin/users-store.ts` (shared client stores). Data: `users`, `groups` and `roles` in `lib/data/users.ts`.

## What is on the page

**Header.** Standard `PageHeader` resolved from the nav entry (eyebrow "Administration", icon, title). Actions: "New group" and "Invite user", both open sheets (see Actions).

**Stat tiles.** A compact four-column `StatGrid` read from the shared stores, so inviting a user or creating a group moves the numbers:

| Tile              | Value                                       | Extra                                                                         |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Users             | rows in the directory                       | hint: distinct departments, plus pending and deactivated counts when non-zero |
| VIPs              | users with `vip`                            |                                                                               |
| Assignment groups | groups in the store                         | hint: total memberships and distinct managers                                 |
| Roles             | `roles.length` from `lib/data/users.ts` (7) | hint lists the first four roles                                               |

**Tabs.** Users and Groups with live `CountPill` counts. Tab state is local, not in the URL.

**Users tab.** A table sorted by name, caption "Users".

| Column     | Content                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name       | avatar with initials, name, VIP badge when set, email beneath                                                                                                                                   |
| Title      | job title                                                                                                                                                                                       |
| Department | badge                                                                                                                                                                                           |
| Location   | city                                                                                                                                                                                            |
| Roles      | derived until edited: `admin` and `itil` for the current user, `itil` for IT, `approver` for People, `finance_viewer` for Finance, `readonly` otherwise; header tooltip explains the derivation |
| Groups     | derived: groups the user manages, or 1 for IT users, plus groups added in this session                                                                                                          |
| Status     | Active, Pending (title starts with "New Hire" or invited this session) or Deactivated                                                                                                           |

Facets: Department, Location, Status (Active, Pending, Deactivated), Role. Search matches name, email, title, department, location and roles. The toolbar carries the same "Invite user" sheet as the header. The per-row menu has Edit roles, Add to group and Deactivate (or Reactivate for a deactivated user). Selecting rows shows a bulk bar with Add to group and Deactivate.

**Groups tab.** One card per group: name, type badge (ITIL, Fulfillment, Approval, People, CAB), description, manager chip and member count. New groups appear at the end.

## What to check

Every day

- Nothing routine. Open this page when a record shows an empty assignee chip or an unknown group, or when a new hire needs access.

Every week

- Status Pending. New hires (Liam O'Connor and Ava Thompson in the seed) should have a New Hire Account Setup request in Requests; once provisioned they should become Active.
- VIP flags. VIP callers raise default urgency on new incidents (per the incident sheet copy). Make sure the list is deliberate: in the seed Kevin Dargas and Fatima Al-Sayed are VIPs.
- Groups with a manager who is Pending or not in the users list. Every ITIL and fulfillment group needs an active manager because approvals and escalations route to them.
- Groups count column at zero for someone who is assigned work on Incidents; group membership drives the "Assigned to me" and group queues.
- Roles. The `admin` role should be limited; in the seed only the platform owner has it.

## Actions

All actions mutate the shared client stores (`usersStore`, `groupsStore` in `features/admin/users-store.ts`), so the table, the stat tiles, the tab counts and the Groups grid agree. Nothing is persisted; a reload returns to the seed. No e-mail is sent by any action.

| Action                              | Behaviour in the template                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invite user (header, toolbar)       | sheet with name, e-mail handle (completed with `SAMPLE_EMAIL_DOMAIN`), title, department, location and role; adds a Pending user with the next `u-NNN` id and toasts |
| New group (header)                  | sheet with name, type, manager and description; adds a group with one member and toasts; the card appears in the Groups tab                                          |
| Edit roles (row)                    | dialog with one checkbox per role in `roles`; saving stores the override on the row and toasts                                                                       |
| Add to group (row, bulk)            | dialog with a group select; the users' Groups count and the group's member count increase; toast                                                                     |
| Deactivate (row, bulk)              | confirmation dialog, then Status becomes Deactivated with a toast; the row menu then offers Reactivate                                                               |
| Reactivate (row)                    | Status back to Active, toast                                                                                                                                         |
| Users / Groups tabs, facets, search | local state                                                                                                                                                          |

Impersonate and Reset password were removed because nothing in the template can perform them.

## Reading the data

- Status badge: Active (green), Pending (grey), Deactivated (grey), from `stateTone`.
- Roles and group counts are computed in `features/admin/users-store.ts` (`rolesOf`, `groupCountOf`) from department, ownership and session overrides; they are not stored on the seeded user. Treat them as placeholders for a real role model.
- Group types: `itil` (resolver groups that receive incidents, problems and changes), `fulfillment` (catalog tasks), `hr` (shown as "People"), `cab` (Change Advisory Board), `approval` (defined in the type, unused in the seed).
- `members` is a count on the group, not a membership list; there is no way to see who is in a group.
- `currentUser` is the first user (Kevin Dargas, Platform Owner, San Francisco); the greeting, My Work, approvals and the user menu all key off this record.

## How the data gets here

`lib/data/users.ts` holds two static arrays: 24 `users` (`u-001` to `u-024`) and 14 `groups` (`g-sd` Service Desk, `g-infra`, `g-net`, `g-dba`, `g-cloud`, `g-app`, `g-sec`, `g-sre`, `g-cab`, `g-hw`, `g-iam`, `g-hr`, `g-payroll`, `g-fac`), plus `roles`, `getUser`, `getGroup`, `initials`, `currentUser` and `SAMPLE_EMAIL_DOMAIN`. `UserChip` and `GroupChip` in `components/shared/user-chip.tsx` resolve ids through these lookups everywhere in the app.

Incident assignees are drawn from a per-group roster in `lib/data/itsm.ts` (`agentsByGroup`), so changing users here without updating that map will leave dangling ids. Replace both arrays with a directory client that returns `User` and `Group` from `lib/types.ts`, and replace the store mutations in `features/admin/users-store.ts` with real invitations, role edits and deactivations.

## Related pages

- [Settings](./settings.md) (profile of the current user, platform options)
- [Incidents](../service-management/incidents.md), [Changes](../service-management/changes.md), [Requests](../service-management/requests.md) (where groups route work)
- [Approvals](../workspace/approvals.md) (approver routing)
