import React from 'react';
import { ViewMode } from '../types';
import { Calendar, Columns3, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentWeekStart: Date;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  currentWeekStart,
  onNavigateWeek
}) => {
  return (
    <div className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">TaskScheduler</h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateWeek('prev')}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-gray-300 min-w-[120px] text-center">
              {format(currentWeekStart, 'MMM d, yyyy')}
            </span>
            
            <button
              onClick={() => onNavigateWeek('next')}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-gray-800 rounded-lg p-1 flex">
            <button
              onClick={() => onViewModeChange('board')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'board'
                  ? 'bg-green-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Columns3 className="w-4 h-4 inline mr-2" />
              Board
            </button>
            <button
              onClick={() => onViewModeChange('calendar')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'calendar'
                  ? 'bg-green-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};