import React from 'react';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  visible: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  onClick, 
  visible 
}) => {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 touch-manipulation"
      style={{
        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)'
      }}
      aria-label="Quick add task"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
};