# Time Tracker Calendar Sync

A CLI tool that syncs Google Calendar events with Tikal Time Tracker using MCP (Model Context Protocol) servers.

## Architecture

This project uses an MCP-based architecture:

```
┌─────────────────────┐
│   Sync CLI Tool     │
│  (This Project)     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼─────┐
│ Google │   │  Time   │
│Calendar│   │ Tracker │
│  MCP   │   │   MCP   │
│(public)│   │ (local) │
└────────┘   └─────────┘
```

## Features

- Automatically syncs calendar events to time tracker
- Classifies events as meetings, vacation, or WFO (Working From Office)
- Handles Israeli holidays (only actual vacation days)
- Fills remaining hours with client work (9 hours/day for Sun-Thu)
- Automatically discovers client projects from Time Tracker and, once 2+ are active, asks whether to split hours by a fixed percentage or switch entirely on a given date
- Idempotent per-day sync: every day in range has its existing entries deleted and replaced with freshly calculated ones, so re-running a sync always converges to the same result with no manual conflict resolution

## Prerequisites

1. Node.js 18+ and npm
2. Google Calendar access
3. Tikal Time Tracker account
4. Time Tracker MCP server (included in this repo)

## Installation

1. Install dependencies:
```bash
cd time-tracker-sync
npm install
```

2. Build the project:
```bash
npm run build
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

## Configuration

### Environment Variables (.env)

```env
# Time Tracker Credentials
TIME_TRACKER_EMAIL=your.email@tikalk.com
TIME_TRACKER_PASSWORD=your_password

# Google Calendar IDs
GOOGLE_CALENDAR_ID=your.email@tikalk.com
GOOGLE_HOLIDAY_CALENDAR_ID=en.judaism#holiday@group.v.calendar.google.com

# MCP Server Paths
TIME_TRACKER_MCP_PATH=../time-tracker-mcp/dist/index.js
GOOGLE_CALENDAR_MCP_COMMAND=npx
GOOGLE_CALENDAR_MCP_ARGS=-y,@cocal/google-calendar-mcp
```

### Setting up Google Calendar MCP

The tool uses the public `@cocal/google-calendar-mcp` package. You'll need to:

1. Set up Google OAuth credentials (follow the MCP server's documentation)
2. Ensure the MCP server can access your calendars

## Usage

### Sync Current Month

```bash
npm run sync
```

Or:

```bash
node dist/index.js sync
```

### Sync Specific Month

```bash
npm run sync -- --month 2025-11
```

### Sync Single Date

```bash
npm run sync -- --date 2025-11-24
```

### Test Connection

```bash
node dist/index.js test-connection
```

## How It Works

### Daily Logic

For each workday (Sunday-Thursday):

1. **Check if holiday** → Skip entirely (no submissions)
2. **Check if has "WFO" event** → Submit 9 hours of client work only
3. **Check if has "vacation"/"PTO" event** → Submit 9 hours vacation
4. **Normal day**:
   - Sum all meeting durations
   - Submit as "Tikal - Meeting" (project=14, task=13)
   - Calculate remaining hours: 9 - meetings
   - Submit remaining as client work (task=5), billed to one or more client projects per `clients.config.json` — see [Client Billing Configuration](#client-billing-configuration)

### Holiday Detection

The tool checks the Jewish holiday calendar for specific vacation days:
- Rosh Hashana (2 days)
- Yom Kippur
- Sukkot (first and last days only)
- Passover (eve + day after)
- Yom Ha'atzmaut

All other holidays marked in the calendar are treated as regular working days.

### Event Classification

- **WFO Events**: Title contains "WFO" or "working from office"
- **Vacation**: Title contains "vacation", "PTO", or "paid time off"
- **Meetings**: All other calendar events

### Client Billing Configuration

Client project IDs are no longer hardcoded — the tool discovers them from Time Tracker on every `sync` run and stores your billing preference in `clients.config.json` (gitignored, project-root of `time-tracker-sync/`):

- **One client project** → billing is automatic, no prompts. `clients.config.json` is created silently the first time.
- **Two or more client projects seen for the first time** (or a new one appears later) → you're asked, once, to choose:
  - **Split**: a fixed percentage of each day's client hours goes to each project (e.g. 60% / 40%), every day.
  - **Switch**: pick which client you worked with before a given date and which one after — hours bill 100% to one side or the other depending on the entry's date.
- **No change since last run** → the saved config is reused silently, no prompts, no file rewrites.
- If a project you'd configured is later removed from Time Tracker, or the config file is corrupted, `sync` stops with a clear error telling you to fix or delete `clients.config.json` rather than silently mis-billing hours.

This reconciliation only runs for `sync` (not `test-connection` or `delete`), since only `sync` needs to know how to bill client hours.

### Idempotent Sync

Every day processed by `sync` (the whole range for `--month`, or the single day for `--date`) goes through the same delete-then-add step:
1. Fetch any existing time entries for that date
2. Delete all of them
3. Add whatever the calculator produced for that date (possibly nothing, e.g. weekends/holidays)

There's no conflict prompt — running `sync` again for the same period always leaves Time Tracker matching exactly what the calculator computes from your calendar, even if a day's classification changed since the last run (e.g. a meeting was added/removed, or a vacation event was extended).

## Project Structure

```
time-tracker-sync/
├── src/
│   ├── index.ts                      # CLI entry point
│   ├── sync-engine.ts                # Main sync orchestration
│   ├── types.ts                      # TypeScript interfaces
│   ├── services/
│   │   ├── calendar-client.ts        # Google Calendar MCP client
│   │   └── time-tracker-client.ts    # Time Tracker MCP client
│   └── utils/
│       ├── day-calculator.ts         # Daily time calculation logic
│       ├── event-classifier.ts       # Event type classification
│       ├── holiday-detector.ts       # Holiday detection
│       ├── sync-plan.ts              # Idempotent delete-then-add day sync plan
│       ├── client-config.ts          # Client billing data model + resolution logic
│       ├── client-wizard.ts          # Interactive split/switch prompts
│       └── client-reconciler.ts      # Reconciles clients.config.json against live Time Tracker projects
├── .env                              # Environment configuration
├── clients.config.json               # Client billing config (auto-generated, gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Testing

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

## Project/Task IDs

- **Tikal Meeting**: project=14, task=13
- **Tikal Vacation**: project=14, task=8
- **Client Development**: task=5, project=whichever client project(s) `clients.config.json` resolves for that date (see [Client Billing Configuration](#client-billing-configuration))

## Troubleshooting

### "Client not connected"

Ensure the MCP servers are properly configured and the paths in .env are correct.

### "Login failed"

Check your TIME_TRACKER_EMAIL and TIME_TRACKER_PASSWORD in .env.

### "No calendar events found"

1. Verify GOOGLE_CALENDAR_ID is correct
2. Ensure Google Calendar MCP has OAuth access
3. Check the date range being queried

### "Invalid clients config" / a client project disappeared

`sync` validates `clients.config.json` and the live Time Tracker project list on every run. If it errors out here, fix or delete `clients.config.json` and run `sync` again — it will either reuse a corrected file or walk you through the split/switch prompts again.

### MCP Connection Issues

Test connections individually:

```bash
# Test Time Tracker MCP
node ../time-tracker-mcp/dist/index.js

# Test Google Calendar MCP (follow their setup guide)
npx -y @cocal/google-calendar-mcp
```

## Related Projects

- [time-tracker-mcp](../time-tracker-mcp) - Local MCP server for Time Tracker API
- [@cocal/google-calendar-mcp](https://www.npmjs.com/package/@cocal/google-calendar-mcp) - Public Google Calendar MCP server

## License

MIT
