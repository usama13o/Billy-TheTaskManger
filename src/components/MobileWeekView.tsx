import React from 'react';
import { Task, DayColumn } from '../types';
import { TaskCard } from './TaskCard';
import { Calendar, Plus, ArrowRight } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface MobileWeekViewProps {
  days: DayColumn[];
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onQuickAdd: () => void;
  currentWeekStart: Date;
}

export const MobileWeekView: React.FC<MobileWeekViewProps> = ({
  days,
  onToggleComplete,
  onEditTask,
  onQuickAdd,
  currentWeekStart
}) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekEnd = addDays(currentWeekStart, 6);

  const getTotalTasks = () => {
    return days.reduce((total, day) => total + day.tasks.length, 0);
  };

  const getCompletedTasks = () => {
    return days.reduce((total, day) => 
      total + day.tasks.filter(task => task.status === 'completed').length, 0
    );
  };

  const getDayColor = (day: DayColumn) => {
    if (day.date === today) return 'border-blue-500/50 bg-blue-500/10';
    if (day.tasks.length > 0) return 'border-green-500/30 bg-green-500/5';
    return 'border-gray-700 bg-gray-800/30';
  };

  const getDayTaskCount = (day: DayColumn) => {
    const pending = day.tasks.filter(task => task.status !== 'completed').length;
    const completed = day.tasks.filter(task => task.status === 'completed').length;
    return { pending, completed };
  };

  return (
    <div className="bg-gray-900 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Week View</h2>
              <p className="text-xs text-gray-400">
                {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          <button
            onClick={onQuickAdd}
            className="bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-xl transition-colors"
            aria-label="Add task for this week"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Week stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{getTotalTasks()}</div>
            <div className="text-xs text-gray-400">Total Tasks</div>
          </div>
          <div className="bg-green-500/20 rounded-xl p-3 text-center border border-green-500/30">
            <div className="text-lg font-bold text-green-400">{getCompletedTasks()}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
        </div>
      </div>

      {/* Days list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {days.map((day) => {
          const { pending, completed } = getDayTaskCount(day);
          const isToday = day.date === today;
          
          return (
            <div
              key={day.id}
              className={`rounded-xl border p-4 transition-all ${getDayColor(day)}`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className={`font-semibold ${isToday ? 'text-blue-400' : 'text-white'}`}>
                    {format(new Date(day.date + 'T00:00:00'), 'EEEE')}
                    {isToday && <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded-full">Today</span>}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {format(new Date(day.date + 'T00:00:00'), 'MMM d')}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {pending > 0 && (
                    <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full border border-orange-500/30">
                      {pending} pending
                    </span>
                  )}
                  {completed > 0 && (
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">
                      {completed} done
                    </span>
                  )}
                  {day.tasks.length > 0 && (
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>

              {/* Tasks preview */}
              {day.tasks.length > 0 ? (
                <div className="space-y-2">
                  {day.tasks.slice(0, 2).map((task) => (
                    <div key={task.id} className="transform transition-transform active:scale-95">
                      <TaskCard
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onEdit={onEditTask}
                        compact
                      />
                    </div>
                  ))}
                  {day.tasks.length > 2 && (
                    <div className="text-xs text-gray-500 text-center py-2">
                      +{day.tasks.length - 2} more tasks
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500">No tasks scheduled</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};