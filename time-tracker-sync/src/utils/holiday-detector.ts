import type { CalendarEvent } from '../types.js';

// Specific Jewish holidays that count as actual vacation days
// (not all holidays in the Jewish calendar are days off)
const VACATION_HOLIDAY_NAMES = [
  'Rosh Hashana',
  'Rosh Hashanah', // Alternative spelling
  'Yom Kippur',
  'Sukkot', // First and last days
  'Pesach', // Eve and day after
  'Passover', // Alternative name
  'Yom HaAtzmaut',
  "Yom Ha'atzmaut", // Alternative spelling
  'Independence Day', // Alternative name
];

export class HolidayDetector {
  /**
   * Check if a given date is a vacation holiday based on the Jewish calendar
   */
  static isVacationHoliday(date: string, holidayEvents: CalendarEvent[]): boolean {
    // Find events overlapping the given date (events may span multiple days
    // as a single object, e.g. start=Sukkot eve, end=last day exclusive)
    const eventsOnDate = holidayEvents.filter((event) => this.eventOverlapsDate(event, date));

    // Check if any of the events match vacation holiday names
    return eventsOnDate.some((event) => {
      const summary = event.summary?.toLowerCase() || '';
      return VACATION_HOLIDAY_NAMES.some((holiday) =>
        summary.includes(holiday.toLowerCase())
      );
    });
  }

  /**
   * Check if an event overlaps a given date, handling events that span
   * multiple days as a single object (end date/dateTime is exclusive).
   */
  static eventOverlapsDate(event: CalendarEvent, date: string): boolean {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);

    const startRaw = event.start.dateTime || event.start.date;
    const endRaw = event.end.dateTime || event.end.date;
    if (!startRaw || !endRaw) {
      return false;
    }

    const eventStart = event.start.dateTime ? new Date(startRaw) : new Date(`${startRaw}T00:00:00`);
    const eventEnd = event.end.dateTime ? new Date(endRaw) : new Date(`${endRaw}T00:00:00`);

    return eventStart < dayEnd && eventEnd > dayStart;
  }

  /**
   * Check if a date falls on a weekend (Friday or Saturday)
   */
  static isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
  }

  /**
   * Check if a date is a workday (Sunday through Thursday, not a holiday)
   */
  static isWorkday(date: string, holidayEvents: CalendarEvent[]): boolean {
    const dateObj = new Date(date + 'T00:00:00');

    if (this.isWeekend(dateObj)) {
      return false;
    }

    if (this.isVacationHoliday(date, holidayEvents)) {
      return false;
    }

    return true;
  }
}
