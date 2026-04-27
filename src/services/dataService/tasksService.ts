import type { Task } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const tasksService = createCollectionService<Task>('tasks', TABLES.tasks);

