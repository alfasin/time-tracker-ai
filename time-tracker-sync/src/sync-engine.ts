import { startOfMonth, endOfMonth, format } from 'date-fns';
import { TimeTrackerClient } from './services/time-tracker-client.js';
import { CalendarClient } from './services/calendar-client.js';
import { DayCalculator } from './utils/day-calculator.js';
import { ConflictHandler } from './utils/conflict-handler.js';
import type { SyncConfig, ExistingReport } from './types.js';

export class SyncEngine {
  private ttClient: TimeTrackerClient;
  private calClient: CalendarClient;
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
    this.ttClient = new TimeTrackerClient();
    this.calClient = new CalendarClient();
  }

  async initialize(): Promise<void> {
    console.log('Connecting to MCP servers...');

    // Connect to Time Tracker MCP
    await this.ttClient.connect(this.config.timeTrackerMcpPath);
    console.log('✓ Connected to Time Tracker MCP');

    // Connect to Google Calendar MCP
    await this.calClient.connect(
      this.config.googleCalendarMcpCommand,
      this.config.googleCalendarMcpArgs
    );
    console.log('✓ Connected to Google Calendar MCP');

    // Login to Time Tracker
    console.log('Authenticating with Time Tracker...');
    await this.ttClient.login(
      this.config.timeTrackerEmail,
      this.config.timeTrackerPassword
    );
    console.log('✓ Authenticated with Time Tracker');
  }

  async syncMonth(yearMonth?: string): Promise<void> {
    const today = new Date();
    const targetDate = yearMonth
      ? new Date(`${yearMonth}-01`)
      : today;

    const startDate = format(startOfMonth(targetDate), 'yyyy-MM-dd');
    // Cap end date to today if syncing current month (don't process future dates)
    const monthEnd = endOfMonth(targetDate);
    const endDate = format(monthEnd > today ? today : monthEnd, 'yyyy-MM-dd');

    console.log(`\nSyncing period: ${startDate} to ${endDate}`);

    // Fetch calendar events
    console.log('Fetching calendar events...');
    const workEvents = await this.calClient.listEvents(
      this.config.googleCalendarId,
      startDate + 'T00:00:00Z',
      endDate + 'T23:59:59Z'
    );
    console.log(`✓ Found ${workEvents.length} work events`);

    const holidayEvents = await this.calClient.listEvents(
      this.config.googleHolidayCalendarId,
      startDate + 'T00:00:00Z',
      endDate + 'T23:59:59Z'
    );
    console.log(`✓ Found ${holidayEvents.length} holiday events`);

    // Calculate daily time entries
    console.log('\nCalculating time entries...');
    const calculations = DayCalculator.calculateRange(
      startDate,
      endDate,
      workEvents,
      holidayEvents
    );

    // Filter to only workdays with entries
    const daysWithEntries = calculations.filter((calc) => calc.entries.length > 0);
    console.log(`✓ ${daysWithEntries.length} days need time entries`);

    // Fetch existing time entries
    console.log('\nChecking for existing time entries...');
    const existingReports: ExistingReport[] = [];
    for (const calc of daysWithEntries) {
      try {
        const reports = await this.ttClient.getReports(calc.date);
        if (reports.reports && reports.reports.length > 0) {
          existingReports.push(...reports.reports.map((r: any) => ({
            id: r.id,
            project: r.project,
            task: r.task,
            date: calc.date,
            duration: parseFloat(r.duration),
            note: r.note,
          })));
        }
      } catch (error) {
        console.error(`Warning: Could not fetch reports for ${calc.date}`);
      }
    }
    console.log(`✓ Found ${existingReports.length} existing time entries`);

    // Handle conflicts
    console.log('\nResolving conflicts...');
    const resolutions = await ConflictHandler.handleConflicts(
      daysWithEntries,
      existingReports
    );

    // Submit time entries
    console.log('\nSubmitting time entries...');
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const [date, resolution] of resolutions) {
      if (resolution.action === 'skip') {
        console.log(`⊘ Skipped ${date}`);
        skipCount++;
        continue;
      }

      // If replacing, delete old entries first
      if (resolution.action === 'replace' && resolution.entriesToDelete.length > 0) {
        console.log(`Deleting ${resolution.entriesToDelete.length} existing entries for ${date}...`);
        for (const oldEntry of resolution.entriesToDelete) {
          try {
            await this.ttClient.deleteTime(oldEntry.id);
            console.log(`  ✓ Deleted ${oldEntry.project}/${oldEntry.task} (${oldEntry.duration}h)`);
          } catch (error: any) {
            console.error(`  ✗ Failed to delete entry ${oldEntry.id}: ${error.message}`);
            errorCount++;
          }
        }
      }

      // Add new entries
      for (const entry of resolution.entriesToAdd) {
        try {
          await this.ttClient.addTime(entry);
          console.log(`✓ Added ${entry.type} entry for ${date} (${entry.duration}h)`);
          successCount++;
        } catch (error: any) {
          console.error(`✗ Failed to add entry for ${date}: ${error.message}`);
          errorCount++;
        }
      }
    }

    // Summary
    console.log('\n=== Sync Summary ===');
    console.log(`✓ Successful: ${successCount} entries`);
    console.log(`⊘ Skipped: ${skipCount} days`);
    console.log(`✗ Errors: ${errorCount} entries`);
  }

  async syncDate(date: string): Promise<void> {
    console.log(`\nSyncing single date: ${date}`);

    // Fetch calendar events for the specific date
    console.log('Fetching calendar events...');
    const workEvents = await this.calClient.listEvents(
      this.config.googleCalendarId,
      date + 'T00:00:00Z',
      date + 'T23:59:59Z'
    );
    const holidayEvents = await this.calClient.listEvents(
      this.config.googleHolidayCalendarId,
      date + 'T00:00:00Z',
      date + 'T23:59:59Z'
    );

    // Calculate time entries
    const calculation = DayCalculator.calculateDay(date, workEvents, holidayEvents);

    if (calculation.entries.length === 0) {
      console.log('No time entries needed for this date');
      return;
    }

    // Check for existing entries
    const existingReports: ExistingReport[] = [];
    try {
      const reports = await this.ttClient.getReports(date);
      if (reports.reports && reports.reports.length > 0) {
        existingReports.push(...reports.reports.map((r: any) => ({
          id: r.id,
          project: r.project,
          task: r.task,
          date,
          duration: parseFloat(r.duration),
          note: r.note,
        })));
      }
    } catch (error) {
      console.error(`Warning: Could not fetch existing reports`);
    }

    // Handle conflicts
    const resolutions = await ConflictHandler.handleConflicts(
      [calculation],
      existingReports
    );

    // Submit entries
    const resolution = resolutions.get(date);
    if (!resolution || resolution.action === 'skip') {
      console.log('⊘ Skipped');
      return;
    }

    // If replacing, delete old entries first
    if (resolution.action === 'replace' && resolution.entriesToDelete.length > 0) {
      console.log(`Deleting ${resolution.entriesToDelete.length} existing entries...`);
      for (const oldEntry of resolution.entriesToDelete) {
        try {
          await this.ttClient.deleteTime(oldEntry.id);
          console.log(`  ✓ Deleted ${oldEntry.project}/${oldEntry.task} (${oldEntry.duration}h)`);
        } catch (error: any) {
          console.error(`  ✗ Failed to delete entry ${oldEntry.id}: ${error.message}`);
        }
      }
    }

    // Add new entries
    for (const entry of resolution.entriesToAdd) {
      try {
        await this.ttClient.addTime(entry);
        console.log(`✓ Added ${entry.type} entry (${entry.duration}h)`);
      } catch (error: any) {
        console.error(`✗ Failed: ${error.message}`);
      }
    }
  }

  async deleteMonth(yearMonth: string): Promise<void> {
    const targetDate = new Date(`${yearMonth}-01`);
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);

    console.log(`\nDeleting entries for period: ${format(start, 'yyyy-MM-dd')} to ${format(end, 'yyyy-MM-dd')}`);

    // Collect all entries by iterating through each day (month query API doesn't work reliably)
    console.log('Fetching existing time entries...');
    const allEntries: Array<{ id: string; date: string; project: string; task: string; duration: string }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      try {
        const response = await this.ttClient.getReports(dateStr);
        if (response.reports && response.reports.length > 0) {
          allEntries.push(...response.reports.map((r: any) => ({
            id: r.id,
            date: r.date,
            project: r.project,
            task: r.task,
            duration: r.duration,
          })));
        }
      } catch {
        // Skip days with errors
      }
    }

    if (allEntries.length === 0) {
      console.log('No entries found for this period');
      return;
    }

    console.log(`Found ${allEntries.length} entries to delete`);

    // Delete each entry
    let successCount = 0;
    let errorCount = 0;

    for (const entry of allEntries) {
      try {
        await this.ttClient.deleteTime(Number(entry.id));
        console.log(`✓ Deleted ${entry.date}: ${entry.project}/${entry.task} (${entry.duration})`);
        successCount++;
      } catch (error: any) {
        console.error(`✗ Failed to delete entry ${entry.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n=== Delete Summary ===');
    console.log(`✓ Deleted: ${successCount} entries`);
    console.log(`✗ Errors: ${errorCount} entries`);
  }

  async deleteDate(date: string): Promise<void> {
    console.log(`\nDeleting entries for date: ${date}`);

    // Fetch existing time entries for the date
    console.log('Fetching existing time entries...');
    const reports = await this.ttClient.getReports(date);

    if (!reports.reports || reports.reports.length === 0) {
      console.log('No entries found for this date');
      return;
    }

    console.log(`Found ${reports.reports.length} entries to delete`);

    // Delete each entry
    let successCount = 0;
    let errorCount = 0;

    for (const report of reports.reports) {
      try {
        await this.ttClient.deleteTime(report.id);
        console.log(`✓ Deleted ${report.project}/${report.task} (${report.duration}h)`);
        successCount++;
      } catch (error: any) {
        console.error(`✗ Failed to delete entry ${report.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n=== Delete Summary ===');
    console.log(`✓ Deleted: ${successCount} entries`);
    console.log(`✗ Errors: ${errorCount} entries`);
  }

  async close(): Promise<void> {
    await this.ttClient.close();
    await this.calClient.close();
  }
}
