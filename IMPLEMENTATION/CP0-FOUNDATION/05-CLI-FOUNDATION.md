# Step 05: CLI Foundation

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04f-AI-PROVIDER.md
> **Next Step:** 06-PERSISTENCE-LAYER.md
> **Architecture Reference:** `ARCHITECTURE.md` - CLI Interface

---

## Overview

The **CLI Foundation** provides the command-line interface for Aigentflow, serving as a thin wrapper around the NestJS API. This enables developers to interact with the orchestrator from their terminal while maintaining a consistent API-first architecture.

The CLI supports both **local mode** (direct execution) and **remote mode** (API calls), with the API provider abstraction from Step 04f enabling seamless switching between Claude CLI and Anthropic API backends.

---

## Key Principles

1. **API-First**: CLI wraps API endpoints, not direct execution
2. **Dual Mode**: Support both local and remote operation
3. **Developer Experience**: Rich output, progress indicators, interactive prompts
4. **Configuration**: Hierarchical config (global → project → environment)
5. **Extensibility**: Plugin architecture for custom commands

---

## Deliverables

1. `apps/cli/src/index.ts` - CLI entry point
2. `apps/cli/src/commands/` - Command implementations
3. `apps/cli/src/client/api-client.ts` - HTTP client for API communication
4. `apps/cli/src/config/` - Configuration management
5. `apps/cli/src/output/` - Output formatters (table, JSON, streaming)
6. `apps/cli/src/prompts/` - Interactive prompts

---

## 1. CLI Structure

### 1.1 Package Configuration

```json
// apps/cli/package.json
{
  "name": "@aigentflow/cli",
  "version": "0.1.0",
  "bin": {
    "aigentflow": "./bin/aigentflow.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "inquirer": "^9.2.0",
    "conf": "^12.0.0",
    "got": "^14.0.0",
    "eventsource": "^2.0.0"
  }
}
```

### 1.2 Entry Point

```typescript
// apps/cli/src/index.ts

import { Command } from 'commander';
import { version } from '../package.json';
import { runCommand } from './commands/run';
import { statusCommand } from './commands/status';
import { configCommand } from './commands/config';
import { approveCommand } from './commands/approve';
import { initCommand } from './commands/init';
import { loadConfig } from './config/loader';

const program = new Command();

program
  .name('aigentflow')
  .description('AI-powered development orchestrator')
  .version(version);

// Load configuration
const config = loadConfig();

// Register commands
program.addCommand(initCommand);
program.addCommand(runCommand(config));
program.addCommand(statusCommand(config));
program.addCommand(configCommand);
program.addCommand(approveCommand(config));

program.parse();
```

---

## 2. Core Commands

### 2.1 Run Command

```typescript
// apps/cli/src/commands/run.ts

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client/api-client';
import { StreamHandler } from '../output/stream-handler';
import { Config } from '../config/types';

export function runCommand(config: Config): Command {
  const cmd = new Command('run')
    .description('Run the orchestrator with a prompt')
    .argument('<prompt>', 'The task prompt')
    .option('-p, --project <path>', 'Project directory', process.cwd())
    .option('-m, --mode <mode>', 'Execution mode (local|remote)', 'local')
    .option('--no-stream', 'Disable streaming output')
    .option('--json', 'Output as JSON')
    .action(async (prompt, options) => {
      const spinner = ora('Starting orchestrator...').start();

      try {
        const client = new ApiClient(config, options.mode);

        // Create task
        const task = await client.createTask({
          prompt,
          projectPath: options.project,
        });

        spinner.succeed(`Task created: ${task.id}`);

        if (options.stream !== false) {
          // Stream agent activity
          const handler = new StreamHandler(options.json);
          await handler.connect(task.id);
          await handler.waitForCompletion();
        } else {
          // Poll for completion
          await pollForCompletion(client, task.id);
        }

        console.log(chalk.green('\n✓ Task completed'));
      } catch (error) {
        spinner.fail('Task failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  return cmd;
}

async function pollForCompletion(client: ApiClient, taskId: string): Promise<void> {
  const spinner = ora('Processing...').start();

  while (true) {
    const status = await client.getTaskStatus(taskId);

    if (status.state === 'completed') {
      spinner.succeed('Processing complete');
      return;
    }

    if (status.state === 'failed') {
      spinner.fail('Processing failed');
      throw new Error(status.error);
    }

    if (status.state === 'awaiting_approval') {
      spinner.info('Awaiting approval');
      console.log(chalk.yellow('Run: aigentflow approve ' + taskId));
      return;
    }

    spinner.text = `Processing... (${status.currentAgent || 'orchestrator'})`;
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

### 2.2 Status Command

```typescript
// apps/cli/src/commands/status.ts

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../client/api-client';
import { formatTable } from '../output/table';
import { Config } from '../config/types';

export function statusCommand(config: Config): Command {
  const cmd = new Command('status')
    .description('Check task or project status')
    .argument('[taskId]', 'Task ID (optional, shows project status if omitted)')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      const client = new ApiClient(config);

      if (taskId) {
        // Show specific task status
        const task = await client.getTaskStatus(taskId);

        if (options.json) {
          console.log(JSON.stringify(task, null, 2));
        } else {
          printTaskStatus(task);
        }
      } else {
        // Show project status
        const tasks = await client.listTasks({ limit: 10 });

        if (options.json) {
          console.log(JSON.stringify(tasks, null, 2));
        } else {
          printTaskList(tasks);
        }
      }
    });

  return cmd;
}

function printTaskStatus(task: any): void {
  console.log(chalk.bold('\nTask Status'));
  console.log('─'.repeat(40));
  console.log(`ID:      ${task.id}`);
  console.log(`State:   ${formatState(task.state)}`);
  console.log(`Agent:   ${task.currentAgent || 'N/A'}`);
  console.log(`Created: ${new Date(task.createdAt).toLocaleString()}`);

  if (task.artifacts?.length > 0) {
    console.log(chalk.bold('\nArtifacts:'));
    for (const artifact of task.artifacts) {
      console.log(`  - ${artifact.type}: ${artifact.path}`);
    }
  }
}

function printTaskList(tasks: any[]): void {
  console.log(chalk.bold('\nRecent Tasks'));
  console.log('─'.repeat(60));

  const rows = tasks.map(t => ({
    ID: t.id.substring(0, 8),
    State: formatState(t.state),
    Prompt: t.prompt.substring(0, 30) + '...',
    Created: new Date(t.createdAt).toLocaleDateString(),
  }));

  console.log(formatTable(rows));
}

function formatState(state: string): string {
  const colors: Record<string, typeof chalk> = {
    pending: chalk.gray,
    running: chalk.blue,
    awaiting_approval: chalk.yellow,
    completed: chalk.green,
    failed: chalk.red,
  };
  return (colors[state] || chalk.white)(state);
}
```

### 2.3 Approve Command

```typescript
// apps/cli/src/commands/approve.ts

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ApiClient } from '../client/api-client';
import { Config } from '../config/types';

export function approveCommand(config: Config): Command {
  const cmd = new Command('approve')
    .description('Approve or reject a pending task')
    .argument('<taskId>', 'Task ID')
    .option('--yes', 'Auto-approve without prompting')
    .option('--reject', 'Reject the task')
    .option('-m, --message <message>', 'Approval/rejection message')
    .action(async (taskId, options) => {
      const client = new ApiClient(config);

      // Get current task state
      const task = await client.getTaskStatus(taskId);

      if (task.state !== 'awaiting_approval') {
        console.log(chalk.yellow(`Task is not awaiting approval (state: ${task.state})`));
        return;
      }

      // Show what needs approval
      console.log(chalk.bold('\nPending Approval'));
      console.log('─'.repeat(40));
      console.log(`Task: ${task.prompt}`);
      console.log(`Agent: ${task.currentAgent}`);

      if (task.pendingApproval?.artifacts) {
        console.log(chalk.bold('\nArtifacts to approve:'));
        for (const artifact of task.pendingApproval.artifacts) {
          console.log(`  - ${artifact.type}: ${artifact.path}`);
        }
      }

      let approved = options.yes;
      let rejected = options.reject;

      if (!approved && !rejected) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'decision',
            message: 'What would you like to do?',
            choices: [
              { name: 'Approve', value: 'approve' },
              { name: 'Reject', value: 'reject' },
              { name: 'View Details', value: 'details' },
              { name: 'Cancel', value: 'cancel' },
            ],
          },
        ]);

        if (answer.decision === 'cancel') {
          return;
        }

        if (answer.decision === 'details') {
          // Show full artifact content
          for (const artifact of task.pendingApproval?.artifacts || []) {
            console.log(chalk.bold(`\n${artifact.path}:`));
            console.log(artifact.content);
          }
          return;
        }

        approved = answer.decision === 'approve';
        rejected = answer.decision === 'reject';
      }

      // Send decision
      await client.submitApproval(taskId, {
        approved,
        message: options.message,
      });

      if (approved) {
        console.log(chalk.green('\n✓ Task approved, continuing execution...'));
      } else {
        console.log(chalk.yellow('\n✗ Task rejected'));
      }
    });

  return cmd;
}
```

---

## 3. API Client

### 3.1 HTTP Client Implementation

```typescript
// apps/cli/src/client/api-client.ts

import got, { Got } from 'got';
import { Config } from '../config/types';

export interface CreateTaskInput {
  prompt: string;
  projectPath?: string;
  config?: Record<string, unknown>;
}

export interface TaskStatus {
  id: string;
  state: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed';
  prompt: string;
  currentAgent?: string;
  artifacts?: Array<{ type: string; path: string; content?: string }>;
  pendingApproval?: {
    reason: string;
    artifacts?: Array<{ type: string; path: string; content: string }>;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class ApiClient {
  private client: Got;
  private mode: 'local' | 'remote';

  constructor(config: Config, mode: 'local' | 'remote' = 'local') {
    this.mode = mode;

    const baseUrl = mode === 'local'
      ? `http://localhost:${config.api.port}`
      : config.api.remoteUrl;

    this.client = got.extend({
      prefixUrl: baseUrl,
      headers: {
        'Authorization': `Bearer ${config.api.token}`,
        'Content-Type': 'application/json',
      },
      responseType: 'json',
      timeout: { request: 30000 },
    });
  }

  async createTask(input: CreateTaskInput): Promise<{ id: string }> {
    const response = await this.client.post('api/v1/tasks', {
      json: input,
    }).json<{ id: string }>();

    return response;
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    return this.client.get(`api/v1/tasks/${taskId}`).json<TaskStatus>();
  }

  async listTasks(options: { limit?: number } = {}): Promise<TaskStatus[]> {
    return this.client.get('api/v1/tasks', {
      searchParams: { limit: options.limit || 10 },
    }).json<TaskStatus[]>();
  }

  async submitApproval(taskId: string, decision: { approved: boolean; message?: string }): Promise<void> {
    await this.client.post(`api/v1/tasks/${taskId}/approve`, {
      json: decision,
    });
  }

  getStreamUrl(taskId: string): string {
    const baseUrl = this.mode === 'local'
      ? `http://localhost:${process.env.API_PORT || 3000}`
      : process.env.API_REMOTE_URL;

    return `${baseUrl}/api/v1/tasks/${taskId}/stream`;
  }
}
```

### 3.2 SSE Stream Handler

```typescript
// apps/cli/src/output/stream-handler.ts

import EventSource from 'eventsource';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

interface AgentEvent {
  type: 'agent_start' | 'agent_message' | 'agent_complete' | 'task_complete' | 'approval_required' | 'error';
  agentId?: string;
  message?: string;
  artifacts?: Array<{ type: string; path: string }>;
  error?: string;
  timestamp: string;
}

export class StreamHandler {
  private eventSource?: EventSource;
  private spinner?: Ora;
  private jsonMode: boolean;
  private resolveCompletion?: () => void;
  private rejectCompletion?: (error: Error) => void;

  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode;
  }

  async connect(taskId: string): Promise<void> {
    const url = `${process.env.API_URL || 'http://localhost:3000'}/api/v1/tasks/${taskId}/stream`;

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      const data: AgentEvent = JSON.parse(event.data);
      this.handleEvent(data);
    };

    this.eventSource.onerror = (error) => {
      this.spinner?.fail('Connection error');
      this.rejectCompletion?.(new Error('Stream connection failed'));
    };
  }

  async waitForCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.resolveCompletion = resolve;
      this.rejectCompletion = reject;
    });
  }

  private handleEvent(event: AgentEvent): void {
    if (this.jsonMode) {
      console.log(JSON.stringify(event));
      return;
    }

    switch (event.type) {
      case 'agent_start':
        this.spinner?.stop();
        this.spinner = ora(`${this.formatAgent(event.agentId)} working...`).start();
        break;

      case 'agent_message':
        this.spinner?.stop();
        console.log(`${this.formatAgent(event.agentId)}: ${event.message}`);
        this.spinner?.start();
        break;

      case 'agent_complete':
        this.spinner?.succeed(`${this.formatAgent(event.agentId)} complete`);
        if (event.artifacts?.length) {
          for (const a of event.artifacts) {
            console.log(chalk.dim(`  → ${a.type}: ${a.path}`));
          }
        }
        break;

      case 'approval_required':
        this.spinner?.info('Approval required');
        console.log(chalk.yellow(`\nRun: aigentflow approve <taskId>`));
        this.disconnect();
        this.resolveCompletion?.();
        break;

      case 'task_complete':
        this.spinner?.succeed('Task complete');
        this.disconnect();
        this.resolveCompletion?.();
        break;

      case 'error':
        this.spinner?.fail(`Error: ${event.error}`);
        this.disconnect();
        this.rejectCompletion?.(new Error(event.error));
        break;
    }
  }

  private formatAgent(agentId?: string): string {
    const colors: Record<string, typeof chalk> = {
      orchestrator: chalk.magenta,
      project_manager: chalk.blue,
      architect: chalk.cyan,
      ui_designer: chalk.yellow,
      frontend_dev: chalk.green,
      backend_dev: chalk.red,
      tester: chalk.gray,
      reviewer: chalk.white,
    };

    const name = agentId || 'unknown';
    const color = colors[name] || chalk.white;
    return color(`[${name}]`);
  }

  private disconnect(): void {
    this.eventSource?.close();
    this.eventSource = undefined;
  }
}
```

---

## 4. Configuration Management

### 4.1 Configuration Loader

```typescript
// apps/cli/src/config/loader.ts

import Conf from 'conf';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Config, ConfigSchema } from './types';

const globalConfig = new Conf<Partial<Config>>({
  projectName: 'aigentflow',
  schema: ConfigSchema as any,
});

export function loadConfig(): Config {
  // Start with defaults
  let config: Config = {
    api: {
      port: 3000,
      remoteUrl: 'https://api.aigentflow.io',
      token: '',
    },
    cli: {
      defaultMode: 'local',
      outputFormat: 'pretty',
      streamEnabled: true,
    },
    project: {
      path: process.cwd(),
    },
  };

  // Merge global config
  const global = globalConfig.store;
  config = deepMerge(config, global);

  // Merge project config (.aigentflow.json)
  const projectConfigPath = join(process.cwd(), '.aigentflow.json');
  if (existsSync(projectConfigPath)) {
    const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
    config = deepMerge(config, projectConfig);
  }

  // Merge environment variables
  if (process.env.AIGENTFLOW_API_PORT) {
    config.api.port = parseInt(process.env.AIGENTFLOW_API_PORT);
  }
  if (process.env.AIGENTFLOW_API_URL) {
    config.api.remoteUrl = process.env.AIGENTFLOW_API_URL;
  }
  if (process.env.AIGENTFLOW_API_TOKEN) {
    config.api.token = process.env.AIGENTFLOW_API_TOKEN;
  }

  return config;
}

export function saveGlobalConfig(updates: Partial<Config>): void {
  const current = globalConfig.store;
  globalConfig.store = deepMerge(current, updates) as Partial<Config>;
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] as any, source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}
```

### 4.2 Configuration Types

```typescript
// apps/cli/src/config/types.ts

export interface Config {
  api: {
    port: number;
    remoteUrl: string;
    token: string;
  };
  cli: {
    defaultMode: 'local' | 'remote';
    outputFormat: 'pretty' | 'json';
    streamEnabled: boolean;
  };
  project: {
    path: string;
  };
}

export const ConfigSchema = {
  api: {
    type: 'object',
    properties: {
      port: { type: 'number', default: 3000 },
      remoteUrl: { type: 'string' },
      token: { type: 'string' },
    },
  },
  cli: {
    type: 'object',
    properties: {
      defaultMode: { type: 'string', enum: ['local', 'remote'] },
      outputFormat: { type: 'string', enum: ['pretty', 'json'] },
      streamEnabled: { type: 'boolean' },
    },
  },
  project: {
    type: 'object',
    properties: {
      path: { type: 'string' },
    },
  },
};
```

---

## 5. Init Command

### 5.1 Project Initialization

```typescript
// apps/cli/src/commands/init.ts

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const initCommand = new Command('init')
  .description('Initialize a new Aigentflow project')
  .option('-y, --yes', 'Accept defaults without prompting')
  .action(async (options) => {
    const cwd = process.cwd();
    const configPath = join(cwd, '.aigentflow.json');

    if (existsSync(configPath) && !options.yes) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Project already initialized. Overwrite?',
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Initialization cancelled'));
        return;
      }
    }

    let config: Record<string, unknown> = {
      name: require(join(cwd, 'package.json')).name || 'my-project',
      version: '1.0.0',
    };

    if (!options.yes) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          default: config.name,
        },
        {
          type: 'list',
          name: 'type',
          message: 'Project type:',
          choices: ['web', 'api', 'fullstack', 'library'],
        },
        {
          type: 'checkbox',
          name: 'agents',
          message: 'Enable agents:',
          choices: [
            { name: 'UI Designer', value: 'ui_designer', checked: true },
            { name: 'Frontend Developer', value: 'frontend_dev', checked: true },
            { name: 'Backend Developer', value: 'backend_dev', checked: true },
            { name: 'Tester', value: 'tester', checked: true },
            { name: 'Reviewer', value: 'reviewer', checked: true },
          ],
        },
      ]);

      config = { ...config, ...answers };
    }

    // Create .aigentflow.json
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.green('✓ Created .aigentflow.json'));

    // Create .aigentflow directory for local state
    const stateDir = join(cwd, '.aigentflow');
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir);
      console.log(chalk.green('✓ Created .aigentflow/ directory'));
    }

    // Add to .gitignore
    const gitignorePath = join(cwd, '.gitignore');
    const gitignoreEntry = '\n# Aigentflow\n.aigentflow/\n';

    if (existsSync(gitignorePath)) {
      const content = require('fs').readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('.aigentflow/')) {
        require('fs').appendFileSync(gitignorePath, gitignoreEntry);
        console.log(chalk.green('✓ Updated .gitignore'));
      }
    }

    console.log(chalk.bold('\nProject initialized!'));
    console.log(chalk.dim('Run `aigentflow run "your prompt"` to start'));
  });
```

---

## Validation Checklist

```
□ CLI Foundation (Step 05)
  □ Commander.js CLI structure works
  □ `aigentflow --version` shows version
  □ `aigentflow init` creates project config
  □ `aigentflow run` creates task via API
  □ `aigentflow status` shows task/project status
  □ `aigentflow approve` handles approval flow
  □ SSE streaming displays agent activity
  □ JSON output mode works
  □ Configuration hierarchy (global → project → env)
  □ Local and remote modes work
  □ Error handling with helpful messages
  □ Interactive prompts work
  □ Tests pass
```

---

## Next Step

Proceed to **06-PERSISTENCE-LAYER.md** to implement PostgreSQL repositories and data access patterns.
