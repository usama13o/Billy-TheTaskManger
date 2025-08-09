export interface Task {
  id: string;
  title: string;
  description?: string;
  timeEstimate: number; // in minutes
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  tags: string[];
}

export interface DayColumn {
  id: string;
  date: string;
  dayName: string;
  tasks: Task[];
}

export type ViewMode = 'board' | 'calendar';

export interface TimeSlot {
  hour: number;
  time: string;
  displayTime: string;
}

export interface CalendarTimeSlot {
  time: string;
  tasks: Task[];
}