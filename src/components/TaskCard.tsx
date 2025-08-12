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
  draggable?: boolean; // disable drag when false (e.g., sidebar preview)
  compact?: boolean; // mobile-optimized compact view
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onToggleComplete, 
  onEdit, 
  isDragging = false,
  draggable = true,
  compact = false
}) => {
  let attributes: any = {};
  let listeners: any = {};
  let setNodeRef: (el: HTMLElement | null) => void = () => {};
  let style: any = undefined;

  if (draggable) {
    const sortable = useSortable({ id: task.id });
    attributes = sortable.attributes;
    listeners = sortable.listeners;
    setNodeRef = sortable.setNodeRef;
    style = {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
    };
  }

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
      ref={draggable ? setNodeRef : undefined}
      style={style}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={`
        bg-gray-800 rounded-lg border-l-4 ${getPriorityColor(task.priority)}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-all duration-200
        hover:bg-gray-750 hover:scale-[1.02] group active:scale-95
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${compact ? 'p-2' : 'p-3'}
      `}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          className={`mt-1 text-gray-400 hover:text-green-400 transition-colors ${compact ? 'touch-manipulation' : ''}`}
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className={`text-green-400 ${compact ? 'w-4 h-4' : 'w-4 h-4'}`} />
          ) : (
            <Circle className={`${compact ? 'w-4 h-4' : 'w-4 h-4'}`} />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <h3 className={`
            font-medium text-gray-200 leading-tight
            ${task.status === 'completed' ? 'line-through text-gray-500' : ''}
            ${compact ? 'text-xs' : 'text-sm'}
          `}>
            {task.title}
          </h3>
          
          {task.description && !compact && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className={`flex items-center justify-between ${compact ? 'mt-1' : 'mt-2'}`}>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{task.timeEstimate}m</span>
            </div>
            
            {task.priority === 'high' && (
              <AlertTriangle className="w-3 h-3 text-red-400" />
            )}
          </div>

          {task.tags.length > 0 && !compact && (
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

          {task.tags.length > 0 && compact && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-green-400">
                {task.tags.slice(0, 1).join(', ')}
                {task.tags.length > 1 && ` +${task.tags.length - 1}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};