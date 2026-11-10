# Settings

Settings holds personal preferences (profile, appearance, notifications, security) and instance-wide platform configuration, on one scrolling page with an anchor navigation. Personal changes are meant to apply immediately; platform changes are described as audited. In this template the theme mode, the profile photo, the session list, the API token and the directory export are wired to real local behaviour; every other field is a form that shows a toast on save.

## Where to find it

- Route: `/settings`. Sidebar: Administration, Settings. Chord `G` then `S`.
- Deep links: `?section=<id>` or `?tab=<id>` scroll to a card, where id is one of `profile`, `appearance`, `notifications`, `security`, `platform`, `danger`. The user menu and the notifications popover use `/settings?tab=notifications`.
- Code: `app/(app)/settings/page.tsx`, `features/admin/settings-form.tsx`. Theme mode uses `next-themes` through `components/theme-provider.tsx`. Platform defaults come from `cabSchedule`, `incidentAutoCloseDays` and `onHoldAutoResolveDays` in `lib/constants.ts` and `siteConfig.workspace` in `config/site.ts`.

## What is on the page

**Header.** Standard `PageHeader` resolved from the nav entry (eyebrow "Administration", icon, title). Action: "Users & Groups" (`/admin/users`).

**Anchor nav.** Six entries with a one-line description each; the active entry follows the card nearest the top of the viewport. Danger zone is tinted red.

**Profile.** Avatar with initials and Upload photo (a file picker; the chosen file name is shown and kept in session state) with Remove once a photo is chosen; Full name, Email, Title, Location (described as driving routing for facilities requests), Time zone (Pacific, Eastern, GMT, CET, IST, JST; described as the zone for dates and SLA timers), Language (English US, English UK, Deutsch, Español, 日本語). "Save changes" footer.

**Appearance.** Theme toggle Light / Dark / System (wired to `next-themes`; "Press D anywhere to toggle quickly"), Default landing page (Overview, My Work, Incidents, Approvals), and switches Compact tables (off), Show record numbers (on), Sticky table headers (on), Reduce motion (off). The card points to the header theme customizer for accent and radius.

**Notifications.** Delivery channel (In-app and email, In-app only, Email only, Slack DM; "Major incidents always page you regardless"), and switches Assignments, Approvals, SLA warnings ("15 minutes before a resolution SLA breaches"), Mentions, Major incidents (badge "Always on"), AI agent proposals, Weekly digest (off). "Save" footer.

**Security.** Switches Multi-factor authentication (badge "Enforced"), Sign out idle sessions ("after 8 hours"), Approve from email (off). Active sessions list: this device plus two others whose "Active ..." time is computed from the frozen clock (2 hours ago, 3 days ago); "Sign out others" removes the other rows. Personal API token, masked, with "Rotate".

**Platform.** Workspace name (default `siteConfig.workspace`), Incident number prefix (INC), Auto-close resolved incidents after (1, 3, 5, 7 days, built from `incidentAutoCloseDays` and `onHoldAutoResolveDays`; default `incidentAutoCloseDays`, 3), CAB meeting day (default from `cabSchedule.weekday`, Thursday) and CAB meeting time (default from `cabSchedule.hour`, 09:00, with the shared label "Thursday 09:00 UTC" quoted beneath), and switches Require an affected service on P1/P2 incidents, Major incident approval, Virtual agent ("Enable the assistant in the self-service portal"), Agent autonomy (badge "Preview", off). "Save" footer.

**Danger zone.** Export directory (real download), Reset demo data (confirmation, then reload), Delete workspace (confirmation naming `siteConfig.workspace` and the user count; disabled for the sample workspace).

## What to check

Every day

- Nothing. This page is configuration, not operations.

Every week

- Appearance mode. If operators report the app flashing or ignoring their OS theme, confirm System is selected here or in the theme customizer; the `D` hotkey can flip it by accident while a table has focus.
- Notifications. SLA warnings and Approvals switched off for an approver means approvals age silently on `/approvals`.
- Platform: the CAB day and time and the auto-close period are read from `lib/constants.ts` (`cabSchedule`, `incidentAutoCloseDays`), the same constants the Changes list, the change approval card and the incident resolve dialog quote, so the defaults here always match those pages. Editing the form does not change the constants.
- Security: Approve from email on means one-click approvals from notification mails; keep it off unless the mail path is trusted.

## Actions

| Action                                                              | Behaviour in the template                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Theme Light / Dark / System                                         | sets the `next-themes` mode immediately, cross-fades, persists in the browser                                   |
| Save changes (Profile), Save (Notifications, Platform)              | toast only                                                                                                      |
| Upload photo / Replace photo                                        | opens a file picker; the file name is kept in session state and shown next to the buttons, toast                |
| Remove (photo)                                                      | clears the selection, toast                                                                                     |
| Default landing page, all switches, selects and inputs except Theme | uncontrolled inputs with defaults; nothing reads them                                                           |
| Sign out others                                                     | removes the other sessions from the list (disabled once only this device remains), toast                        |
| Rotate (API token)                                                  | generates a new deterministic token and updates the masked value; the description counts rotations this session |
| Export                                                              | downloads `<workspace>-directory.json` with the users and groups from `lib/data/users.ts`, toast                |
| Reset data                                                          | confirmation, then reloads the page so every client store returns to the seed                                   |
| Delete workspace                                                    | confirmation, then a toast explaining deletion is disabled for the sample workspace; nothing changes            |
| Anchor nav                                                          | scrolls to the card; `?section=` or `?tab=` on load does the same                                               |

## Reading the data

- Profile defaults come from `currentUser` in `lib/data/users.ts` (Kevin Dargas, Platform Owner, IT, San Francisco, kevin.dargas@agentops.dev).
- Workspace name comes from `siteConfig.workspace` in `config/site.ts`, the same value the sidebar header shows; the field here does not update it.
- Badges on switches: "Always on" and "Enforced" mark settings the copy describes as not user-changeable; the switches themselves are still toggleable in the template.
- The theme mode shown here is the same value as the Mode group in the header theme customizer; accent, radius, density, surface and sidebar style are only in the customizer (see [Assistant and shell](../assistant-and-shell.md)).

## How the data gets here

The form is static JSX in `features/admin/settings-form.tsx` with default values; there is no settings data module. The one persisted value, theme mode, is stored by `next-themes` in `localStorage` under its default key and applied as a class on `<html>` by `components/theme-provider.tsx`. The photo, sessions and token live in component state and reset on reload. The token is minted with `createRng` from `lib/data/seed.ts`, so the sequence is the same every session.

To make the page real, back each card with a settings record, replace the `toast` calls in the footers with mutations, make the switches controlled, and feed `siteConfig.workspace`, `cabSchedule`, `incidentAutoCloseDays` and `onHoldAutoResolveDays` from the saved platform settings.

## Related pages

- [Users & Groups](./users-and-groups.md)
- Theme customizer, notifications popover and user menu: [Assistant and shell](../assistant-and-shell.md)
- [Changes](../service-management/changes.md) (CAB day), [Incidents](../service-management/incidents.md) (auto-close copy)
