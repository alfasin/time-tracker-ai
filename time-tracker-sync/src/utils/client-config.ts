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

export function activeProjectIds(config: ClientsConfig): string[] {
  if (config.mode === 'switch') {
    return [config.switch!.beforeProjectId, config.switch!.afterProjectId];
  }
  return Object.entries(config.split!)
    .filter(([, percent]) => percent > 0)
    .map(([projectId]) => projectId);
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

function invalidConfig(filePath: string, reason: string): never {
  throw new Error(`Invalid clients config at ${filePath}: ${reason}. Fix or delete the file and re-run.`);
}

function validateClientsConfig(filePath: string, parsed: any): asserts parsed is ClientsConfig {
  if (parsed === null || typeof parsed !== 'object') {
    invalidConfig(filePath, 'expected a JSON object');
  }
  if (parsed.mode !== 'split' && parsed.mode !== 'switch') {
    invalidConfig(filePath, `"mode" must be "split" or "switch"`);
  }
  if (!Array.isArray(parsed.knownProjectIds) || !parsed.knownProjectIds.every((id: any) => typeof id === 'string')) {
    invalidConfig(filePath, '"knownProjectIds" must be an array of strings');
  }
  if (parsed.projectNames === null || typeof parsed.projectNames !== 'object' || Array.isArray(parsed.projectNames)) {
    invalidConfig(filePath, '"projectNames" must be an object');
  }
  if (parsed.mode === 'split') {
    if (parsed.split === null || typeof parsed.split !== 'object' || Array.isArray(parsed.split)) {
      invalidConfig(filePath, '"split" must be an object when mode is "split"');
    }
  } else {
    const sw = parsed.switch;
    if (
      sw === null ||
      typeof sw !== 'object' ||
      typeof sw.beforeProjectId !== 'string' ||
      typeof sw.afterProjectId !== 'string' ||
      typeof sw.lastDateWithBefore !== 'string'
    ) {
      invalidConfig(
        filePath,
        '"switch" must be an object with string "beforeProjectId", "afterProjectId", and "lastDateWithBefore" fields when mode is "switch"'
      );
    }
  }
}

export function loadClientsConfig(filePath: string): ClientsConfig | null {
  if (!existsSync(filePath)) {
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error: any) {
    throw new Error(`Invalid clients config at ${filePath}: ${error.message}. Fix or delete the file and re-run.`);
  }

  validateClientsConfig(filePath, parsed);
  return parsed;
}

export function saveClientsConfig(filePath: string, config: ClientsConfig): void {
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
