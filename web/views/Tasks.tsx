
import React, { useState } from 'react';
import { Task, Category, Difficulty, AppState } from '../types';
import TaskItem from '../components/TaskItem';
import { XP_REWARDS } from '../constants';

interface TasksProps {
  state: AppState;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  onToggleTask: (id: string) => void;
}

const Tasks: React.FC<TasksProps> = ({ state, onAddTask, onToggleTask }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL');
  
  // New Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Category>(Category.WORK);
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTask({
      title: newTitle,
      category: newCategory,
      difficulty: newDifficulty,
      xp: XP_REWARDS[newDifficulty],
      isRecurring: false,
    });

    setNewTitle('');
    setIsModalOpen(false);
  };

  const filteredTasks = filter === 'ALL' 
    ? state.tasks 
    : state.tasks.filter(t => t.category === filter);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Current Quests</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-12 h-12 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg shadow-amber-500/20 active:scale-90 transition-all"
        >
          +
        </button>
      </div>

      {/* Categories Scroller */}
      <div className="flex gap-2 overflow-x-auto mb-6 pb-2 no-scrollbar">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            filter === 'ALL' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'
          }`}
        >
          All Realms
        </button>
        {Object.values(Category).map(cat => (
          <button 
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filter === cat ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <span className="text-6xl mb-4 block">🕯️</span>
            <p className="font-bold uppercase tracking-widest text-sm">Your scroll is empty...</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskItem key={task.id} task={task} onToggle={onToggleTask} />
          ))
        )}
      </div>

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-700 shadow-2xl p-6">
            <h3 className="text-xl font-black text-white mb-6 uppercase">Proclaim New Quest</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Quest Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Defeat the laundry dragon..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Category</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as Category)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none"
                  >
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Danger Level</label>
                  <select 
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as Difficulty)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none"
                  >
                    {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-400 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
                >
                  Flee
                </button>
                <button 
                  type="submit"
                  className="flex-[2] bg-amber-500 text-slate-900 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Accept Quest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
