import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, Brain, Zap, Mic, Square } from 'lucide-react';
import { transcribeAudio, extractTasksFromText } from '../lib/voice';

interface MobileBrainDumpProps {
  tasks: Task[];
  onAddTask: (task: Partial<Task>) => void;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}

export const MobileBrainDump: React.FC<MobileBrainDumpProps> = ({
  tasks,
  onAddTask,
  onToggleComplete,
  onEditTask
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const addBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribeBusy, setTranscribeBusy] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);


  const handleAddTask = () => {
    const raw = newTaskTitle.trim();
    if (!raw) return;
    
    // Enhanced parsing for mobile quick entry
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
    // Keep adding mode active for rapid entry
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
        if (blob.size > 25 * 1024 * 1024) {
          setIsAdding(true);
          setNewTaskTitle('Voice note too long for transcription. Please try a shorter note.');
          return;
        }
        setTranscribeBusy(true);
        try {
          const text = await transcribeAudio(blob, 'whisper-1');
          if (text) {
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
    <div className="bg-gray-900 flex flex-col h-full">
      {/* Header with prominent branding */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-500/20 p-2 rounded-xl">
            <Brain className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Brain Dump</h2>
            <p className="text-xs text-gray-400">Capture thoughts instantly</p>
          </div>
        </div>
        
        {/* Enhanced quick add section */}
  {isAdding ? (
          <div ref={addBoxRef} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="What's on your mind?"
                className="w-full p-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/20 text-base"
                ref={inputRef}
                autoFocus
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Zap className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="flex-1 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors"
              >
                Add Task
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTaskTitle('');
                }}
                className="px-4 py-3 bg-gray-700 text-white text-sm rounded-xl hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribeBusy}
                className={`px-3 py-3 rounded-xl border text-white ${recording ? 'bg-red-600 border-red-700 hover:bg-red-500' : 'bg-indigo-600 border-indigo-700 hover:bg-indigo-500'} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                title={recording ? 'Stop and transcribe' : 'Record voice note'}
              >
                {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="text-xs">{recording ? 'Stop' : (transcribeBusy ? '...' : 'Voice')}</span>
              </button>
            </div>
            <p className="text-xs text-gray-500">
              💡 Tip: Use semicolons to separate title; description; priority (l/m/h)
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 p-4 border-2 border-dashed border-gray-600 rounded-xl text-gray-400 hover:border-green-400 hover:text-green-400 hover:bg-green-400/5 transition-all duration-200 flex items-center justify-center gap-3"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Capture a thought</span>
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribeBusy}
              className={`p-4 rounded-xl border text-white ${recording ? 'bg-red-600 border-red-700 hover:bg-red-500' : 'bg-indigo-600 border-indigo-700 hover:bg-indigo-500'} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              title={recording ? 'Stop and transcribe' : 'Record voice note'}
            >
              {recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>

      {/* Tasks list with enhanced mobile styling (no drag, just scroll/click) */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {tasks.map((task) => (
          <div key={task.id} className="transform transition-transform active:scale-95">
            <TaskCard
              task={task}
              onToggleComplete={onToggleComplete}
              onEdit={onEditTask}
              draggable={false}
            />
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="bg-gray-800/50 rounded-2xl p-8 mx-4">
              <Brain className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-600" />
              <h3 className="text-lg font-semibold mb-2 text-gray-400">Your mind is clear!</h3>
              <p className="text-sm leading-relaxed">
                Start by capturing your thoughts and ideas here. 
                This is your digital brain dump space.
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-4 px-6 py-2 bg-green-500/20 text-green-400 rounded-xl border border-green-500/30 hover:bg-green-500/30 transition-colors"
              >
                Add your first thought
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};