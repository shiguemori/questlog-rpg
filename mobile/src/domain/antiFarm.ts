import type { Quest, UserStats } from './types';

/** PRODUCT_PLAN §H — máximo de quests com XP por dia civil. */
export const MAX_XP_QUESTS_PER_DAY = 10;

/** PRODUCT_PLAN §H — idade mínima da quest (ms) para gerar XP. */
export const MIN_QUEST_AGE_MS = 60_000;

export type XpDenyReason = 'TOO_FAST' | 'DAILY_LIMIT';

export interface XpEligibility {
  eligible: boolean;
  xpAwarded: number;
  reason: XpDenyReason | null;
}

function completionsForToday(stats: UserStats, todayIsoDate: string): number {
  if (stats.dailyXpCompletionsDate !== todayIsoDate) return 0;
  return stats.dailyXpCompletions;
}

/**
 * Avalia se a conclusão de uma quest gera XP (anti-farm).
 * Quests recorrentes (MVP futuro) poderiam isentar TOO_FAST — ainda não existem.
 */
export function evaluateXpEligibility(
  quest: Quest,
  stats: UserStats,
  nowMs: number,
  todayIsoDate: string,
): XpEligibility {
  const createdMs = Date.parse(quest.createdAt);
  if (!Number.isNaN(createdMs) && nowMs - createdMs < MIN_QUEST_AGE_MS) {
    return { eligible: false, xpAwarded: 0, reason: 'TOO_FAST' };
  }

  if (completionsForToday(stats, todayIsoDate) >= MAX_XP_QUESTS_PER_DAY) {
    return { eligible: false, xpAwarded: 0, reason: 'DAILY_LIMIT' };
  }

  return { eligible: true, xpAwarded: quest.xp, reason: null };
}

export function nextDailyXpCompletions(
  stats: UserStats,
  todayIsoDate: string,
  awardedXp: boolean,
): Pick<UserStats, 'dailyXpCompletions' | 'dailyXpCompletionsDate'> {
  const current = completionsForToday(stats, todayIsoDate);
  return {
    dailyXpCompletionsDate: todayIsoDate,
    dailyXpCompletions: awardedXp ? current + 1 : current,
  };
}

export const XP_DENY_COPY: Record<XpDenyReason, string> = {
  TOO_FAST: 'Espere 1 minuto após criar a quest para ganhar XP.',
  DAILY_LIMIT: `Limite diário de ${MAX_XP_QUESTS_PER_DAY} quests com XP atingido. Volte amanhã.`,
};
