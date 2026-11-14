import type { BossId } from './battle';
import { CATEGORIES } from './constants';
import { localIsoDate, shiftIsoDate, weekdayIndex } from './dates';
import { mondayOf } from './schedule';
import type { AppState, Category } from './types';

/**
 * Resumo da semana (segunda a domingo): o que foi feito por categoria, lutas,
 * maior sequência, itens e o chefe. Aparece no domingo e, se não foi visto,
 * na segunda e na terça seguintes.
 */

export interface WeekRecord {
  /** Segunda-feira da semana (YYYY-MM-DD). */
  weekKey: string;
  byCategory: Record<Category, number>;
  battlesWon: number;
  battlesLost: number;
  /** Maior streak de dias alcançado na semana. */
  bestStreak: number;
  itemsFound: number;
  challengesDone: number;
  boss: { id: BossId; result: 'BEATEN' | 'LOST' } | null;
}

export const WEEK_HISTORY_CAP = 8;

function emptyCategories(): Record<Category, number> {
  return { STUDY: 0, WORK: 0, HEALTH: 0, HOME: 0, OTHER: 0 };
}

export function emptyWeek(weekKey: string): WeekRecord {
  return {
    weekKey,
    byCategory: emptyCategories(),
    battlesWon: 0,
    battlesLost: 0,
    bestStreak: 0,
    itemsFound: 0,
    challengesDone: 0,
    boss: null,
  };
}

/** Aplica a mudança na semana de `now`, criando a semana se preciso. */
export function updateWeek(
  weeks: readonly WeekRecord[],
  now: Date,
  change: (week: WeekRecord) => WeekRecord,
): WeekRecord[] {
  const key = mondayOf(localIsoDate(now));
  const current = weeks.find((week) => week.weekKey === key) ?? emptyWeek(key);
  const rest = weeks.filter((week) => week.weekKey !== key);
  return [...rest, change(current)]
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .slice(-WEEK_HISTORY_CAP);
}

export interface WeekNote {
  quest?: { category: Category; streak: number };
  battle?: { won: boolean };
  items?: number;
  challenges?: number;
  boss?: { id: BossId; won: boolean };
}

/** Anota o que aconteceu agora na semana corrente. */
export function noteWeek(state: AppState, now: Date, note: WeekNote): AppState {
  const weeks = updateWeek(state.weeks, now, (week) => {
    const next: WeekRecord = { ...week, byCategory: { ...week.byCategory } };
    if (note.quest) {
      next.byCategory[note.quest.category] += 1;
      next.bestStreak = Math.max(next.bestStreak, note.quest.streak);
    }
    if (note.battle) {
      if (note.battle.won) next.battlesWon += 1;
      else next.battlesLost += 1;
    }
    if (note.items) next.itemsFound += note.items;
    if (note.challenges) next.challengesDone += note.challenges;
    if (note.boss) {
      const beaten = note.boss.won || next.boss?.result === 'BEATEN';
      next.boss = { id: note.boss.id, result: beaten ? 'BEATEN' : 'LOST' };
    }
    return next;
  });
  return { ...state, weeks };
}

export function weekTotal(week: WeekRecord): number {
  return CATEGORIES.reduce((sum, category) => sum + week.byCategory[category], 0);
}

/**
 * Qual semana resumir hoje: a atual no domingo; a anterior na segunda e na terça.
 * Null se já foi vista ou se a semana ficou vazia.
 */
export function recapWeekFor(state: AppState, today: string): WeekRecord | null {
  const weekday = weekdayIndex(today);
  if (weekday == null) return null;
  let key: string | null = null;
  if (weekday === 0) key = mondayOf(today);
  else if (weekday === 1 || weekday === 2) key = shiftIsoDate(mondayOf(today), -7);
  if (!key || state.settings.dismissedRecapWeek === key) return null;
  const week = state.weeks.find((entry) => entry.weekKey === key);
  if (!week || weekTotal(week) + week.battlesWon + week.battlesLost === 0) return null;
  return week;
}

const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function dayLabel(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} de ${MONTHS[(month ?? 1) - 1]}`;
}

/** "9 a 15 de nov". */
export function weekRangeLabel(weekKey: string): string {
  const end = shiftIsoDate(weekKey, 6) ?? weekKey;
  const [startDay] = dayLabel(weekKey).split(' de ');
  const sameMonth = weekKey.slice(0, 7) === end.slice(0, 7);
  return sameMonth ? `${startDay} a ${dayLabel(end)}` : `${dayLabel(weekKey)} a ${dayLabel(end)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(9999, Math.floor(value)))
    : 0;
}

const BOSS_KEYS: readonly BossId[] = ['procrastination', 'clutter', 'couch', 'meeting'];

export function sanitizeWeeks(raw: unknown): WeekRecord[] {
  if (!Array.isArray(raw)) return [];
  const weeks: WeekRecord[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.weekKey !== 'string') continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.weekKey)) continue;
    if (weeks.some((week) => week.weekKey === entry.weekKey)) continue;
    const byCategory = emptyCategories();
    if (isRecord(entry.byCategory)) {
      for (const category of CATEGORIES) byCategory[category] = count(entry.byCategory[category]);
    }
    let boss: WeekRecord['boss'] = null;
    if (isRecord(entry.boss) && BOSS_KEYS.includes(entry.boss.id as BossId)) {
      boss = {
        id: entry.boss.id as BossId,
        result: entry.boss.result === 'BEATEN' ? 'BEATEN' : 'LOST',
      };
    }
    weeks.push({
      weekKey: entry.weekKey,
      byCategory,
      battlesWon: count(entry.battlesWon),
      battlesLost: count(entry.battlesLost),
      bestStreak: count(entry.bestStreak),
      itemsFound: count(entry.itemsFound),
      challengesDone: count(entry.challengesDone),
      boss,
    });
  }
  return weeks.sort((a, b) => a.weekKey.localeCompare(b.weekKey)).slice(-WEEK_HISTORY_CAP);
}
