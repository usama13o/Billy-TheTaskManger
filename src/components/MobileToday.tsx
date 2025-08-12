import React from 'react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { Calendar, Plus, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface MobileTodayProps {
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onQuickAdd: () => void;
  currentDate: Date;
}

export const MobileToday: React.FC<MobileTodayProps> = ({
  tasks,
  onToggleComplete,
  onEditTask,
  onQuickAdd,
  currentDate
}) => {
  const todayTasks = tasks.filter(task => {
    const today = format(currentDate, 'yyyy-MM-dd');
    return task.scheduledDate === today;
  }).sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));

  const completedTasks = todayTasks.filter(task => task.status === 'completed');
  const pendingTasks = todayTasks.filter(task => task.status !== 'completed');

  const getTimeSlot = (task: Task) => {
    if (!task.scheduledTime) return 'No time set';
    const [hours, minutes] = task.scheduledTime.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="bg-gray-900 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Today</h2>
              <p className="text-xs text-gray-400">{format(currentDate, 'EEEE, MMM d')}</p>
            </div>
          </div>
          
          <button
            onClick={onQuickAdd}
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-xl transition-colors"
            aria-label="Add task for today"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Today stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{todayTasks.length}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="bg-green-500/20 rounded-xl p-3 text-center border border-green-500/30">
            <div className="text-lg font-bold text-green-400">{completedTasks.length}</div>
            <div className="text-xs text-gray-400">Done</div>
          </div>
          <div className="bg-orange-500/20 rounded-xl p-3 text-center border border-orange-500/30">
            <div className="text-lg font-bold text-orange-400">{pendingTasks.length}</div>
            <div className="text-xs text-gray-400">Pending</div>
          </div>
        </div>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto">
        {pendingTasks.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Tasks
            </h3>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="transform transition-transform active:scale-95">
                  <div className="bg-gray-800/50 rounded-xl p-1">
                    {task.scheduledTime && (
                      <div className="px-3 py-1">
                        <span className="text-xs text-blue-400 font-medium">
                          {getTimeSlot(task)}
                        </span>
                      </div>
                    )}
                    <TaskCard
                      task={task}
                      onToggleComplete={onToggleComplete}
                      onEdit={onEditTask}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="p-4 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-4 h-4 text-green-400">✓</span>
              Completed Today
            </h3>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div key={task.id} className="transform transition-transform active:scale-95">
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

        {todayTasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="bg-gray-800/50 rounded-2xl p-8">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-600" />
                <h3 className="text-lg font-semibold mb-2 text-gray-400">No plans for today</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  Schedule some tasks from your Brain Dump or create new ones.
                </p>
                <button
                  onClick={onQuickAdd}
                  className="px-6 py-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                >
                  Plan your day
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};