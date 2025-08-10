import { useState, useEffect } from 'react';
import { useTasks } from './hooks/useTasks';
import { BrainDump } from './components/BrainDump';
import { WeeklyBoard } from './components/WeeklyBoard';
import { CalendarView } from './components/CalendarView';
import { TaskModal } from './components/TaskModal';
import { Header } from './components/Header';
import { Task } from './types';
import { generateWeeklySummary } from './lib/aiSummary';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { TaskCard } from './components/TaskCard';

function App() {
  const {
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
  } = useTasks();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('btm.theme') as 'light' | 'dark') || 'dark';
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState<'week' | 'month'>('week');
  const [exportPeriodStart, setExportPeriodStart] = useState<string>('');
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const [exportJsonText, setExportJsonText] = useState<string>('');
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string>('');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('btm.theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'dark') {
      setNotice("You're better than this – return to the dark side. 🌑 (Light mode is disabled here.)");
      setShowNotice(true);
      return;
    }
    setTheme('dark');
  };

  // Build export ranges: default to current week or month start
  useEffect(() => {
    if (exportMode === 'week') {
      setExportPeriodStart(currentWeekStart.toISOString().split('T')[0]);
    } else {
      const d = new Date(currentWeekStart);
      d.setDate(1);
      setExportPeriodStart(d.toISOString().split('T')[0]);
    }
  }, [exportMode, currentWeekStart]);

  const allTasks = [...brainDumpTasks, ...weekDays.flatMap(d => d.tasks)];

  const generateExport = () => {
    if (!exportPeriodStart) return;
    const start = new Date(exportPeriodStart + 'T00:00:00');
    let end = new Date(start);
    if (exportMode === 'week') {
      end.setDate(end.getDate() + 7);
    } else {
      // month mode: go to first of next month
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    }
    const inRange = allTasks.filter(t => {
      if (!t.scheduledDate) return false;
      const d = new Date(t.scheduledDate + 'T00:00:00');
      return d >= start && d < end;
    });
    const summary = {
      mode: exportMode,
      start: start.toISOString().substring(0,10),
      end: end.toISOString().substring(0,10),
      generatedAt: new Date().toISOString(),
      totals: {
        totalTasks: inRange.length,
        completed: inRange.filter(t => t.status === 'completed').length,
        pending: inRange.filter(t => t.status !== 'completed').length,
        totalMinutes: inRange.reduce((acc, t) => acc + (t.timeEstimate || 0), 0)
      },
      tasks: inRange.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        scheduledDate: t.scheduledDate,
        scheduledTime: t.scheduledTime,
        timeEstimate: t.timeEstimate,
        priority: t.priority,
        status: t.status,
        tags: t.tags
      }))
    };
  const jsonString = JSON.stringify(summary, null, 2);
  setExportJsonText(jsonString);
  const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    setExportDownloadUrl(url);
  };

  const openSummary = async () => {
    setShowSummary(true);
    setSummaryText('');
    setSummaryLoading(true);
    try {
      const startISO = currentWeekStart.toISOString().substring(0,10);
      const end = new Date(currentWeekStart); end.setDate(end.getDate()+7);
      const endISO = end.toISOString().substring(0,10);
      const weekTasks = weekDays.flatMap(d => d.tasks).filter(t => t.scheduledDate);
      const res = await generateWeeklySummary({ tasks: weekTasks, startISO, endISO });
      setSummaryText(res.summary);
    } catch (e:any) {
      setSummaryText('Failed to generate summary: ' + e.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const downloadFile = () => {
    if (!exportDownloadUrl) return;
    const a = document.createElement('a');
    const fileLabel = exportMode + '_' + exportPeriodStart;
    a.href = exportDownloadUrl;
    a.download = `tasks_${fileLabel}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(exportDownloadUrl), 2000);
    setExportDownloadUrl(null);
    setShowExport(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = [...brainDumpTasks, ...weekDays.flatMap(day => day.tasks)]
      .find(t => t.id === taskId);
    setDraggedTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setDraggedTask(null);
      return;
    }
    const taskId = active.id as string;
    const overId = over.id as string;

    if (overId.startsWith('slot|')) {
      // Calendar precise time slot drop
      const [, dayId, time] = overId.split('|');
      if (dayId) moveTask(taskId, dayId, time);
    } else if (overId === 'brain-dump') {
      // Unschedule task
      moveTask(taskId, undefined, undefined);
    } else if (overId.startsWith('day|')) {
      // Board view: dropping anywhere in a day column appends it to bottom (handled by moveTask ordering)
      const [, dayId] = overId.split('|');
      moveTask(taskId, dayId, undefined);
    } else if (viewMode === 'board') {
      // If we dropped over a task card (sortable item id), infer its day and append to that day.
      const allDayTasks = weekDays.map(d => ({ dayId: d.id, tasks: d.tasks }));
      const containing = allDayTasks.find(d => d.tasks.some(t => t.id === overId));
      if (containing) {
        moveTask(taskId, containing.dayId, undefined);
      }
    }
    setDraggedTask(null);
  };

  const handleToggleComplete = (taskId: string) => {
    const allTasks = [...brainDumpTasks, ...weekDays.flatMap(day => day.tasks)];
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
      updateTask(taskId, {
        status: task.status === 'completed' ? 'pending' : 'completed'
      });
    }
  };

  return (
    <div className="h-screen flex flex-col transition-colors bg-[var(--color-bg)] text-[var(--color-text)]">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Header
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          currentWeekStart={currentWeekStart}
          onNavigateWeek={navigateWeek}
      theme={theme}
      onToggleTheme={toggleTheme}
          onToday={jumpToToday}
          onOpenExport={() => setShowExport(true)}
          onGenerateSummary={openSummary}
        />
        {showNotice && notice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowNotice(false)} />
            <div className="relative max-w-sm w-full rounded-xl border border-fuchsia-400/40 bg-gradient-to-br from-gray-900 via-purple-900/80 to-fuchsia-900/60 p-5 shadow-2xl text-fuchsia-100 ring-1 ring-fuchsia-500/30">
              <h3 className="text-sm font-semibold mb-2 tracking-wide">Dark Side Protection</h3>
              <p className="text-xs leading-relaxed mb-4 text-fuchsia-200/90">{notice}</p>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={()=>setShowNotice(false)}
                  className="px-3 py-1.5 rounded-md bg-fuchsia-600/80 hover:bg-fuchsia-600 text-white font-medium shadow hover:shadow-lg transition"
                >Got it</button>
              </div>
              <button
                onClick={()=>setShowNotice(false)}
                className="absolute top-2 right-2 text-fuchsia-300 hover:text-white transition"
                aria-label="Close"
              >✕</button>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <BrainDump
            tasks={brainDumpTasks}
            onAddTask={addTask}
            onToggleComplete={handleToggleComplete}
            onEditTask={setEditingTask}
          />

          {viewMode === 'board' ? (
             <WeeklyBoard
               days={weekDays}
               onAddTask={addTask}
               onToggleComplete={handleToggleComplete}
               onEditTask={setEditingTask}
             />
          ) : (
            <CalendarView
              days={weekDays}
              selectedDate={selectedCalendarDate}
              onDateSelect={setSelectedDate}
              onToggleComplete={handleToggleComplete}
              onEditTask={setEditingTask}
              updateTask={updateTask}
            />
          )}
        </div>

        <DragOverlay>
          {draggedTask ? (
            <div className="rotate-3 scale-105">
              <TaskCard
                task={draggedTask}
                onToggleComplete={() => {}}
                onEdit={() => {}}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={updateTask}
        onDelete={deleteTask}
      />

      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowExport(false)} />
          <div className="relative w-full max-w-md rounded-lg bg-gray-900 border border-gray-700 p-5 space-y-5">
            <h3 className="text-lg font-semibold text-white">Export Tasks</h3>
            <div className="space-y-4 text-sm">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="exportMode" value="week" checked={exportMode==='week'} onChange={()=>setExportMode('week')} />
                  <span>Week</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="exportMode" value="month" checked={exportMode==='month'} onChange={()=>setExportMode('month')} />
                  <span>Month</span>
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wide text-gray-400">{exportMode === 'week' ? 'Week start date' : 'Month start date'}</label>
                <input
                  type="date"
                  value={exportPeriodStart}
                  onChange={e => setExportPeriodStart(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <button
                onClick={generateExport}
                className="w-full py-2 rounded-md bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >Generate JSON</button>
              {exportJsonText && (
                <div className="p-3 rounded-md bg-gray-800 border border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-300">Preview (truncated if long)</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(exportJsonText); }}
                      className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-200"
                    >Copy</button>
                  </div>
                  <pre className="max-h-40 overflow-auto text-[10px] leading-snug whitespace-pre-wrap bg-gray-900 p-2 rounded-md text-gray-300">
{exportJsonText.length > 4000 ? exportJsonText.slice(0,4000) + '\n... (truncated)' : exportJsonText}
                  </pre>
                  {exportDownloadUrl && (
                    <button
                      onClick={downloadFile}
                      className="w-full py-2 rounded-md bg-green-500 hover:bg-green-400 text-white text-sm font-medium"
                    >Download JSON</button>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500 leading-relaxed">
                Includes tasks within selected {exportMode === 'week' ? '7-day week (start inclusive, end exclusive)' : 'calendar month'} that have a scheduledDate.
              </div>
            </div>
            <button
              onClick={()=>setShowExport(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              aria-label="Close"
            >✕</button>
          </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowSummary(false)} />
          <div className="relative w-full max-w-lg rounded-lg bg-gray-900 border border-gray-700 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white">Weekly AI Summary</h3>
            {summaryLoading && <p className="text-sm text-gray-400 animate-pulse">Generating summary...</p>}
            {!summaryLoading && (
              <div className="prose prose-invert max-h-[50vh] overflow-y-auto text-sm whitespace-pre-wrap">
                {summaryText || 'No summary yet.'}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={()=>openSummary()}
                disabled={summaryLoading}
                className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm"
              >Regenerate</button>
              <button
                onClick={()=>setShowSummary(false)}
                className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white text-sm"
              >Close</button>
            </div>
            <button
              onClick={()=>setShowSummary(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              aria-label="Close"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;