import { ATTRIBUTE_POINTS_PER_LEVEL, INITIAL_MAX_XP, XP_GROWTH_FACTOR } from './constants';
import type { UserStats } from './types';

export interface LevelProgress {
  level: number;
  xp: number;
  maxXp: number;
  attributePointsGained: number;
}

/** Aplica XP e sobe de nível enquanto XP >= maxXp. Contrato: SDD do MVP. */
export function applyXp(
  level: number,
  xp: number,
  maxXp: number,
  amount: number,
): LevelProgress {
  let nextLevel = level;
  let nextXp = xp + amount;
  let nextMaxXp = maxXp;
  let attributePointsGained = 0;

  while (nextXp >= nextMaxXp) {
    nextXp -= nextMaxXp;
    nextLevel += 1;
    nextMaxXp = Math.floor(nextMaxXp * XP_GROWTH_FACTOR);
    attributePointsGained += ATTRIBUTE_POINTS_PER_LEVEL;
  }

  return {
    level: nextLevel,
    xp: nextXp,
    maxXp: nextMaxXp,
    attributePointsGained,
  };
}

export function maxXpForLevel(level: number): number {
  let maxXp = INITIAL_MAX_XP;
  for (let i = 1; i < level; i += 1) {
    maxXp = Math.floor(maxXp * XP_GROWTH_FACTOR);
  }
  return maxXp;
}

/** Atualiza streak diária a partir da última data de conclusão (YYYY-MM-DD). */
export function nextStreak(stats: UserStats, todayIsoDate: string): number {
  const lastDate = stats.lastCompletedDate;
  if (lastDate === null) return 1;
  if (lastDate === todayIsoDate) return stats.streak;

  const yesterday = new Date(`${todayIsoDate}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastDate === yesterdayStr) return stats.streak + 1;
  return 1;
}
