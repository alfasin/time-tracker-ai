# Setup Guide

Quick guide to set up and run the Time Tracker Calendar Sync tool.

## Prerequisites

- Node.js 18+ installed
- npm installed
- Google Calendar access (nir.alfasi@tikalk.com)
- Tikal Time Tracker account credentials

## Step-by-Step Setup

### 1. Install Time Tracker MCP Server

```bash
cd time-tracker-mcp
npm install
npm run build
```

Verify it built successfully:
```bash
ls -l dist/
# You should see index.js and other compiled files
```

### 2. Set Up Sync Tool

```bash
cd ../time-tracker-sync
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Time Tracker Credentials
TIME_TRACKER_EMAIL=nir.alfasi@tikalk.com
TIME_TRACKER_PASSWORD=eK1726132362s

# Google Calendar IDs
GOOGLE_CALENDAR_ID=nir.alfasi@tikalk.com
GOOGLE_HOLIDAY_CALENDAR_ID=en.judaism#holiday@group.v.calendar.google.com

# MCP Server Paths (should be correct by default)
TIME_TRACKER_MCP_PATH=../time-tracker-mcp/dist/index.js
GOOGLE_CALENDAR_MCP_COMMAND=npx
GOOGLE_CALENDAR_MCP_ARGS=-y,@cocal/google-calendar-mcp
```

### 4. Build Sync Tool

```bash
npm run build
```

### 5. Set Up Google Calendar MCP (First Run)

The first time you run the tool, you'll need to authenticate with Google Calendar. The public MCP server (@cocal/google-calendar-mcp) requires OAuth 2.0 setup.

**📖 See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for detailed step-by-step instructions.**

Quick setup:

```bash
# Run the authentication flow
npx -y @cocal/google-calendar-mcp auth
```

This will:
1. Guide you through Google OAuth setup
2. Create a Google Cloud Project (if needed)
3. Enable Google Calendar API
4. Save authentication tokens locally

### 6. Test Connection

```bash
node dist/index.js test-connection
```

Expected output:
```
Connecting to MCP servers...
✓ Connected to Time Tracker MCP
✓ Connected to Google Calendar MCP
Authenticating with Time Tracker...
✓ Authenticated with Time Tracker

✓ All connections successful
```

### 7. Run Your First Sync

```bash
# Dry run to see what will happen (coming soon)
# npm run sync -- --dry-run

# Sync current month
npm run sync

# Or sync specific date
npm run sync -- --date 2025-11-24
```

## Common Issues

### "Client not connected"

**Problem**: MCP servers aren't connecting

**Solution**:
1. Check `TIME_TRACKER_MCP_PATH` in `.env` points to the correct location
2. Ensure Time Tracker MCP was built: `cd time-tracker-mcp && npm run build`
3. Check that `node` is in your PATH: `which node`

### "Login failed"

**Problem**: Time Tracker authentication failed

**Solution**:
1. Verify `TIME_TRACKER_EMAIL` and `TIME_TRACKER_PASSWORD` in `.env`
2. Try logging in manually at https://tt-api.tikalk.dev (or the Time Tracker web interface)
3. Check if your password has expired

### "No calendar events found"

**Problem**: Calendar MCP isn't returning events

**Solution**:
1. Complete Google OAuth setup (see Step 5)
2. Verify `GOOGLE_CALENDAR_ID` matches your calendar email
3. Check that you have events in the selected date range
4. Try running the Google Calendar MCP standalone to test: `npx -y @cocal/google-calendar-mcp`

### Google Calendar OAuth Issues

**Problem**: OAuth authentication not working

**Solution**:
1. Follow Google Calendar MCP setup guide: https://github.com/nspady/google-calendar-mcp or https://www.npmjs.com/package/@cocal/google-calendar-mcp
2. Ensure OAuth consent screen is configured
3. Add yourself as a test user if app is in testing mode
4. Check OAuth scopes include Calendar read access

## Usage Examples

### Sync Entire Month

```bash
# Current month
npm run sync

# Specific month
npm run sync -- --month 2025-11
npm run sync -- --month 2025-12
```

### Sync Single Day

```bash
npm run sync -- --date 2025-11-24
npm run sync -- --date 2025-12-01
```

### Handle Conflicts

When the tool finds existing time entries:

```
Conflict detected for 2025-11-24:

Existing entries:
  - Truvify/Development: 9h - "Development work"

New entries to add:
  - meeting: 2h (Project: 14, Task: 13)
  - truvify: 7h (Project: 938, Task: 5)

? What would you like to do?
  Skip - Keep existing entries, do not add new ones
❯ Replace - Delete existing entries and add new ones
  Add - Keep existing entries and add new ones anyway
```

Use arrow keys to select, then press Enter.

## What Gets Synced?

### Workdays (Sun-Thu)

- **Holidays** → Nothing submitted
- **WFO Tuesdays** → 9h Truvify
- **Vacation/PTO days** → 9h Vacation (Tikal 14/8)
- **Normal days** → Meetings (Tikal 14/13) + remaining Truvify (938/5)

### Weekends (Fri-Sat)

- Nothing is submitted

### Specific Holidays (from Jewish calendar)

Only these are treated as vacation days:
- Rosh Hashana (2 days)
- Yom Kippur
- Sukkot (first and last days)
- Passover (eve + day after)
- Yom Ha'atzmaut

## Next Steps

After successful setup:

1. Review the generated time entries in Time Tracker web interface
2. Set up a cron job or scheduled task to run sync automatically
3. Customize event classification logic if needed (edit `src/utils/event-classifier.ts`)
4. Add more holiday types or custom rules as needed

## Getting Help

- Check the main [README.md](./README.md)
- Time Tracker MCP: [time-tracker-mcp/README.md](./time-tracker-mcp/README.md)
- Sync Tool: [time-tracker-sync/README.md](./time-tracker-sync/README.md)
- Report issues: Create an issue in the project repository
