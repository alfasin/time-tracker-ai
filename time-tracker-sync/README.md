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
- Fills remaining hours with Truvify work (9 hours/day for Sun-Thu)
- Detects conflicts with existing time entries
- Prompts user before overwriting entries

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
2. **Check if has "WFO" event** → Submit 9 hours Truvify only
3. **Check if has "vacation"/"PTO" event** → Submit 9 hours vacation
4. **Normal day**:
   - Sum all meeting durations
   - Submit as "Tikal - Meeting" (project=14, task=13)
   - Calculate remaining hours: 9 - meetings
   - Submit remaining as Truvify (project=938, task=5)

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

### Conflict Resolution

When existing time entries are found:
1. Tool displays existing vs. new entries
2. User chooses:
   - **Skip**: Keep existing, don't add new
   - **Replace**: Delete existing, add new
   - **Add**: Keep existing, add new anyway

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
│       └── conflict-handler.ts       # Conflict resolution
├── .env                              # Environment configuration
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

### Development Mode

```bash
npm run dev
```

## Project/Task IDs

- **Tikal Meeting**: project=14, task=13
- **Tikal Vacation**: project=14, task=8
- **Truvify Development**: project=938, task=5

## Troubleshooting

### "Client not connected"

Ensure the MCP servers are properly configured and the paths in .env are correct.

### "Login failed"

Check your TIME_TRACKER_EMAIL and TIME_TRACKER_PASSWORD in .env.

### "No calendar events found"

1. Verify GOOGLE_CALENDAR_ID is correct
2. Ensure Google Calendar MCP has OAuth access
3. Check the date range being queried

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
