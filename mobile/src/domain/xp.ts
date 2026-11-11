import { ATTRIBUTE_POINTS_PER_LEVEL, INITIAL_MAX_XP, XP_GROWTH_FACTOR } from './constants';
import { previousIsoDate } from './dates';
import type { UserStats } from './types';

export interface LevelProgress {
  level: number;
  xp: number;
  maxXp: number;
  attributePointsGained: number;
}

/** Aplica XP e sobe de nível enquanto XP >= maxXp. Contrato: SDD do MVP. */
export function applyXp(level: number, xp: number, maxXp: number, amount: number): LevelProgress {
  // Guardas: save corrompido (maxXp <= 0) não pode travar o app em loop infinito.
  const safeAmount = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  let nextLevel = level;
  let nextXp = Math.max(0, xp) + safeAmount;
  let nextMaxXp = Number.isFinite(maxXp) && maxXp >= 1 ? maxXp : maxXpForLevel(level);
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
  // Mesmo dia — ou relógio atrasado: não pune nem premia.
  if (lastDate >= todayIsoDate) return Math.max(1, stats.streak);
  if (lastDate === previousIsoDate(todayIsoDate)) return stats.streak + 1;
  return 1;
}
