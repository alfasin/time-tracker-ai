import { z } from 'zod';
import { TimeTrackerAPIClient } from '../api-client.js';

export const getProjectsSchema = z.object({});

export async function getProjectsTool(
  args: z.infer<typeof getProjectsSchema>,
  client: TimeTrackerAPIClient
) {
  try {
    const response = await client.getUserProjects();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Retrieved projects and tasks',
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
