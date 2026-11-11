
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Tasks from './views/Tasks';
import Hero from './views/Hero';
import Stats from './views/Stats';
import { loadState, saveState } from './utils/storage';
import { AppState, Task, Category, Difficulty, Attributes } from './types';
import { XP_GROWTH_FACTOR, XP_REWARDS } from './constants';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState());
  const [activeTab, setActiveTab] = useState('home');

  // Persistence
  useEffect(() => {
    saveState(state);
  }, [state]);

  const addXP = useCallback((amount: number) => {
    setState(prev => {
      let newXp = prev.character.xp + amount;
      let newLevel = prev.character.level;
      let newMaxXp = prev.character.maxXp;
      let newAttributePoints = prev.character.attributePoints;

      // Level up logic
      while (newXp >= newMaxXp) {
        newXp -= newMaxXp;
        newLevel += 1;
        newMaxXp = Math.floor(newMaxXp * XP_GROWTH_FACTOR);
        newAttributePoints += 2; // Gain 2 points per level
      }

      // Check daily streak
      const today = new Date().toISOString().split('T')[0];
      const lastDate = prev.stats.lastCompletedDate;
      let newStreak = prev.stats.streak;

      if (lastDate === null) {
        newStreak = 1;
      } else if (lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastDate === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }

      return {
        ...prev,
        character: {
          ...prev.character,
          level: newLevel,
          xp: newXp,
          maxXp: newMaxXp,
          attributePoints: newAttributePoints
        },
        stats: {
          ...prev.stats,
          totalXpEarned: prev.stats.totalXpEarned + amount,
          lastCompletedDate: today,
          streak: newStreak
        }
      };
    });
  }, []);

  const handleAddTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completed: false,
    };
    setState(prev => ({
      ...prev,
      tasks: [newTask, ...prev.tasks]
    }));
  };

  const handleToggleTask = (id: string) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.completed) return;

    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: true } : t),
      stats: {
        ...prev.stats,
        totalTasksCompleted: prev.stats.totalTasksCompleted + 1
      }
    }));
    
    // Add XP reward
    addXP(task.xp);
  };

  const handleAllocatePoint = (attr: keyof Attributes) => {
    setState(prev => {
      if (prev.character.attributePoints <= 0) return prev;
      return {
        ...prev,
        character: {
          ...prev.character,
          attributePoints: prev.character.attributePoints - 1,
          attributes: {
            ...prev.character.attributes,
            [attr]: prev.character.attributes[attr] + 1
          }
        }
      };
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard state={state} />;
      case 'tasks':
        return <Tasks state={state} onAddTask={handleAddTask} onToggleTask={handleToggleTask} />;
      case 'hero':
        return <Hero state={state} onAllocatePoint={handleAllocatePoint} />;
      case 'stats':
        return <Stats state={state} />;
      default:
        return <Dashboard state={state} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default App;
