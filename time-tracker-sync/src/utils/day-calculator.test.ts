import { describe, it, expect } from 'vitest';
import { DayCalculator } from './day-calculator.js';
import { buildSingleClientConfig, type ClientsConfig } from './client-config.js';
import type { CalendarEvent } from '../types.js';

const splitConfig: ClientsConfig = {
  mode: 'split',
  knownProjectIds: ['938', '952'],
  projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
  split: { '938': 60, '952': 40 },
  switch: null,
};

const switchConfig: ClientsConfig = {
  mode: 'switch',
  knownProjectIds: ['938', '952'],
  projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
  split: null,
  switch: { beforeProjectId: '938', afterProjectId: '952', lastDateWithBefore: '2026-06-30' },
};

describe('DayCalculator.calculateDay with multiple clients', () => {
  it("splits a normal workday's remaining hours across both clients by percentage", () => {
    const meetingEvent: CalendarEvent = {
      id: 'm1',
      summary: 'Standup',
      start: { dateTime: '2026-07-15T09:00:00Z' },
      end: { dateTime: '2026-07-15T12:00:00Z' },
    };

    const result = DayCalculator.calculateDay('2026-07-15', [meetingEvent], [], splitConfig);

    expect(result.entries).toEqual([
      { date: '2026-07-15', project: '14', task: '13', duration: '3', note: 'Meetings: Standup', type: 'meeting' },
      { date: '2026-07-15', project: '938', task: '5', duration: '3.6', note: 'Development work (Truvify - 60%)', type: 'client' },
      { date: '2026-07-15', project: '952', task: '5', duration: '2.4', note: 'Development work (Acme Corp - 40%)', type: 'client' },
    ]);
  });

  it('bills 100% to the "before" client on the day of a switch', () => {
    const result = DayCalculator.calculateDay('2026-06-30', [], [], switchConfig);
    const clientEntries = result.entries.filter((e) => e.type === 'client');
    expect(clientEntries).toEqual([
      { date: '2026-06-30', project: '938', task: '5', duration: '9', note: 'Development work', type: 'client' },
    ]);
  });

  it('bills 100% to the "after" client starting the day after the switch', () => {
    const result = DayCalculator.calculateDay('2026-07-01', [], [], switchConfig);
    const clientEntries = result.entries.filter((e) => e.type === 'client');
    expect(clientEntries).toEqual([
      { date: '2026-07-01', project: '952', task: '5', duration: '9', note: 'Development work', type: 'client' },
    ]);
  });

  it('splits WFO full-day hours across both clients too', () => {
    const wfoEvent: CalendarEvent = {
      id: '1',
      summary: 'WFO',
      start: { date: '2026-07-15' },
      end: { date: '2026-07-16' },
    };

    const result = DayCalculator.calculateDay('2026-07-15', [wfoEvent], [], splitConfig);

    expect(result.entries).toEqual([
      { date: '2026-07-15', project: '938', task: '5', duration: '5.4', note: 'Working from clients office (Truvify - 60%)', type: 'client' },
      { date: '2026-07-15', project: '952', task: '5', duration: '3.6', note: 'Working from clients office (Acme Corp - 40%)', type: 'client' },
    ]);
  });

  it('keeps the plain note wording when only one client is configured (backward compatible)', () => {
    const singleConfig = buildSingleClientConfig('938', 'Truvify');
    const result = DayCalculator.calculateDay('2026-07-15', [], [], singleConfig);
    const clientEntries = result.entries.filter((e) => e.type === 'client');
    expect(clientEntries).toEqual([
      { date: '2026-07-15', project: '938', task: '5', duration: '9', note: 'Development work', type: 'client' },
    ]);
  });
});

describe('DayCalculator.calculateRange', () => {
  it('applies the clients config to every date in the range', () => {
    const results = DayCalculator.calculateRange('2026-07-15', '2026-07-16', [], [], splitConfig);
    for (const day of results) {
      const clientEntries = day.entries.filter((e) => e.type === 'client');
      expect(clientEntries.map((e) => e.project)).toEqual(['938', '952']);
    }
  });
});

describe('DayCalculator.calculateDay with a multi-day vacation event', () => {
  // Mirrors a real Google Calendar event: a single object spanning several days
  // (start/end dateTime), not one event per day.
  const multiDayVacation: CalendarEvent = {
    id: 'v1',
    summary: 'Nir - Vacation',
    start: { dateTime: '2026-08-05T00:00:00+03:00' },
    end: { dateTime: '2026-08-23T00:00:00+03:00' },
  };

  const singleConfig = buildSingleClientConfig('938', 'Truvify');

  it('marks the first day of the range as vacation', () => {
    const result = DayCalculator.calculateDay('2026-08-05', [multiDayVacation], [], singleConfig);
    expect(result.hasVacation).toBe(true);
  });

  it('marks a day in the middle of the range as vacation, not a normal workday', () => {
    const result = DayCalculator.calculateDay('2026-08-12', [multiDayVacation], [], singleConfig);
    expect(result.hasVacation).toBe(true);
    expect(result.entries).toEqual([
      { date: '2026-08-12', project: '14', task: '8', duration: '9', note: 'Vacation/PTO', type: 'vacation' },
    ]);
  });

  it('marks the last workday before the (exclusive) end date as vacation', () => {
    // 2026-08-22 is the actual last day covered by the event, but it's a Saturday
    // (weekend), so 08-20 (Thursday) is the last workday that should show vacation.
    const result = DayCalculator.calculateDay('2026-08-20', [multiDayVacation], [], singleConfig);
    expect(result.hasVacation).toBe(true);
  });

  it('does not mark the exclusive end date itself as vacation', () => {
    const result = DayCalculator.calculateDay('2026-08-23', [multiDayVacation], [], singleConfig);
    expect(result.hasVacation).toBe(false);
  });

  it('does not mark a day before the range as vacation', () => {
    const result = DayCalculator.calculateDay('2026-08-04', [multiDayVacation], [], singleConfig);
    expect(result.hasVacation).toBe(false);
  });
});
