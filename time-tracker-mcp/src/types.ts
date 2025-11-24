export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface AddTimeRequest {
  date: string; // yyyy-mm-dd
  project: string;
  task: string;
  start?: string; // hh:mm or empty
  finish?: string; // hh:mm or empty
  duration?: string; // hours as string
  note?: string;
}

export interface TimeReport {
  id: number;
  project: string;
  task: string;
  date: string;
  start: string;
  finish: string;
  note: string;
  duration: number; // hours
}

export interface GetReportsResponse {
  reports: TimeReport[];
  dayTotal: string;
  monthTotal: string;
  quota: string;
  remainingQuota: string;
}

export interface UserReportsResponse extends Array<TimeReport> {}

export interface EditTimeRequest extends AddTimeRequest {
  id: string;
}

export interface DeleteTimeRequest {
  id: string;
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  name: string;
}
