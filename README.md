# Time Tracker AI - Calendar Sync with MCP

A Model Context Protocol (MCP) based solution for automatically syncing Google Calendar events with [Tikal Time Tracker](https://github.com/tikalk/TikalTimeTracker).

## Overview

This project demonstrates the use of MCP servers to create a calendar synchronization tool. It consists of two main components:

1. **time-tracker-mcp** - A custom MCP server for the Tikal Time Tracker API
2. **time-tracker-sync** - A CLI tool that uses MCP servers to sync calendar events to time tracker

## Architecture

```
┌─────────────────────────────────┐
│   Time Tracker Sync CLI         │
│   (time-tracker-sync/)          │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │             │
┌─────▼──────┐  ┌──▼──────────────┐
│  Google    │  │  Time Tracker   │
│  Calendar  │  │  MCP Server     │
│  MCP       │  │  (custom built) │
│  (public)  │  │                 │
└────────────┘  └─────────┬───────┘
                          │
                    ┌─────▼──────┐
                    │ Time       │
                    │ Tracker    │
                    │ API        │
                    └────────────┘
```

## Features

- Automatically sync Google Calendar meetings to time tracker
- Classify events as meetings, vacation, or WFO (Working From Office)
- Handle Israeli vacation holidays correctly
- Fill remaining hours with Truvify work (9 hours/day for Sun-Thu)
- Detect and resolve conflicts with existing time entries
- Built using MCP for modularity and reusability

## Quick Start

### 1. Build Time Tracker MCP Server

```bash
cd time-tracker-mcp
npm install
npm run build
```

### 2. Set Up Sync Tool

```bash
cd time-tracker-sync
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
```

### 3. Run Sync

```bash
cd time-tracker-sync
npm run sync
```

## Project Components

### time-tracker-mcp/

A custom MCP server that wraps the Tikal Time Tracker API. Provides tools for:
- Authentication (`time_tracker_login`)
- Adding time entries (`time_tracker_add_time`)
- Querying reports (`time_tracker_get_reports`)
- Getting projects/tasks (`time_tracker_get_projects`)

[See time-tracker-mcp/README.md](./time-tracker-mcp/README.md) for details.

### time-tracker-sync/

A CLI tool that orchestrates the sync between Google Calendar and Time Tracker using MCP servers.

Key features:
- Connects to both Google Calendar MCP (public) and Time Tracker MCP (local)
- Implements business logic for daily time calculations
- Handles conflict resolution with user prompts
- Supports syncing by month or single date

[See time-tracker-sync/README.md](./time-tracker-sync/README.md) for details.

## Configuration

### Time Tracker MCP

No configuration needed - it proxies to the existing time-tracker-api.

### Sync Tool

Create a `.env` file in `time-tracker-sync/`:

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

## Usage Examples

### Sync Current Month

```bash
cd time-tracker-sync
npm run sync
```

### Sync Specific Month

```bash
npm run sync -- --month 2025-11
```

### Sync Single Date

```bash
npm run sync -- --date 2025-11-24
```

### Test MCP Connections

```bash
node dist/index.js test-connection
```

## Daily Logic

For each workday (Sunday-Thursday):

1. **Holiday** → Skip entirely
2. **WFO Event** → Submit 9 hours Truvify
3. **Vacation Event** → Submit 9 hours vacation (project=14, task=8)
4. **Normal Day**:
   - Sum meeting hours → Submit as Tikal Meeting (project=14, task=13)
   - Calculate remaining → Submit as Truvify (project=938, task=5)
   - Total = 9 hours

## Why MCP?

This project demonstrates MCP benefits:

1. **Modularity**: Time Tracker MCP can be reused by other tools
2. **Separation of Concerns**: API logic separate from business logic
3. **Testability**: Each component can be tested independently
4. **Extensibility**: Easy to add new MCP tools or connect to other calendars
5. **AI Integration**: MCP servers work seamlessly with Claude and other AI assistants

## Development

### Build Both Projects

```bash
# Build Time Tracker MCP
cd time-tracker-mcp
npm run build

# Build Sync Tool
cd ../time-tracker-sync
npm run build
```

### Watch Mode

```bash
# In separate terminals:
cd time-tracker-mcp && npm run watch
cd time-tracker-sync && npm run watch
```

## Dependencies

- **Node.js** 18+
- **TypeScript** 5.7+
- **@modelcontextprotocol/sdk** - MCP SDK
- **axios** - HTTP client for Time Tracker API
- **date-fns** - Date manipulation
- **commander** - CLI framework
- **inquirer** - User prompts
- **zod** - Schema validation

## Related Projects

- [time-tracker-api](../time-tracker-api) - The underlying Time Tracker API
- [@cocal/google-calendar-mcp](https://www.npmjs.com/package/@cocal/google-calendar-mcp) - Google Calendar MCP server

## Troubleshooting

See the README files in each subdirectory for specific troubleshooting:
- [time-tracker-mcp/README.md](./time-tracker-mcp/README.md)
- [time-tracker-sync/README.md](./time-tracker-sync/README.md)

## License

MIT
