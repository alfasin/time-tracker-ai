import { describe, it, expect } from 'vitest';
import { planDaySync } from './sync-plan.js';
import type { TimeEntry, ExistingReport } from '../types.js';

// The live Time Tracker API returns `task` as a human-readable name (e.g.
// "Vacation", "Development"), not the id used when adding entries - fixtures
// below reflect that.
const VACATION_TASK_NAME = 'Vacation';

const existingEntry: ExistingReport = {
  id: 1,
  project: '1003',
  task: 'Development',
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
    const plan = planDaySync([calculatedVacationEntry], [existingEntry], VACATION_TASK_NAME);
    expect(plan.toDelete).toEqual([existingEntry]);
    expect(plan.toAdd).toEqual([calculatedVacationEntry]);
  });

  it('deletes stale entries even when the day now calculates to zero entries', () => {
    const plan = planDaySync([], [existingEntry], VACATION_TASK_NAME);
    expect(plan.toDelete).toEqual([existingEntry]);
    expect(plan.toAdd).toEqual([]);
  });

  it('adds new entries even when there is nothing existing to delete', () => {
    const plan = planDaySync([calculatedVacationEntry], [], VACATION_TASK_NAME);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toAdd).toEqual([calculatedVacationEntry]);
  });

  it('is a no-op when there is nothing existing and nothing calculated', () => {
    const plan = planDaySync([], [], VACATION_TASK_NAME);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toAdd).toEqual([]);
  });

  it('deletes and re-adds even when the calculated entries are identical to what already exists', () => {
    const calculatedClientEntry: TimeEntry = {
      date: '2026-08-06',
      project: '1003',
      task: '5',
      duration: '9',
      note: 'Development work',
      type: 'client',
    };
    const identicalExisting: ExistingReport = {
      id: 42,
      project: '1003',
      task: 'Development',
      date: '2026-08-06',
      duration: 9,
      note: 'Development work',
    };
    const plan = planDaySync([calculatedClientEntry], [identicalExisting], VACATION_TASK_NAME);
    expect(plan.toDelete).toEqual([identicalExisting]);
    expect(plan.toAdd).toEqual([calculatedClientEntry]);
  });

  describe('when a vacation entry already exists in the Time Tracker', () => {
    const externallySubmittedVacation: ExistingReport = {
      id: 99,
      project: 'Tikal',
      task: VACATION_TASK_NAME,
      date: '2026-12-01',
      duration: 9,
      note: 'Vacation/PTO',
    };

    it('leaves it untouched and adds nothing, even when the calculator produced entries', () => {
      const clientEntry: TimeEntry = {
        date: '2026-12-01',
        project: '1003',
        task: '5',
        duration: '9',
        note: 'Development work',
        type: 'client',
      };
      const plan = planDaySync([clientEntry], [externallySubmittedVacation], VACATION_TASK_NAME);
      expect(plan.toDelete).toEqual([]);
      expect(plan.toAdd).toEqual([]);
    });

    it('does not delete other existing entries on that date either', () => {
      const otherExisting: ExistingReport = {
        id: 100,
        project: '1003',
        task: 'Development',
        date: '2026-12-01',
        duration: 2,
        note: 'Some other entry',
      };
      const plan = planDaySync([], [externallySubmittedVacation, otherExisting], VACATION_TASK_NAME);
      expect(plan.toDelete).toEqual([]);
      expect(plan.toAdd).toEqual([]);
    });
  });
});
