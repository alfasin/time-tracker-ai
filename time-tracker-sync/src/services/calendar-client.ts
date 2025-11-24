import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CalendarEvent } from '../types.js';

export class CalendarClient {
  private client: Client | null = null;

  async connect(command: string, args: string[]): Promise<void> {
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
      command,
      args,
      env: process.env.GOOGLE_OAUTH_CREDENTIALS
        ? ({
            ...process.env,
            GOOGLE_OAUTH_CREDENTIALS: process.env.GOOGLE_OAUTH_CREDENTIALS,
          } as Record<string, string>)
        : (process.env as Record<string, string>),
    });

    await this.client.connect(transport);
  }

  async listEvents(
    calendarId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarEvent[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      // Try to call the list events tool
      const result = await this.client.callTool({
        name: 'list-events',
        arguments: {
          calendarId,
          timeMin: startDate,
          timeMax: endDate,
        },
      });

      // Check if there's an error in the response
      if ((result as any).isError) {
        const errorText = (result.content as any)[0].text;
        throw new Error(`Calendar MCP error: ${errorText}`);
      }

      // Parse the result - the content should be text with JSON
      const content = (result.content as any)[0];

      if (content.type === 'text') {
        try {
          const response = JSON.parse(content.text);
          return response.items || response.events || response || [];
        } catch (parseError) {
          console.error('Failed to parse calendar response:', content.text);
          throw new Error(`Invalid JSON response from calendar: ${content.text.substring(0, 100)}`);
        }
      }

      throw new Error('Unexpected content type from calendar MCP');
    } catch (error: any) {
      console.error('Error listing events:', error.message);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}
