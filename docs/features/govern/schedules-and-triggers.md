# Schedules & Triggers

Schedules & Triggers is where you see when and why agents run without a human starting them. Cron schedules run an agent on a cadence with a per-run budget, a concurrency rule and a retry policy. Triggers start an agent (or open a review, or send a notification) when an external event matches a condition: a webhook, a Slack mention, a queue message, a record event, a drift signal, a budget threshold, an eval failure or a git push. The run history behind both is on the same page, and a weekly calendar shows where scheduled runs collide with freeze windows.

The people who use it are the platform operator on duty (is anything failing, is anything about to run into a freeze window), schedule owners (is my nightly job still healthy), and whoever owns an integration (is the webhook secret valid, are deliveries being accepted).

## Where to find it

- Route: `/agentops/schedules`
- Nav: Govern group, "Schedules & Triggers"
- Tabs sync to `?tab=`: `schedules` (default), `triggers`, `calendar`, `runs`. Switching tabs writes the param back with `history.replaceState`, so the URL always reflects the open tab.
- `?agent=<id>` (linked from the agent configuration panel) preselects the Agent facet on the Schedules, Triggers and Run history tables and shows only that agent on the Calendar until you re-enable others in the legend.
- `?schedule=<id>` and `?trigger=<id>` open that record's sheet on load; opening or closing a sheet writes the param. A `?trigger=` link lands on the Triggers tab unless `?tab=` says otherwise.
- Record ids: schedules `sch-001` to `sch-017`, triggers `trg-001` to `trg-013`, runs `run-…`, freeze windows `frz-001` to `frz-004`. Records created in the browser get `sch-local-001`, `trg-local-001`, `run-local-001` style ids.

## What is on the page

### Header and stat cards

The header uses the nav title "Schedules & Triggers" and the Govern eyebrow. Five small stat cards sit under it, computed on the client from the same stores the tables use, so pausing a schedule or starting a run moves the numbers immediately:

| Card                 | Value                                                                                       | Hint                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Active schedules     | Count of schedules with `enabled: true`                                                     | Number paused                                                                                 |
| Runs · 24h           | Runs started in the last 24 hours (schedules and triggers)                                  | How many came from triggers                                                                   |
| Failed · 24h         | Runs with status Failed in the last 24 hours                                                | Percentage of runs, or "No failures". The card gets a red ring when the count is above zero   |
| Next run             | Countdown ("in 2h 15m") to the earliest next occurrence across enabled schedules, or "None" | Name of that schedule                                                                         |
| Triggers fired · 24h | Sum of `fired24h` across all triggers                                                       | "N triggers in error" if any trigger has status Error, otherwise the count of Active triggers |

### Schedules tab

A data table of every schedule. Default sort is next run, soonest first.

| Column       | Content                                                                                                                                          | Visible by default |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Schedule     | Name, with the description underneath. An amber "Target agent paused" chip appears when the schedule is enabled but its agent is manually paused | Yes                |
| Agent        | Agent chip, links to `/agentops/agents/<id>`                                                                                                     | Yes                |
| Cron         | Raw expression in monospace, humanised text underneath ("Weekdays at 09:00 and 15:00"). The header has a hint explaining the five fields         | Yes                |
| Timezone     | IANA zone name                                                                                                                                   | No                 |
| Next run     | Countdown plus absolute time, or "Paused" when disabled                                                                                          | Yes                |
| Last run     | Status badge plus relative time, or "Never"                                                                                                      | Yes                |
| Avg duration | Formatted from `avgDurationMs` ("41m", "4m 12s")                                                                                                 | Yes                |
| Concurrency  | Forbid, Allow or Replace. Hover the badge or the header hint for the rule                                                                        | Yes                |
| Retry        | "2× exponential · 300s" or "No retries"                                                                                                          | No                 |
| Budget / run | USD cap per run. Header hint explains that the run stops at the cap                                                                              | Yes                |
| Owner        | User chip                                                                                                                                        | No                 |
| Enabled      | Switch. Toggling pauses or resumes the schedule in the client store and shows a toast with an Undo action                                        | Yes                |

Facets: Agent, Last run (Succeeded, Failed, Skipped, Running), Enabled (Enabled, Paused). Search matches name, description, cron, humanised cron and agent name. The toolbar "New schedule" button opens the schedule editor in create mode (see below). The tab count in the tab strip is the live number of schedules in the store.

Clicking a row opens the schedule sheet:

- Header: schedule id, last run status badge, a "Paused" badge when disabled, "Target agent paused" when the agent is paused, agent chip, name and description.
- Metric tiles: Cadence (cron, humanised, timezone), Next run (countdown and absolute time, or "Paused"), Budget / run with the average duration under it.
- Run durations: sparkline of the last 14 run durations in seconds with a hairline at the average, or an empty note for a schedule that has not run.
- Recent runs: up to 8 runs for this schedule with status badge, start time, duration ("running" while in flight) and a trace link. Runs started with Run now appear here immediately.
- Parameters: the schedule's `parameters` object as JSON, or "No parameters".
- Policies: Concurrency (with the rule text), Retry, Owner.
- Notifications: Slack channel ("on failure and budget overrun"), email addresses, PagerDuty service, or "Silent, failures only appear in run history" when nothing is configured.
- Footer: Delete on the left (opens a confirmation dialog), then Edit, Pause or Resume, and Run now as the primary action.

The editor sheet is shared by Edit and New schedule. It has Name, Frequency (Every N minutes, Hourly, Daily, Weekdays, Weekly, Monthly) with the matching Every (minutes) / Hour / Minute / Weekday / Day of month fields, Timezone (UTC, Europe/London, Europe/Berlin, America/New_York, America/Los_Angeles, Asia/Kolkata, Asia/Tokyo, Australia/Sydney), Concurrency and Budget per run (USD). In create mode it also asks for Description and Agent (preselected from `?agent=` when present) and warns when the chosen agent is paused. The sheet shows a live humanised preview and the computed next run. Save patches the store and toasts "Schedule saved"; Create adds an enabled schedule owned by the current user and toasts "Schedule created" with its first run time.

### Triggers tab

A data table of event triggers. Default sort is Fired · 24h, highest first.

| Column       | Content                                                                                                                                                    | Visible by default |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Trigger      | Source icon, name, and "Source · detail" underneath (for example "Queue · SQS"). Active triggers whose agent is paused show the "Target agent paused" chip | Yes                |
| Condition    | Filter expression in monospace, truncated with full text on hover. Header hint explains the expression                                                     | Yes                |
| Target       | Agent chip                                                                                                                                                 | Yes                |
| Action       | Run agent, Open review or Notify                                                                                                                           | Yes                |
| Fired · 24h  | Count                                                                                                                                                      | Yes                |
| Last fired   | Relative time                                                                                                                                              | No                 |
| Failure rate | Percentage of failed deliveries. Red at 10% or more, amber at 3% or more, muted below 3%. The thresholds are repeated in the header hint                   | Yes                |
| Status       | Active, Paused or Error badge                                                                                                                              | Yes                |
| Secret       | Valid, Rotating or Missing with a key icon, or "n/a" for internal event sources. Header hint explains HMAC and bearer secrets                              | Yes                |
| Test         | Button that opens the test dialog                                                                                                                          | Yes                |

Facets: Source (Webhook, Slack mention, Email inbox, Queue, Record event, Drift signal, Budget threshold, Eval failure, Git push), Status, Target agent. The toolbar "New trigger" button opens a create sheet with Name, Source, Source detail, Condition, Target agent (preselected from `?agent=`) and Action. Created triggers start Active with zero deliveries; external sources (Webhook, Slack mention, Email inbox, Git push) start with a Missing HMAC secret so the sheet's amber banner reminds you to rotate one in.

Clicking a row opens the trigger sheet:

- Header: trigger id, status badge, source badge, "Target agent paused" when relevant, agent chip, name, and the condition in a code block.
- A red banner "Delivery failures above threshold" when status is Error, stating the failure rate and that failed deliveries are retried three times.
- An amber banner "Signing secret missing" when the secret status is Missing. Deliveries are being accepted without signature verification.
- Metric tiles: Fired · 24h, Failure rate (same colour thresholds as the table), Last fired.
- Recent deliveries: table of Received, Status (HTTP code, green under 400, red otherwise), Latency, Run id when the delivery started a run. Test deliveries appear at the top.
- Configuration: Source, Action, Target, Secret (status and kind: HMAC-SHA256 or Bearer token, or "Internal event, no secret"), Owner.
- Sample payload as JSON, or "No sample payload" for triggers created in the browser.
- Footer: Delete on the left (confirmation dialog), Rotate secret (only shown when a secret exists and is not Valid), Pause or Resume, and Test trigger as the primary action.

The test dialog shows the sample payload and explains what "Send test" does: it records a simulated 202 delivery under Recent deliveries (incrementing Fired · 24h and Last fired) and, for "Run agent" triggers whose agent is not paused, appends a Running dry run to Run history. The toast reads "Test delivery recorded (simulated)" and names the run id. Nothing is sent over the network.

### Calendar tab

A seven-day week grid, Monday to Sunday, in UTC, rendered as a section whose title is the date range ("Nov 2 to Nov 8, 2026") and whose description counts scheduled runs in the visible week and any freeze windows that overlap it. Controls on the right: previous week, next week, "This week" (disabled while on the current week). Today's date is highlighted.

- Each enabled schedule's occurrences are computed from its cron and placed in the day column, one chip per schedule per day. The chip shows the time(s) for one or two runs, or "×N" for more. Chips are coloured per agent (fixed chart colour per agent, never cycled; chart colours 1 to 8 cover all eight agents).
- Freeze windows overlapping a day hatch the day column and add a chip with the window name and the time span ("01:00 to 03:00", "from 22:00", "until 04:00", "all day"). Change freezes (the ones that come from the change calendar, `changeFreezeWindows` in `lib/data/itsm.ts`) carry a lock icon; provider or platform maintenance windows carry a wrench icon. Hover shows the kind, scope and reason.
- Clicking a run chip opens a popover with the description, agent, cadence (cron, humanised, timezone), the list of run times (struck through and amber when inside a freeze window), a "N skipped inside a freeze window" line when more than six runs, average duration, owner and a "Run now" button that behaves exactly like the one in the schedule sheet.
- The legend under the grid lists the agents in view. Clicking an agent hides or shows its chips. With `?agent=` in the URL only that agent starts visible. Three legend entries explain the two freeze kinds and the today marker.

Paused and deleted schedules do not appear on the calendar; schedules created in the session do.

### Run history tab

A data table of the most recent 100 runs across schedules and triggers. Default sort is Started, newest first, 25 per page.

| Column             | Content                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Run                | Run id in monospace                                                                                                      |
| Schedule / trigger | Calendar icon for schedule runs, bolt icon for trigger runs, name and "Schedule · sch-…" or "Trigger · trg-…" underneath |
| Agent              | Agent colour dot plus agent chip                                                                                         |
| Started            | Relative time with the absolute datetime underneath                                                                      |
| Duration           | Formatted duration. Running runs show in the brand colour and have no duration yet (header hint)                         |
| Status             | Succeeded, Failed, Running (pulsing) or Skipped                                                                          |
| Items              | Items processed (header hint)                                                                                            |
| Cost               | USD                                                                                                                      |
| Trace              | Link to `/agentops/traces/<traceId>`, or a dash                                                                          |
| Error              | Error message, red for Failed runs, muted for Skipped                                                                    |

Facets: Status, Agent, Source (Schedule, Trigger). Runs started with Run now or a trigger test appear at the top as Running. The same component accepts an `agentId` prop that removes the agent facet and a compact layout for embedding on agent pages.

## What to check

### Every day

- Failed · 24h card. Anything above zero means a run failed in the last day. Open the Run history tab, filter Status = Failed, read the Error column, and open the trace. Repeated failures of the same schedule usually mean a dependency changed (deprecated semantic entity, schema validation, provider rate limit).
- Triggers fired · 24h hint. If it reads "N triggers in error", open the Triggers tab, filter Status = Error, and read the Recent deliveries table in the sheet. Status codes of 500/502 point at the receiver; 429 means the target is rate limited; 401 almost always means the signing secret is missing or mismatched.
- Failure rate column on the Triggers tab. Red (10% or more) is a trigger that should be paused or fixed today. Amber (3% to 10%) deserves a look at the delivery log.
- Secret column. Any Missing is a webhook accepting unsigned payloads. Use Rotate secret in the sheet and share the new secret with the sender. Rotating is fine as a transient state but should not stay that way for days.
- Next run card. If the countdown reads "now" or a schedule is stuck Running for longer than its average duration, check the Run history for an in-flight run and the schedule's Concurrency rule.
- "Target agent paused" chips. A schedule or trigger that stays enabled while its agent is paused will not get a run accepted; either resume the agent or pause the schedule so the calendar stops promising runs. The sample data has one: "Month-start spend digest" targets the paused Finance Copilot.
- Calendar tab, this week. Look for run chips on hatched (freeze) days. Runs inside a freeze window are skipped, not queued. If a skipped run matters (month-start digest, eval regression), reschedule it or run it manually after the window.

### Every week

- Schedules with Last run = Skipped or Failed for several consecutive runs. Open the sheet and read the Recent runs list; a solid streak of Skipped outside any freeze window means the Forbid concurrency rule is firing because the previous run overruns. Either widen the cadence or fix the duration.
- Run durations sparkline in the schedule sheet. A trend climbing away from the average hairline means the job is doing more work or the provider is slower; compare with Budget / run, since cost scales with duration.
- Budget / run against the Cost column in Run history. Runs consistently near the budget are candidates for a lower-cost model or a smaller lookback window.
- Paused triggers (Status = Paused). Confirm they are intentionally paused. The two paused triggers in the sample data are "HR policy updated" and "Finance Slack mention".
- Paused schedules (Enabled facet = Paused). The sample data has two: "Shadow traffic replay" and "Vendor spend anomaly check". Decide whether to resume or delete.
- Notifications section of each critical schedule. "Silent, failures only appear in run history" on a production job means nobody is paged when it fails. Add Slack, email or PagerDuty.

### Before a release or model change

- Calendar tab, next two weeks. Check for freeze windows that will affect the release ("No production deploys" scope) and for schedules that will run on a changed agent right after the deploy. Consider pausing noisy schedules during the rollout.
- Triggers targeting the agent being changed. Filter Target agent on the Triggers tab. Triggers with action Run agent will immediately exercise the new version; make sure the eval gate trigger ("Eval gate failure") is Active, not Error, so a regression actually opens a review.
- Schedules on the changed agent. Use the Agent facet. Run one manually with Run now after the deploy and check the trace before the next scheduled occurrence.
- Concurrency = Replace on long-running jobs. A deploy that slows the agent down can cause the next occurrence to cancel the running one indefinitely.

## Actions

| Action                                | Where                                                     | What happens in this template                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resume / pause schedule               | Enabled switch in the table, Pause/Resume in the sheet    | Patches the store; toast "Schedule paused" or "Schedule resumed" with the next run time and an Undo action                                                                |
| Edit schedule                         | Sheet footer                                              | Opens the editor; Save patches the store and toasts "Schedule saved"                                                                                                      |
| New schedule                          | Table toolbar                                             | Opens the editor in create mode; Create adds the schedule to the store and toasts "Schedule created"                                                                      |
| Run now                               | Schedule sheet footer, calendar popover                   | Adds a Running run to Run history, sets it as the schedule's last run, toast "Run started" naming the run id. Refused with an error toast when the target agent is paused |
| Delete schedule                       | Sheet footer                                              | Confirmation dialog; Delete removes it from the store and toasts "Schedule deleted" with Undo                                                                             |
| Pause / resume trigger                | Trigger sheet footer                                      | Patches status in the store; toast with Undo                                                                                                                              |
| Rotate secret                         | Trigger sheet footer (when secret is Rotating or Missing) | Sets secret status to Valid in the store, toast "Secret rotated"                                                                                                          |
| Test trigger                          | Test button in table, sheet footer                        | Opens the dialog; Send test records a simulated 202 delivery (and a dry run for "Run agent" triggers) and toasts "Test delivery recorded (simulated)"                     |
| New trigger                           | Table toolbar                                             | Opens the create sheet; Create adds an Active trigger to the store and toasts "Trigger created"                                                                           |
| Delete trigger                        | Sheet footer                                              | Confirmation dialog; Delete removes it from the store and toasts "Trigger deleted" with Undo                                                                              |
| Week navigation, agent legend toggles | Calendar                                                  | Local UI state only                                                                                                                                                       |

All mutations live in module-scope client stores (`features/agentops/schedules/store.ts`, built on `createListStore`) that the stat cards, tab counts, tables and calendar share, so every number on the page reflects the action. They reset on page reload. There are no API calls.

## Reading the data

### Run status

| Status    | Meaning                                                                                                                                            | Tone     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Succeeded | Run completed                                                                                                                                      | Success  |
| Failed    | Run ended with an error. The Error column holds the message                                                                                        | Danger   |
| Running   | In flight. Badge pulses, duration shown in brand colour                                                                                            | Progress |
| Skipped   | Not executed. Either inside a freeze window (the Error column names the window) or the Forbid concurrency rule found the previous run still active | Muted    |

### Trigger status

| Status | Meaning                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------- |
| Active | Listening and firing                                                                              |
| Paused | Not firing; deliveries still recorded in the sample data from before the pause                    |
| Error  | Failure rate above threshold. The trigger keeps firing; failed deliveries are retried three times |

### Secret status

| Status   | Meaning                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Valid    | Signing secret (HMAC-SHA256) or bearer token in place                                                       |
| Rotating | New secret issued, old still accepted. Finish the rotation on the sender side                               |
| Missing  | Deliveries accepted without verification. Fix today                                                         |
| n/a      | Internal event source (queue, record event, drift signal, budget threshold, eval failure); no shared secret |

### Thresholds encoded in the code

- Trigger failure rate: red at `>= 10`, amber at `>= 3`, muted below 3 (`triggers-table.tsx`).
- Delivery status code: green when `< 400`, red otherwise.
- Failed · 24h stat card: red ring when the count is greater than zero.
- Calendar: a run is "skipped" when its time falls within `[freeze.start, freeze.end)`.

### Concurrency rules

| Rule    | Behaviour                                                   |
| ------- | ----------------------------------------------------------- |
| Forbid  | Skip the new occurrence if the previous run is still active |
| Allow   | Runs may overlap                                            |
| Replace | Cancel the active run and start fresh                       |

### Cron humaniser

`describeCron` in `lib/data/schedules.ts` handles the patterns used in the product: every minute, every N minutes, every hour (optionally at :MM), every N hours, every day at HH:MM, weekdays, weekends, named weekdays, and day-of-month. Anything it does not recognise falls back to the raw expression. Timezone handling uses a fixed offset table for the eight supported zones (no DST), which is fine for the demo clock in early November but is not a general scheduler.

## How the data gets here

Everything on this page comes from `lib/data/schedules.ts` (seed `7951`, anchored to `NOW` from `lib/data/seed.ts`).

- Types: `Schedule`, `RetryPolicy`, `Notifications`, `ConcurrencyPolicy`, `Trigger`, `TriggerDelivery`, `TriggerSource`, `TriggerAction`, `TriggerStatus`, `SecretStatus`, `ScheduledRun`, `RunStatus`, `RunSource`, `FreezeWindow`.
- Exports: `schedules` (17), `triggers` (13), `scheduledRuns` (newest 100), `freezeWindows` (4), `timezones`, `runStatuses`, `triggerSources`, `getSchedule`, `getTrigger`, `freezeAt`, and the cron helpers `parseCron`, `describeCron`, `nextRun`, `occurrences`.
- Run history is derived: for each schedule the module computes past occurrences in the last 7 days, keeps a handful, and assigns statuses with weights Succeeded 84 / Failed 9 / Skipped 7. Occurrences inside a freeze window are forced to Skipped. Each trigger gets 7 to 12 deliveries (2 to 4 when paused); successful "Run agent" deliveries create runs. One synthetic Running run is appended for `trg-009`. Trace ids are picked from `agentTraces` in `lib/data/agentops.ts` so the Trace column links resolve.
- `freezeWindows` holds two maintenance windows of its own and derives the change freezes from `changeFreezeWindows` in `lib/data/itsm.ts`, so the schedule calendar and the change calendar agree on when deploys are frozen. The calendar tells the two kinds apart by id.
- The page (`app/(app)/agentops/schedules/page.tsx`) is a static shell: it renders the header and, inside `<Suspense fallback={<TableSkeleton />}>`, `SchedulesRoute` (`features/agentops/schedules/schedules-route.tsx`), a client component that reads `?tab=`, `?agent=`, `?schedule=` and `?trigger=` with `useSearchParams` and passes them to `SchedulesView` (`schedules-view.tsx`), which renders the stat cards and the four panels from those props and writes tab and sheet changes back with `setQueryParam`; the page never touches `searchParams`, so it exports statically. `store.ts` seeds the three `createListStore`s from the data module; `actions.ts` holds the shared pause/resume and Run now handlers used by both the table and the calendar. Formatters (`formatUntil`, `formatClock`, `formatDurationMs`, `formatCost`) come from `lib/format.ts`.

To wire a backend, replace the module exports with API clients that return the same shapes: a schedules list with last-run and 14-run duration history, a triggers list with recent deliveries, a paged runs endpoint, and a freeze-window list. The cron helpers can stay client-side for the calendar and next-run previews, but `nextRun` should be replaced by the scheduler's own next-fire time, since the fixed-offset timezone table ignores DST. The Resume, Edit, Create, Delete, Pause, Rotate secret, Run now and Test actions need real mutation endpoints; today they only patch the client stores and toast.

## Related pages

- Run history Trace column opens `/agentops/traces/<id>` (Traces).
- Agent chips open `/agentops/agents/<id>` (Agents); the agent configuration panel links back here with `?agent=<id>`, which preselects the agent facet.
- Triggers with source "Budget threshold" relate to `/agentops/costs` (Costs & Budgets).
- Triggers with source "Eval failure" relate to `/agentops/evals` (Evals & Datasets).
- Triggers with source "Drift signal" relate to `/agentops/drift` (Drift).
- Freeze windows with scope "No production deploys" are the ones that also matter on `/agentops/deployments` (Deployments).
