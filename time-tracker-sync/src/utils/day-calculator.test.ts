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
