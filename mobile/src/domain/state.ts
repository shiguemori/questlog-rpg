import { CATEGORIES, CLASS_DEFAULTS, INITIAL_MAX_XP, XP_REWARDS } from './constants';
import { backfillCompletionDays, COMPLETION_DAY_CAP } from './engagement';
import type {
  AppState,
  Attributes,
  Category,
  Character,
  CharacterClass,
  Difficulty,
  MusicVolume,
  PlayerSettings,
  Quest,
  RepeatRule,
  UserStats,
} from './types';
import { emptyBestiary, sanitizeBestiary } from './bestiary';
import { sanitizeFocus } from './focus';
import { emptyWeeklyBoss, sanitizeWeeklyBoss } from './boss';
import { emptyDailyChallenges, sanitizeDailyChallenges } from './challenges';
import { REPEAT_RULES } from './schedule';
import { sanitizeWeeks } from './weekly';
import { emptyInventory, sanitizeInventory } from './loot';
import { clampDailyGoalTarget } from './rewards';
import { sanitizeVitals } from './vitals';
import { LOADOUT_SIZE, sanitizeIdList } from './talents';
import { applyXp, maxXpForLevel } from './xp';

export const HERO_NAME_MAX_LENGTH = 24;
export const HERO_NAME_MIN_LENGTH = 2;
export const DEFAULT_HERO_NAME = 'Herói';

export function defaultPlayerSettings(): PlayerSettings {
  return {
    dailyGoalTarget: 1,
    reminder: null,
    soundEnabled: false,
    dismissedSuggestionDate: null,
    dismissedReturnGap: null,
    streakShieldArmed: false,
    streakShieldUsedOn: null,
    battleTutorialDone: false,
    musicVolume: 0.6,
    dismissedRecapWeek: null,
    challengesCollapsed: false,
  };
}

const MUSIC_VOLUMES: readonly MusicVolume[] = [0, 0.3, 0.6, 1];

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Estado de um jogador novo (antes do onboarding). */
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
      bestStreak: 0,
      lastCompletedDate: null,
      totalXpEarned: 0,
      totalQuestsCompleted: 0,
      dailyXpCompletions: 0,
      dailyXpCompletionsDate: null,
      dailyCompletions: 0,
      dailyCompletionsDate: null,
      completionDays: [],
    },
    settings: defaultPlayerSettings(),
    inventory: emptyInventory(),
    weeklyBoss: emptyWeeklyBoss(),
    dailyChallenges: emptyDailyChallenges(),
    weeks: [],
    bestiary: emptyBestiary(),
    focus: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function toIsoDay(value: unknown): string | null {
  return typeof value === 'string' && ISO_DAY.test(value) ? value : null;
}

function sanitizeAttributes(raw: unknown, characterClass: CharacterClass): Attributes {
  const defaults = CLASS_DEFAULTS[characterClass].attributes;
  if (!isRecord(raw)) return { ...defaults };
  return {
    strength: toCount(raw.strength, defaults.strength),
    intelligence: toCount(raw.intelligence, defaults.intelligence),
    agility: toCount(raw.agility, defaults.agility),
    vitality: toCount(raw.vitality, defaults.vitality),
  };
}

function sanitizeCharacter(raw: unknown): Character {
  const base = createInitialState().character;
  if (!isRecord(raw)) return base;

  const characterClass: CharacterClass =
    typeof raw.characterClass === 'string' && raw.characterClass in CLASS_DEFAULTS
      ? (raw.characterClass as CharacterClass)
      : base.characterClass;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, HERO_NAME_MAX_LENGTH) : '';
  const level = Math.max(1, toCount(raw.level, 1));
  const rawMaxXp = toCount(raw.maxXp, 0);
  const maxXp = rawMaxXp >= 1 ? rawMaxXp : maxXpForLevel(level);
  // XP acima do teto (save adulterado/antigo) vira níveis de verdade, não barra estourada.
  const progress = applyXp(level, 0, maxXp, toCount(raw.xp, 0));

  const character: Character = {
    name,
    characterClass,
    level: progress.level,
    xp: progress.xp,
    maxXp: progress.maxXp,
    attributes: sanitizeAttributes(raw.attributes, characterClass),
    attributePoints: toCount(raw.attributePoints, 0) + progress.attributePointsGained,
  };
  const talents = sanitizeIdList(raw.talents, 32);
  if (talents && talents.length > 0) character.talents = talents;
  const loadout = sanitizeIdList(raw.loadout, LOADOUT_SIZE);
  if (loadout && loadout.length > 0) character.loadout = loadout;
  const vitals = sanitizeVitals(raw.vitals);
  // Save antigo não tem vida guardada: o herói volta com a vida cheia.
  return vitals ? { ...character, vitals } : character;
}

function sanitizeQuest(raw: unknown): Quest | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return null;

  const difficulty: Difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty)
    ? (raw.difficulty as Difficulty)
    : 'EASY';
  const category: Category = CATEGORIES.includes(raw.category as Category)
    ? (raw.category as Category)
    : 'OTHER';
  const createdAt =
    typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date(0).toISOString();

  const quest: Quest = {
    id: raw.id,
    title: raw.title.trim(),
    category,
    difficulty,
    // XP sempre vem da tabela oficial — save editado não infla recompensa.
    xp: XP_REWARDS[difficulty],
    completed: raw.completed === true,
    createdAt,
    recurring: raw.recurring === true,
  };
  if (typeof raw.completedAt === 'string' && !Number.isNaN(Date.parse(raw.completedAt))) {
    quest.completedAt = raw.completedAt;
  }
  // Save antigo: recurring true era todo dia.
  const repeat = REPEAT_RULES.includes(raw.repeat as RepeatRule)
    ? (raw.repeat as RepeatRule)
    : quest.recurring
      ? 'DAILY'
      : undefined;
  if (repeat) {
    quest.repeat = repeat;
    quest.recurring = true;
    const streak = toCount(raw.streak, 0);
    if (streak > 0) quest.streak = Math.min(9999, streak);
    const lastDoneOn = toIsoDay(raw.lastDoneOn);
    if (lastDoneOn) quest.lastDoneOn = lastDoneOn;
  }
  return quest;
}

function sanitizeQuests(raw: unknown): Quest[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const quests: Quest[] = [];
  for (const entry of raw) {
    const quest = sanitizeQuest(entry);
    if (!quest || seen.has(quest.id)) continue;
    seen.add(quest.id);
    quests.push(quest);
  }
  return quests;
}

function sanitizeCompletionDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const days = new Set<string>();
  for (const entry of raw) {
    if (typeof entry === 'string' && ISO_DAY.test(entry)) days.add(entry);
  }
  return [...days].sort().slice(-COMPLETION_DAY_CAP);
}

function sanitizeReminder(raw: unknown): PlayerSettings['reminder'] {
  if (!isRecord(raw)) return null;
  const hour = toCount(raw.hour, -1);
  const minute = toCount(raw.minute, -1);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function sanitizeSettings(raw: unknown): PlayerSettings {
  const base = defaultPlayerSettings();
  if (!isRecord(raw)) return base;
  return {
    dailyGoalTarget: clampDailyGoalTarget(raw.dailyGoalTarget),
    reminder: sanitizeReminder(raw.reminder),
    soundEnabled: raw.soundEnabled === true,
    dismissedSuggestionDate: toIsoDay(raw.dismissedSuggestionDate),
    dismissedReturnGap: toIsoDay(raw.dismissedReturnGap),
    streakShieldArmed: raw.streakShieldArmed === true,
    streakShieldUsedOn: toIsoDay(raw.streakShieldUsedOn),
    battleTutorialDone: raw.battleTutorialDone === true,
    musicVolume: MUSIC_VOLUMES.includes(raw.musicVolume as MusicVolume)
      ? (raw.musicVolume as MusicVolume)
      : base.musicVolume,
    dismissedRecapWeek: toIsoDay(raw.dismissedRecapWeek),
    challengesCollapsed: raw.challengesCollapsed === true,
  };
}

function sanitizeStats(raw: unknown): UserStats {
  const base = createInitialState().stats;
  if (!isRecord(raw)) return base;
  const streak = toCount(raw.streak, 0);
  const lastCompletedDate = toIsoDay(raw.lastCompletedDate);
  const dailyXpCompletionsDate = toIsoDay(raw.dailyXpCompletionsDate);
  const dailyCompletionsDate = toIsoDay(raw.dailyCompletionsDate);
  const storedDays = sanitizeCompletionDays(raw.completionDays);
  return {
    streak,
    bestStreak: Math.max(streak, toCount(raw.bestStreak, 0)),
    lastCompletedDate,
    totalXpEarned: toCount(raw.totalXpEarned, 0),
    totalQuestsCompleted: toCount(raw.totalQuestsCompleted, 0),
    dailyXpCompletions: dailyXpCompletionsDate ? toCount(raw.dailyXpCompletions, 0) : 0,
    dailyXpCompletionsDate,
    dailyCompletions: dailyCompletionsDate ? toCount(raw.dailyCompletions, 0) : 0,
    dailyCompletionsDate,
    completionDays:
      storedDays.length > 0 ? storedDays : backfillCompletionDays(lastCompletedDate, streak),
  };
}

/**
 * Converte qualquer JSON lido do aparelho em um AppState válido.
 * Retorna null quando o conteúdo não é sequer um objeto (save irrecuperável).
 * Também migra saves antigos (campos novos ganham valor padrão).
 */
export function sanitizeState(raw: unknown): AppState | null {
  if (!isRecord(raw)) return null;
  const character = sanitizeCharacter(raw.character);
  const onboardingDone = raw.onboardingDone === true;
  const quests = sanitizeQuests(raw.quests);
  return {
    onboardingDone,
    character:
      onboardingDone && character.name.length === 0
        ? { ...character, name: DEFAULT_HERO_NAME }
        : character,
    quests,
    stats: sanitizeStats(raw.stats),
    settings: sanitizeSettings(raw.settings),
    inventory: sanitizeInventory(raw.inventory),
    weeklyBoss: sanitizeWeeklyBoss(raw.weeklyBoss),
    dailyChallenges: sanitizeDailyChallenges(raw.dailyChallenges),
    weeks: sanitizeWeeks(raw.weeks),
    bestiary: sanitizeBestiary(raw.bestiary),
    focus: sanitizeFocus(
      raw.focus,
      new Set(quests.filter((quest) => !quest.completed).map((quest) => quest.id)),
    ),
  };
}

export type HeroUpdateResult = { ok: true; state: AppState } | { ok: false; message: string };

/** Renomeia e/ou troca a classe. Atributos já gastos permanecem. */
export function updateHero(
  state: AppState,
  input: { name?: string; characterClass?: CharacterClass },
): HeroUpdateResult {
  let character = state.character;
  if (input.name != null) {
    const name = input.name.trim().replace(/\s+/g, ' ').slice(0, HERO_NAME_MAX_LENGTH);
    if (name.length < HERO_NAME_MIN_LENGTH) {
      return {
        ok: false,
        message: `O nome precisa de pelo menos ${HERO_NAME_MIN_LENGTH} letras.`,
      };
    }
    character = { ...character, name };
  }
  if (input.characterClass != null) {
    if (!(input.characterClass in CLASS_DEFAULTS)) {
      return { ok: false, message: 'Escolha Guerreiro, Mago ou Ladino.' };
    }
    character = { ...character, characterClass: input.characterClass };
  }
  return { ok: true, state: { ...state, character } };
}

export function exportSaveJson(state: AppState): string {
  return JSON.stringify(state);
}

export function importSaveJson(
  raw: string,
): { ok: true; state: AppState } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Esse texto não é um save do QuestLog.' };
  }
  const state = sanitizeState(parsed);
  if (!state) return { ok: false, message: 'Não reconhecemos esse save.' };
  return { ok: true, state };
}

/** Nuvem fica fora do MVP. O backup real é exportar o save. */
export function cloudSyncStatus(): { mode: 'LOCAL_ONLY'; message: string } {
  return {
    mode: 'LOCAL_ONLY',
    message: 'Seu progresso fica neste aparelho. A conta na nuvem ainda não faz parte do jogo.',
  };
}

/** Estado logo após o onboarding: herói nomeado, atributos da classe. */
export function startJourney(name: string, characterClass: CharacterClass): AppState {
  const base = createInitialState();
  const trimmed = name.trim().slice(0, HERO_NAME_MAX_LENGTH);
  return {
    ...base,
    onboardingDone: true,
    character: {
      ...base.character,
      name: trimmed.length > 0 ? trimmed : DEFAULT_HERO_NAME,
      characterClass,
      attributes: { ...CLASS_DEFAULTS[characterClass].attributes },
    },
  };
}
