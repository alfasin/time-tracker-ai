#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TimeTrackerAPIClient } from './api-client.js';
import { loginSchema, loginTool } from './tools/login.js';
import { addTimeSchema, addTimeTool } from './tools/add-time.js';
import { getReportsSchema, getReportsTool } from './tools/get-reports.js';
import { getProjectsSchema, getProjectsTool } from './tools/get-projects.js';
import { deleteTimeSchema, deleteTimeTool } from './tools/delete-time.js';

// Initialize API client
const apiClient = new TimeTrackerAPIClient(
  process.env.TIME_TRACKER_API_URL || 'https://tt-api.tikalk.dev'
);

// Create MCP server
const server = new Server(
  {
    name: 'time-tracker-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'time_tracker_login',
        description:
          'Authenticate with the Time Tracker API and receive a JWT token. This must be called before using any other tools.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'User email address',
            },
            password: {
              type: 'string',
              description: 'User password',
            },
          },
          required: ['email', 'password'],
        },
      },
      {
        name: 'time_tracker_add_time',
        description:
          'Add a time entry to the time tracker. Provide either duration OR both start and finish times. Common project/task combinations: Tikal Meeting (project=14, task=13), Vacation (project=14, task=8), Truvify (project=938, task=5).',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in yyyy-mm-dd format (e.g., "2025-11-24")',
            },
            project: {
              type: 'string',
              description:
                'Project ID (e.g., "14" for Tikal, "938" for Truvify)',
            },
            task: {
              type: 'string',
              description:
                'Task ID (e.g., "13" for Meeting, "8" for Vacation, "5" for Development)',
            },
            duration: {
              type: 'string',
              description:
                'Duration in hours (e.g., "9", "0.5"). Use this OR start+finish',
            },
            start: {
              type: 'string',
              description:
                'Start time in hh:mm format (e.g., "09:00"). Use with finish, not duration',
            },
            finish: {
              type: 'string',
              description:
                'Finish time in hh:mm format (e.g., "18:00"). Use with start, not duration',
            },
            note: {
              type: 'string',
              description: 'Optional note for the time entry',
            },
          },
          required: ['date', 'project', 'task'],
        },
      },
      {
        name: 'time_tracker_get_reports',
        description:
          'Get time reports for a specific date, date range, or month. Use this to check existing time entries before adding new ones.',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'Single date in yyyy-mm-dd format to get daily reports',
            },
            startDate: {
              type: 'string',
              description:
                'Start date in yyyy-mm-dd format for date range query',
            },
            endDate: {
              type: 'string',
              description: 'End date in yyyy-mm-dd format for date range query',
            },
            yearMonth: {
              type: 'string',
              description:
                'Year and month in yyyy-mm format (e.g., "2025-11") - alternative to date range',
            },
          },
        },
      },
      {
        name: 'time_tracker_get_projects',
        description:
          'Get all available projects and tasks for the authenticated user. Use this to discover valid project and task IDs.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'time_tracker_delete_time',
        description:
          'Delete a time entry by its ID. Use this to remove incorrect or duplicate entries.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Time report ID to delete',
            },
          },
          required: ['id'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'time_tracker_login': {
        const validatedArgs = loginSchema.parse(args);
        return await loginTool(validatedArgs, apiClient);
      }

      case 'time_tracker_add_time': {
        const validatedArgs = addTimeSchema.parse(args);
        return await addTimeTool(validatedArgs, apiClient);
      }

      case 'time_tracker_get_reports': {
        const validatedArgs = getReportsSchema.parse(args);
        return await getReportsTool(validatedArgs, apiClient);
      }

      case 'time_tracker_get_projects': {
        const validatedArgs = getProjectsSchema.parse(args);
        return await getProjectsTool(validatedArgs, apiClient);
      }

      case 'time_tracker_delete_time': {
        const validatedArgs = deleteTimeSchema.parse(args);
        return await deleteTimeTool(validatedArgs, apiClient);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              details: error.response?.data || error.stack || null,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Time Tracker MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
