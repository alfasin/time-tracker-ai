import { z } from 'zod';
import { TimeTrackerAPIClient } from '../api-client.js';

export const getReportsSchema = z.object({
  date: z.string().optional().describe('Single date in yyyy-mm-dd format to get daily reports'),
  startDate: z.string().optional().describe('Start date in yyyy-mm-dd format for date range query'),
  endDate: z.string().optional().describe('End date in yyyy-mm-dd format for date range query'),
  yearMonth: z.string().optional().describe('Year and month in yyyy-mm format (alternative to date range)'),
});

export async function getReportsTool(
  args: z.infer<typeof getReportsSchema>,
  client: TimeTrackerAPIClient
) {
  try {
    let response;

    // Single date query
    if (args.date) {
      response = await client.getReports(args.date);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                queryType: 'single-day',
                date: args.date,
                data: response,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Year-month query
    if (args.yearMonth) {
      response = await client.getUserReportsByMonth(args.yearMonth);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                queryType: 'month',
                yearMonth: args.yearMonth,
                data: response,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Date range query
    if (args.startDate && args.endDate) {
      response = await client.getUserReports(args.startDate, args.endDate);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                queryType: 'date-range',
                startDate: args.startDate,
                endDate: args.endDate,
                data: response,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error('Must provide either date, yearMonth, or startDate+endDate');
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
