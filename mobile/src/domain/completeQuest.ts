import { evaluateXpEligibility, nextDailyXpCompletions, type XpDenyReason } from './antiFarm';
import { localIsoDate } from './dates';
import {
  buildDailyGoal,
  dailyCompletionsOn,
  nextCompletionDays,
  nextDailyCompletionCount,
  streakMilestoneCrossed,
  type StreakMilestone,
} from './engagement';
import { progressChallenges, type Challenge } from './challenges';
import type { LootDrop } from './loot';
import { attributeBonusXp, resolveStreak, streakBonusXp } from './rewards';
import { nextQuestStreak } from './schedule';
import { noteWeek } from './weekly';
import type { AppState, Character, Quest, UserStats } from './types';
import { applyXp } from './xp';

/** FULL é o padrão de quem já chama `completeQuest` direto. */
export type QuestRewardTier = 'FULL' | 'REDUCED';

export interface CompleteQuestOptions {
  rewardTier?: QuestRewardTier;
}

/** O que a tela faz ao tocar em concluir. Batalha só se o anti-farm daria XP. */
export type QuestCompletionPlan = 'REJECTED' | 'BLOCKED' | 'BATTLE';

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
  /** Cena cheia só na 1ª do dia ou em quest difícil. */
  showVillainScene: boolean;
  /** Bônus de atributo + streak, já incluído em `xpAwarded`. Zero se o anti-farm negou ou na derrota. */
  bonusXp: number;
  shieldConsumed: boolean;
  /**
   * FULL: vitória (padrão) — XP base + bônus.
   * REDUCED: derrota — metade do XP base, sem bônus. O anti-farm continua valendo.
   */
  rewardTier: QuestRewardTier;
  /** Desafios do dia que fecharam com esta conclusão (só conclusão com XP conta). */
  challengesFinished: Challenge[];
  challengeBonus: LootDrop | null;
}

/**
 * Caso de uso: concluir quest com anti-farm + XP + streak.
 * Contrato SDD — único caminho de mutação de conclusão no MVP.
 * A tela só chama isto depois da batalha quando `planQuestCompletion` é BATTLE.
 */
export function completeQuest(
  state: AppState,
  questId: string,
  now: Date = new Date(),
  options?: CompleteQuestOptions,
): CompleteQuestResult | null {
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return null;

  // Dia civil do aparelho (não UTC): o dia do jogador vira à meia-noite local.
  const todayIsoDate = localIsoDate(now);
  const eligibility = evaluateXpEligibility(quest, state.stats, now.getTime(), todayIsoDate);
  const streakResolution = resolveStreak(state.stats, todayIsoDate, state.settings);
  const streak = streakResolution.streak;
  const rewardTier: QuestRewardTier = options?.rewardTier === 'REDUCED' ? 'REDUCED' : 'FULL';
  const eligible = eligibility.eligible && eligibility.xpAwarded > 0;
  const bonusXp =
    eligible && rewardTier === 'FULL'
      ? attributeBonusXp(state.character, quest.category) + streakBonusXp(streak)
      : 0;
  const xpAwarded = !eligible
    ? 0
    : rewardTier === 'REDUCED'
      ? Math.max(1, Math.floor(eligibility.xpAwarded / 2))
      : eligibility.xpAwarded + bonusXp;

  let character: Character = state.character;
  let leveledUp = false;
  let newLevel: number | null = null;

  if (xpAwarded > 0) {
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
  }

  const daily = nextDailyXpCompletions(state.stats, todayIsoDate, eligibility.eligible);
  const completions = nextDailyCompletionCount(state.stats, todayIsoDate);
  const goalTarget = state.settings.dailyGoalTarget;
  const goalBefore = buildDailyGoal(state.stats, todayIsoDate, goalTarget);
  const firstOfDay = dailyCompletionsOn(state.stats, todayIsoDate) === 0;
  const streakMilestone = streakMilestoneCrossed(state.stats.streak, streak);

  const stats: UserStats = {
    ...state.stats,
    ...daily,
    ...completions,
    completionDays: nextCompletionDays(state.stats.completionDays, todayIsoDate),
    streak,
    bestStreak: Math.max(state.stats.bestStreak ?? 0, streak),
    lastCompletedDate: todayIsoDate,
    totalXpEarned: state.stats.totalXpEarned + xpAwarded,
    totalQuestsCompleted: state.stats.totalQuestsCompleted + 1,
  };
  const dailyGoalJustMet = !goalBefore.met && buildDailyGoal(stats, todayIsoDate, goalTarget).met;

  const questStreak = nextQuestStreak(quest, todayIsoDate);
  const quests: Quest[] = state.quests.map((q) => {
    if (q.id !== questId) return q;
    const done: Quest = { ...q, completed: true, completedAt: now.toISOString() };
    if (q.repeat) {
      done.lastDoneOn = todayIsoDate;
      done.streak = questStreak;
    }
    return done;
  });

  let next: AppState = {
    ...state,
    character,
    quests,
    stats,
    settings: streakResolution.settings,
  };
  next = noteWeek(next, now, { quest: { category: quest.category, streak } });
  let challengesFinished: Challenge[] = [];
  let challengeBonus: LootDrop | null = null;
  if (xpAwarded > 0) {
    const progress = progressChallenges(next, { type: 'QUEST', category: quest.category }, now);
    next = progress.state;
    challengesFinished = progress.finished;
    challengeBonus = progress.bonus;
    if (progress.finished.length > 0) {
      next = noteWeek(next, now, {
        challenges: progress.finished.length,
        items: progress.bonus ? 1 : 0,
      });
    }
  }

  return {
    state: next,
    challengesFinished,
    challengeBonus,
    leveledUp,
    newLevel,
    xpAwarded,
    denyReason: eligibility.reason,
    dailyGoalJustMet,
    streakMilestone,
    showVillainScene: firstOfDay || quest.difficulty === 'HARD',
    bonusXp,
    shieldConsumed: streakResolution.shieldConsumed,
    rewardTier,
  };
}

/**
 * Batalha só quando a conclusão daria XP.
 * BLOCKED marca a quest na hora, com o feedback curto, sem luta.
 */
export function planQuestCompletion(
  state: AppState,
  questId: string,
  now: Date = new Date(),
): QuestCompletionPlan {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || quest.completed) return 'REJECTED';
  const eligibility = evaluateXpEligibility(quest, state.stats, now.getTime(), localIsoDate(now));
  if (!eligibility.eligible || eligibility.xpAwarded <= 0) return 'BLOCKED';
  return 'BATTLE';
}
