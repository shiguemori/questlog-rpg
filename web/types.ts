
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum Category {
  STUDY = 'STUDY',
  WORK = 'WORK',
  HEALTH = 'HEALTH',
  HOME = 'HOME',
  OTHER = 'OTHER'
}

export enum CharacterClass {
  WARRIOR = 'WARRIOR',
  MAGE = 'MAGE',
  ROGUE = 'ROGUE'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  xp: number;
  completed: boolean;
  dueDate?: string; // ISO string
  createdAt: string;
  isRecurring: boolean;
}

export interface Attributes {
  strength: number;
  intelligence: number;
  agility: number;
  vitality: number;
}

export interface Character {
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  characterClass: CharacterClass;
  attributes: Attributes;
  attributePoints: number;
}

export interface UserStats {
  streak: number;
  lastCompletedDate: string | null;
  totalXpEarned: number;
  totalTasksCompleted: number;
  history: {
    date: string;
    xpGained: number;
    tasksCount: number;
  }[];
}

export interface AppState {
  tasks: Task[];
  character: Character;
  stats: UserStats;
}
