import { z } from 'zod';
import { TimeTrackerAPIClient } from '../api-client.js';

export const deleteTimeSchema = z.object({
  id: z.string().describe('Time report ID to delete'),
});

export async function deleteTimeTool(
  args: z.infer<typeof deleteTimeSchema>,
  client: TimeTrackerAPIClient
) {
  try {
    const response = await client.deleteTime(args.id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Time entry deleted successfully',
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
