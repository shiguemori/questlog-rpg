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
  createdAt: string;
}

export interface Attributes {
  strength: number;
  intelligence: number;
  agility: number;
  vitality: number;
}

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
  lastCompletedDate: string | null;
  totalXpEarned: number;
  totalQuestsCompleted: number;
}

export interface AppState {
  onboardingDone: boolean;
  character: Character;
  quests: Quest[];
  stats: UserStats;
}
