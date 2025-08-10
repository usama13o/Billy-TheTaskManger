import { useState, useCallback, useEffect, useRef } from 'react';
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

  const suppressNextUpsertRef = useRef(false); // skip bulk upsert when state change originated from remote
  // Track last synced task content (simple hash) to avoid re-uploading identical rows
  const lastSyncedHashesRef = useRef<Record<string, string>>({});
  const pendingDeletionIdsRef = useRef<Set<string>>(new Set());

  const hashTask = (t: Task) => {
    // Stable JSON of fields persisted remotely (order matters). Keep only fields stored in DB.
    return JSON.stringify({
      id: t.id,
      title: t.title,
      description: t.description || '',
      timeEstimate: t.timeEstimate,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      scheduledDate: t.scheduledDate || null,
      scheduledTime: t.scheduledTime || null,
      tags: t.tags || []
    });
  };

  const logErr = (context: string, error: any) => {
    if (error) {
      // Centralized console warning (could be replaced with UI toast later)
      // eslint-disable-next-line no-console
      console.warn(`[Supabase:${context}]`, error);
    }
  };

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
  }).then(({ error }: { error: any }) => logErr('addTask', error));
    }
    return newTask;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task));
    if (SUPA_ENABLED) {
      // Build full row to avoid NOT NULL constraint issues if record missing remotely
      const current = tasks.find(t => t.id === taskId);
      const merged: Task | undefined = current ? { ...current, ...updates } : undefined;
      if (merged) {
        const fullRow: any = {
          id: merged.id,
          title: merged.title,
          description: merged.description || '',
          time_estimate: merged.timeEstimate,
          priority: merged.priority,
          status: merged.status,
          created_at: merged.createdAt.toISOString(),
          scheduled_date: merged.scheduledDate,
          scheduled_time: merged.scheduledTime,
          tags: merged.tags
        };
        supabase.from('tasks').upsert(fullRow).then(({ error }: { error: any }) => logErr('updateTask', error));
      }
    }
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    if (SUPA_ENABLED) {
      // Queue deletion in case offline; attempt immediate delete
      pendingDeletionIdsRef.current.add(taskId);
      supabase.from('tasks').delete().eq('id', taskId).then(({ error }: { error: any }) => {
        logErr('deleteTask', error);
        if (!error) {
          // Remove from last synced map so it won't resurrect
          delete lastSyncedHashesRef.current[taskId];
          pendingDeletionIdsRef.current.delete(taskId);
        }
      });
    }
  }, []);

  const moveTask = useCallback((taskId: string, scheduledDate?: string, scheduledTime?: string) => {
    setTasks(prev => {
      let target: Task | undefined = prev.find(t => t.id === taskId);
      if (!target) return prev;
      const updated: Task = { ...target, scheduledDate, scheduledTime };
      // Remove original
      const remaining = prev.filter(t => t.id !== taskId);
      // Append updated to end so it shows at bottom of its day column
      return [...remaining, updated];
    });
    if (SUPA_ENABLED) {
      const t = tasks.find(t => t.id === taskId);
      if (t) {
        const merged: Task = { ...t, scheduledDate, scheduledTime };
        const fullRow: any = {
          id: merged.id,
          title: merged.title,
          description: merged.description || '',
          time_estimate: merged.timeEstimate,
          priority: merged.priority,
          status: merged.status,
          created_at: merged.createdAt.toISOString(),
          scheduled_date: merged.scheduledDate,
          scheduled_time: merged.scheduledTime,
          tags: merged.tags
        };
        supabase.from('tasks').upsert(fullRow).then(({ error }: { error: any }) => logErr('moveTask', error));
      }
    }
  }, [tasks]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  }, []);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedCalendarDate(date);
  }, []);

  const jumpToToday = useCallback(() => {
    const today = new Date();
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setSelectedCalendarDate(format(today, 'yyyy-MM-dd'));
  }, []);

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      }
    } catch {/* ignore quota errors for now */}
    if (SUPA_ENABLED && !suppressNextUpsertRef.current) {
      // Diff detection: only send changed/new tasks
      const changed: any[] = [];
      for (const t of tasks) {
        const h = hashTask(t);
        if (lastSyncedHashesRef.current[t.id] !== h) {
          changed.push({
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
          });
        }
      }
      const pendingDeletes = Array.from(pendingDeletionIdsRef.current);
      const performSync = async () => {
        if (changed.length > 0) {
          const { error } = await supabase.from('tasks').upsert(changed);
          logErr('bulkDiffUpsert', error);
          if (!error) {
            for (const t of tasks) {
              lastSyncedHashesRef.current[t.id] = hashTask(t);
            }
          }
        }
        if (pendingDeletes.length > 0) {
          const { error } = await supabase.from('tasks').delete().in('id', pendingDeletes);
          logErr('bulkDeletes', error);
          if (!error) {
            for (const id of pendingDeletes) {
              pendingDeletionIdsRef.current.delete(id);
              delete lastSyncedHashesRef.current[id];
            }
          }
        }
      };
      if (changed.length > 0 || pendingDeletes.length > 0) performSync();
    }
    if (suppressNextUpsertRef.current) {
      suppressNextUpsertRef.current = false; // reset after skipping
    }
  }, [tasks]);

  // Initial fetch from Supabase (one-way merge) & realtime subscription
  useEffect(() => {
    if (!SUPA_ENABLED) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) logErr('initialFetch', error);
      if (!error && data && active) {
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
        // Overwrite local with remote unless remote empty (keep local seeding)
        if (remoteTasks.length > 0) {
          suppressNextUpsertRef.current = true; // prevent echo bulk upsert
          setTasks(remoteTasks);
        }
      }
    })();
    const channel = supabase.channel('public:tasks')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        const r: any = payload.new || payload.old;
        setTasks(prev => {
          if (payload.eventType === 'DELETE') {
            suppressNextUpsertRef.current = true;
            pendingDeletionIdsRef.current.delete(r.id);
            delete lastSyncedHashesRef.current[r.id];
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
          const existing = prev.find(t => t.id === task.id);
            const remoteHash = hashTask(task);
          if (existing) {
            // If identical, ignore to prevent loops
            if (hashTask(existing) === remoteHash) {
              return prev; // no change
            }
            suppressNextUpsertRef.current = true;
            lastSyncedHashesRef.current[task.id] = remoteHash;
            return prev.map(t => t.id === task.id ? { ...t, ...task } : t);
          } else {
            suppressNextUpsertRef.current = true;
            lastSyncedHashesRef.current[task.id] = remoteHash;
            return [...prev, task];
          }
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
  moveTask,
  jumpToToday
  };
};