import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDailyXpSummary,
  evaluateXpEligibility,
  MAX_XP_QUESTS_PER_DAY,
  MIN_QUEST_AGE_MS,
  msUntilXpEligible,
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
  recurring: false,
};

const baseStats: UserStats = {
  streak: 1,
  bestStreak: 1,
  lastCompletedDate: '2026-11-11',
  totalXpEarned: 0,
  totalQuestsCompleted: 0,
  dailyXpCompletions: 0,
  dailyXpCompletionsDate: null,
  dailyCompletions: 0,
  dailyCompletionsDate: null,
  completionDays: [],
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

describe('msUntilXpEligible', () => {
  const created = Date.parse(baseQuest.createdAt);

  it('conta o tempo que falta para liberar XP', () => {
    assert.equal(msUntilXpEligible(baseQuest, created), MIN_QUEST_AGE_MS);
    assert.equal(msUntilXpEligible(baseQuest, created + 18_000), 42_000);
  });

  it('zera exatamente quando evaluateXpEligibility passa a liberar', () => {
    const at = created + MIN_QUEST_AGE_MS;
    assert.equal(msUntilXpEligible(baseQuest, at), 0);
    assert.equal(evaluateXpEligibility(baseQuest, baseStats, at, '2026-11-11').eligible, true);
    assert.ok(msUntilXpEligible(baseQuest, at - 1) > 0);
    assert.equal(evaluateXpEligibility(baseQuest, baseStats, at - 1, '2026-11-11').eligible, false);
  });

  it('nunca passa de 1 minuto, mesmo com relógio atrasado', () => {
    assert.equal(msUntilXpEligible(baseQuest, created - 3_600_000), MIN_QUEST_AGE_MS);
  });

  it('devolve 0 para data de criação inválida', () => {
    assert.equal(msUntilXpEligible({ ...baseQuest, createdAt: 'ontem' }, created), 0);
  });
});

describe('buildDailyXpSummary', () => {
  it('conta só as quests com XP do dia', () => {
    const summary = buildDailyXpSummary(
      { ...baseStats, dailyXpCompletions: 3, dailyXpCompletionsDate: '2026-11-11' },
      '2026-11-11',
    );
    assert.deepEqual(summary, {
      xpQuestsToday: 3,
      xpQuestsLimit: MAX_XP_QUESTS_PER_DAY,
      xpQuestsRemaining: MAX_XP_QUESTS_PER_DAY - 3,
      limitReached: false,
    });
  });

  it('zera em um novo dia', () => {
    const summary = buildDailyXpSummary(
      { ...baseStats, dailyXpCompletions: 10, dailyXpCompletionsDate: '2026-11-10' },
      '2026-11-11',
    );
    assert.equal(summary.xpQuestsToday, 0);
    assert.equal(summary.limitReached, false);
  });

  it('marca limite atingido aos 10', () => {
    const summary = buildDailyXpSummary(
      { ...baseStats, dailyXpCompletions: 10, dailyXpCompletionsDate: '2026-11-11' },
      '2026-11-11',
    );
    assert.equal(summary.limitReached, true);
    assert.equal(summary.xpQuestsRemaining, 0);
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
