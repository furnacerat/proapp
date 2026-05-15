import type { Dispatch, SetStateAction } from 'react';
import type { AppData, Task } from '../../data/types';

interface TaskHookDeps {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

export function useTasks({ data, setData }: TaskHookDeps) {
  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const job = task.jobId ? data.jobs.find(item => item.id === task.jobId) : undefined;
    const newTask: Task = {
      taskType: 'task',
      assignmentRole: task.assignedTo ? 'worker' : 'office',
      ...task,
      customerId: task.customerId || job?.customerId,
      estimateId: task.estimateId || job?.estimateId,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setData(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
    }));
  };

  const deleteTask = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id),
    }));
  };

  return { addTask, updateTask, deleteTask };
}
