import { z } from 'zod';
import { TimeTrackerAPIClient } from '../api-client.js';

export const loginSchema = z.object({
  email: z.string().email().describe('User email address'),
  password: z.string().describe('User password'),
});

export async function loginTool(
  args: z.infer<typeof loginSchema>,
  client: TimeTrackerAPIClient
) {
  try {
    const response = await client.login(args.email, args.password);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              token: response.token,
              message: 'Successfully authenticated with Time Tracker API',
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
