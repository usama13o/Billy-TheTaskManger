import { useState, useCallback, useEffect } from 'react';
import { Task, DayColumn, ViewMode } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, startOfWeek } from 'date-fns';

const INITIAL_TASKS: Task[] = [
  {
    id: uuidv4(),
    title: 'R&D read and get scope growth data OWs',
    description: 'Research and development task for growth metrics',
    timeEstimate: 30,
    priority: 'high',
    status: 'pending',
    createdAt: new Date(),
    tags: ['research', 'data']
  },
  {
    id: uuidv4(),
    title: 'Align vet data we have for growth from ati - project',
    description: 'Align veterinary data for growth analysis',
    timeEstimate: 30,
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    tags: ['alignment', 'data']
  },
  {
    id: uuidv4(),
    title: 'Test growth with new model OWs - eval',
    description: 'Testing growth metrics with updated model',
    timeEstimate: 30,
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    tags: ['testing', 'evaluation']
  },
  {
    id: uuidv4(),
    title: 'run skye multi gpu high res model - test again',
    description: 'Execute multi-GPU model testing',
    timeEstimate: 30,
    priority: 'low',
    status: 'pending',
    createdAt: new Date(),
    tags: ['testing', 'gpu']
  }
];

export const useTasks = () => {
  const STORAGE_KEY = 'taskManager.tasks.v1';

  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === 'undefined') return INITIAL_TASKS; // SSR safety (not used here but defensive)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return INITIAL_TASKS;
      const parsed = JSON.parse(raw) as any[];
      return parsed.map(t => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date()
      })) as Task[];
    } catch {
      return INITIAL_TASKS;
    }
  });
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => 
    format(new Date(), 'yyyy-MM-dd')
  );
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const brainDumpTasks = tasks.filter(task => !task.scheduledDate);
  
  const weekDays: DayColumn[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(currentWeekStart, index);
    const dateString = format(date, 'yyyy-MM-dd');
    const dayName = format(date, 'EEE MMM d');
    
    return {
      id: dateString,
      date: dateString,
      dayName,
      tasks: tasks.filter(task => task.scheduledDate === dateString)
    };
  });

  const addTask = useCallback((taskData: Partial<Task>) => {
    const newTask: Task = {
      id: uuidv4(),
      title: taskData.title || 'New Task',
      description: taskData.description || '',
      timeEstimate: taskData.timeEstimate || 30,
      priority: taskData.priority || 'medium',
      status: taskData.status || 'pending',
      createdAt: new Date(),
      scheduledDate: taskData.scheduledDate,
      scheduledTime: taskData.scheduledTime,
      tags: taskData.tags || []
    };
    
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const moveTask = useCallback((taskId: string, scheduledDate?: string, scheduledTime?: string) => {
    updateTask(taskId, { scheduledDate, scheduledTime });
  }, [updateTask]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  }, []);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedCalendarDate(date);
  }, []);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      }
    } catch {/* ignore quota errors for now */}
  }, [tasks]);

  // Listen for cross-tab updates
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as any[];
          setTasks(parsed.map(t => ({ ...t, createdAt: t.createdAt ? new Date(t.createdAt) : new Date() })) as Task[]);
        } catch {/* ignore */}
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);

  return {
    tasks,
    brainDumpTasks,
    weekDays,
    viewMode,
    setViewMode,
    currentWeekStart,
    selectedCalendarDate,
    setSelectedDate,
    navigateWeek,
    addTask,
    updateTask,
    deleteTask,
    moveTask
  };
};