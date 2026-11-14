import { BOSS_IDS, type BattleState, type BossId } from './battle';
import { recordBattle } from './battleRecords';
import type { Challenge } from './challenges';
import { localIsoDate, shiftIsoDate, weekdayIndex } from './dates';
import { addLoot, rollLoot, spendPotions, type LootDrop, type PotionStock } from './loot';
import type { AppState, WeeklyBoss } from './types';
import { settleHeroVitals } from './vitals';
import { applyXp } from './xp';

/**
 * Chefe da semana. Quatro chefes em rodízio, um por semana (ver `BOSSES` em `battle.ts`).
 *
 * - Aparece depois de BOSS_WINS_NEEDED vitórias na semana (segunda a domingo).
 * - Uma tentativa por dia. Vencido, some até a semana seguinte.
 * - Dá XP fixo por nível e sempre deixa equipamento raro ou épico.
 */

export const BOSS_WINS_NEEDED = 5;
/** Antes disso o herói ainda não aguenta uma luta longa (ver `scripts/simulate-battles.ts`). */
export const BOSS_MIN_LEVEL = 3;
export const BOSS_XP_BASE = 120;
export const BOSS_XP_PER_LEVEL = 15;

export function emptyWeeklyBoss(): WeeklyBoss {
  return { weekKey: null, wins: 0, beatenWeek: null, triedOn: null };
}

/** Segunda-feira (YYYY-MM-DD) da semana do dia informado. */
export function weekKeyOf(isoDate: string): string {
  const weekday = weekdayIndex(isoDate) ?? 1;
  return shiftIsoDate(isoDate, -((weekday + 6) % 7)) ?? isoDate;
}

/** Segunda-feira de referência do rodízio. */
const ROTATION_EPOCH = Date.UTC(2026, 0, 5);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Chefe da semana que começa em `weekKey` (segunda-feira). */
export function bossOfWeek(weekKey: string): BossId {
  const [year, month, day] = weekKey.split('-').map(Number);
  const weeks = Math.round((Date.UTC(year, month - 1, day) - ROTATION_EPOCH) / WEEK_MS);
  const index = ((weeks % BOSS_IDS.length) + BOSS_IDS.length) % BOSS_IDS.length;
  return BOSS_IDS[index] ?? 'procrastination';
}

/** Chefe da semana de hoje. */
export function bossOfToday(now: Date): BossId {
  return bossOfWeek(weekKeyOf(localIsoDate(now)));
}

export type BossAvailability = 'TOO_EARLY' | 'LOCKED' | 'READY' | 'TRIED_TODAY' | 'BEATEN';

export interface BossStatus {
  availability: BossAvailability;
  /** Vitórias desta semana (teto: BOSS_WINS_NEEDED). */
  wins: number;
  needed: number;
  bossId: BossId;
}

export function bossStatus(boss: WeeklyBoss, now: Date, heroLevel: number): BossStatus {
  const today = localIsoDate(now);
  const week = weekKeyOf(today);
  const wins = boss.weekKey === week ? Math.min(BOSS_WINS_NEEDED, boss.wins) : 0;
  let availability: BossAvailability = 'LOCKED';
  if (heroLevel < BOSS_MIN_LEVEL) availability = 'TOO_EARLY';
  else if (boss.beatenWeek === week) availability = 'BEATEN';
  else if (wins >= BOSS_WINS_NEEDED)
    availability = boss.triedOn === today ? 'TRIED_TODAY' : 'READY';
  return { availability, wins, needed: BOSS_WINS_NEEDED, bossId: bossOfWeek(week) };
}

/** Conta uma vitória de quest na semana. A semana nova zera a contagem. */
export function recordBattleWin(boss: WeeklyBoss, now: Date): WeeklyBoss {
  const week = weekKeyOf(localIsoDate(now));
  const wins = boss.weekKey === week ? boss.wins + 1 : 1;
  return { ...boss, weekKey: week, wins: Math.min(99, wins) };
}

export function bossXpFor(level: number): number {
  return BOSS_XP_BASE + BOSS_XP_PER_LEVEL * Math.max(0, level - 1);
}

export interface BossOutcome {
  state: AppState;
  xpAwarded: number;
  leveledUp: boolean;
  newLevel: number | null;
  drop: LootDrop | null;
  /** Desafios do dia que fecharam com esta luta. */
  challengesFinished: Challenge[];
  challengeBonus: LootDrop | null;
}

/**
 * Fecha a luta contra o chefe: marca a tentativa do dia, guarda a vida e,
 * na vitória, dá XP e o equipamento.
 */
export function settleBossBattle(
  state: AppState,
  input: {
    won: boolean;
    heroHp: number;
    seed: number;
    now: Date;
    /** Poções gastas na luta. */
    potionsUsed?: Partial<PotionStock>;
    /** A luta inteira (bestiário, desafios e resumo da semana). */
    battle?: BattleState;
  },
): BossOutcome {
  const today = localIsoDate(input.now);
  const week = weekKeyOf(today);
  let character = state.character;
  let inventory = spendPotions(state.inventory, input.potionsUsed ?? {});
  let xpAwarded = 0;
  let leveledUp = false;
  let newLevel: number | null = null;
  let drop: LootDrop | null = null;

  if (input.won) {
    xpAwarded = bossXpFor(character.level);
    const progress = applyXp(character.level, character.xp, character.maxXp, xpAwarded);
    leveledUp = progress.level > character.level;
    newLevel = leveledUp ? progress.level : null;
    character = {
      ...character,
      level: progress.level,
      xp: progress.xp,
      maxXp: progress.maxXp,
      attributePoints: character.attributePoints + progress.attributePointsGained,
    };
    drop = rollLoot({
      seed: input.seed,
      source: 'BOSS',
      difficulty: 'HARD',
      owned: inventory.gear,
    });
    if (drop) inventory = addLoot(inventory, drop);
  }

  character = settleHeroVitals(character, input.heroHp, input.now, leveledUp);
  const weeklyBoss: WeeklyBoss = {
    ...state.weeklyBoss,
    triedOn: today,
    beatenWeek: input.won ? week : state.weeklyBoss.beatenWeek,
  };
  const settled: AppState = {
    ...state,
    character,
    inventory,
    weeklyBoss,
    stats: { ...state.stats, totalXpEarned: state.stats.totalXpEarned + xpAwarded },
  };
  const records = input.battle
    ? recordBattle(settled, {
        battle: input.battle,
        won: input.won,
        now: input.now,
        difficulty: 'HARD',
        drop,
      })
    : { state: settled, finished: [], bonus: null };
  return {
    state: records.state,
    xpAwarded,
    leveledUp,
    newLevel,
    drop,
    challengesFinished: records.finished,
    challengeBonus: records.bonus,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isoDayOrNull(value: unknown): string | null {
  return typeof value === 'string' && ISO_DAY.test(value) ? value : null;
}

export function sanitizeWeeklyBoss(raw: unknown): WeeklyBoss {
  if (!isRecord(raw)) return emptyWeeklyBoss();
  const wins = raw.wins;
  return {
    weekKey: isoDayOrNull(raw.weekKey),
    wins:
      typeof wins === 'number' && Number.isFinite(wins)
        ? Math.max(0, Math.min(99, Math.floor(wins)))
        : 0,
    beatenWeek: isoDayOrNull(raw.beatenWeek),
    triedOn: isoDayOrNull(raw.triedOn),
  };
}
