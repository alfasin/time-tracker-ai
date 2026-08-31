import { describe, it, expect } from 'vitest';
import { HolidayDetector } from './holiday-detector.js';
import type { CalendarEvent } from '../types.js';

describe('HolidayDetector.isVacationHoliday with a multi-day holiday event', () => {
  const multiDaySukkot: CalendarEvent = {
    id: 'h1',
    summary: 'Sukkot',
    start: { date: '2026-09-27' },
    end: { date: '2026-09-30' }, // exclusive end, per Google Calendar convention
  };

  it('matches the first day of the range', () => {
    expect(HolidayDetector.isVacationHoliday('2026-09-27', [multiDaySukkot])).toBe(true);
  });

  it('matches a day in the middle of the range', () => {
    expect(HolidayDetector.isVacationHoliday('2026-09-28', [multiDaySukkot])).toBe(true);
  });

  it('matches the last day before the exclusive end date', () => {
    expect(HolidayDetector.isVacationHoliday('2026-09-29', [multiDaySukkot])).toBe(true);
  });

  it('does not match the exclusive end date itself', () => {
    expect(HolidayDetector.isVacationHoliday('2026-09-30', [multiDaySukkot])).toBe(false);
  });

  it('does not match a day before the range', () => {
    expect(HolidayDetector.isVacationHoliday('2026-09-26', [multiDaySukkot])).toBe(false);
  });
});
