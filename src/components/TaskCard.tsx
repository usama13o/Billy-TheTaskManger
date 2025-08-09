import React from 'react';
import { Task } from '../types';
import { Clock, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  isDragging?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onToggleComplete, 
  onEdit, 
  isDragging = false 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-500/10';
      case 'medium': return 'border-yellow-500 bg-yellow-500/10';
      case 'low': return 'border-green-500 bg-green-500/10';
      default: return 'border-gray-600 bg-gray-700/50';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-gray-800 rounded-lg p-3 border-l-4 ${getPriorityColor(task.priority)}
        cursor-grab active:cursor-grabbing transition-all duration-200
        hover:bg-gray-750 hover:scale-[1.02] group
        ${isDragging ? 'opacity-50 scale-95' : ''}
      `}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          className="mt-1 text-gray-400 hover:text-green-400 transition-colors"
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <h3 className={`
            text-sm font-medium text-gray-200 leading-tight
            ${task.status === 'completed' ? 'line-through text-gray-500' : ''}
          `}>
            {task.title}
          </h3>
          
          {task.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{task.timeEstimate}m</span>
            </div>
            
            {task.priority === 'high' && (
              <AlertTriangle className="w-3 h-3 text-red-400" />
            )}
          </div>

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.slice(0, 2).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-md"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-md">
                  +{task.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};