import {
  evaluateXpEligibility,
  nextDailyXpCompletions,
  type XpDenyReason,
} from './antiFarm';
import type { AppState, Character, Quest, UserStats } from './types';
import { applyXp, nextStreak } from './xp';

export interface CompleteQuestResult {
  state: AppState;
  leveledUp: boolean;
  newLevel: number | null;
  xpAwarded: number;
  denyReason: XpDenyReason | null;
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

  const todayIsoDate = now.toISOString().split('T')[0];
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

  const stats: UserStats = {
    ...state.stats,
    ...daily,
    streak: nextStreak(state.stats, todayIsoDate),
    lastCompletedDate: todayIsoDate,
    totalXpEarned: state.stats.totalXpEarned + eligibility.xpAwarded,
    totalQuestsCompleted: state.stats.totalQuestsCompleted + 1,
  };

  const quests: Quest[] = state.quests.map((q) =>
    q.id === questId ? { ...q, completed: true } : q,
  );

  return {
    state: { ...state, character, quests, stats },
    leveledUp,
    newLevel,
    xpAwarded: eligibility.xpAwarded,
    denyReason: eligibility.reason,
  };
}
