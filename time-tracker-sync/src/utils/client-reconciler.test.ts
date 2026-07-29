import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Project } from '../types.js';
import { saveClientsConfig, loadClientsConfig, type ClientsConfig } from './client-config.js';

vi.mock('./client-wizard.js', () => ({
  runClientWizard: vi.fn(),
}));

import { runClientWizard } from './client-wizard.js';
import { ensureClientsConfig } from './client-reconciler.js';

describe('ensureClientsConfig', () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tt-sync-test-'));
    configPath = join(dir, 'clients.config.json');
    vi.mocked(runClientWizard).mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when no non-Tikal projects exist', async () => {
    await expect(
      ensureClientsConfig(configPath, [{ id: '14', name: 'Tikal', tasks: [] }])
    ).rejects.toThrow(/No client projects/);
  });

  it('silently saves a single-client config with no wizard when only one client exists', async () => {
    const projects: Project[] = [
      { id: '14', name: 'Tikal', tasks: [] },
      { id: '938', name: 'Truvify', tasks: [] },
    ];

    const config = await ensureClientsConfig(configPath, projects);

    expect(config).toEqual({
      mode: 'split',
      knownProjectIds: ['938'],
      projectNames: { '938': 'Truvify' },
      split: { '938': 100 },
      switch: null,
    });
    expect(runClientWizard).not.toHaveBeenCalled();
    expect(loadClientsConfig(configPath)).toEqual(config);
  });

  it('runs the wizard when 2+ non-Tikal projects appear for the first time', async () => {
    const projects: Project[] = [
      { id: '938', name: 'Truvify', tasks: [] },
      { id: '952', name: 'Acme Corp', tasks: [] },
    ];
    const wizardResult: ClientsConfig = {
      mode: 'split',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: { '938': 50, '952': 50 },
      switch: null,
    };
    vi.mocked(runClientWizard).mockResolvedValue(wizardResult);

    const config = await ensureClientsConfig(configPath, projects);

    expect(config).toEqual(wizardResult);
    expect(loadClientsConfig(configPath)).toEqual(wizardResult);
  });

  it('reuses the saved config without invoking the wizard when nothing new appears', async () => {
    const existing: ClientsConfig = {
      mode: 'split',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: { '938': 50, '952': 50 },
      switch: null,
    };
    saveClientsConfig(configPath, existing);

    const projects: Project[] = [
      { id: '938', name: 'Truvify', tasks: [] },
      { id: '952', name: 'Acme Corp', tasks: [] },
    ];

    const config = await ensureClientsConfig(configPath, projects);

    expect(config).toEqual(existing);
    expect(runClientWizard).not.toHaveBeenCalled();
  });

  it('runs the wizard again when a new project appears alongside a saved config', async () => {
    const existing: ClientsConfig = {
      mode: 'split',
      knownProjectIds: ['938'],
      projectNames: { '938': 'Truvify' },
      split: { '938': 100 },
      switch: null,
    };
    saveClientsConfig(configPath, existing);

    const projects: Project[] = [
      { id: '938', name: 'Truvify', tasks: [] },
      { id: '101', name: 'New Client', tasks: [] },
    ];
    const wizardResult: ClientsConfig = {
      mode: 'split',
      knownProjectIds: ['938', '101'],
      projectNames: { '938': 'Truvify', '101': 'New Client' },
      split: { '938': 70, '101': 30 },
      switch: null,
    };
    vi.mocked(runClientWizard).mockResolvedValue(wizardResult);

    const config = await ensureClientsConfig(configPath, projects);

    expect(config).toEqual(wizardResult);
    expect(runClientWizard).toHaveBeenCalledWith(existing, projects);
  });

  it('throws when a split-mode config references a project no longer in the live list', async () => {
    const existing: ClientsConfig = {
      mode: 'split',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: { '938': 60, '952': 40 },
      switch: null,
    };
    saveClientsConfig(configPath, existing);

    const projects: Project[] = [{ id: '938', name: 'Truvify', tasks: [] }];

    await expect(ensureClientsConfig(configPath, projects)).rejects.toThrow(/952/);
    expect(runClientWizard).not.toHaveBeenCalled();
  });

  it('throws when a switch-mode config\'s beforeProjectId is missing from the live list', async () => {
    const existing: ClientsConfig = {
      mode: 'switch',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: null,
      switch: { beforeProjectId: '938', afterProjectId: '952', lastDateWithBefore: '2026-06-30' },
    };
    saveClientsConfig(configPath, existing);

    const projects: Project[] = [{ id: '952', name: 'Acme Corp', tasks: [] }];

    await expect(ensureClientsConfig(configPath, projects)).rejects.toThrow(/938/);
    expect(runClientWizard).not.toHaveBeenCalled();
  });

  it('throws when a switch-mode config\'s afterProjectId is missing from the live list', async () => {
    const existing: ClientsConfig = {
      mode: 'switch',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: null,
      switch: { beforeProjectId: '938', afterProjectId: '952', lastDateWithBefore: '2026-06-30' },
    };
    saveClientsConfig(configPath, existing);

    const projects: Project[] = [{ id: '938', name: 'Truvify', tasks: [] }];

    await expect(ensureClientsConfig(configPath, projects)).rejects.toThrow(/952/);
    expect(runClientWizard).not.toHaveBeenCalled();
  });
});
