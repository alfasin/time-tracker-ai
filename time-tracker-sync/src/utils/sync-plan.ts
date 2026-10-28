import type { TimeEntry, ExistingReport } from '../types.js';
import { TASK_VACATION } from '../types.js';

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
 */
export function planDaySync(calculatedEntries: TimeEntry[], existingReports: ExistingReport[]): DaySyncPlan {
  const alreadyHasVacation = existingReports.some((report) => report.task === TASK_VACATION);
  if (alreadyHasVacation) {
    return { toDelete: [], toAdd: [] };
  }

  return {
    toDelete: existingReports,
    toAdd: calculatedEntries,
  };
}
