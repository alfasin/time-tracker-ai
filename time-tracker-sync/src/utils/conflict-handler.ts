import inquirer from 'inquirer';
import type { TimeEntry, ExistingReport } from '../types.js';

export interface ConflictResolution {
  action: 'skip' | 'replace' | 'add';
  entriesToAdd: TimeEntry[];
  entriesToDelete: ExistingReport[];
}

export class ConflictHandler {
  /**
   * Check if there are existing entries for a given date
   */
  static hasExistingEntries(date: string, existingReports: ExistingReport[]): boolean {
    return existingReports.some((report) => report.date === date);
  }

  /**
   * Get existing entries for a given date
   */
  static getExistingEntries(date: string, existingReports: ExistingReport[]): ExistingReport[] {
    return existingReports.filter((report) => report.date === date);
  }

  /**
   * Format entries for display
   */
  static formatEntry(entry: TimeEntry | ExistingReport): string {
    if ('type' in entry) {
      // TimeEntry
      return `  - ${entry.type}: ${entry.duration}h (Project: ${entry.project}, Task: ${entry.task})`;
    } else {
      // ExistingReport
      return `  - ${entry.project}/${entry.task}: ${entry.duration}h - "${entry.note}"`;
    }
  }

  /**
   * Prompt user to resolve conflicts for a specific date
   */
  static async promptConflictResolution(
    date: string,
    newEntries: TimeEntry[],
    existingEntries: ExistingReport[]
  ): Promise<ConflictResolution> {
    console.log(`\nConflict detected for ${date}:`);
    console.log('\nExisting entries:');
    existingEntries.forEach((entry) => console.log(this.formatEntry(entry)));

    console.log('\nNew entries to add:');
    newEntries.forEach((entry) => console.log(this.formatEntry(entry)));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Skip - Keep existing entries, do not add new ones', value: 'skip' },
          { name: 'Replace - Delete existing entries and add new ones', value: 'replace' },
          { name: 'Add - Keep existing entries and add new ones anyway', value: 'add' },
        ],
      },
    ]);

    return {
      action: answer.action,
      entriesToAdd: answer.action === 'skip' ? [] : newEntries,
      entriesToDelete: answer.action === 'replace' ? existingEntries : [],
    };
  }

  /**
   * Handle conflicts for multiple days
   */
  static async handleConflicts(
    calculations: Array<{ date: string; entries: TimeEntry[] }>,
    existingReports: ExistingReport[]
  ): Promise<Map<string, ConflictResolution>> {
    const resolutions = new Map<string, ConflictResolution>();

    for (const calc of calculations) {
      if (calc.entries.length === 0) {
        // No entries to add, skip
        continue;
      }

      const existing = this.getExistingEntries(calc.date, existingReports);

      if (existing.length > 0) {
        // Conflict detected, prompt user
        const resolution = await this.promptConflictResolution(
          calc.date,
          calc.entries,
          existing
        );
        resolutions.set(calc.date, resolution);
      } else {
        // No conflict, add all entries
        resolutions.set(calc.date, {
          action: 'add',
          entriesToAdd: calc.entries,
          entriesToDelete: [],
        });
      }
    }

    return resolutions;
  }
}
