import { describe, it, expect } from 'vitest';
import { planDaySync } from './sync-plan.js';
import type { TimeEntry, ExistingReport } from '../types.js';

const existingEntry: ExistingReport = {
  id: 1,
  project: '1003',
  task: '5',
  date: '2026-08-06',
  duration: 9,
  note: 'Development work',
};

const calculatedVacationEntry: TimeEntry = {
  date: '2026-08-06',
  project: '14',
  task: '8',
  duration: '9',
  note: 'Vacation/PTO',
  type: 'vacation',
};

describe('planDaySync', () => {
  it('deletes all existing entries and adds all newly calculated entries, unconditionally', () => {
    const plan = planDaySync([calculatedVacationEntry], [existingEntry]);
    expect(plan.toDelete).toEqual([existingEntry]);
    expect(plan.toAdd).toEqual([calculatedVacationEntry]);
  });

  it('deletes stale entries even when the day now calculates to zero entries', () => {
    const plan = planDaySync([], [existingEntry]);
    expect(plan.toDelete).toEqual([existingEntry]);
    expect(plan.toAdd).toEqual([]);
  });

  it('adds new entries even when there is nothing existing to delete', () => {
    const plan = planDaySync([calculatedVacationEntry], []);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toAdd).toEqual([calculatedVacationEntry]);
  });

  it('is a no-op when there is nothing existing and nothing calculated', () => {
    const plan = planDaySync([], []);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toAdd).toEqual([]);
  });

  it('deletes and re-adds even when the calculated entries are identical to what already exists', () => {
    const identicalExisting: ExistingReport = {
      id: 42,
      project: '14',
      task: '8',
      date: '2026-08-06',
      duration: 9,
      note: 'Vacation/PTO',
    };
    const plan = planDaySync([calculatedVacationEntry], [identicalExisting]);
    expect(plan.toDelete).toEqual([identicalExisting]);
    expect(plan.toAdd).toEqual([calculatedVacationEntry]);
  });
});
