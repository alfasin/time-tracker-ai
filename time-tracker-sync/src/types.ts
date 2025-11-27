export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  organizer?: {
    email: string;
  };
  attendees?: Array<{
    email: string;
  }>;
}

export interface TimeEntry {
  date: string; // yyyy-mm-dd
  project: string;
  task: string;
  duration: string;
  note: string;
  type: 'meeting' | 'vacation' | 'client';
}

export interface DayCalculation {
  date: string;
  isHoliday: boolean;
  isWFO: boolean;
  hasVacation: boolean;
  meetingHours: number;
  clientHours: number;
  entries: TimeEntry[];
}

export interface ExistingReport {
  id: number;
  project: string;
  task: string;
  date: string;
  duration: number;
  note: string;
}

export interface SyncConfig {
  timeTrackerEmail: string;
  timeTrackerPassword: string;
  googleCalendarId: string;
  googleHolidayCalendarId: string;
  timeTrackerMcpPath: string;
  googleCalendarMcpCommand: string;
  googleCalendarMcpArgs: string[];
}

// Project/Task constants
export const PROJECT_TIKAL = '14';

// TODO need to update
export const PROJECT_CLIENT_ID = '';

export const TASK_MEETING = '13';
export const TASK_VACATION = '8';
export const TASK_DEVELOPMENT = '5';

// Jewish holidays that count as vacation
export const VACATION_HOLIDAYS = [
  'Rosh Hashana',
  'Yom Kippur',
  'Sukkot', // First and last days only
  'Pesach', // Eve and day after
  'Yom HaAtzmaut',
];
