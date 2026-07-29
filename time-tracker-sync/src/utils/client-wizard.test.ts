import { describe, it, expect, vi, beforeEach } from 'vitest';
import inquirer from 'inquirer';
import { runClientWizard } from './client-wizard.js';
import type { Project } from '../types.js';

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}));

const projects: Project[] = [
  { id: '938', name: 'Truvify', tasks: [] },
  { id: '952', name: 'Acme Corp', tasks: [] },
];

describe('runClientWizard', () => {
  beforeEach(() => {
    vi.mocked(inquirer.prompt).mockReset();
  });

  it('builds a split config from percentage answers', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ mode: 'split' })
      .mockResolvedValueOnce({ percent: 60 })
      .mockResolvedValueOnce({ percent: 40 });

    const config = await runClientWizard(null, projects);

    expect(config).toEqual({
      mode: 'split',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: { '938': 60, '952': 40 },
      switch: null,
    });
  });

  it('re-prompts the split percentages when they do not sum to 100', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ mode: 'split' })
      .mockResolvedValueOnce({ percent: 60 })
      .mockResolvedValueOnce({ percent: 60 })
      .mockResolvedValueOnce({ percent: 70 })
      .mockResolvedValueOnce({ percent: 30 });

    const config = await runClientWizard(null, projects);

    expect(config.split).toEqual({ '938': 70, '952': 30 });
    expect(inquirer.prompt).toHaveBeenCalledTimes(5);
  });

  it('builds a switch config from before/after/date answers', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ mode: 'switch' })
      .mockResolvedValueOnce({ beforeProjectId: '938' })
      .mockResolvedValueOnce({ afterProjectId: '952' })
      .mockResolvedValueOnce({ lastDateWithBefore: '2026-06-30' });

    const config = await runClientWizard(null, projects);

    expect(config).toEqual({
      mode: 'switch',
      knownProjectIds: ['938', '952'],
      projectNames: { '938': 'Truvify', '952': 'Acme Corp' },
      split: null,
      switch: { beforeProjectId: '938', afterProjectId: '952', lastDateWithBefore: '2026-06-30' },
    });
  });
});
