#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { SyncEngine } from './sync-engine.js';
import type { SyncConfig } from './types.js';

// Load environment variables
dotenv.config();

function getConfig(): SyncConfig {
  const requiredEnvVars = [
    'TIME_TRACKER_EMAIL',
    'TIME_TRACKER_PASSWORD',
    'GOOGLE_CALENDAR_ID',
    'GOOGLE_HOLIDAY_CALENDAR_ID',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Error: Missing required environment variable: ${envVar}`);
      console.error('Please create a .env file based on .env.example');
      process.exit(1);
    }
  }

  // Parse Google Calendar MCP args (comma-separated string to array)
  const mcpArgs = process.env.GOOGLE_CALENDAR_MCP_ARGS?.split(',') || ['-y', '@cocal/google-calendar-mcp'];

  return {
    timeTrackerEmail: process.env.TIME_TRACKER_EMAIL!,
    timeTrackerPassword: process.env.TIME_TRACKER_PASSWORD!,
    googleCalendarId: process.env.GOOGLE_CALENDAR_ID!,
    googleHolidayCalendarId: process.env.GOOGLE_HOLIDAY_CALENDAR_ID!,
    timeTrackerMcpPath: resolve(process.env.TIME_TRACKER_MCP_PATH || '../time-tracker-mcp/dist/index.js'),
    googleCalendarMcpCommand: process.env.GOOGLE_CALENDAR_MCP_COMMAND || 'npx',
    googleCalendarMcpArgs: mcpArgs,
  };
}

const program = new Command();

program
  .name('tt-sync')
  .description('Sync Google Calendar events with Time Tracker')
  .version('1.0.0');

program
  .command('sync')
  .description('Sync calendar events to time tracker')
  .option('-m, --month <YYYY-MM>', 'Sync specific month (default: current month)')
  .option('-d, --date <YYYY-MM-DD>', 'Sync single date')
  .option('--dry-run', 'Preview changes without submitting (not yet implemented)')
  .action(async (options) => {
    try {
      const config = getConfig();
      const engine = new SyncEngine(config);

      await engine.initialize();

      if (options.date) {
        await engine.syncDate(options.date);
      } else {
        await engine.syncMonth(options.month);
      }

      await engine.close();
      console.log('\n✓ Sync completed');
      process.exit(0);
    } catch (error: any) {
      console.error('\n✗ Sync failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('test-connection')
  .description('Test connection to MCP servers')
  .action(async () => {
    try {
      const config = getConfig();
      const engine = new SyncEngine(config);

      await engine.initialize();
      console.log('\n✓ All connections successful');

      await engine.close();
      process.exit(0);
    } catch (error: any) {
      console.error('\n✗ Connection test failed:', error.message);
      process.exit(1);
    }
  });

// Default command
if (process.argv.length === 2) {
  program.parse(['node', 'tt-sync', 'sync']);
} else {
  program.parse(process.argv);
}
