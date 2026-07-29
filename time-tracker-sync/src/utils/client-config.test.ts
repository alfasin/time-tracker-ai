import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveClientsForDate,
  findNewProjectIds,
  buildSingleClientConfig,
  percentsSumTo100,
  loadClientsConfig,
  saveClientsConfig,
  type ClientsConfig,
} from './client-config.js';

describe('resolveClientsForDate', () => {
  const splitConfig: ClientsConfig = {
    mode: 'split',
    knownProjectIds: ['938', '952'],
    projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
    split: { '938': 60, '952': 40 },
    switch: null,
  };

  it('returns every project with a nonzero percent in split mode', () => {
    expect(resolveClientsForDate(splitConfig, '2026-07-15')).toEqual([
      { projectId: '938', percent: 60 },
      { projectId: '952', percent: 40 },
    ]);
  });

  it('omits projects with a zero percent in split mode', () => {
    const config: ClientsConfig = { ...splitConfig, split: { '938': 100, '952': 0 } };
    expect(resolveClientsForDate(config, '2026-07-15')).toEqual([{ projectId: '938', percent: 100 }]);
  });

  const switchConfig: ClientsConfig = {
    mode: 'switch',
    knownProjectIds: ['938', '952'],
    projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
    split: null,
    switch: { beforeProjectId: '938', afterProjectId: '952', lastDateWithBefore: '2026-06-30' },
  };

  it('bills the before-client on and before the switch date', () => {
    expect(resolveClientsForDate(switchConfig, '2026-06-30')).toEqual([{ projectId: '938', percent: 100 }]);
  });

  it('bills the after-client once the switch date has passed', () => {
    expect(resolveClientsForDate(switchConfig, '2026-07-01')).toEqual([{ projectId: '952', percent: 100 }]);
  });
});

describe('findNewProjectIds', () => {
  it('treats every project as new when no config exists yet', () => {
    expect(findNewProjectIds(null, ['938'])).toEqual(['938']);
  });

  it('returns an empty list when the live set matches knownProjectIds exactly', () => {
    const config = buildSingleClientConfig('938', 'Truvify');
    expect(findNewProjectIds(config, ['938'])).toEqual([]);
  });

  it('is order-independent', () => {
    const config: ClientsConfig = { ...buildSingleClientConfig('938', 'Truvify'), knownProjectIds: ['952', '938'] };
    expect(findNewProjectIds(config, ['938', '952'])).toEqual([]);
  });

  it('reports only the ids not already known', () => {
    const config = buildSingleClientConfig('938', 'Truvify');
    expect(findNewProjectIds(config, ['938', '952'])).toEqual(['952']);
  });
});

describe('buildSingleClientConfig', () => {
  it('builds a 100% split config for a single client', () => {
    expect(buildSingleClientConfig('938', 'Truvify')).toEqual({
      mode: 'split',
      knownProjectIds: ['938'],
      projectNames: { '938': 'Truvify' },
      split: { '938': 100 },
      switch: null,
    });
  });
});

describe('percentsSumTo100', () => {
  it('accepts percentages that sum to exactly 100', () => {
    expect(percentsSumTo100({ '938': 60, '952': 40 })).toBe(true);
  });

  it('rejects percentages that do not sum to 100', () => {
    expect(percentsSumTo100({ '938': 60, '952': 30 })).toBe(false);
  });
});

describe('loadClientsConfig / saveClientsConfig', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the file does not exist', () => {
    dir = mkdtempSync(join(tmpdir(), 'tt-sync-test-'));
    expect(loadClientsConfig(join(dir, 'missing.json'))).toBeNull();
  });

  it('round-trips a config through save then load', () => {
    dir = mkdtempSync(join(tmpdir(), 'tt-sync-test-'));
    const path = join(dir, 'clients.config.json');
    const config = buildSingleClientConfig('938', 'Truvify');

    saveClientsConfig(path, config);

    expect(loadClientsConfig(path)).toEqual(config);
  });
});
