const API_BASE_URL = (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL || '';

export interface Task {
  timestamp?: string;
  project: string;
  area?: string;
  trade?: string;
  taskTitle: string;
  taskDetails?: string;
  assignedTo?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate?: string;
  photoNeeded?: boolean;
  status?: 'Open' | 'In Progress' | 'Closed';
  photoUrl?: string;
  notes?: string;
  taskId?: string;
}

export interface TaskResponse {
  success: boolean;
  task?: {
    success: boolean;
    taskId: string;
  };
  error?: string;
}

export interface TasksResponse {
  success: boolean;
  count: number;
  tasks: any[];
  error?: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Re-throw with more context if it's not already an Error
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  async getTasks(filters?: {
    project?: string;
    trade?: string;
    assignedTo?: string;
    status?: string;
  }): Promise<TasksResponse> {
    const params = new URLSearchParams();
    if (filters?.project) params.append('project', filters.project);
    if (filters?.trade) params.append('trade', filters.trade);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters?.status) params.append('status', filters.status);

    const query = params.toString();
    return this.request<TasksResponse>(`/api/tasks${query ? `?${query}` : ''}`);
  }

  async addTask(task: Task): Promise<TaskResponse> {
    return this.request<TaskResponse>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<TaskResponse> {
    return this.request<TaskResponse>('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ taskId, ...updates }),
    });
  }

  async addContractor(contractor: { name: string; email?: string; phone?: string; trade?: string }): Promise<any> {
    return this.request('/api/contractors', {
      method: 'POST',
      body: JSON.stringify(contractor),
    });
  }

  async createProject(projectName: string): Promise<any> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ projectName }),
    });
  }

  async initialize(): Promise<any> {
    return this.request('/api/initialize', {
      method: 'POST',
    });
  }

  async sendWeeklyEmails(): Promise<any> {
    return this.request('/api/emails/weekly', {
      method: 'POST',
    });
  }
}

export const apiService = new ApiService();
