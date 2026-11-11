import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateXpEligibility,
  MAX_XP_QUESTS_PER_DAY,
  MIN_QUEST_AGE_MS,
  nextDailyXpCompletions,
} from './antiFarm';
import type { Quest, UserStats } from './types';

const baseQuest: Quest = {
  id: 'q1',
  title: 'Beber água',
  category: 'HEALTH',
  difficulty: 'EASY',
  xp: 10,
  completed: false,
  createdAt: '2026-11-11T12:00:00.000Z',
};

const baseStats: UserStats = {
  streak: 1,
  lastCompletedDate: '2026-11-11',
  totalXpEarned: 0,
  totalQuestsCompleted: 0,
  dailyXpCompletions: 0,
  dailyXpCompletionsDate: null,
};

describe('evaluateXpEligibility', () => {
  it('nega XP se quest tiver menos de 1 minuto', () => {
    const created = Date.parse(baseQuest.createdAt);
    const result = evaluateXpEligibility(
      baseQuest,
      baseStats,
      created + MIN_QUEST_AGE_MS - 1,
      '2026-11-11',
    );
    assert.equal(result.eligible, false);
    assert.equal(result.xpAwarded, 0);
    assert.equal(result.reason, 'TOO_FAST');
  });

  it('concede XP após 1 minuto', () => {
    const created = Date.parse(baseQuest.createdAt);
    const result = evaluateXpEligibility(
      baseQuest,
      baseStats,
      created + MIN_QUEST_AGE_MS,
      '2026-11-11',
    );
    assert.equal(result.eligible, true);
    assert.equal(result.xpAwarded, 10);
    assert.equal(result.reason, null);
  });

  it('nega XP no 11º completion do dia', () => {
    const created = Date.parse(baseQuest.createdAt);
    const stats: UserStats = {
      ...baseStats,
      dailyXpCompletions: MAX_XP_QUESTS_PER_DAY,
      dailyXpCompletionsDate: '2026-11-11',
    };
    const result = evaluateXpEligibility(
      baseQuest,
      stats,
      created + MIN_QUEST_AGE_MS,
      '2026-11-11',
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'DAILY_LIMIT');
  });

  it('reinicia contagem em novo dia civil', () => {
    const created = Date.parse(baseQuest.createdAt);
    const stats: UserStats = {
      ...baseStats,
      dailyXpCompletions: MAX_XP_QUESTS_PER_DAY,
      dailyXpCompletionsDate: '2026-11-10',
    };
    const result = evaluateXpEligibility(
      baseQuest,
      stats,
      created + MIN_QUEST_AGE_MS,
      '2026-11-11',
    );
    assert.equal(result.eligible, true);
    assert.equal(result.xpAwarded, 10);
  });
});

describe('nextDailyXpCompletions', () => {
  it('incrementa quando XP foi concedido', () => {
    const next = nextDailyXpCompletions(baseStats, '2026-11-11', true);
    assert.equal(next.dailyXpCompletions, 1);
    assert.equal(next.dailyXpCompletionsDate, '2026-11-11');
  });

  it('não incrementa quando XP foi negado', () => {
    const next = nextDailyXpCompletions(
      { ...baseStats, dailyXpCompletions: 3, dailyXpCompletionsDate: '2026-11-11' },
      '2026-11-11',
      false,
    );
    assert.equal(next.dailyXpCompletions, 3);
  });
});
