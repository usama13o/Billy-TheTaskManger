import React, { useState } from 'react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, Brain } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

interface BrainDumpProps {
  tasks: Task[];
  onAddTask: (task: Partial<Task>) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}

export const BrainDump: React.FC<BrainDumpProps> = ({
  tasks,
  onAddTask,
  onToggleComplete,
  onEditTask
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const { setNodeRef } = useDroppable({
    id: 'brain-dump'
  });

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      onAddTask({ title: newTaskTitle.trim() });
      setNewTaskTitle('');
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskTitle('');
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Brain Dump</h2>
        </div>
        
        {isAdding ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter task title..."
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-400"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTaskTitle('');
                }}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full p-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-green-400 hover:text-green-400 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add a task
          </button>
        )}
      </div>

      <div ref={setNodeRef} className="flex-1 p-4 overflow-y-auto space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onEdit={onEditTask}
          />
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tasks in brain dump</p>
            <p className="text-sm mt-1">Add tasks to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};