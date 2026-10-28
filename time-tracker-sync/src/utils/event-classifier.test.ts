import { describe, it, expect } from 'vitest';
import { EventClassifier } from './event-classifier.js';
import type { CalendarEvent } from '../types.js';

describe('EventClassifier.isVacationEvent', () => {
  it('recognizes events with vacation/PTO keywords in the summary', () => {
    const event: CalendarEvent = {
      id: '1',
      summary: 'Nir - Vacation',
      start: { date: '2026-10-06' },
      end: { date: '2026-10-08' },
    };
    expect(EventClassifier.isVacationEvent(event)).toBe(true);
  });

  it('recognizes native Google Calendar Out-of-Office events even without a vacation keyword', () => {
    const oooEvent: CalendarEvent = {
      id: '2',
      summary: 'OOO',
      eventType: 'outOfOffice',
      start: { dateTime: '2026-10-06T00:00:00+03:00' },
      end: { dateTime: '2026-10-08T00:00:00+03:00' },
    };
    expect(EventClassifier.isVacationEvent(oooEvent)).toBe(true);
  });

  it('does not treat a regular meeting as vacation', () => {
    const meeting: CalendarEvent = {
      id: '3',
      summary: 'Group roadmap sync',
      start: { dateTime: '2026-10-07T14:00:00+03:00' },
      end: { dateTime: '2026-10-07T14:30:00+03:00' },
    };
    expect(EventClassifier.isVacationEvent(meeting)).toBe(false);
  });
});
