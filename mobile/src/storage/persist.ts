import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLASS_DEFAULTS, INITIAL_MAX_XP } from '../domain/constants';
import type { AppState } from '../domain/types';

const STORAGE_KEY = 'QUESTLOG_RPG_MOBILE_V1';

export function createInitialState(): AppState {
  return {
    onboardingDone: false,
    character: {
      name: '',
      characterClass: 'WARRIOR',
      level: 1,
      xp: 0,
      maxXp: INITIAL_MAX_XP,
      attributes: { ...CLASS_DEFAULTS.WARRIOR.attributes },
      attributePoints: 0,
    },
    quests: [],
    stats: {
      streak: 0,
      lastCompletedDate: null,
      totalXpEarned: 0,
      totalQuestsCompleted: 0,
      dailyXpCompletions: 0,
      dailyXpCompletionsDate: null,
    },
  };
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = createInitialState();
    return {
      ...base,
      ...parsed,
      character: { ...base.character, ...parsed.character },
      stats: { ...base.stats, ...parsed.stats },
      quests: parsed.quests ?? base.quests,
    };
  } catch {
    return createInitialState();
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
