# Administration

Administration covers the directory and the preferences that sit behind the operational pages.

| Page                                      | Route                                          | Chord | What it is for                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Users & Groups](./users-and-groups.md) | `/admin/users`                                 | none  | People, VIP flags, roles, and the assignment, fulfillment, People and CAB groups that route work; invite, edit roles, add to group, deactivate with confirmation |
| [Settings](./settings.md)                 | `/settings`, `?section=` or `?tab=` deep links | `G S` | Profile, appearance (theme mode), notifications, security, platform options and the danger zone                                                                  |

Users and groups are seeded from `lib/data/users.ts` into two client stores (`features/admin/users-store.ts`) that the table, stat tiles, tab counts and group cards all read, so every action on the page is reflected everywhere on it within a session; a reload returns to the seed. Settings are default values in `features/admin/settings-form.tsx`; the theme mode toggle (through `next-themes`), the profile photo picker, the session list, the API token rotation and the directory export change real local state, while save buttons only toast. Platform defaults (CAB slot, auto-close period, workspace name) come from `lib/constants.ts` and `config/site.ts`.

The current user for the whole app is `currentUser` in `lib/data/users.ts` (Kevin Dargas, kevin.dargas@agentops.dev). Accent, radius, density, surface and sidebar style live in the header theme customizer, documented in [Assistant and shell](../assistant-and-shell.md).
