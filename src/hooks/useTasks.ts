import { useState, useCallback, useEffect } from 'react';
import { Task, DayColumn, ViewMode } from '../types';
import { supabase } from '../lib/supabaseClient';
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
  const SUPA_ENABLED = true; // toggle if needed quickly

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
    if (SUPA_ENABLED) {
      // fire and forget
      supabase.from('tasks').upsert({
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        time_estimate: newTask.timeEstimate,
        priority: newTask.priority,
        status: newTask.status,
        created_at: newTask.createdAt.toISOString(),
        scheduled_date: newTask.scheduledDate,
        scheduled_time: newTask.scheduledTime,
        tags: newTask.tags
      }).then(()=>{}).catch(()=>{});
    }
    return newTask;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
    if (SUPA_ENABLED) {
      const payload: any = { id: taskId };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.timeEstimate !== undefined) payload.time_estimate = updates.timeEstimate;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.scheduledDate !== undefined) payload.scheduled_date = updates.scheduledDate;
      if (updates.scheduledTime !== undefined) payload.scheduled_time = updates.scheduledTime;
      if (updates.tags !== undefined) payload.tags = updates.tags;
      supabase.from('tasks').upsert(payload).then(()=>{}).catch(()=>{});
    }
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    if (SUPA_ENABLED) {
      supabase.from('tasks').delete().eq('id', taskId).then(()=>{}).catch(()=>{});
    }
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
    if (SUPA_ENABLED && tasks.length > 0) {
      // Basic push (non-conflict resolution) for any offline changes when tasks mutate.
      // Could be optimized with diffing.
      const rows = tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        time_estimate: t.timeEstimate,
        priority: t.priority,
        status: t.status,
        created_at: t.createdAt.toISOString(),
        scheduled_date: t.scheduledDate,
        scheduled_time: t.scheduledTime,
        tags: t.tags
      }));
      supabase.from('tasks').upsert(rows).then(()=>{}).catch(()=>{});
    }
  }, [tasks]);

  // Initial fetch from Supabase (one-way merge) & realtime subscription
  useEffect(() => {
    if (!SUPA_ENABLED) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('tasks').select('*');
      if (!error && data && active) {
        // map supabase row -> Task
        const remoteTasks: Task[] = data.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description || '',
          timeEstimate: r.time_estimate || 30,
            priority: r.priority || 'medium',
          status: r.status || 'pending',
          createdAt: r.created_at ? new Date(r.created_at) : new Date(),
          scheduledDate: r.scheduled_date || undefined,
          scheduledTime: r.scheduled_time || undefined,
          tags: r.tags || []
        }));
        setTasks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const merged = [...prev];
          remoteTasks.forEach(rt => {
            if (!existingIds.has(rt.id)) merged.push(rt);
          });
          return merged;
        });
      }
    })();
    const channel = supabase.channel('public:tasks')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        const r: any = payload.new || payload.old;
        setTasks(prev => {
          if (payload.eventType === 'DELETE') {
            return prev.filter(t => t.id !== r.id);
          }
          const task: Task = {
            id: r.id,
            title: r.title,
            description: r.description || '',
            timeEstimate: r.time_estimate || 30,
            priority: r.priority || 'medium',
            status: r.status || 'pending',
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
            scheduledDate: r.scheduled_date || undefined,
            scheduledTime: r.scheduled_time || undefined,
            tags: r.tags || []
          };
          const idx = prev.findIndex(t => t.id === task.id);
          if (idx === -1) return [...prev, task];
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...task };
          return copy;
        });
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

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