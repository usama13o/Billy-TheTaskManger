import { useState, useEffect, useRef } from 'react';
import { addDays } from 'date-fns';
import { useTasks } from './hooks/useTasks';
import { BrainDump } from './components/BrainDump';
import { MobileBrainDump } from './components/MobileBrainDump';
import { MobileToday } from './components/MobileToday';
import { MobileWeekView } from './components/MobileWeekView';
import { MobileHeader } from './components/MobileHeader';
import { FloatingActionButton } from './components/FloatingActionButton';
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
  const [summaryWeekStart, setSummaryWeekStart] = useState<string>(() => currentWeekStart.toISOString().substring(0,10));
  // Mobile panel handling (0 = BrainDump, 1 = Today, 2 = Week View)
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mobilePanel, setMobilePanel] = useState<number>(0); // Default to Brain Dump as main aspect
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState<number>(112);

  useEffect(() => {
    // Robust mobile detection: CSS media query + resize + orientation changes
    const mql = window.matchMedia('(max-width: 639.98px)');
    const update = () => setIsMobile(mql.matches || window.innerWidth < 640);
    update();
    const onResize = () => update();
    const onOrientation = () => update();
    mql.addEventListener?.('change', update);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      mql.removeEventListener?.('change', update);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  // Track dynamic height of the fixed mobile header
  useEffect(() => {
    if (!isMobile) return;
    const measure = () => {
      const h = mobileHeaderRef.current?.offsetHeight ?? 112;
      setMobileHeaderHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (mobileHeaderRef.current) ro.observe(mobileHeaderRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isMobile]);

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

  const runSummary = async (weekStartISO: string) => {
    setSummaryText('');
    setSummaryLoading(true);
    try {
      const startDate = new Date(weekStartISO + 'T00:00:00');
      const end = addDays(startDate, 7);
      const startISO = weekStartISO;
      const endISO = end.toISOString().substring(0,10);
      // Filter all tasks by date range (scheduled tasks only)
      const weekTasks = tasks.filter(t => {
        if (!t.scheduledDate) return false;
        const d = new Date(t.scheduledDate + 'T00:00:00');
        return d >= startDate && d < end;
      });
      const res = await generateWeeklySummary({ tasks: weekTasks, startISO, endISO });
      setSummaryText(res.summary);
    } catch (e:any) {
      setSummaryText('Failed to generate summary: ' + e.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const openSummary = () => {
    setShowSummary(true);
    runSummary(summaryWeekStart);
  };

  const shiftSummaryWeek = (direction: 'prev' | 'next') => {
    const current = new Date(summaryWeekStart + 'T00:00:00');
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    const iso = current.toISOString().substring(0,10);
    setSummaryWeekStart(iso);
    if (showSummary) runSummary(iso);
  };

  const todayWeek = () => {
    const today = new Date();
    // Align to existing currentWeekStart offset (assuming week starts on Sunday like app) -> find difference of currentWeekStart weekday
    const day = today.getDay(); // 0 Sunday
    const start = new Date(today); start.setDate(start.getDate() - day);
    const iso = start.toISOString().substring(0,10);
    setSummaryWeekStart(iso);
    if (showSummary) runSummary(iso);
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

  const handleMobileQuickAdd = () => {
    if (mobilePanel !== 0) {
      setMobilePanel(0); // Switch to Brain Dump panel
    }
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
    {!isMobile && (
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
            onResetFromCloud={resetFromCloud}
            onSyncGoogleCalendar={async () => {
              const startISO = new Date(currentWeekStart).toISOString().substring(0,10);
              const end = addDays(new Date(currentWeekStart), 7).toISOString().substring(0,10);
              try {
                await importGoogleCalendarForRange(startISO, end);
                setNotice('Imported Google Calendar events for this week.');
                setShowNotice(true);
              } catch (e: any) {
                setNotice('Google Calendar sync failed: ' + (e?.message || 'unknown error'));
                setShowNotice(true);
              }
            }}
          />
        )}
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
          {isMobile ? (
            <>
              {/* Mobile Header */}
              <div ref={mobileHeaderRef} className="fixed top-0 left-0 right-0 z-40">
                <MobileHeader
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  currentWeekStart={currentWeekStart}
                  onNavigateWeek={navigateWeek}
                  onToday={jumpToToday}
                  onQuickAdd={handleMobileQuickAdd}
                  onResetFromCloud={resetFromCloud}
                  onSyncGoogleCalendar={async () => {
                    const startISO = new Date(currentWeekStart).toISOString().substring(0,10);
                    const end = addDays(new Date(currentWeekStart), 7).toISOString().substring(0,10);
                    try {
                      await importGoogleCalendarForRange(startISO, end);
                      setNotice('Imported Google Calendar events for this week.');
                      setShowNotice(true);
                    } catch (e: any) {
                      setNotice('Google Calendar sync failed: ' + (e?.message || 'unknown error'));
                      setShowNotice(true);
                    }
                  }}
                />
              </div>

              {/* Mobile Panel System with 3 panels */}
              <div 
                className="relative flex-1 overflow-hidden"
                style={{ marginTop: mobileHeaderHeight }}
                onTouchStart={(e) => {
                  if (e.touches.length === 1) {
                    touchStartXRef.current = e.touches[0].clientX;
                    touchCurrentXRef.current = e.touches[0].clientX;
                  }
                }}
                onTouchMove={(e) => {
                  if (touchStartXRef.current != null) {
                    touchCurrentXRef.current = e.touches[0].clientX;
                  }
                }}
                onTouchEnd={() => {
                  if (touchStartXRef.current != null && touchCurrentXRef.current != null) {
                    const delta = touchCurrentXRef.current - touchStartXRef.current;
                    // Enhanced swipe logic for 3 panels
                    if (delta > 50) {
                      // Swipe right - go to previous panel
                      setMobilePanel(prev => Math.max(0, prev - 1));
                    } else if (delta < -50) {
                      // Swipe left - go to next panel
                      setMobilePanel(prev => Math.min(2, prev + 1));
                    }
                  }
                  touchStartXRef.current = null;
                  touchCurrentXRef.current = null;
                }}
              >
                <div
                  className="flex h-full w-[300%] transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${mobilePanel * 33.333}%)` }}
                >
                  {/* Panel 0: Enhanced Brain Dump (Main panel) */}
                  <div className="w-1/3 min-w-[33.333%] h-full">
                    <MobileBrainDump
                      tasks={brainDumpTasks}
                      onAddTask={addTask}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={setEditingTask}
                    />
                  </div>

                  {/* Panel 1: Enhanced Today View */}
                  <div className="w-1/3 min-w-[33.333%] h-full border-l border-gray-800">
                    <MobileToday
                      tasks={weekDays.flatMap(day => day.tasks)}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={setEditingTask}
                      onQuickAdd={handleMobileQuickAdd}
                      currentDate={new Date()}
                    />
                  </div>

                  {/* Panel 2: Week View */}
                  <div className="w-1/3 min-w-[33.333%] h-full border-l border-gray-800">
                    <MobileWeekView
                      days={weekDays}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={setEditingTask}
                      onQuickAdd={handleMobileQuickAdd}
                      currentWeekStart={currentWeekStart}
                    />
                  </div>
                </div>

                {/* Enhanced Panel Indicators */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {[0, 1, 2].map((panelIndex) => (
                    <button
                      key={panelIndex}
                      onClick={() => setMobilePanel(panelIndex)}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        mobilePanel === panelIndex 
                          ? 'w-8 bg-green-500' 
                          : 'w-2 bg-gray-600 hover:bg-gray-500'
                      }`}
                      aria-label={`Go to ${['Brain Dump', 'Today', 'Week'][panelIndex]} panel`}
                    />
                  ))}
                </div>

                {/* Panel Labels */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                  <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-gray-300">
                    {['🧠 Brain Dump', '📅 Today', '📊 Week'][mobilePanel]}
                  </div>
                </div>
              </div>

              {/* Floating Action Button */}
              <FloatingActionButton
                onClick={handleMobileQuickAdd}
                visible={mobilePanel === 0} // Only show on Brain Dump panel
              />
            </>
          ) : (
            <>
              <div className="w-80">
                <BrainDump
                  tasks={brainDumpTasks}
                  onAddTask={addTask}
                  onToggleComplete={handleToggleComplete}
                  onEditTask={setEditingTask}
                />
              </div>
              <div className="flex flex-1">
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
            </>
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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <button onClick={()=>shiftSummaryWeek('prev')} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200">◀</button>
                <button onClick={()=>shiftSummaryWeek('next')} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200">▶</button>
              </div>
              <input
                type="date"
                value={summaryWeekStart}
                onChange={e => { setSummaryWeekStart(e.target.value); if (showSummary) runSummary(e.target.value); }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200"
              />
              <button onClick={todayWeek} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200">This Week</button>
              <span className="text-gray-400">Range: {summaryWeekStart} → {addDays(new Date(summaryWeekStart+'T00:00:00'),7).toISOString().substring(0,10)}</span>
            </div>
            {summaryLoading && <p className="text-sm text-gray-400 animate-pulse">Generating summary...</p>}
            {!summaryLoading && (
              <div className="prose prose-invert max-h-[50vh] overflow-y-auto text-sm whitespace-pre-wrap">
                {summaryText || 'No summary yet.'}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={()=>runSummary(summaryWeekStart)}
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