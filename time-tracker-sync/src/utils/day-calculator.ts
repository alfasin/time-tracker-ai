import type { CalendarEvent, DayCalculation, TimeEntry } from '../types.js';
import { PROJECT_TIKAL, PROJECT_CLIENT_ID, TASK_MEETING, TASK_VACATION, TASK_DEVELOPMENT } from '../types.js';
import { HolidayDetector } from './holiday-detector.js';
import { EventClassifier, type ClassifiedEvent } from './event-classifier.js';

const WORKDAY_HOURS = 9;

export class DayCalculator {
  /**
   * Calculate what time entries should be submitted for a given day
   */
  static calculateDay(
    date: string,
    workEvents: CalendarEvent[],
    holidayEvents: CalendarEvent[]
  ): DayCalculation {
    if (!PROJECT_CLIENT_ID) {
      throw new Error('PROJECT_CLIENT_ID is not set');
    }

    // Check if it's a holiday (skip entirely)
    const isHoliday = HolidayDetector.isVacationHoliday(date, holidayEvents);
    if (isHoliday) {
      return {
        date,
        isHoliday: true,
        isWFO: false,
        hasVacation: false,
        meetingHours: 0,
        clientHours: 0,
        entries: [],
      };
    }

    // Check if it's a weekend
    const dateObj = new Date(date + 'T00:00:00');
    if (HolidayDetector.isWeekend(dateObj)) {
      return {
        date,
        isHoliday: false,
        isWFO: false,
        hasVacation: false,
        meetingHours: 0,
        clientHours: 0,
        entries: [],
      };
    }

    // Filter events for this specific date
    const eventsOnDate = workEvents.filter((event) => {
      const eventDate = event.start.date || event.start.dateTime?.split('T')[0];
      return eventDate === date;
    });

    // Classify events
    const classified = EventClassifier.classifyEvents(eventsOnDate);

    // Check for WFO event
    const hasWFO = classified.some((c) => c.type === 'wfo');
    if (hasWFO) {
      return {
        date,
        isHoliday: false,
        isWFO: true,
        hasVacation: false,
        meetingHours: 0,
        clientHours: WORKDAY_HOURS,
        entries: [
          {
            date,
            project: PROJECT_CLIENT_ID,
            task: TASK_DEVELOPMENT,
            duration: String(WORKDAY_HOURS),
            note: 'Working from clients office',
            type: 'client',
          },
        ],
      };
    }

    // Check for vacation event
    const hasVacation = classified.some((c) => c.type === 'vacation');
    if (hasVacation) {
      return {
        date,
        isHoliday: false,
        isWFO: false,
        hasVacation: true,
        meetingHours: WORKDAY_HOURS,
        clientHours: 0,
        entries: [
          {
            date,
            project: PROJECT_TIKAL,
            task: TASK_VACATION,
            duration: String(WORKDAY_HOURS),
            note: 'Vacation/PTO',
            type: 'vacation',
          },
        ],
      };
    }

    // Normal workday: calculate meeting hours and remaining client hours
    const meetings = classified.filter((c) => c.type === 'meeting');
    const meetingHours = meetings.reduce((sum, m) => sum + m.duration, 0);
    const clientHours = Math.max(0, WORKDAY_HOURS - meetingHours);

    const entries: TimeEntry[] = [];

    // Add meeting entry if there are meetings
    if (meetingHours > 0) {
      entries.push({
        date,
        project: PROJECT_TIKAL,
        task: TASK_MEETING,
        duration: String(Math.round(meetingHours * 100) / 100),
        note: `Meetings: ${meetings.map((m) => m.event.summary).join(', ')}`,
        type: 'meeting',
      });
    }

    // Add client entry for remaining hours
    if (clientHours > 0) {
      entries.push({
        date,
        project: PROJECT_CLIENT_ID,
        task: TASK_DEVELOPMENT,
        duration: String(Math.round(clientHours * 100) / 100),
        note: 'Development work',
        type: 'client',
      });
    }

    return {
      date,
      isHoliday: false,
      isWFO: false,
      hasVacation: false,
      meetingHours,
      clientHours: clientHours,
      entries,
    };
  }

  /**
   * Calculate time entries for a range of dates
   */
  static calculateRange(
    startDate: string,
    endDate: string,
    workEvents: CalendarEvent[],
    holidayEvents: CalendarEvent[]
  ): DayCalculation[] {
    if (!PROJECT_CLIENT_ID) {
      throw new Error('PROJECT_CLIENT_ID is not set');
    }
    const calculations: DayCalculation[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      calculations.push(this.calculateDay(dateStr, workEvents, holidayEvents));
    }

    return calculations;
  }
}
