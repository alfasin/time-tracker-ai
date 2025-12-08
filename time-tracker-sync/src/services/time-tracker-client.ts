import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { TimeEntry } from '../types.js';

export class TimeTrackerClient {
  private client: Client | null = null;
  private token: string | null = null;

  async connect(mcpPath: string): Promise<void> {
    this.client = new Client(
      {
        name: 'time-tracker-sync',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: [mcpPath],
    });

    await this.client.connect(transport);
  }

  async login(email: string, password: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'time_tracker_login',
      arguments: {
        email,
        password,
      },
    });

    const response = JSON.parse((result.content as any)[0].text);
    if (response.success) {
      this.token = response.token;
    } else {
      throw new Error(`Login failed: ${response.error}`);
    }
  }

  async addTime(entry: TimeEntry): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'time_tracker_add_time',
      arguments: {
        date: entry.date,
        project: entry.project,
        task: entry.task,
        duration: entry.duration,
        note: entry.note,
      },
    });

    const response = JSON.parse((result.content as any)[0].text);
    if (!response.success) {
      throw new Error(`Add time failed: ${response.error}`);
    }
    return response;
  }

  async getReports(date: string): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'time_tracker_get_reports',
      arguments: {
        date,
      },
    });

    const response = JSON.parse((result.content as any)[0].text);
    if (!response.success) {
      throw new Error(`Get reports failed: ${response.error}`);
    }
    return response.data;
  }

  async getUserReportsByMonth(yearMonth: string): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'time_tracker_get_reports',
      arguments: {
        yearMonth,
      },
    });

    const response = JSON.parse((result.content as any)[0].text);
    if (!response.success) {
      throw new Error(`Get reports failed: ${response.error}`);
    }
    return response.data;
  }

  async getProjects(): Promise<any> {
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
    return response.data;
  }

  async deleteTime(id: number): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'time_tracker_delete_time',
      arguments: {
        id: String(id),
      },
    });

    const response = JSON.parse((result.content as any)[0].text);
    if (!response.success) {
      throw new Error(`Delete time failed: ${response.error}`);
    }
    return response;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}
