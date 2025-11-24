import { z } from 'zod';
import { TimeTrackerAPIClient } from '../api-client.js';

export const addTimeSchema = z.object({
  date: z.string().describe('Date in yyyy-mm-dd format'),
  project: z.string().describe('Project ID (e.g., "14" for Tikal, "938" for Truvify)'),
  task: z.string().describe('Task ID (e.g., "13" for Meeting, "8" for Vacation, "5" for Development)'),
  duration: z.string().optional().describe('Duration in hours (e.g., "9", "0.5"). Use this OR start+finish'),
  start: z.string().optional().describe('Start time in hh:mm format (e.g., "09:00"). Use with finish, not duration'),
  finish: z.string().optional().describe('Finish time in hh:mm format (e.g., "18:00"). Use with start, not duration'),
  note: z.string().optional().describe('Optional note for the time entry'),
});

export async function addTimeTool(
  args: z.infer<typeof addTimeSchema>,
  client: TimeTrackerAPIClient
) {
  try {
    // Validate that either duration OR (start+finish) is provided
    if (args.duration && (args.start || args.finish)) {
      throw new Error('Provide either duration OR start+finish, not both');
    }
    if (!args.duration && (!args.start || !args.finish)) {
      throw new Error('Must provide either duration OR both start and finish');
    }

    const response = await client.addTime({
      date: args.date,
      project: args.project,
      task: args.task,
      duration: args.duration || '',
      start: args.start || '',
      finish: args.finish || '',
      note: args.note || '',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Time entry added successfully',
              data: response,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              details: error.response?.data || null,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
