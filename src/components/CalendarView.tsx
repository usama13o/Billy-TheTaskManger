import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DayColumn, Task } from '../types';
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

// ---- New 30-min slot calendar implementation ----

interface DayCalendarColumnProps {
  day: DayColumn;
  timeSlots: string[]; // in HH:MM ascending, 30m steps
  slotHeight: number;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

interface TaskBlockProps {
  task: Task;
  slotHeight: number;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

const TaskBlock: React.FC<TaskBlockProps> = ({ task, slotHeight, onToggleComplete, onEditTask, updateTask }) => {
  const [resizing, setResizing] = useState(false);
  const [previewMinutes, setPreviewMinutes] = useState<number | null>(null);
  const startYRef = useRef(0);
  const originalMinutesRef = useRef(0);
  // Track whether last interaction was a resize to suppress unintended click -> edit
  const wasResizingRef = useRef(false);

  const startHour = task.scheduledTime ? parseInt(task.scheduledTime.split(':')[0]) : 0;
  const startMinute = task.scheduledTime ? parseInt(task.scheduledTime.split(':')[1]) : 0;
  const startIndex = startHour * 2 + (startMinute >= 30 ? 1 : 0);

  const currentMinutes = previewMinutes ?? task.timeEstimate ?? 30;
  const slots = Math.max(1, Math.ceil(currentMinutes / 30));
  const height = slots * slotHeight;
  const top = startIndex * slotHeight;

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    setResizing(true);
  wasResizingRef.current = true;
    startYRef.current = e.clientY;
    originalMinutesRef.current = task.timeEstimate ?? 30;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (!resizing) return;
    const deltaY = e.clientY - startYRef.current;
    const slotsDelta = Math.round(deltaY / slotHeight); // each slotHeight px = 30m
    const newMinutes = Math.max(30, originalMinutesRef.current + slotsDelta * 30);
    setPreviewMinutes(newMinutes);
  }, [resizing, slotHeight]);

  const handleResizeEnd = useCallback(() => {
    if (!resizing) return;
    setResizing(false);
    if (previewMinutes && previewMinutes !== task.timeEstimate) {
      updateTask(task.id, { timeEstimate: previewMinutes });
    }
    setPreviewMinutes(null);
  // Allow a short window where click is ignored so mouseup doesn't trigger edit
  setTimeout(() => { wasResizingRef.current = false; }, 80);
  }, [resizing, previewMinutes, task.id, task.timeEstimate, updateTask]);

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

  const endTotalMinutes = startHour * 60 + startMinute + currentMinutes;
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMinute = endTotalMinutes % 60;
  const endTime = `${endHour.toString().padStart(2,'0')}:${endMinute.toString().padStart(2,'0')}`;

  return (
    <div
      className={`absolute left-1 right-1 rounded-md border border-green-500/40 bg-green-500/15 backdrop-blur-sm overflow-hidden group ${resizing ? 'ring-2 ring-green-400' : ''}`}
      style={{ top, height }}
      onClick={(e) => {
        e.stopPropagation();
        if (resizing || wasResizingRef.current) return; // suppress edit when resizing
        onEditTask(task);
      }}
    >
      <div className="p-2 h-full flex flex-col gap-1 select-none text-xs text-gray-200">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium leading-tight line-clamp-3 flex-1">{task.title}</h4>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${task.status==='completed' ? 'bg-green-400 border-green-300 text-green-900' : 'border-green-400 hover:bg-green-400/20'}`}
          >
            {task.status === 'completed' && '✓'}
          </button>
        </div>
        {task.description && height >= slotHeight * 3 && (
          <p className="text-[11px] text-gray-400 line-clamp-3">{task.description}</p>
        )}
        {task.tags.length>0 && height >= slotHeight * 4 && (
          <div className="flex gap-1 flex-wrap">
            {task.tags.slice(0,3).map(tag => (
              <span key={tag} className="px-1 py-0.5 bg-green-500/25 rounded text-[10px] text-green-300">{tag}</span>
            ))}
            {task.tags.length>3 && <span className="px-1 py-0.5 bg-gray-600/40 rounded text-[10px]">+{task.tags.length-3}</span>}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between text-[10px] text-green-300 pt-1 border-t border-green-500/30">
          <span>{task.scheduledTime} - {endTime}</span>
          <span>{currentMinutes}m</span>
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-green-400/0 group-hover:bg-green-400/20 flex items-center justify-center text-[8px] text-green-300"
        onPointerDown={handleResizeStart}
      >
        ⋮
      </div>
    </div>
  );
};

const DayCalendarColumn: React.FC<DayCalendarColumnProps> = ({ day, timeSlots, slotHeight, onToggleComplete, onEditTask, updateTask }) => {
  // All scheduled tasks for this day
  const scheduled = day.tasks.filter(t => t.scheduledTime);

  // Droppable zones for each slot
  return (
    <div className="relative flex-1 min-w-[180px] border-r border-gray-800" style={{ height: timeSlots.length * slotHeight }}>
      {/* Grid lines */}
      {timeSlots.map((t, idx) => (
        <div
          key={t + '-grid'}
          className={`absolute left-0 right-0 ${t.endsWith(':00') ? 'border-t border-gray-800' : 'border-t border-gray-800/50'} pointer-events-none`}
          style={{ top: idx * slotHeight }}
        />
      ))}
      {/* Droppable overlays */}
      {timeSlots.map((t, idx) => {
        const { setNodeRef, isOver } = useDroppable({ id: `slot|${day.id}|${t}` });
        return (
          <div
            key={t}
            ref={setNodeRef}
            className={`absolute left-0 right-0 ${isOver ? 'bg-green-500/20' : ''}`}
            style={{ top: idx * slotHeight, height: slotHeight }}
          />
        );
      })}
      {/* Tasks */}
      {scheduled.map(task => (
        <TaskBlock
          key={task.id}
          task={task}
          slotHeight={slotHeight}
          onToggleComplete={onToggleComplete}
          onEditTask={onEditTask}
          updateTask={updateTask}
        />
      ))}
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
  // 30-minute time slots (48 slots)
  const slotHeight = 30; // px per 30m
  const START_HOUR = 9; // default scroll-to hour
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const initialScrollDone = React.useRef(false);

  const timeSlots: string[] = Array.from({ length: 24 * 2 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const min = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2,'0')}:${min}`;
  });

  const hourLabels: { index: number; label: string }[] = Array.from({ length: 24 }, (_, h) => ({
    index: h * 2,
    label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
  }));

  const selectedDay = days.find(d => d.date === selectedDate);
  const selectedDayTasks = selectedDay?.tasks || [];
  const unscheduledTasks = selectedDayTasks.filter(t => !t.scheduledTime);

  // Scroll to START_HOUR once on mount
  React.useEffect(() => {
    if (!initialScrollDone.current && scrollRef.current) {
      const target = (START_HOUR * 2) * slotHeight - slotHeight * 2; // small offset so 9AM label not flush top
      scrollRef.current.scrollTop = Math.max(0, target);
      initialScrollDone.current = true;
    }
  }, [slotHeight]);

  return (
    <div className="flex-1 bg-gray-900 flex overflow-hidden">
      {/* Calendar Grid */}
  <div ref={scrollRef} className="flex-1 overflow-auto">
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

          {/* Calendar grid with 30m slots */}
          <div className="relative flex">
            {/* Time axis */}
            <div className="w-14 flex-shrink-0 border-r border-gray-800 relative" style={{ height: timeSlots.length * slotHeight }}>
              {hourLabels.map(h => (
                <div
                  key={h.index}
                  className="absolute right-1 pr-1 text-[10px] md:text-xs text-gray-500 select-none"
                  style={{ top: h.index * slotHeight + 2 }}
                >
                  {h.label}
                </div>
              ))}
            </div>
            {/* Day columns */}
            {days.map(day => (
              <DayCalendarColumn
                key={day.id}
                day={day}
                timeSlots={timeSlots}
                slotHeight={slotHeight}
                onToggleComplete={onToggleComplete}
                onEditTask={onEditTask}
                updateTask={updateTask}
              />
            ))}
            {/* Current time marker */}
            {(() => {
              const now = new Date();
              const todayId = new Date().toISOString().split('T')[0];
              const minutes = now.getHours() * 60 + now.getMinutes();
              const top = (minutes / 30) * slotHeight;
              const columnIndex = days.findIndex(d => d.id === todayId);
              if (columnIndex === -1) return null;
              return (
                <div
                  className="pointer-events-none absolute flex"
                  style={{ left: `calc(56px + ${columnIndex} * 180px)`, top }}
                >
                  <div className="w-2 h-2 -ml-1 rounded-full bg-red-500" />
                  <div className="h-px w-[180px] bg-red-500/70" />
                </div>
              );
            })()}
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