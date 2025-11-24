import axios, { AxiosInstance } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  AddTimeRequest,
  GetReportsResponse,
  UserReportsResponse,
  EditTimeRequest,
  DeleteTimeRequest,
  Project,
} from './types.js';

export class TimeTrackerAPIClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(baseURL: string = 'https://tt-api.tikalk.dev') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getAuthHeaders() {
    if (!this.token) {
      throw new Error('Not authenticated. Please login first.');
    }
    return {
      Authorization: `Bearer ${this.token}`,
    };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/login', {
      email,
      password,
    });
    this.token = response.data.token;
    return response.data;
  }

  async addTime(request: AddTimeRequest): Promise<any> {
    const response = await this.client.post('/time/add', request, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getReports(date: string): Promise<GetReportsResponse> {
    const response = await this.client.get<GetReportsResponse>(
      `/time/reports`,
      {
        params: { date },
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async getUserReports(
    startDate: string,
    endDate: string
  ): Promise<UserReportsResponse> {
    const response = await this.client.get<UserReportsResponse>(
      `/user/reports`,
      {
        params: { startDate, endDate },
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async getUserReportsByMonth(yearMonth: string): Promise<UserReportsResponse> {
    const response = await this.client.get<UserReportsResponse>(
      `/user/reports`,
      {
        params: { yearMonth },
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async editTime(request: EditTimeRequest): Promise<any> {
    const response = await this.client.post('/time/edit', request, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async deleteTime(id: string): Promise<any> {
    const response = await this.client.post(
      '/time/delete',
      { id },
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async getUserProjects(): Promise<Project[]> {
    const response = await this.client.get<Project[]>('/user/projects', {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async health(): Promise<{ status: string }> {
    const response = await this.client.get<{ status: string }>('/health');
    return response.data;
  }
}
