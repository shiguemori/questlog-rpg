
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'home', icon: '🏠', label: 'Dashboard' },
    { id: 'tasks', icon: '📜', label: 'Quests' },
    { id: 'hero', icon: '🛡️', label: 'Hero' },
    { id: 'stats', icon: '📊', label: 'Stats' },
  ];

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-900 overflow-hidden shadow-2xl relative">
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 pb-safe-area">
        <div className="flex justify-around items-center py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center transition-all duration-300 ${
                activeTab === item.id ? 'text-amber-400 scale-110' : 'text-slate-400 opacity-60'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
