import inquirer from 'inquirer';
import type { ClientsConfig } from './client-config.js';
import type { Project } from '../types.js';

export async function runClientWizard(
  existingConfig: ClientsConfig | null,
  projects: Project[]
): Promise<ClientsConfig> {
  const knownProjectIds = Array.from(
    new Set([...(existingConfig?.knownProjectIds ?? []), ...projects.map((p) => p.id)])
  );
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const list = knownProjectIds.map((id) => ({
    id,
    name: nameById.get(id) ?? existingConfig?.projectNames[id] ?? id,
  }));
  const projectNames = Object.fromEntries(list.map((p) => [p.id, p.name]));

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'You have multiple client projects. How should client hours be billed?',
      choices: [
        { name: 'Split by a fixed percentage across clients', value: 'split' },
        { name: 'I switched from one client to another on a specific date', value: 'switch' },
      ],
    },
  ]);

  if (mode === 'switch') {
    const { beforeProjectId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'beforeProjectId',
        message: 'Which client were you working with BEFORE the switch?',
        choices: list.map((p) => ({ name: p.name, value: p.id })),
      },
    ]);

    const { afterProjectId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'afterProjectId',
        message: 'Which client are you working with AFTER the switch?',
        choices: list.filter((p) => p.id !== beforeProjectId).map((p) => ({ name: p.name, value: p.id })),
      },
    ]);

    const { lastDateWithBefore } = await inquirer.prompt([
      {
        type: 'input',
        name: 'lastDateWithBefore',
        message: 'Last date (YYYY-MM-DD) you worked with that client:',
        validate: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) || 'Enter a date as YYYY-MM-DD',
      },
    ]);

    return {
      mode: 'switch',
      knownProjectIds: list.map((p) => p.id),
      projectNames,
      split: null,
      switch: { beforeProjectId, afterProjectId, lastDateWithBefore },
    };
  }

  let split: Record<string, number>;
  for (;;) {
    split = {};
    for (const project of list) {
      const defaultPercent = existingConfig?.split?.[project.id] ?? 0;
      const { percent } = await inquirer.prompt([
        {
          type: 'number',
          name: 'percent',
          message: `Percentage of client hours for ${project.name} (id ${project.id}):`,
          default: defaultPercent,
          validate: (value: number) => (value >= 0 && value <= 100) || 'Enter a number between 0 and 100',
        },
      ]);
      split[project.id] = percent;
    }

    const total = Object.values(split).reduce((sum, value) => sum + value, 0);
    if (total === 100) {
      break;
    }
    console.log(`Percentages must sum to 100 (got ${total}). Please re-enter.`);
  }

  return {
    mode: 'split',
    knownProjectIds: list.map((p) => p.id),
    projectNames,
    split,
    switch: null,
  };
}
