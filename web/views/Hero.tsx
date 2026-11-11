
import React from 'react';
import { AppState, CharacterClass } from '../types';
import { CLASS_DEFAULTS } from '../constants';
import ProgressBar from '../components/ProgressBar';

interface HeroProps {
  state: AppState;
  onAllocatePoint: (attr: keyof AppState['character']['attributes']) => void;
  onResetPoints?: () => void;
}

const Hero: React.FC<HeroProps> = ({ state, onAllocatePoint }) => {
  const { character } = state;
  const classInfo = CLASS_DEFAULTS[character.characterClass];

  const attributeMap = [
    { key: 'strength', label: 'Strength', icon: '💪', color: 'text-red-400' },
    { key: 'intelligence', label: 'Intelligence', icon: '🧠', color: 'text-blue-400' },
    { key: 'agility', label: 'Agility', icon: '⚡', color: 'text-yellow-400' },
    { key: 'vitality', label: 'Vitality', icon: '❤️', color: 'text-green-400' },
  ] as const;

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="w-32 h-32 bg-slate-800 rounded-3xl border-4 border-amber-500 mx-auto flex items-center justify-center text-7xl mb-4 shadow-2xl relative">
          {classInfo.icon}
          <div className="absolute -bottom-4 bg-amber-500 px-4 py-1 rounded-full border-4 border-slate-900 text-slate-900 font-black text-xs">
            LVL {character.level}
          </div>
        </div>
        <h2 className="text-2xl font-black text-white uppercase mb-1">{character.name}</h2>
        <p className="text-amber-500 font-bold tracking-widest uppercase text-sm">{character.characterClass}</p>
      </div>

      {/* XP Bar */}
      <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 mb-8">
        <ProgressBar 
          label="Progress to Next Level"
          value={character.xp}
          max={character.maxXp}
          color="bg-amber-500"
        />
      </div>

      {/* Attributes Section */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Attributes</h3>
          {character.attributePoints > 0 && (
            <div className="bg-amber-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black animate-bounce">
              {character.attributePoints} POINTS AVAILABLE
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {attributeMap.map((attr) => (
            <div 
              key={attr.key}
              className={`flex items-center justify-between bg-slate-800/80 p-4 rounded-2xl border border-slate-700 transition-all ${
                character.attributePoints > 0 ? 'hover:border-amber-500 group cursor-pointer' : ''
              }`}
              onClick={() => character.attributePoints > 0 && onAllocatePoint(attr.key)}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{attr.icon}</span>
                <div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mb-1">{attr.label}</p>
                  <p className={`text-xl font-black ${attr.color}`}>{character.attributes[attr.key]}</p>
                </div>
              </div>
              
              {character.attributePoints > 0 && (
                <button 
                  className="w-10 h-10 bg-slate-700 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black group-hover:bg-amber-500 group-hover:text-slate-900 transition-all"
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Class Lore */}
      <div className="bg-slate-900 p-6 rounded-3xl border-2 border-slate-800 border-dashed">
        <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Class Description</h4>
        <p className="text-slate-400 text-sm italic leading-relaxed">
          {classInfo.description}
        </p>
      </div>
    </div>
  );
};

export default Hero;
