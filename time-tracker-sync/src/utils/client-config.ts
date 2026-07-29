import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface ClientAllocation {
  projectId: string;
  percent: number;
}

export interface ClientSwitchConfig {
  beforeProjectId: string;
  afterProjectId: string;
  lastDateWithBefore: string; // yyyy-mm-dd
}

export interface ClientsConfig {
  mode: 'split' | 'switch';
  knownProjectIds: string[];
  projectNames: Record<string, string>;
  split: Record<string, number> | null;
  switch: ClientSwitchConfig | null;
}

export function resolveClientsForDate(config: ClientsConfig, date: string): ClientAllocation[] {
  if (config.mode === 'switch') {
    const { beforeProjectId, afterProjectId, lastDateWithBefore } = config.switch!;
    const projectId = date <= lastDateWithBefore ? beforeProjectId : afterProjectId;
    return [{ projectId, percent: 100 }];
  }

  return config.knownProjectIds
    .map((projectId) => ({ projectId, percent: config.split![projectId] ?? 0 }))
    .filter((allocation) => allocation.percent > 0);
}

export function findNewProjectIds(config: ClientsConfig | null, liveProjectIds: string[]): string[] {
  const known = new Set(config?.knownProjectIds ?? []);
  return liveProjectIds.filter((id) => !known.has(id));
}

export function buildSingleClientConfig(projectId: string, projectName: string): ClientsConfig {
  return {
    mode: 'split',
    knownProjectIds: [projectId],
    projectNames: { [projectId]: projectName },
    split: { [projectId]: 100 },
    switch: null,
  };
}

export function percentsSumTo100(percents: Record<string, number>): boolean {
  const total = Object.values(percents).reduce((sum, value) => sum + value, 0);
  return total === 100;
}

export function loadClientsConfig(filePath: string): ClientsConfig | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ClientsConfig;
}

export function saveClientsConfig(filePath: string, config: ClientsConfig): void {
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
