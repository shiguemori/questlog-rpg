
import React from 'react';
import { AppState } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface StatsProps {
  state: AppState;
}

const Stats: React.FC<StatsProps> = ({ state }) => {
  const { stats, tasks } = state;

  // Aggregate completion by category
  const categoriesCount = tasks.reduce((acc, task) => {
    if (task.completed) {
      acc[task.category] = (acc[task.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoriesCount).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#64748b'];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Adventure Logs</h2>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total XP</p>
          <p className="text-2xl font-black text-amber-400">{stats.totalXpEarned}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Quests</p>
          <p className="text-2xl font-black text-blue-400">{stats.totalTasksCompleted}</p>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 mb-8">
        <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6">Quests by Realm</h3>
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 italic text-sm">
              Complete quests to unlock insights
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-3xl border-2 border-slate-800 border-dashed">
        <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Milestone Tracker</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between opacity-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🌟</span>
              <span className="text-sm font-bold text-slate-300">Level 10 reached</span>
            </div>
            <span className="text-xs text-slate-500 font-bold">LOCKED</span>
          </div>
          <div className="flex items-center justify-between opacity-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🏆</span>
              <span className="text-sm font-bold text-slate-300">100 Quests Cleared</span>
            </div>
            <span className="text-xs text-slate-500 font-bold">LOCKED</span>
          </div>
          <div className="flex items-center justify-between opacity-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔥</span>
              <span className="text-sm font-bold text-slate-300">30 Day Streak</span>
            </div>
            <span className="text-xs text-slate-500 font-bold">LOCKED</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
