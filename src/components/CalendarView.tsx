import React from 'react';
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
}

interface CalendarTimeSlotProps {
  dayId: string;
  time: string;
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}

const CalendarTimeSlotComponent: React.FC<CalendarTimeSlotProps> = ({ dayId, time, tasks, onToggleComplete, onEditTask }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot|${dayId}|${time}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[180px] min-h-[52px] p-1.5 border-r border-gray-800 transition-colors ${
        isOver ? 'bg-green-900/40' : 'hover:bg-gray-800/40'
      }`}
    >
      <div className="space-y-1">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onEdit={onEditTask}
          />
        ))}
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  days,
  selectedDate,
  onDateSelect,
  onToggleComplete,
  onEditTask
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
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10">
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
          <div>
            {timeSlots.map(({ time, displayTime }) => (
              <div key={time} className="flex border-b border-gray-800">
                <div className="w-14 flex-shrink-0 p-1.5 pr-2 text-[10px] md:text-xs text-gray-500 text-right border-r border-gray-800">
                  {displayTime}
                </div>
                {days.map(day => (
                  <CalendarTimeSlotComponent
                    key={`slot-${day.id}-${time}`}
                    dayId={day.id}
                    time={time}
                    tasks={day.tasks.filter(t => t.scheduledTime === time)}
                    onToggleComplete={onToggleComplete}
                    onEditTask={onEditTask}
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