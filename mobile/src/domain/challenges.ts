import { CATEGORY_LABELS } from './constants';
import { localIsoDate } from './dates';
import { addLoot, type LootDrop, type PotionId } from './loot';
import type { AppState, Category, Difficulty } from './types';

/**
 * Três desafios do dia: um de missão e dois de batalha.
 *
 * - Sorteados pela data (o mesmo dia sempre dá os mesmos) e guardados no save.
 * - Cada um dá uma poção. Os três juntos dão fragmentos.
 * - Só conta conclusão que rendeu XP: o anti-farm continua valendo.
 */

export type ChallengeKind =
  'COMPLETE_ANY' | 'COMPLETE_CATEGORY' | 'WIN_NO_POTION' | 'WIN_TOUGH' | 'WIN_FAST' | 'WIN_HEALTHY';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  target: number;
  category?: Category;
  progress: number;
  reward: PotionId;
}

export interface DailyChallenges {
  /** Dia (YYYY-MM-DD) dos desafios. Null = ainda não sorteado. */
  date: string | null;
  list: Challenge[];
  /** Os fragmentos dos três já foram entregues. */
  bonusClaimed: boolean;
}

export const CHALLENGE_COUNT = 3;
export const CHALLENGE_BONUS_FRAGMENTS = 5;
/** "Vença em até N turnos". */
export const WIN_FAST_TURNS = 5;

const BATTLE_KINDS: readonly ChallengeKind[] = [
  'WIN_NO_POTION',
  'WIN_TOUGH',
  'WIN_FAST',
  'WIN_HEALTHY',
];

export function emptyDailyChallenges(): DailyChallenges {
  return { date: null, list: [], bonusClaimed: false };
}

function hashOf(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash >>> 0;
}

/** Texto do desafio ("Conclua 2 missões de Saúde"). */
export function challengeText(challenge: Challenge): string {
  switch (challenge.kind) {
    case 'COMPLETE_ANY':
      return `Conclua ${challenge.target} missões`;
    case 'COMPLETE_CATEGORY': {
      const label = CATEGORY_LABELS[challenge.category ?? 'OTHER'];
      return challenge.target === 1
        ? `Conclua 1 missão de ${label}`
        : `Conclua ${challenge.target} missões de ${label}`;
    }
    case 'WIN_NO_POTION':
      return 'Vença uma luta sem tomar poção';
    case 'WIN_TOUGH':
      return 'Vença uma luta média ou difícil';
    case 'WIN_FAST':
      return `Vença uma luta em até ${WIN_FAST_TURNS} turnos`;
    case 'WIN_HEALTHY':
      return 'Termine uma luta com mais da metade da vida';
    default:
      return '';
  }
}

export function isChallengeDone(challenge: Challenge): boolean {
  return challenge.progress >= challenge.target;
}

/**
 * Sorteia os desafios do dia. O de missão usa uma categoria com missão aberta,
 * para ser possível hoje mesmo.
 */
export function generateChallenges(
  today: string,
  openByCategory: Partial<Record<Category, number>>,
): Challenge[] {
  const hash = hashOf(today);
  const open = (Object.entries(openByCategory) as [Category, number][])
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const rewards: PotionId[] =
    hash % 2 === 0
      ? ['potion.water', 'potion.coffee', 'potion.water']
      : ['potion.coffee', 'potion.water', 'potion.coffee'];

  let first: Challenge;
  if (open.length > 0) {
    const [category, count] = open[hash % open.length];
    first = {
      id: `${today}:0`,
      kind: 'COMPLETE_CATEGORY',
      category,
      target: count >= 2 && hash % 3 === 0 ? 2 : 1,
      progress: 0,
      reward: rewards[0],
    };
  } else {
    first = { id: `${today}:0`, kind: 'COMPLETE_ANY', target: 2, progress: 0, reward: rewards[0] };
  }
  const a = (hash >>> 3) % BATTLE_KINDS.length;
  const b = (a + 1 + ((hash >>> 7) % (BATTLE_KINDS.length - 1))) % BATTLE_KINDS.length;
  const battle = [BATTLE_KINDS[a], BATTLE_KINDS[b]].map((kind, index): Challenge => ({
    id: `${today}:${index + 1}`,
    kind,
    target: 1,
    progress: 0,
    reward: rewards[index + 1],
  }));
  return [first, ...battle];
}

/** Garante os desafios de hoje (sorteia na virada do dia). */
export function ensureDailyChallenges(state: AppState, now: Date): AppState {
  const today = localIsoDate(now);
  if (state.dailyChallenges.date === today) return state;
  const openByCategory: Partial<Record<Category, number>> = {};
  for (const quest of state.quests) {
    if (!quest.completed)
      openByCategory[quest.category] = (openByCategory[quest.category] ?? 0) + 1;
  }
  return {
    ...state,
    dailyChallenges: {
      date: today,
      list: generateChallenges(today, openByCategory),
      bonusClaimed: false,
    },
  };
}

export type ChallengeEvent =
  | { type: 'QUEST'; category: Category }
  | {
      type: 'BATTLE';
      won: boolean;
      difficulty: Difficulty;
      boss: boolean;
      potionsUsed: number;
      turns: number;
      hpPct: number;
    };

function matches(challenge: Challenge, event: ChallengeEvent): boolean {
  if (event.type === 'QUEST') {
    if (challenge.kind === 'COMPLETE_ANY') return true;
    return challenge.kind === 'COMPLETE_CATEGORY' && challenge.category === event.category;
  }
  if (!event.won) return false;
  switch (challenge.kind) {
    case 'WIN_NO_POTION':
      return event.potionsUsed === 0;
    case 'WIN_TOUGH':
      return event.boss || event.difficulty !== 'EASY';
    case 'WIN_FAST':
      return event.turns <= WIN_FAST_TURNS;
    case 'WIN_HEALTHY':
      return event.hpPct > 0.5;
    default:
      return false;
  }
}

export interface ChallengeProgress {
  state: AppState;
  /** Desafios que fecharam agora. */
  finished: Challenge[];
  /** Os três fecharam agora (fragmentos entregues). */
  bonus: LootDrop | null;
}

/** Soma o evento nos desafios de hoje e entrega as recompensas que fecharam. */
export function progressChallenges(
  base: AppState,
  event: ChallengeEvent,
  now: Date,
): ChallengeProgress {
  const state = ensureDailyChallenges(base, now);
  const finished: Challenge[] = [];
  let inventory = state.inventory;
  const list = state.dailyChallenges.list.map((challenge) => {
    if (isChallengeDone(challenge) || !matches(challenge, event)) return challenge;
    const next = { ...challenge, progress: Math.min(challenge.target, challenge.progress + 1) };
    if (isChallengeDone(next)) {
      finished.push(next);
      inventory = addLoot(inventory, { type: 'POTION', id: next.reward, amount: 1 });
    }
    return next;
  });
  let bonus: LootDrop | null = null;
  let bonusClaimed = state.dailyChallenges.bonusClaimed;
  if (!bonusClaimed && list.length > 0 && list.every(isChallengeDone)) {
    bonus = { type: 'FRAGMENTS', amount: CHALLENGE_BONUS_FRAGMENTS };
    inventory = addLoot(inventory, bonus);
    bonusClaimed = true;
  }
  return {
    state: {
      ...state,
      inventory,
      dailyChallenges: { ...state.dailyChallenges, list, bonusClaimed },
    },
    finished,
    bonus,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const KINDS: readonly ChallengeKind[] = ['COMPLETE_ANY', 'COMPLETE_CATEGORY', ...BATTLE_KINDS];
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as Category[];

export function sanitizeDailyChallenges(raw: unknown): DailyChallenges {
  if (!isRecord(raw) || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    return emptyDailyChallenges();
  }
  const list: Challenge[] = [];
  if (Array.isArray(raw.list)) {
    for (const entry of raw.list.slice(0, CHALLENGE_COUNT)) {
      if (!isRecord(entry) || typeof entry.id !== 'string') continue;
      if (!KINDS.includes(entry.kind as ChallengeKind)) continue;
      const target =
        typeof entry.target === 'number' ? Math.max(1, Math.min(3, Math.floor(entry.target))) : 1;
      const progress =
        typeof entry.progress === 'number'
          ? Math.max(0, Math.min(target, Math.floor(entry.progress)))
          : 0;
      const challenge: Challenge = {
        id: entry.id,
        kind: entry.kind as ChallengeKind,
        target,
        progress,
        reward: entry.reward === 'potion.coffee' ? 'potion.coffee' : 'potion.water',
      };
      if (CATEGORY_KEYS.includes(entry.category as Category)) {
        challenge.category = entry.category as Category;
      }
      list.push(challenge);
    }
  }
  if (list.length === 0) return emptyDailyChallenges();
  return { date: raw.date, list, bonusClaimed: raw.bonusClaimed === true };
}
