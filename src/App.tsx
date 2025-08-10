import { useState, useEffect } from 'react';
import { useTasks } from './hooks/useTasks';
import { BrainDump } from './components/BrainDump';
import { WeeklyBoard } from './components/WeeklyBoard';
import { CalendarView } from './components/CalendarView';
import { TaskModal } from './components/TaskModal';
import { Header } from './components/Header';
import { Task } from './types';
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
    </div>
  );
}

export default App;