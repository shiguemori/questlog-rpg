
import React from 'react';
import { Task, Difficulty, Category } from '../types';
import { XP_REWARDS, CATEGORY_COLORS } from '../constants';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle }) => {
  const getDifficultyColor = (diff: Difficulty) => {
    switch (diff) {
      case Difficulty.EASY: return 'text-green-400';
      case Difficulty.MEDIUM: return 'text-amber-400';
      case Difficulty.HARD: return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div 
      onClick={() => !task.completed && onToggle(task.id)}
      className={`relative group mb-3 p-4 bg-slate-800 rounded-xl border-2 transition-all cursor-pointer ${
        task.completed 
          ? 'border-green-500 opacity-60 scale-[0.98]' 
          : 'border-slate-700 active:scale-95 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${CATEGORY_COLORS[task.category]}`}>
              {task.category}
            </span>
            <span className={`text-[10px] font-black tracking-widest uppercase ${getDifficultyColor(task.difficulty)}`}>
              {task.difficulty}
            </span>
          </div>
          <h3 className={`text-lg font-bold ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-1">{task.description}</p>
          )}
        </div>
        
        <div className="flex flex-col items-end ml-4">
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            task.completed ? 'bg-green-500 border-green-500' : 'border-slate-600'
          }`}>
            {task.completed && <span className="text-white">✓</span>}
          </div>
          <div className="mt-2 text-amber-400 font-bold text-sm">+{task.xp} XP</div>
        </div>
      </div>
      
      {task.isRecurring && (
        <div className="absolute -top-2 -right-2 bg-slate-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-slate-600">
          RECURRING
        </div>
      )}
    </div>
  );
};

export default TaskItem;
