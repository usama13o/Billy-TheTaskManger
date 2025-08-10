import React from 'react';
import { ViewMode } from '../types';
import { Calendar, Columns3, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentWeekStart: Date;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToday: () => void;
  onOpenExport: () => void;
  onGenerateSummary: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  currentWeekStart,
  onNavigateWeek,
  theme,
  onToggleTheme,
  onToday,
  onOpenExport,
  onGenerateSummary
}) => {
  return (
    <div className="p-4 border-b transition-colors bg-[var(--color-bg)] border-[var(--color-border)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Billy</h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateWeek('prev')}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-[var(--color-muted)] min-w-[120px] text-center">
              {format(currentWeekStart, 'MMM d, yyyy')}
            </span>
            
            <button
              onClick={() => onNavigateWeek('next')}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={onToday}
              className="ml-2 px-3 py-1.5 rounded-md border text-xs font-medium border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
            >Today</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenExport}
            className="px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2 border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
            title="Export tasks"
          >
            <span>Export</span>
          </button>
          <button
            onClick={onGenerateSummary}
            className="px-3 py-2 rounded-md border text-sm font-medium flex items-center gap-2 border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
            title="Weekly AI Summary"
          >
            <span>AI Summary</span>
          </button>
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-md border text-sm flex items-center gap-1 transition-colors border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <div className="rounded-lg p-1 flex bg-[var(--color-bg-alt)] border border-[var(--color-border)]">
            <button
              onClick={() => onViewModeChange('board')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'board' ? 'bg-green-500 text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}
            >
              <Columns3 className="w-4 h-4 inline mr-2" />
              Board
            </button>
            <button
              onClick={() => onViewModeChange('calendar')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-green-500 text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}
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