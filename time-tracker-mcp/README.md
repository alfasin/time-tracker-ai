# Time Tracker MCP Server

A Model Context Protocol (MCP) server for the Tikal Time Tracker API.

## Features

This MCP server provides tools to interact with the Time Tracker API:

- `time_tracker_login` - Authenticate and get JWT token
- `time_tracker_add_time` - Add time entries
- `time_tracker_get_reports` - Query existing time entries
- `time_tracker_get_projects` - List available projects and tasks

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "time-tracker": {
      "command": "node",
      "args": ["/path/to/time-tracker-mcp/dist/index.js"],
      "env": {
        "TIME_TRACKER_API_URL": "https://tt-api.tikalk.dev"
      }
    }
  }
}
```

### Standalone

```bash
npm run start
```

## Available Tools

### time_tracker_login

Authenticate with the Time Tracker API.

**Parameters:**
- `email` (string, required) - User email address
- `password` (string, required) - User password

**Returns:** JWT token

### time_tracker_add_time

Add a time entry to the tracker.

**Parameters:**
- `date` (string, required) - Date in yyyy-mm-dd format
- `project` (string, required) - Project ID
- `task` (string, required) - Task ID
- `duration` (string, optional) - Duration in hours (use this OR start+finish)
- `start` (string, optional) - Start time in hh:mm format
- `finish` (string, optional) - Finish time in hh:mm format
- `note` (string, optional) - Optional note

**Common project/task combinations:**
- Tikal Meeting: `project: "14", task: "13"`
- Vacation: `project: "14", task: "8"`
- Truvify: `project: "938", task: "5"`

### time_tracker_get_reports

Query existing time entries.

**Parameters (provide one of):**
- `date` (string) - Single date in yyyy-mm-dd format
- `yearMonth` (string) - Year-month in yyyy-mm format
- `startDate` + `endDate` (strings) - Date range in yyyy-mm-dd format

### time_tracker_get_projects

Get all available projects and tasks for the authenticated user.

**Parameters:** None

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Run in development
npm run dev
```

## Environment Variables

- `TIME_TRACKER_API_URL` - Base URL for the Time Tracker API (default: https://tt-api.tikalk.dev)

## License

MIT
