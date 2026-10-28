import type { TimeEntry, ExistingReport } from '../types.js';

export interface DaySyncPlan {
  toDelete: ExistingReport[];
  toAdd: TimeEntry[];
}

/**
 * Idempotent per-day sync plan: always delete every existing entry for the
 * day, then add whatever the calculator produced. No conflict resolution -
 * re-running a sync always converges to exactly what was calculated.
 *
 * Exception: if a vacation entry already exists in the Time Tracker for the
 * day, it was submitted by the external vacation-request auto-approval
 * system, not by this sync. Leave the day untouched entirely - no deletes,
 * no adds - rather than overwrite or layer on top of it.
 *
 * `vacationTaskName` must be the task's display *name* (e.g. "Vacation"),
 * not its id - the Time Tracker API returns existing reports' task field as
 * a name, not the id used when adding entries.
 */
export function planDaySync(
  calculatedEntries: TimeEntry[],
  existingReports: ExistingReport[],
  vacationTaskName: string
): DaySyncPlan {
  const alreadyHasVacation = existingReports.some((report) => report.task === vacationTaskName);
  if (alreadyHasVacation) {
    return { toDelete: [], toAdd: [] };
  }

  return {
    toDelete: existingReports,
    toAdd: calculatedEntries,
  };
}
