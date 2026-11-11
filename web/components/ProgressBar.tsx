
import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
  height?: string;
  showValue?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  value, 
  max, 
  label, 
  color = 'bg-amber-500', 
  height = 'h-3',
  showValue = true
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-xs font-bold text-slate-300">
        {label && <span className="uppercase tracking-wide">{label}</span>}
        {showValue && <span>{Math.floor(value)} / {max} XP</span>}
      </div>
      <div className={`w-full bg-slate-700 rounded-full overflow-hidden border border-slate-800 p-0.5 ${height}`}>
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)] ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
