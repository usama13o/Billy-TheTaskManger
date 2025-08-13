import { useState, useCallback, useEffect, useRef } from 'react';
import { Task, DayColumn, ViewMode } from '../types';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, startOfWeek } from 'date-fns';
import { getNormalizedEventsForRange } from '../lib/googleCalendar';



export const useTasks = () => {
  const STORAGE_KEY = 'taskManager.tasks.v1';
  const SUPA_ENABLED = true; // toggle if needed quickly

  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === 'undefined') return []; // SSR safety (not used here but defensive)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as any[];
      return parsed.map(t => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date()
      })) as Task[];
    } catch {
      return [];
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

  // Import Google Calendar events for a date range (e.g., current week)
  const importGoogleCalendarForRange = useCallback(async (startISODate: string, endISODate: string) => {
    try {
      const events = await getNormalizedEventsForRange(startISODate, endISODate);
      setTasks(prev => {
        const existingByTag = new Set<string>();
        for (const t of prev) {
          for (const tag of t.tags || []) {
            if (tag.startsWith('gcal:')) existingByTag.add(tag);
          }
        }
        const additions: Task[] = [];
        for (const e of events) {
          const tag = `gcal:${e.id}`;
          if (existingByTag.has(tag)) continue; // already imported
          additions.push({
            id: uuidv4(),
            title: e.title,
            description: e.description,
            timeEstimate: e.minutes,
            priority: 'medium',
            status: 'pending',
            createdAt: new Date(),
            scheduledDate: e.date,
            scheduledTime: e.time,
            tags: [tag, 'calendar']
          });
        }
        if (additions.length === 0) return prev;
        const next = [...prev, ...additions];
        // Also push to supabase
        if (SUPA_ENABLED && additions.length) {
          const rows = additions.map(t => ({
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
          supabase.from('tasks').upsert(rows).then(({ error }: { error: any }) => logErr('importGCal', error));
        }
        return next;
      });
    } catch (err) {
      logErr('importGCal.error', err);
      throw err;
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

  // Clear local cache and reload tasks from cloud (Supabase is source of truth)
  const resetFromCloud = useCallback(async () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {/* ignore */}
    // Clear local trackers to avoid echo upserts/deletes
    lastSyncedHashesRef.current = {};
    pendingDeletionIdsRef.current.clear();
    if (SUPA_ENABLED) {
      const { data, error } = await supabase.from('tasks').select('*');
      logErr('resetFromCloud.fetch', error);
      const remoteTasks: Task[] = (data || []).map((r: any) => ({
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
      // Use remote as source of truth
      suppressNextUpsertRef.current = true;
      setTasks(remoteTasks);
      // Rebuild hashes from cloud
      for (const t of remoteTasks) {
        lastSyncedHashesRef.current[t.id] = hashTask(t);
      }
    } else {
      suppressNextUpsertRef.current = true;
      setTasks([]);
    }
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
        // Always use remote data when available, regardless of whether it's empty
        suppressNextUpsertRef.current = true; // prevent echo bulk upsert
        setTasks(remoteTasks);
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
  jumpToToday,
  resetFromCloud,
  importGoogleCalendarForRange
  };
};