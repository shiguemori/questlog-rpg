import {
  evaluateXpEligibility,
  nextDailyXpCompletions,
  type XpDenyReason,
} from './antiFarm';
import { localIsoDate } from './dates';
import {
  buildDailyGoal,
  nextCompletionDays,
  nextDailyCompletionCount,
  streakMilestoneCrossed,
  type StreakMilestone,
} from './engagement';
import type { AppState, Character, Quest, UserStats } from './types';
import { applyXp, nextStreak } from './xp';

export interface CompleteQuestResult {
  state: AppState;
  leveledUp: boolean;
  newLevel: number | null;
  xpAwarded: number;
  denyReason: XpDenyReason | null;
  /** A meta de 1 quest/dia fechou nesta conclusão. Não mexe no XP. */
  dailyGoalJustMet: boolean;
  /** Marco de streak cruzado agora. Null no mesmo dia ou fora dos marcos. */
  streakMilestone: StreakMilestone | null;
}

/**
 * Caso de uso: concluir quest com anti-farm + XP + streak.
 * Contrato SDD — único caminho de mutação de conclusão no MVP.
 */
export function completeQuest(
  state: AppState,
  questId: string,
  now: Date = new Date(),
): CompleteQuestResult | null {
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return null;

  // Dia civil do aparelho (não UTC): o dia do jogador vira à meia-noite local.
  const todayIsoDate = localIsoDate(now);
  const eligibility = evaluateXpEligibility(quest, state.stats, now.getTime(), todayIsoDate);

  let character: Character = state.character;
  let leveledUp = false;
  let newLevel: number | null = null;

  if (eligibility.eligible && eligibility.xpAwarded > 0) {
    const progress = applyXp(
      character.level,
      character.xp,
      character.maxXp,
      eligibility.xpAwarded,
    );
    leveledUp = progress.level > character.level;
    newLevel = leveledUp ? progress.level : null;
    character = {
      ...character,
      level: progress.level,
      xp: progress.xp,
      maxXp: progress.maxXp,
      attributePoints: character.attributePoints + progress.attributePointsGained,
    };
  }

  const daily = nextDailyXpCompletions(state.stats, todayIsoDate, eligibility.eligible);
  const completions = nextDailyCompletionCount(state.stats, todayIsoDate);
  const goalBefore = buildDailyGoal(state.stats, todayIsoDate);

  const streak = nextStreak(state.stats, todayIsoDate);
  const streakMilestone = streakMilestoneCrossed(state.stats.streak, streak);

  const stats: UserStats = {
    ...state.stats,
    ...daily,
    ...completions,
    completionDays: nextCompletionDays(state.stats.completionDays, todayIsoDate),
    streak,
    bestStreak: Math.max(state.stats.bestStreak ?? 0, streak),
    lastCompletedDate: todayIsoDate,
    totalXpEarned: state.stats.totalXpEarned + eligibility.xpAwarded,
    totalQuestsCompleted: state.stats.totalQuestsCompleted + 1,
  };
  const dailyGoalJustMet = !goalBefore.met && buildDailyGoal(stats, todayIsoDate).met;

  const quests: Quest[] = state.quests.map((q) =>
    q.id === questId ? { ...q, completed: true, completedAt: now.toISOString() } : q,
  );

  return {
    state: { ...state, character, quests, stats },
    leveledUp,
    newLevel,
    xpAwarded: eligibility.xpAwarded,
    denyReason: eligibility.reason,
    dailyGoalJustMet,
    streakMilestone,
  };
}
