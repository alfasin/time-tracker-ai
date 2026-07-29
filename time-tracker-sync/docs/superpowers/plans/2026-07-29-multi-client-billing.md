# Multi-Client Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded `PROJECT_CLIENT_ID` with dynamic discovery of client projects from Time Tracker, letting the user split client-billable hours by fixed percentage across clients or switch entirely from one client to another on a given date, persisted in `clients.config.json` and only re-prompted when the live project list actually changes.

**Architecture:** A new pure module (`client-config.ts`) owns the `ClientsConfig` data model, load/save, and the per-date resolution logic. A separate interactive module (`client-wizard.ts`) asks the user split-vs-switch questions via `inquirer`. A thin orchestrator (`client-reconciler.ts`) ties the two together: it diffs the live Time Tracker project list against the saved config and only invokes the wizard when something new appears. `SyncEngine` calls the reconciler once per run (after login) and threads the resulting `ClientsConfig` into `DayCalculator`, which now builds one `TimeEntry` per client allocation instead of one hardcoded entry.

**Tech Stack:** TypeScript (Node16/ESM), `inquirer` (already a dependency), `vitest` (new — this repo has no test suite yet).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-multi-client-billing-design.md` — follow it exactly; this plan implements it task-by-task.
- `PROJECT_TIKAL = '14'` is never a client project; always excluded from client discovery (`src/types.ts:61`).
- `TASK_DEVELOPMENT = '5'` stays a single global constant used for every client project's entries (confirmed valid platform-wide, no per-project task IDs).
- `WORKDAY_HOURS = 9` (`src/utils/day-calculator.ts:6`) is the full-day hour total split/allocated across clients.
- All intra-project imports use explicit `.js` extensions (Node16/NodeNext module resolution) even though source files are `.ts` — follow this pattern in every new file.
- `clients.config.json` lives at the `time-tracker-sync/` project root (resolved via `process.cwd()`) and must be added to the top-level `.gitignore` (`/Users/nir/dev/time-tracker-ai/.gitignore`) — it is user-specific state, not committed, same treatment as `.env`.
- No behavior change when only one client project exists: single-client accounts get a silently-generated 100% config and see no prompts, no `clients.config.json` diff noise, matching today's `PROJECT_CLIENT_ID` behavior exactly.
- This repo has no existing test suite; this plan introduces `vitest` for the new pure logic (`client-config.ts`, `client-wizard.ts`, `client-reconciler.ts`, and the `DayCalculator` changes). Wizard/integration behavior beyond that stays manually verified, per the spec's Testing section.

---

### Task 1: Shared `Project`/`Task` types and a typed `getProjects()`

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/time-tracker-client.ts`

**Interfaces:**
- Produces: `Project { id: string; name: string; tasks: Task[] }`, `Task { id: string; name: string }` — mirrors the shape already returned by the Time Tracker MCP's `time_tracker_get_projects` tool (see `time-tracker-mcp/src/types.ts:49-58`).
- Produces: `TimeTrackerClient.getProjects(): Promise<Project[]>` (was `Promise<any>`).

This task is a pure type addition with no new runtime behavior, so there's no failing-test step — verification is `tsc` compiling cleanly.

- [ ] **Step 1: Add the `Project`/`Task` interfaces to `src/types.ts`**

Add after the `ExistingReport` interface (`src/types.ts:41-48`):

```typescript
export interface Task {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
}
```

- [ ] **Step 2: Type `getProjects()` in `src/services/time-tracker-client.ts`**

Change the import at the top of the file:

```typescript
import type { TimeEntry, Project } from '../types.js';
```

Change the `getProjects` method (`src/services/time-tracker-client.ts:110-125`):

```typescript
  async getProjects(): Promise<Project[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'time_tracker_get_projects',
      arguments: {},
    });

    const response = JSON.parse((result.content as any)[0].text);
    if (!response.success) {
      throw new Error(`Get projects failed: ${response.error}`);
    }
    return response.data as Project[];
  }
```

- [ ] **Step 3: Verify the project builds**

Run: `npm run build`
Expected: compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/services/time-tracker-client.ts
git commit -m "Add shared Project/Task types and type getProjects()"
```

---

### Task 2: `client-config.ts` — data model, resolution logic, load/save

**Files:**
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `vitest.config.ts`
- Create: `src/utils/client-config.ts`
- Test: `src/utils/client-config.test.ts`

**Interfaces:**
- Produces: `ClientAllocation { projectId: string; percent: number }`
- Produces: `ClientSwitchConfig { beforeProjectId: string; afterProjectId: string; lastDateWithBefore: string }`
- Produces: `ClientsConfig { mode: 'split' | 'switch'; knownProjectIds: string[]; projectNames: Record<string, string>; split: Record<string, number> | null; switch: ClientSwitchConfig | null }`
- Produces: `resolveClientsForDate(config: ClientsConfig, date: string): ClientAllocation[]`
- Produces: `findNewProjectIds(config: ClientsConfig | null, liveProjectIds: string[]): string[]`
- Produces: `buildSingleClientConfig(projectId: string, projectName: string): ClientsConfig`
- Produces: `percentsSumTo100(percents: Record<string, number>): boolean`
- Produces: `loadClientsConfig(filePath: string): ClientsConfig | null`
- Produces: `saveClientsConfig(filePath: string, config: ClientsConfig): void`

- [ ] **Step 1: Add vitest**

```bash
npm install --save-dev vitest
```

Add to `package.json` `scripts`:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing tests**

Create `src/utils/client-config.test.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/utils/client-config.test.ts`
Expected: FAIL — `client-config.ts` does not exist yet (module not found).

- [ ] **Step 5: Implement `src/utils/client-config.ts`**

```typescript
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/utils/client-config.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/utils/client-config.ts src/utils/client-config.test.ts
git commit -m "Add ClientsConfig data model and per-date resolution logic"
```

---

### Task 3: `client-wizard.ts` — interactive split/switch prompts

**Files:**
- Create: `src/utils/client-wizard.ts`
- Test: `src/utils/client-wizard.test.ts`

**Interfaces:**
- Consumes: `ClientsConfig` from Task 2 (`src/utils/client-config.ts`); `Project` from Task 1 (`src/types.ts`).
- Produces: `runClientWizard(existingConfig: ClientsConfig | null, projects: Project[]): Promise<ClientsConfig>`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/client-wizard.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/client-wizard.test.ts`
Expected: FAIL — `client-wizard.ts` does not exist yet.

- [ ] **Step 3: Implement `src/utils/client-wizard.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/client-wizard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/client-wizard.ts src/utils/client-wizard.test.ts
git commit -m "Add interactive split/switch wizard for client configuration"
```

---

### Task 4: `client-reconciler.ts` — idempotent reconciliation entry point

**Files:**
- Create: `src/utils/client-reconciler.ts`
- Test: `src/utils/client-reconciler.test.ts`

**Interfaces:**
- Consumes: `loadClientsConfig`, `saveClientsConfig`, `findNewProjectIds`, `buildSingleClientConfig`, `ClientsConfig` (Task 2); `runClientWizard` (Task 3); `Project`, `PROJECT_TIKAL` (Task 1 / `src/types.ts`).
- Produces: `ensureClientsConfig(configPath: string, allProjects: Project[]): Promise<ClientsConfig>`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/client-reconciler.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/client-reconciler.test.ts`
Expected: FAIL — `client-reconciler.ts` does not exist yet.

- [ ] **Step 3: Implement `src/utils/client-reconciler.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/client-reconciler.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/client-reconciler.ts src/utils/client-reconciler.test.ts
git commit -m "Add idempotent client-config reconciliation against live Time Tracker projects"
```

---

### Task 5: Wire into `DayCalculator` and `SyncEngine`, remove `PROJECT_CLIENT_ID`

**Files:**
- Modify: `src/utils/day-calculator.ts`
- Test: `src/utils/day-calculator.test.ts`
- Modify: `src/sync-engine.ts`
- Modify: `src/types.ts` (remove `PROJECT_CLIENT_ID`)
- Modify: `/Users/nir/dev/time-tracker-ai/.gitignore` (top-level, one directory above `time-tracker-sync/`)

**Interfaces:**
- Consumes: `resolveClientsForDate`, `ClientsConfig` (Task 2); `ensureClientsConfig` (Task 4); `TimeTrackerClient.getProjects()` (Task 1).
- Produces: `DayCalculator.calculateDay(date: string, workEvents: CalendarEvent[], holidayEvents: CalendarEvent[], clientsConfig: ClientsConfig): DayCalculation` and `DayCalculator.calculateRange(startDate, endDate, workEvents, holidayEvents, clientsConfig: ClientsConfig): DayCalculation[]` (both signatures gain the trailing `clientsConfig` parameter).

- [ ] **Step 1: Write the failing tests**

Create `src/utils/day-calculator.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/day-calculator.test.ts`
Expected: FAIL — `calculateDay`/`calculateRange` don't accept a `clientsConfig` argument yet, and `PROJECT_CLIENT_ID` still hardcodes `'938'` for every entry with the old note wording.

- [ ] **Step 3: Update `src/utils/day-calculator.ts`**

Replace the import line (`src/utils/day-calculator.ts:1-4`):

```typescript
import type { CalendarEvent, DayCalculation, TimeEntry } from '../types.js';
import { PROJECT_TIKAL, TASK_MEETING, TASK_VACATION, TASK_DEVELOPMENT } from '../types.js';
import { HolidayDetector } from './holiday-detector.js';
import { EventClassifier, type ClassifiedEvent } from './event-classifier.js';
import { resolveClientsForDate, type ClientsConfig } from './client-config.js';
```

Change the `calculateDay` signature (`src/utils/day-calculator.ts:12-16`) and remove its `PROJECT_CLIENT_ID` guard (`src/utils/day-calculator.ts:17-19`):

```typescript
  static calculateDay(
    date: string,
    workEvents: CalendarEvent[],
    holidayEvents: CalendarEvent[],
    clientsConfig: ClientsConfig
  ): DayCalculation {
```

Add a private static helper (anywhere inside the `DayCalculator` class, e.g. just above `calculateDay`):

```typescript
  private static buildClientEntries(
    date: string,
    totalHours: number,
    clientsConfig: ClientsConfig,
    baseNote: string
  ): TimeEntry[] {
    const allocations = resolveClientsForDate(clientsConfig, date);
    return allocations.map(({ projectId, percent }) => ({
      date,
      project: projectId,
      task: TASK_DEVELOPMENT,
      duration: String(Math.round(((totalHours * percent) / 100) * 100) / 100),
      note:
        allocations.length > 1
          ? `${baseNote} (${clientsConfig.projectNames[projectId] ?? projectId} - ${percent}%)`
          : baseNote,
      type: 'client',
    }));
  }
```

Replace the WFO branch's entries (`src/utils/day-calculator.ts:60-79`):

```typescript
    const hasWFO = classified.some((c) => c.type === 'wfo');
    if (hasWFO) {
      return {
        date,
        isHoliday: false,
        isWFO: true,
        hasVacation: false,
        meetingHours: 0,
        clientHours: WORKDAY_HOURS,
        entries: this.buildClientEntries(date, WORKDAY_HOURS, clientsConfig, 'Working from clients office'),
      };
    }
```

Replace the normal-day client entry block (`src/utils/day-calculator.ts:123-133`):

```typescript
    // Add client entries for remaining hours, split across configured clients
    if (clientHours > 0) {
      entries.push(...this.buildClientEntries(date, clientHours, clientsConfig, 'Development work'));
    }
```

Update `calculateRange` (`src/utils/day-calculator.ts:149-169`) to accept and forward `clientsConfig`, and drop its own `PROJECT_CLIENT_ID` guard:

```typescript
  static calculateRange(
    startDate: string,
    endDate: string,
    workEvents: CalendarEvent[],
    holidayEvents: CalendarEvent[],
    clientsConfig: ClientsConfig
  ): DayCalculation[] {
    const calculations: DayCalculation[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      calculations.push(this.calculateDay(dateStr, workEvents, holidayEvents, clientsConfig));
    }

    return calculations;
  }
```

- [ ] **Step 4: Remove `PROJECT_CLIENT_ID` from `src/types.ts`**

Delete these lines (`src/types.ts:63-64`):

```typescript
// TODO need to update
export const PROJECT_CLIENT_ID = '938';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/day-calculator.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Wire reconciliation into `SyncEngine`**

Add to the imports at the top of `src/sync-engine.ts`:

```typescript
import { resolve } from 'node:path';
import { ensureClientsConfig } from './utils/client-reconciler.js';
import type { ClientsConfig } from './utils/client-config.js';
```

Add a private field to the class (`src/sync-engine.ts:9-11`):

```typescript
  private clientsConfig!: ClientsConfig;
```

At the end of `initialize()` (`src/sync-engine.ts:19-40`, after the existing login block), add:

```typescript
    // Discover client projects and resolve billing configuration
    console.log('Checking client configuration...');
    const projects = await this.ttClient.getProjects();
    this.clientsConfig = await ensureClientsConfig(
      resolve(process.cwd(), 'clients.config.json'),
      projects
    );
    console.log(`✓ Client billing mode: ${this.clientsConfig.mode}`);
```

Update the `calculateRange` call in `syncMonth` (`src/sync-engine.ts:73-78`):

```typescript
    const calculations = DayCalculator.calculateRange(
      startDate,
      endDate,
      workEvents,
      holidayEvents,
      this.clientsConfig
    );
```

Update the `calculateDay` call in `syncDate` (`src/sync-engine.ts:177`):

```typescript
    const calculation = DayCalculator.calculateDay(date, workEvents, holidayEvents, this.clientsConfig);
```

- [ ] **Step 7: Add `clients.config.json` to the top-level `.gitignore`**

Modify `/Users/nir/dev/time-tracker-ai/.gitignore`, in the "Environment files" section:

```
# Environment files
.env
.env.local
.env.*.local

# Client billing configuration (user-specific, not committed)
time-tracker-sync/clients.config.json
```

- [ ] **Step 8: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/utils/day-calculator.ts src/utils/day-calculator.test.ts src/sync-engine.ts src/types.ts ../.gitignore
git commit -m "Resolve client billing dynamically per day instead of hardcoded PROJECT_CLIENT_ID"
```

- [ ] **Step 10: Manual verification**

This project has no automated coverage for the MCP-integrated wizard/reconciliation flow end to end (per the spec's Testing section) — verify manually against a real Time Tracker account:

1. Run `npm run sync -- --month <a month you've already synced>` with today's single client project. Confirm no prompt appears and `clients.config.json` is created silently with `{"mode":"split","split":{"<id>":100}}`.
2. Manually edit (or have Time Tracker expose) a second client project, run `npm run sync` again. Confirm the split/switch wizard runs, and that entries submitted match the chosen percentages or switch date.
3. Run `npm run sync` a third time with no project changes. Confirm no prompt appears and `clients.config.json` is untouched (check its mtime/contents don't change).

---

## Self-Review

**Spec coverage:**
- Data model (`clients.config.json` shape) → Task 2.
- Reconciliation flow (steps 1–6 in the spec) → Task 4 (`ensureClientsConfig`), wired in Task 5 Step 6.
- Wizard (split percentages, switch before/after/date) → Task 3.
- `resolveClientsForDate` (split and switch resolution) → Task 2.
- `DayCalculator` applying resolved allocations to normal-day and WFO hours, note formatting → Task 5.
- Removal of `PROJECT_CLIENT_ID` → Task 5 Step 4.
- `clients.config.json` gitignored → Task 5 Step 7.
- Error handling (0 client projects, corrupt config, percentage/date validation) → Task 4 Step 3 (0-projects throw), Task 3 Step 3 (inquirer validators), `loadClientsConfig`'s `JSON.parse` naturally throws on corrupt files with a stack pointing at the file path.
- Manual testing note (no existing suite, MCP-integrated flow verified by hand) → Task 5 Step 10.

**Type consistency:** `ClientsConfig`, `ClientAllocation`, `ClientSwitchConfig` (Task 2) are used identically by name and shape in Tasks 3, 4, and 5. `resolveClientsForDate`, `findNewProjectIds`, `buildSingleClientConfig`, `loadClientsConfig`, `saveClientsConfig` signatures match between their Task 2 definition and every later consumer. `runClientWizard(existingConfig, projects)` matches between Task 3's definition and Task 4's call site. `ensureClientsConfig(configPath, allProjects)` matches between Task 4's definition and Task 5's `SyncEngine` call site. `DayCalculator.calculateDay`/`calculateRange`'s new trailing `clientsConfig` parameter is consistent across Task 5's implementation, tests, and `SyncEngine` call sites.
