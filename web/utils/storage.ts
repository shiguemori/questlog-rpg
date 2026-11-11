
import { AppState, CharacterClass, Difficulty } from '../types';
import { INITIAL_MAX_XP, CLASS_DEFAULTS } from '../constants';

const STORAGE_KEY = 'QUESTLOG_RPG_DATA_V1';

export const loadState = (): AppState => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to load state", e);
    }
  }

  // Default state for first-time users
  return {
    tasks: [],
    character: {
      name: 'Hero',
      level: 1,
      xp: 0,
      maxXp: INITIAL_MAX_XP,
      characterClass: CharacterClass.WARRIOR,
      attributes: CLASS_DEFAULTS[CharacterClass.WARRIOR].attributes,
      attributePoints: 0
    },
    stats: {
      streak: 0,
      lastCompletedDate: null,
      totalXpEarned: 0,
      totalTasksCompleted: 0,
      history: []
    }
  };
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
