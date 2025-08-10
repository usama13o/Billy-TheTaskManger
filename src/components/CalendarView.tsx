import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DayColumn, Task, TimeSlot } from '../types';
import { TaskCard } from './TaskCard';
import { useDroppable } from '@dnd-kit/core';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarViewProps {
  days: DayColumn[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

interface CalendarTimeSlotProps {
  dayId: string;
  time: string;
  tasks: Task[];
  allDayTasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

interface SpanningTaskProps {
  task: Task;
  startHour: number;
  dayId: string;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

const SpanningTask: React.FC<SpanningTaskProps> = ({ 
  task, 
  startHour, 
  dayId, 
  onToggleComplete, 
  onEditTask, 
  updateTask 
}) => {
  const [resizing, setResizing] = useState(false);
  const [resizePreview, setResizePreview] = useState<number | null>(null);
  const startYRef = useRef(0);
  const originalDurationRef = useRef(0);
  
  const currentDuration = resizePreview ?? task.timeEstimate ?? 30;
  const durationHours = currentDuration / 60;
  const height = Math.max(1, durationHours) * 60; // 60px per hour
  const top = startHour * 60;

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    setResizing(true);
    startYRef.current = e.clientY;
    originalDurationRef.current = task.timeEstimate ?? 30;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (!resizing) return;
    const deltaY = e.clientY - startYRef.current;
    // 30 minutes = 30px, so 1px = 1 minute
    const minutesChanged = Math.round(deltaY / 2) * 30; // Snap to 30-minute increments
    const newDuration = Math.max(30, originalDurationRef.current + minutesChanged);
    setResizePreview(newDuration);
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    if (!resizing) return;
    setResizing(false);
    
    if (resizePreview && resizePreview !== task.timeEstimate) {
      updateTask(task.id, { timeEstimate: resizePreview });
    }
    setResizePreview(null);
  }, [resizing, resizePreview, task.id, task.timeEstimate, updateTask]);

  useEffect(() => {
    if (resizing) {
      document.addEventListener('pointermove', handleResizeMove);
      document.addEventListener('pointerup', handleResizeEnd);
      return () => {
        document.removeEventListener('pointermove', handleResizeMove);
        document.removeEventListener('pointerup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const endTime = new Date();
  endTime.setHours(Math.floor(startHour + currentDuration / 60));
  endTime.setMinutes((startHour * 60 + currentDuration) % 60);

  return (
    <div
      className={`absolute left-1 right-1 bg-green-600/20 border border-green-500/60 rounded-md group overflow-hidden ${
        resizing ? 'ring-2 ring-green-400 z-20' : 'z-10'
      } ${resizePreview ? 'bg-green-600/30' : ''}`}
      style={{ top: `${top}px`, height: `${height}px` }}
      onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
    >
      <div className="h-full flex flex-col text-xs p-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-green-300 truncate">{task.title}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
            className={`w-3 h-3 rounded-full border transition-colors ${
              task.status === 'completed' 
                ? 'bg-green-400 border-green-300' 
                : 'border-green-400 hover:bg-green-500/30'
            }`}
          >
            {task.status === 'completed' && <div className="w-1.5 h-1.5 bg-green-900 rounded-sm mx-auto" />}
          </button>
        </div>
        
        {task.description && height > 40 && (
          <div className="text-[10px] text-gray-300 mt-1 line-clamp-2">{task.description}</div>
        )}
        
        <div className="mt-auto text-[10px] text-green-400">
          {task.scheduledTime} - {endTime.toTimeString().slice(0, 5)} ({currentDuration}m)
        </div>
      </div>
      
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-green-500/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        onPointerDown={handleResizeStart}
      >
        <div className="text-green-900 text-xs font-bold">⋮⋮⋮</div>
      </div>
    </div>
  );
};

const CalendarTimeSlotComponent: React.FC<CalendarTimeSlotProps> = ({ 
  dayId, 
  time, 
  tasks, 
  allDayTasks,
  onToggleComplete, 
  onEditTask, 
  updateTask 
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot|${dayId}|${time}` });
  const hour = parseInt(time.split(':')[0]);
  
  // Only show spanning tasks that start at this hour
  const spanningTasks = allDayTasks.filter(task => {
    if (!task.scheduledTime) return false;
    const taskStartHour = parseInt(task.scheduledTime.split(':')[0]);
    return taskStartHour === hour;
  });

  // Show individual tasks that exactly match this time slot
  const slotTasks = tasks.filter(task => task.scheduledTime === time);
  
  return (
    <div className="relative" style={{ height: '60px' }}>
      <div
        ref={setNodeRef}
        className={`absolute inset-0 border-r border-gray-800 border-b border-gray-800/50 transition-colors ${
          isOver ? 'bg-green-900/40' : 'hover:bg-gray-800/40'
        }`}
      >
        {/* All scheduled tasks as spanning tasks (draggable and resizable) */}
        {spanningTasks.map(task => (
          <SpanningTask
            key={task.id}
            task={task}
            startHour={hour}
            dayId={dayId}
            onToggleComplete={onToggleComplete}
            onEditTask={onEditTask}
            updateTask={updateTask}
          />
        ))}
        
        {/* Fallback: Simple display for tasks without proper time format */}
        {slotTasks.length > 0 && spanningTasks.length === 0 && (
          <div className="absolute inset-1 space-y-1">
            {slotTasks.map(task => (
              <div key={task.id} className="bg-blue-600/20 border border-blue-500/60 rounded p-1">
                <TaskCard
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onEdit={onEditTask}
                />
                <div className="text-[10px] text-blue-300 mt-1">
                  {task.scheduledTime} ({task.timeEstimate}m)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  days,
  selectedDate,
  onDateSelect,
  onToggleComplete,
  onEditTask,
  updateTask
}) => {
  const timeSlots: TimeSlot[] = Array.from({ length: 24 }, (_, hour) => {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    const displayTime = hour === 0 ? '12 AM' : 
                       hour < 12 ? `${hour} AM` : 
                       hour === 12 ? '12 PM' : `${hour - 12} PM`;
    return { time, hour, displayTime };
  });

  const selectedDay = days.find(d => d.date === selectedDate);
  const selectedDayTasks = selectedDay?.tasks || [];
  const unscheduledTasks = selectedDayTasks.filter(t => !t.scheduledTime);

  return (
    <div className="flex-1 bg-gray-900 flex overflow-hidden">
      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-30">
            <div className="flex">
              <div className="w-14 flex-shrink-0 bg-gray-900"></div>
              {days.map(day => {
                const isToday = day.date === new Date().toISOString().split('T')[0];
                const isSelected = day.date === selectedDate;
                return (
                  <div
                    key={day.id}
                    onClick={() => onDateSelect(day.date)}
                    className={`flex-1 min-w-[180px] p-3 text-center border-r border-gray-800 cursor-pointer select-none transition-colors ${
                      isSelected ? 'bg-green-500/15' : isToday ? 'bg-green-500/5' : 'hover:bg-gray-800/60'
                    }`}
                  >
                    <div className={`text-sm font-medium ${
                      isSelected ? 'text-green-300' : isToday ? 'text-green-400' : 'text-gray-100'
                    }`}>{day.dayName}</div>
                    {isToday && <div className="text-[10px] text-green-400 mt-0.5">Today</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div className="relative">
            {timeSlots.map(({ time, displayTime }) => (
              <div key={time} className="flex">
                <div className="w-14 flex-shrink-0 p-1.5 pr-2 text-[10px] md:text-xs text-gray-500 text-right border-r border-gray-800" style={{ height: '60px' }}>
                  <div className="sticky top-16">{displayTime}</div>
                </div>
                {days.map(day => (
                  <CalendarTimeSlotComponent
                    key={`slot-${day.id}-${time}`}
                    dayId={day.id}
                    time={time}
                    tasks={day.tasks.filter(t => t.scheduledTime === time)}
                    allDayTasks={day.tasks.filter(t => t.scheduledTime)}
                    onToggleComplete={onToggleComplete}
                    onEditTask={onEditTask}
                    updateTask={updateTask}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side Panel for Selected Day */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon className="w-5 h-5 text-green-400" />
            <h2 className="text-base font-semibold text-gray-100">
              {selectedDay ? selectedDay.dayName : 'Select a Day'}
            </h2>
          </div>
          {selectedDay && (
            <div className="text-xs text-gray-400">
              {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
              {unscheduledTasks.length > 0 && (
                <span className="ml-2 text-yellow-400">({unscheduledTasks.length} unscheduled)</span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedDay ? (
            <div className="p-4 space-y-6">
              {unscheduledTasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Unscheduled
                  </h3>
                  <div className="space-y-2">
                    {unscheduledTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onEdit={onEditTask}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedDayTasks.filter(t => t.scheduledTime).length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-300 mb-2">Scheduled</h3>
                  <div className="space-y-2">
                    {selectedDayTasks
                      .filter(t => t.scheduledTime)
                      .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
                      .map(task => (
                        <div key={task.id} className="bg-gray-800 rounded-lg p-2 border-l-4 border-green-500">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-green-400 font-medium">{task.scheduledTime}</span>
                            <span className="text-[10px] text-gray-400">{task.timeEstimate}m</span>
                          </div>
                          <TaskCard
                            task={task}
                            onToggleComplete={onToggleComplete}
                            onEdit={onEditTask}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedDayTasks.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-xs">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No tasks</p>
                  <p className="mt-1">Drag tasks from Brain Dump</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Select a day to view tasks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};