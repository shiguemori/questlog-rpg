export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type Category = 'STUDY' | 'WORK' | 'HEALTH' | 'HOME' | 'OTHER';
export type CharacterClass = 'WARRIOR' | 'MAGE' | 'ROGUE';

export interface Quest {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  xp: number;
  completed: boolean;
  /** ISO 8601 — base do anti-farm (idade mínima da quest). */
  createdAt: string;
  /** ISO 8601 do momento da conclusão. Ausente em saves antigos. */
  completedAt?: string;
}

export interface Attributes {
  strength: number;
  intelligence: number;
  agility: number;
  vitality: number;
}

export type AttributeKey = keyof Attributes;

export interface Character {
  name: string;
  characterClass: CharacterClass;
  level: number;
  xp: number;
  maxXp: number;
  attributes: Attributes;
  attributePoints: number;
}

export interface UserStats {
  streak: number;
  /** Maior streak já atingido — base das conquistas de constância. */
  bestStreak: number;
  /** Dia civil local (YYYY-MM-DD) da última conclusão. */
  lastCompletedDate: string | null;
  totalXpEarned: number;
  totalQuestsCompleted: number;
  /** Contagem de quests que geraram XP no dia `dailyXpCompletionsDate`. */
  dailyXpCompletions: number;
  /** Dia civil (YYYY-MM-DD) da contagem anti-farm diária. */
  dailyXpCompletionsDate: string | null;
}

export interface AppState {
  onboardingDone: boolean;
  character: Character;
  quests: Quest[];
  stats: UserStats;
}
