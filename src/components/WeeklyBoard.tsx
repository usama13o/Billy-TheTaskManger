import React, { useState } from 'react';
import { DayColumn, Task } from '../types';
import { TaskCard } from './TaskCard';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface WeeklyBoardProps {
  days: DayColumn[];
  onAddTask: (task: Partial<Task>) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}

export const WeeklyBoard: React.FC<WeeklyBoardProps> = ({
  days,
  onAddTask,
  onToggleComplete,
  onEditTask
}) => {
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = (dayId: string) => {
    if (newTaskTitle.trim()) {
      onAddTask({
        title: newTaskTitle.trim(),
        scheduledDate: dayId
      });
      setNewTaskTitle('');
      setAddingToDay(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, dayId: string) => {
    if (e.key === 'Enter') {
      handleAddTask(dayId);
    } else if (e.key === 'Escape') {
      setAddingToDay(null);
      setNewTaskTitle('');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {days.map((day) => (
          <DayColumnComponent
            key={day.id}
            day={day}
            isAdding={addingToDay === day.id}
            newTaskTitle={newTaskTitle}
            onStartAdding={() => setAddingToDay(day.id)}
            onCancelAdding={() => {
              setAddingToDay(null);
              setNewTaskTitle('');
            }}
            onTaskTitleChange={setNewTaskTitle}
            onAddTask={() => handleAddTask(day.id)}
            onKeyPress={(e) => handleKeyPress(e, day.id)}
            onToggleComplete={onToggleComplete}
            onEditTask={onEditTask}
          />
        ))}
      </div>
    </div>
  );
};

interface DayColumnProps {
  day: DayColumn;
  isAdding: boolean;
  newTaskTitle: string;
  onStartAdding: () => void;
  onCancelAdding: () => void;
  onTaskTitleChange: (title: string) => void;
  onAddTask: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}

const DayColumnComponent: React.FC<DayColumnProps> = ({
  day,
  isAdding,
  newTaskTitle,
  onStartAdding,
  onCancelAdding,
  onTaskTitleChange,
  onAddTask,
  onKeyPress,
  onToggleComplete,
  onEditTask
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day|${day.id}`
  });

  const isToday = day.date === new Date().toISOString().split('T')[0];
  
  return (
    <div className="w-72 bg-gray-800 rounded-lg flex flex-col">
      <div className={`p-4 border-b border-gray-700 ${isToday ? 'bg-green-500/10' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className={`font-semibold ${isToday ? 'text-green-400' : 'text-white'}`}>
              {day.dayName}
            </h3>
            {isToday && (
              <span className="text-xs text-green-400 font-medium">Today</span>
            )}
          </div>
          <span className="text-sm text-gray-400">
            {day.tasks.reduce((total, task) => total + task.timeEstimate, 0)}m
          </span>
        </div>

        {isAdding ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => onTaskTitleChange(e.target.value)}
              onKeyDown={onKeyPress}
              placeholder="Enter task title..."
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-400"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={onAddTask}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
              >
                Add
              </button>
              <button
                onClick={onCancelAdding}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onStartAdding}
            className="w-full p-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-green-400 hover:text-green-400 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add a task
          </button>
        )}
      </div>

      <SortableContext items={day.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 p-4 space-y-3 min-h-[240px] transition-colors rounded-b-lg ${isOver ? 'bg-gray-700/60 ring-1 ring-green-400/40' : ''}`}
        >
          {day.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onEdit={onEditTask}
            />
          ))}
          
          {day.tasks.length === 0 && !isAdding && (
            <div className="text-center py-8 text-gray-500 text-sm select-none">
              {isOver ? 'Release to add here' : 'Drag tasks here'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};