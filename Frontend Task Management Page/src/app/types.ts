export type TaskStatus = 'Open' | 'Closed' | 'In Progress' | 'Blocked';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Project {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  timestamp: Date;
  project: string;
  area: string;
  trade: string;
  taskTitle: string;
  taskDetails: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: Date | null;
  photoNeeded: boolean;
  status: TaskStatus;
  photoURL?: string;
  notes?: string;
}

export interface FilterState {
  search: string;
  project: string;
  area: string;
  trade: string;
  assignedTo: string;
  priority: string;
  status: string;
  photoNeeded: string;
  showOverdueOnly: boolean;
  showOpenOnly: boolean;
  showUrgentOnly: boolean;
}
