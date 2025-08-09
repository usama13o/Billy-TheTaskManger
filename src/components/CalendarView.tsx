import React from 'react';
import { DayColumn, Task, TimeSlot } from '../types';
import { TaskCard } from './TaskCard';
import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
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

const CalendarTimeSlotComponent: React.FC<CalendarTimeSlotProps> = ({
  dayId,
  time,
  tasks,
  onToggleComplete,
  onEditTask
}) => {
  const { setNodeRef } = useDroppable({
    id: `${dayId}-${time}`
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex-1 min-w-[200px] min-h-[60px] p-2 border-r border-gray-700 hover:bg-gray-800/50 transition-colors"
    >
      <div className="space-y-1">
        {tasks.map((task) => (
          <div key={task.id} className="scale-90 origin-top-left">
            <TaskCard
              task={task}
              onToggleComplete={onToggleComplete}
              onEdit={onEditTask}
            />
          </div>
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

  const selectedDay = days.find(day => day.date === selectedDate);
  const selectedDayTasks = selectedDay?.tasks || [];
  const unscheduledTasks = selectedDayTasks.filter(task => !task.scheduledTime);

  return (
    <div className="flex-1 bg-gray-900 flex overflow-hidden">
      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10">
            <div className="flex">
              <div className="w-16 flex-shrink-0 bg-gray-900"></div>
              {days.map((day) => {
                const isToday = day.date === new Date().toISOString().split('T')[0];
                const isSelected = day.date === selectedDate;
                return (
                  <div 
                    key={day.id} 
                    onClick={() => onDateSelect(day.date)}
                    className={`flex-1 min-w-[200px] p-4 text-center border-r border-gray-700 cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-500/20' : 
                      isToday ? 'bg-green-500/10' : 'hover:bg-gray-800'
                    }`}
                  >
                    <div className={`font-semibold ${
                      isSelected ? 'text-green-300' :
                      isToday ? 'text-green-400' : 'text-white'
                    }`}>
                      {day.dayName}
                    </div>
                    {isToday && (
                      <div className="text-xs text-green-400 mt-1">Today</div>
                    )}
                    {isSelected && !isToday && (
                      <div className="text-xs text-green-300 mt-1">Selected</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div className="relative">
            {timeSlots.map(({ time, hour, displayTime }) => (
              <div key={time} className="flex border-b border-gray-800">
                <div className="w-16 flex-shrink-0 p-2 text-xs text-gray-400 text-right border-r border-gray-700">
                  {displayTime}
                </div>
                
                {days.map((day) => (
                  <CalendarTimeSlotComponent
                    key={`${day.id}-${time}`}
                    dayId={day.id}
                    time={time}
                    tasks={day.tasks.filter(task => 
                      task.scheduledTime?.startsWith(time.split(':')[0])
                    )}
                    onToggleComplete={onToggleComplete}
                    onEditTask={onEditTask}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day Tasks Sidebar */}
      <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">
              {selectedDay ? selectedDay.dayName : 'Select a Day'}
            </h2>
          </div>
          
          {selectedDay && (
            <div className="text-sm text-gray-400">
              {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''} scheduled
              {unscheduledTasks.length > 0 && (
                <span className="text-yellow-400 ml-2">
                  ({unscheduledTasks.length} unscheduled)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedDay ? (
            <div className="p-4 space-y-4">
              {/* Unscheduled Tasks */}
              {unscheduledTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Unscheduled Tasks
                  </h3>
                  <div className="space-y-2">
                    {unscheduledTasks.map((task) => (
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

              {/* Scheduled Tasks */}
              {selectedDayTasks.filter(task => task.scheduledTime).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Scheduled Tasks
                  </h3>
                  <div className="space-y-2">
                    {selectedDayTasks
                      .filter(task => task.scheduledTime)
                      .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
                      .map((task) => (
                        <div key={task.id} className="bg-gray-800 rounded-lg p-3 border-l-4 border-green-500">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-green-400 font-medium">
                              {task.scheduledTime}
                            </span>
                            <span className="text-xs text-gray-400">
                              {task.timeEstimate}m
                            </span>
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
                <div className="text-center py-8 text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks scheduled</p>
                  <p className="text-sm mt-1">Drag tasks from Brain Dump or other days</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a day to view tasks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};