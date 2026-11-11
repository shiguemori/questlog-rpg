
import React from 'react';
import { AppState, CharacterClass } from '../types';
import ProgressBar from '../components/ProgressBar';
import { CLASS_DEFAULTS } from '../constants';

interface DashboardProps {
  state: AppState;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const { character, tasks, stats } = state;
  const pendingTasks = tasks.filter(t => !t.completed).length;
  const completedToday = tasks.filter(t => t.completed).length;
  
  const classInfo = CLASS_DEFAULTS[character.characterClass];

  return (
    <div className="p-6">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">
            QUEST<span className="text-amber-400">LOG</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">Welcome back, Traveler</p>
        </div>
        <div className="bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2">
          <span className="text-orange-500 text-lg">🔥</span>
          <span className="font-bold text-white">{stats.streak}d Streak</span>
        </div>
      </header>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 border-2 border-indigo-500/30 shadow-2xl mb-8 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 text-9xl opacity-10 pointer-events-none">
          {classInfo.icon}
        </div>
        
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-slate-800 rounded-2xl border-4 border-amber-500/50 flex items-center justify-center text-5xl shadow-inner transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            {classInfo.icon}
          </div>
          <div>
            <h2 className="rpg-font text-xs text-amber-400 mb-1">LVL {character.level}</h2>
            <h3 className="text-2xl font-black text-white uppercase tracking-wider">{character.name}</h3>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{character.characterClass}</p>
          </div>
        </div>

        <ProgressBar 
          label="EXPERIENCE"
          value={character.xp} 
          max={character.maxXp} 
          color="bg-amber-400"
        />
      </div>

      {/* Daily Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Quests Pending</p>
          <p className="text-3xl font-black text-white">{pendingTasks}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Completed Today</p>
          <p className="text-3xl font-black text-green-400">{completedToday}</p>
        </div>
      </div>

      {/* Tip of the day */}
      <div className="bg-slate-800 p-4 rounded-2xl border-l-4 border-amber-500">
        <h4 className="font-bold text-amber-400 text-xs uppercase tracking-widest mb-1">Divine Wisdom</h4>
        <p className="text-slate-300 text-sm leading-relaxed">
          Complete tasks before sunset to gain a <span className="text-amber-400 font-bold">+20% XP</span> night owl bonus!
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
