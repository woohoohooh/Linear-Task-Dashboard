export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Task {
  id: string;
  globalId: number;
  title: string;
  completed: boolean;
  assigneeId?: string;
  tags: string[];
  priority: Priority;
  groupId: string;
}

export interface Group {
  id: string;
  title: string;
  taskIds: string[];
}

export interface ProjectState {
  id: string;
  title: string;
  groups: Group[];
  tasks: Record<string, Task>;
  users: User[];
  nextGlobalId: number;
}
