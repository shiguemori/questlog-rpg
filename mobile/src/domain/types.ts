import type { Bestiary } from './bestiary';
import type { DailyChallenges } from './challenges';
import type { Inventory } from './loot';
import type { WeekRecord } from './weekly';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type Category = 'STUDY' | 'WORK' | 'HEALTH' | 'HOME' | 'OTHER';
export type CharacterClass = 'WARRIOR' | 'MAGE' | 'ROGUE' | 'ARCHER' | 'DRUID' | 'BARD' | 'MONK';
/** Quando a missão volta: todo dia, de segunda a sexta ou uma vez por semana. */
export type RepeatRule = 'DAILY' | 'WEEKDAYS' | 'WEEKLY';

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
  /** Tem repetição (`repeat`). Mantido para saves e telas antigas. */
  recurring: boolean;
  /** Quando reabre (ver `schedule.ts`). Ausente = não repete. */
  repeat?: RepeatRule;
  /** Vezes seguidas que a missão foi feita na vez certa. */
  streak?: number;
  /** Dia (YYYY-MM-DD) da última conclusão desta missão. */
  lastDoneOn?: string;
}

export interface Attributes {
  strength: number;
  intelligence: number;
  agility: number;
  vitality: number;
}

export type AttributeKey = keyof Attributes;

/** Vida guardada depois de uma luta. Ausente = vida cheia. */
export interface HeroVitals {
  hp: number;
  /** ISO 8601 do fim da última luta. A vida recupera a partir daqui. */
  updatedAt: string;
}

export interface Character {
  name: string;
  characterClass: CharacterClass;
  level: number;
  xp: number;
  maxXp: number;
  attributes: Attributes;
  attributePoints: number;
  /** Vida entre as batalhas (ver `vitals.ts`). */
  vitals?: HeroVitals;
  /** Ids dos talentos aprendidos (ver `talents.ts`). Ausente = nenhum. */
  talents?: string[];
  /** Ids das habilidades levadas para a luta. Ausente = as iniciais. */
  loadout?: string[];
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
  /** Já viu a dica de como lutar (aparece na primeira batalha). */
  battleTutorialDone: boolean;
  /** Volume da trilha da batalha (0 = desligada). Independe do Som dos efeitos. */
  musicVolume: MusicVolume;
  /** Semana (segunda-feira) cujo resumo já foi visto. */
  dismissedRecapWeek: string | null;
  /** Cartão "Desafios de hoje" recolhido na tela principal. */
  challengesCollapsed: boolean;
}

export type MusicVolume = 0 | 0.3 | 0.6 | 1;

/** Progresso do chefe da semana (ver `boss.ts`). Datas em YYYY-MM-DD. */
export interface WeeklyBoss {
  /** Segunda-feira da semana contada em `wins`. */
  weekKey: string | null;
  wins: number;
  /** Semana (segunda-feira) em que o chefe foi vencido. */
  beatenWeek: string | null;
  /** Dia da última tentativa (uma por dia). */
  triedOn: string | null;
}

export interface AppState {
  onboardingDone: boolean;
  character: Character;
  quests: Quest[];
  stats: UserStats;
  settings: PlayerSettings;
  /** Equipamento e poções (ver `loot.ts`). */
  inventory: Inventory;
  weeklyBoss: WeeklyBoss;
  /** Três desafios do dia (ver `challenges.ts`). */
  dailyChallenges: DailyChallenges;
  /** Resumo das últimas semanas, da mais antiga para a mais nova (ver `weekly.ts`). */
  weeks: WeekRecord[];
  /** Monstros vencidos e jeitos de lutar já vistos (ver `bestiary.ts`). */
  bestiary: Bestiary;
  /** Modo foco rodando (ver `focus.ts`), ou null. */
  focus: FocusSession | null;
}

/** Cronômetro de foco numa quest aberta. `startedAt` em ISO 8601. */
export interface FocusSession {
  questId: string;
  startedAt: string;
  minutes: number;
}
