import { startOfMonth, endOfMonth, format } from 'date-fns';
import { resolve } from 'node:path';
import { TimeTrackerClient } from './services/time-tracker-client.js';
import { CalendarClient } from './services/calendar-client.js';
import { DayCalculator } from './utils/day-calculator.js';
import { planDaySync } from './utils/sync-plan.js';
import { ensureClientsConfig } from './utils/client-reconciler.js';
import type { ClientsConfig } from './utils/client-config.js';
import type { SyncConfig, ExistingReport, DayCalculation } from './types.js';

interface DaySyncCounts {
  deleted: number;
  added: number;
  errors: number;
}

export class SyncEngine {
  private ttClient: TimeTrackerClient;
  private calClient: CalendarClient;
  private config: SyncConfig;
  private clientsConfig!: ClientsConfig;

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

  /**
   * Idempotent per-day sync: delete every existing entry for the date, then
   * add whatever the calculator produced (which may be nothing). Re-running
   * a sync always converges to exactly what's calculated, so there's no
   * conflict to resolve.
   */
  private async syncDay(calc: DayCalculation): Promise<DaySyncCounts> {
    const counts: DaySyncCounts = { deleted: 0, added: 0, errors: 0 };

    let existingReports: ExistingReport[] = [];
    try {
      const reports = await this.ttClient.getReports(calc.date);
      existingReports = (reports.reports || []).map((r: any) => ({
        id: r.id,
        project: r.project,
        task: r.task,
        date: calc.date,
        duration: parseFloat(r.duration),
        note: r.note,
      }));
    } catch (error) {
      console.error(`Warning: Could not fetch reports for ${calc.date}`);
    }

    const plan = planDaySync(calc.entries, existingReports);

    if (plan.toDelete.length === 0 && plan.toAdd.length === 0) {
      return counts;
    }

    for (const oldEntry of plan.toDelete) {
      try {
        await this.ttClient.deleteTime(oldEntry.id);
        console.log(`  ✓ Deleted ${oldEntry.project}/${oldEntry.task} (${oldEntry.duration}h) for ${calc.date}`);
        counts.deleted++;
      } catch (error: any) {
        console.error(`  ✗ Failed to delete entry ${oldEntry.id} for ${calc.date}: ${error.message}`);
        counts.errors++;
      }
    }

    for (const entry of plan.toAdd) {
      try {
        await this.ttClient.addTime(entry);
        console.log(`✓ Added ${entry.type} entry for ${calc.date} (${entry.duration}h)`);
        counts.added++;
      } catch (error: any) {
        console.error(`✗ Failed to add entry for ${calc.date}: ${error.message}`);
        counts.errors++;
      }
    }

    return counts;
  }

  private async ensureClientsConfigLoaded(): Promise<void> {
    // Discover client projects and resolve billing configuration
    console.log('Checking client configuration...');
    const projects = await this.ttClient.getProjects();
    this.clientsConfig = await ensureClientsConfig(
      resolve(process.cwd(), 'clients.config.json'),
      projects
    );
    console.log(`✓ Client billing mode: ${this.clientsConfig.mode}`);
  }

  async syncMonth(yearMonth?: string): Promise<void> {
    await this.ensureClientsConfigLoaded();

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
      holidayEvents,
      this.clientsConfig
    );

    console.log(`✓ ${calculations.filter((c) => c.entries.length > 0).length} days need time entries`);

    // Delete-then-add every day in range, idempotently
    console.log('\nSyncing days...');
    let deletedCount = 0;
    let addedCount = 0;
    let errorCount = 0;

    for (const calc of calculations) {
      const counts = await this.syncDay(calc);
      deletedCount += counts.deleted;
      addedCount += counts.added;
      errorCount += counts.errors;
    }

    // Summary
    console.log('\n=== Sync Summary ===');
    console.log(`✓ Deleted: ${deletedCount} entries`);
    console.log(`✓ Added: ${addedCount} entries`);
    console.log(`✗ Errors: ${errorCount} entries`);
  }

  async syncDate(date: string): Promise<void> {
    await this.ensureClientsConfigLoaded();

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
    const calculation = DayCalculator.calculateDay(date, workEvents, holidayEvents, this.clientsConfig);

    const counts = await this.syncDay(calculation);
    console.log(`\n✓ Deleted: ${counts.deleted} entries, Added: ${counts.added} entries, Errors: ${counts.errors}`);
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
