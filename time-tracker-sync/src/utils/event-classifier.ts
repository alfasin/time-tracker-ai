import type { CalendarEvent } from '../types.js';

export interface ClassifiedEvent {
  event: CalendarEvent;
  type: 'wfo' | 'vacation' | 'meeting';
  duration: number; // hours
}

export class EventClassifier {
  /**
   * Check if an event is a WFO (Working From Office) event
   */
  static isWFOEvent(event: CalendarEvent): boolean {
    const summary = event.summary?.toLowerCase() || '';
    return summary.includes('wfo') || summary.includes('working from office');
  }

  /**
   * Check if an event is a vacation/PTO event
   */
  static isVacationEvent(event: CalendarEvent): boolean {
    const summary = event.summary?.toLowerCase() || '';
    return summary.includes('vacation') || summary.includes('pto') || summary.includes('paid time off');
  }

  /**
   * Calculate duration of an event in hours
   */
  static calculateDuration(event: CalendarEvent): number {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;

    if (!start || !end) {
      return 0;
    }

    const startTime = new Date(start);
    const endTime = new Date(end);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    return Math.round(durationHours * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Classify an event as WFO, vacation, or regular meeting
   */
  static classifyEvent(event: CalendarEvent): ClassifiedEvent {
    if (this.isWFOEvent(event)) {
      return {
        event,
        type: 'wfo',
        duration: this.calculateDuration(event),
      };
    }

    if (this.isVacationEvent(event)) {
      return {
        event,
        type: 'vacation',
        duration: this.calculateDuration(event),
      };
    }

    return {
      event,
      type: 'meeting',
      duration: this.calculateDuration(event),
    };
  }

  /**
   * Classify multiple events
   */
  static classifyEvents(events: CalendarEvent[]): ClassifiedEvent[] {
    return events.map((event) => this.classifyEvent(event));
  }
}
