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
  /** Hábito fixo: reabre no dia seguinte. O anti-farm vale de novo. */
  recurring: boolean;
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
  /**
   * Quests concluídas hoje (com ou sem XP). A meta diária usa isto.
   * O anti-farm continua só em `dailyXpCompletions`.
   */
  dailyCompletions: number;
  /** Dia civil (YYYY-MM-DD) de `dailyCompletions`. */
  dailyCompletionsDate: string | null;
  /** Dias civis com pelo menos uma conclusão. Teto 120, do mais antigo ao mais novo. */
  completionDays: string[];
}

export type DailyGoalTarget = 1 | 2 | 3;

export interface ReminderTime {
  hour: number;
  minute: number;
}

/** Preferências locais. Não dão XP e não furam o anti-farm. */
export interface PlayerSettings {
  dailyGoalTarget: DailyGoalTarget;
  reminder: ReminderTime | null;
  soundEnabled: boolean;
  dismissedSuggestionDate: string | null;
  /** `lastCompletedDate` para o qual a tela de retorno já foi dispensada. */
  dismissedReturnGap: string | null;
  streakShieldArmed: boolean;
  /** Dia em que o escudo foi gasto. No máximo um por mês. */
  streakShieldUsedOn: string | null;
}

export interface AppState {
  onboardingDone: boolean;
  character: Character;
  quests: Quest[];
  stats: UserStats;
  settings: PlayerSettings;
}
