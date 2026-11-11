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
    },
  };
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return { ...createInitialState(), ...(JSON.parse(raw) as AppState) };
  } catch {
    return createInitialState();
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
