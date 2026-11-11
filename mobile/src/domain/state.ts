import { CATEGORIES, CLASS_DEFAULTS, INITIAL_MAX_XP, XP_REWARDS } from './constants';
import { backfillCompletionDays, COMPLETION_DAY_CAP } from './engagement';
import type {
  AppState,
  Attributes,
  Category,
  Character,
  CharacterClass,
  Difficulty,
  Quest,
  UserStats,
} from './types';
import { applyXp, maxXpForLevel } from './xp';

export const HERO_NAME_MAX_LENGTH = 24;
export const DEFAULT_HERO_NAME = 'Herói';

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
  const name =
    typeof raw.name === 'string' ? raw.name.trim().slice(0, HERO_NAME_MAX_LENGTH) : '';
  const level = Math.max(1, toCount(raw.level, 1));
  const rawMaxXp = toCount(raw.maxXp, 0);
  const maxXp = rawMaxXp >= 1 ? rawMaxXp : maxXpForLevel(level);
  // XP acima do teto (save adulterado/antigo) vira níveis de verdade, não barra estourada.
  const progress = applyXp(level, 0, maxXp, toCount(raw.xp, 0));

  return {
    name,
    characterClass,
    level: progress.level,
    xp: progress.xp,
    maxXp: progress.maxXp,
    attributes: sanitizeAttributes(raw.attributes, characterClass),
    attributePoints: toCount(raw.attributePoints, 0) + progress.attributePointsGained,
  };
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
  };
  if (typeof raw.completedAt === 'string' && !Number.isNaN(Date.parse(raw.completedAt))) {
    quest.completedAt = raw.completedAt;
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
  return {
    onboardingDone,
    character:
      onboardingDone && character.name.length === 0
        ? { ...character, name: DEFAULT_HERO_NAME }
        : character,
    quests: sanitizeQuests(raw.quests),
    stats: sanitizeStats(raw.stats),
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
