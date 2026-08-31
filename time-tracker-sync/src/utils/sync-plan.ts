import type { TimeEntry, ExistingReport } from '../types.js';

export interface DaySyncPlan {
  toDelete: ExistingReport[];
  toAdd: TimeEntry[];
}

/**
 * Idempotent per-day sync plan: always delete every existing entry for the
 * day, then add whatever the calculator produced. No conflict resolution -
 * re-running a sync always converges to exactly what was calculated.
 */
export function planDaySync(calculatedEntries: TimeEntry[], existingReports: ExistingReport[]): DaySyncPlan {
  return {
    toDelete: existingReports,
    toAdd: calculatedEntries,
  };
}
