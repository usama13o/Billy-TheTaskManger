import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, Brain, Mic, Square } from 'lucide-react';
import { transcribeAudio, extractTasksFromText } from '../lib/voice';
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
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [transcribeBusy, setTranscribeBusy] = useState(false);
  const addBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { setNodeRef } = useDroppable({
    id: 'brain-dump'
  });

  const handleAddTask = () => {
    const raw = newTaskTitle.trim();
    if (!raw) return;
    // Split by semicolons: title; description; priority(l/m/h); rest appended to description
    const parts = raw.split(';').map(p => p.trim()).filter(p => p.length > 0);
    let title = parts[0] || 'Untitled';
    let description = '';
    let priority: Task['priority'] | undefined;
    if (parts.length > 1) description = parts[1];
    if (parts.length > 2) {
      const p = parts[2].toLowerCase();
      if (p.startsWith('l')) priority = 'low';
      else if (p.startsWith('m')) priority = 'medium';
      else if (p.startsWith('h')) priority = 'high';
      else description += (description ? ' ' : '') + parts[2];
    }
    if (parts.length > 3) {
      const extra = parts.slice(3).join('; ');
      description += (description ? '\n' : '') + extra;
    }
    onAddTask({ title, description, priority });
    setNewTaskTitle('');
    // stay in adding mode for rapid entry
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskTitle('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribeBusy(true);
        try {
          const text = await transcribeAudio(blob, 'whisper-1');
          if (text) {
            // Try to extract structured tasks
            const tasks = await extractTasksFromText(text);
            if (Array.isArray(tasks) && tasks.length > 0) {
              for (const t of tasks) {
                onAddTask({
                  title: t.title,
                  description: t.description,
                  priority: t.priority,
                  timeEstimate: t.timeEstimate,
                  tags: t.tags || ['voice']
                });
              }
            } else {
              // Fallback: put transcript into input so user can edit before adding
              setIsAdding(true);
              setNewTaskTitle(text);
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Transcription failed', err);
          setIsAdding(true);
        } finally {
          setTranscribeBusy(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Mic permission/error', e);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
      // stop tracks
      mr.stream.getTracks().forEach(t => t.stop());
    }
    setRecording(false);
  };

  // Click-away to exit add mode
  useEffect(() => {
    if (!isAdding) return;
    const handler = (e: MouseEvent) => {
      if (addBoxRef.current && !addBoxRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setNewTaskTitle('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isAdding]);

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Brain Dump</h2>
        </div>
        
  {isAdding ? (
          <div ref={addBoxRef} className="space-y-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter task title..."
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-400"
              ref={inputRef}
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
          <div className="flex gap-2">
            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 p-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-green-400 hover:text-green-400 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add a task
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribeBusy}
              className={`p-2 rounded-lg border text-white ${recording ? 'bg-red-600 border-red-700 hover:bg-red-500' : 'bg-indigo-600 border-indigo-700 hover:bg-indigo-500'} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              title={recording ? 'Stop and transcribe' : 'Record voice note'}
            >
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="text-xs">{recording ? 'Stop' : (transcribeBusy ? 'Transcribing…' : 'Voice')}</span>
            </button>
          </div>
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