import { PROJECT_TIKAL } from '../types.js';
import type { Project } from '../types.js';
import {
  loadClientsConfig,
  saveClientsConfig,
  findNewProjectIds,
  buildSingleClientConfig,
  type ClientsConfig,
} from './client-config.js';
import { runClientWizard } from './client-wizard.js';

export async function ensureClientsConfig(
  configPath: string,
  allProjects: Project[]
): Promise<ClientsConfig> {
  const projects = allProjects.filter((p) => p.id !== PROJECT_TIKAL);

  if (projects.length === 0) {
    throw new Error(
      'No client projects found in Time Tracker (only the Tikal project exists). Cannot determine client billing.'
    );
  }

  const existing = loadClientsConfig(configPath);

  if (!existing && projects.length === 1) {
    const config = buildSingleClientConfig(projects[0].id, projects[0].name);
    saveClientsConfig(configPath, config);
    return config;
  }

  const newIds = findNewProjectIds(existing, projects.map((p) => p.id));
  if (newIds.length > 0) {
    const config = await runClientWizard(existing, projects);
    saveClientsConfig(configPath, config);
    return config;
  }

  return existing!;
}
