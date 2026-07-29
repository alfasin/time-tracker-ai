# Multi-Client Billing Design

## Problem

`time-tracker-sync` bills all non-meeting hours to a single hardcoded project, `PROJECT_CLIENT_ID` (currently `'938'`), set via `src/types.ts`. The user now works with two (and potentially more, over time) client projects in Time Tracker, some of which are stale/past clients still present in the account's project list. The tool needs to figure out, automatically and without re-asking every run, how to divide client-billable hours across whichever client projects are currently relevant — either as a fixed percentage split, or as a hard cutover on a given date from one client to another.

## Goals

- Discover the real, current list of client projects from Time Tracker itself (not hardcoded), and detect when it changes.
- When 2+ client projects are known, let the user choose a fixed percentage split across them, or a date-based switch from one to another.
- Never re-prompt for information already confirmed; only ask when something genuinely new appears.
- Preserve today's behavior exactly when there's only one client project (no prompts, no config file needed).
- Idempotent: running `sync` repeatedly with no change in Time Tracker's project list produces no config writes and no prompts.

## Non-goals

- Per-project task IDs — `TASK_DEVELOPMENT = '5'` remains a single global constant for all client projects (confirmed as valid platform-wide).
- WFO-specific client attribution — WFO days are just a calendar-blocking convention (marking days worked from a client's office so meetings aren't scheduled) and continue to bill through the same client resolution as regular days; no special-casing needed.
- Support for 3+ concurrent time-based switches — `switch` mode covers exactly two projects (a "before" and an "after"); further transitions would require rerunning the wizard as a new "split/switch" decision (out of scope for now).

## Data model — `clients.config.json`

New file at `time-tracker-sync/clients.config.json`, gitignored (like `.env`). Absence of this file means "only one client project has ever been seen" and the tool behaves exactly as it does today.

```json
{
  "mode": "split",
  "knownProjectIds": ["938", "952", "101"],
  "split": { "938": 50, "952": 50, "101": 0 },
  "switch": null
}
```

Switch mode:

```json
{
  "mode": "switch",
  "knownProjectIds": ["938", "952"],
  "split": null,
  "switch": {
    "beforeProjectId": "938",
    "afterProjectId": "952",
    "lastDateWithBefore": "2026-06-30"
  }
}
```

- `knownProjectIds` is the full set of non-Tikal project IDs the wizard has ever presented to the user (including ones assigned 0%). It is the basis for idempotency: as long as Time Tracker's live project list doesn't introduce an ID outside this set, nothing changes.
- `PROJECT_TIKAL` is always excluded from consideration — it's meetings/vacation, never a client.
- `split` percentages must sum to 100 across all listed projects (0 is valid, and is how a stale/past client is "ignored" without a separate ignore list).
- `switch` requires `beforeProjectId !== afterProjectId`; both must be in `knownProjectIds`. Projects not chosen for either side are implicitly 0% for all dates.

## Reconciliation flow

Runs in `SyncEngine.initialize()`, right after Time Tracker login (so `getProjects()` is authenticated):

1. `projects = await ttClient.getProjects()` → filter out `PROJECT_TIKAL`.
2. Load `clients.config.json` if present; `null` if not.
3. `newIds = projects.map(p => p.id).filter(id => !(config?.knownProjectIds ?? []).includes(id))`.
4. **No config, and exactly one non-Tikal project exists** → write `{ mode: 'split', knownProjectIds: [id], split: { [id]: 100 }, switch: null }` silently. No prompt — identical to today's single-client behavior.
5. **`newIds.length > 0`** (first time seeing 2+, or a later addition) → run the wizard (see below), presenting the full set of known + new non-Tikal projects by name. Save the result, replacing `knownProjectIds`/`split`/`switch`.
6. **`newIds.length === 0`** → reuse the saved config as-is. No prompts, no file write.

This makes the check idempotent by construction: nothing changes unless Time Tracker's project list grows beyond what's already recorded.

## Wizard (`src/utils/client-wizard.ts`)

Presented only when reconciliation step 5 triggers. Uses `inquirer`, consistent with the existing `ConflictHandler` pattern.

1. List all relevant projects (existing `knownProjectIds` ∪ `newIds`) by name and ID (from the `getProjects()` response).
2. Ask: **split** or **switch**?
   - **Split**: prompt a percentage for each listed project. Projects already in the saved config default to their last saved percentage; new ones default to `0`. Validate the total is exactly 100; re-prompt on failure.
   - **Switch**: prompt to pick the "before" project and the "after" project from the list (must differ), then ask for the last date worked with the "before" client (`YYYY-MM-DD`, validated as a real date). Projects not selected for either side are recorded implicitly at 0%.
3. Persist to `clients.config.json`.

## Applying the config — `resolveClientsForDate`

New function in `src/utils/client-config.ts`:

```ts
function resolveClientsForDate(config: ClientsConfig, date: string): Array<{ projectId: string; percent: number }>
```

- `split` mode: returns every project with `percent > 0`, same list for every date.
- `switch` mode: returns `[{ projectId: beforeProjectId, percent: 100 }]` if `date <= lastDateWithBefore`, else `[{ projectId: afterProjectId, percent: 100 }]`.

`DayCalculator.calculateDay`/`calculateRange` take the loaded `ClientsConfig` as a parameter (replacing the direct `PROJECT_CLIENT_ID` import) and call `resolveClientsForDate` wherever client hours are computed (normal workday remainder and WFO full-day). For each returned allocation, hours = `totalClientHours * percent / 100`, rounded to 2 decimals, as its own `TimeEntry` (`type: 'client'`). Note text stays `"Development work"` when there's a single 100% allocation (matches today's wording); when there are 2+, it becomes `"Development work (<client name> - <percent>%)"` so entries are distinguishable in Time Tracker.

`PROJECT_CLIENT_ID` and its "not set" throw are removed from `src/types.ts` — client project IDs now come entirely from `getProjects()` + `clients.config.json`.

## Error handling

- `getProjects()` failure → propagates as a normal connection/auth error, same as other MCP calls today; sync aborts rather than falling back to guessed config.
- Wizard validation (percentages not summing to 100, same project picked for both switch sides, invalid date) → re-prompt inline via inquirer validators, not a crash.
- Corrupt/unparsable `clients.config.json` → fail with a clear error naming the file and asking the user to fix or delete it manually. The tool never silently overwrites a file that might represent a deliberate prior choice.

## Testing

This project has no existing automated test suite; verification will be manual — running `sync` against a live Time Tracker account with (a) one client project, (b) two, and (c) a newly added third, checking the resulting `clients.config.json` and submitted time entries match expectations at each step.
