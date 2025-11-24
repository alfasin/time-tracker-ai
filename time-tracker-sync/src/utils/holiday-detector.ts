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
    // Find events on the given date
    const eventsOnDate = holidayEvents.filter((event) => {
      const eventDate = event.start.date || event.start.dateTime?.split('T')[0];
      return eventDate === date;
    });

    // Check if any of the events match vacation holiday names
    return eventsOnDate.some((event) => {
      const summary = event.summary?.toLowerCase() || '';
      return VACATION_HOLIDAY_NAMES.some((holiday) =>
        summary.includes(holiday.toLowerCase())
      );
    });
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
