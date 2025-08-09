import React, { useState } from 'react';
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
    moveTask
  } = useTasks();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

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

    // Parse time from calendar drop zones
    const parseTimeFromDropId = (dropId: string) => {
      if (dropId.includes('-')) {
        const parts = dropId.split('-');
        if (parts.length >= 2) {
          const dayId = parts[0];
          const time = parts.slice(1).join('-'); // Handle cases like "2024-01-01-09:00"
          return { dayId, time };
        }
      }
      return { dayId: dropId, time: undefined };
    };

    // Handle dropping to brain dump
    if (overId === 'brain-dump') {
      moveTask(taskId, undefined, undefined);
    }
    // Handle dropping to day columns
    else if (weekDays.some(day => day.id === overId)) {
      moveTask(taskId, overId, undefined);
    }
    // Handle dropping to calendar time slots with proper time parsing
    else {
      const { dayId, time } = parseTimeFromDropId(overId);
      if (weekDays.some(day => day.id === dayId)) {
        moveTask(taskId, dayId, time);
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
    <div className="h-screen bg-gray-900 flex flex-col">
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
        />

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