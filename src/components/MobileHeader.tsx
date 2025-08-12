import React from 'react';
import { ViewMode } from '../types';
import { ChevronLeft, ChevronRight, Plus, Calendar, Columns3, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface MobileHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentWeekStart: Date;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onToday: () => void;
  onQuickAdd: () => void;
  onResetFromCloud?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  viewMode,
  onViewModeChange,
  currentWeekStart,
  onNavigateWeek,
  onToday,
  onQuickAdd,
  onResetFromCloud
}) => {
  return (
    <div className="bg-gray-900 border-b border-gray-700 p-3">
      {/* Top row - Brand and Quick Add */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-green-400">🧠</span>
          Billy
        </h1>
        
        <div className="flex items-center gap-2">
          {onResetFromCloud && (
            <button
              onClick={onResetFromCloud}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 p-2 rounded-full border border-gray-700 transition-colors"
              aria-label="Reset from cloud"
              title="Reset from cloud"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onQuickAdd}
            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full shadow-lg transition-colors"
            aria-label="Quick add task"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Bottom row - Date navigation and view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateWeek('prev')}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={onToday}
            className="text-sm text-gray-300 min-w-[100px] text-center px-2 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            {format(currentWeekStart, 'MMM d')}
          </button>
          
          <button
            onClick={() => onNavigateWeek('next')}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Compact view mode toggle */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('board')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'board' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Board view"
          >
            <Columns3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'calendar' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Calendar view"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};