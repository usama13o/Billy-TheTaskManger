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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('btm.theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setNotice(null);
    setTimeout(() => setNotice(null), 0);
    setNotice(null);
    setTimeout(() => setNotice(null), 0); // ensure cleared
    if (theme === 'dark') {
      setNotice("you're better than this – go back to the dark side ✨");
      // Do NOT switch to light; playful rejection
      setTimeout(() => setNotice(null), 4000);
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

    // slot|dayId|HH:00 droppable id format
    if (overId.startsWith('slot|')) {
      const [, dayId, time] = overId.split('|');
      if (dayId) moveTask(taskId, dayId, time);
    } else if (overId === 'brain-dump') {
      // Return to brain dump (unschedule)
      moveTask(taskId, undefined, undefined);
    } else if (overId.startsWith('day|')) {
      const [, dayId] = overId.split('|');
      moveTask(taskId, dayId, undefined);
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
        {notice && (
          <div className="mx-4 mt-2 mb-0 rounded-md bg-gradient-to-r from-fuchsia-600/70 to-purple-700/70 dark:from-fuchsia-600/30 dark:to-purple-800/30 border border-fuchsia-400/40 px-4 py-2 text-xs text-white backdrop-blur-sm shadow">
            {notice}
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