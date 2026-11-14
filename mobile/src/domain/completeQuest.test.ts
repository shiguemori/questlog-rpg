import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_XP_QUESTS_PER_DAY } from './antiFarm';
import { completeQuest, planQuestCompletion } from './completeQuest';
import { CLASS_DEFAULTS, INITIAL_MAX_XP } from './constants';
import { localIsoDate } from './dates';
import { emptyWeeklyBoss } from './boss';
import { emptyInventory } from './loot';
import { defaultPlayerSettings } from './state';
import type { AppState, Quest } from './types';
import { xpProgressRatio } from './xpBar';

function makeState(overrides: Partial<AppState> = {}): AppState {
  const quest: Quest = {
    id: 'q1',
    title: 'Estudar 25 min',
    category: 'STUDY',
    difficulty: 'HARD',
    xp: 50,
    completed: false,
    createdAt: '2026-11-11T10:00:00.000Z',
    recurring: false,
  };
  return {
    onboardingDone: true,
    character: {
      name: 'Lucas',
      characterClass: 'MAGE',
      level: 1,
      xp: 80,
      maxXp: INITIAL_MAX_XP,
      attributes: { ...CLASS_DEFAULTS.MAGE.attributes },
      attributePoints: 0,
    },
    quests: [quest],
    stats: {
      streak: 0,
      bestStreak: 0,
      lastCompletedDate: null,
      totalXpEarned: 0,
      totalQuestsCompleted: 0,
      dailyXpCompletions: 0,
      dailyXpCompletionsDate: null,
      dailyCompletions: 0,
      dailyCompletionsDate: null,
      completionDays: [],
    },
    inventory: emptyInventory(),
    weeklyBoss: emptyWeeklyBoss(),
    settings: defaultPlayerSettings(),
    ...overrides,
  };
}

describe('completeQuest', () => {
  it('marca quest, dá XP e sobe de nível', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const result = completeQuest(makeState(), 'q1', now);
    assert.ok(result);
    assert.equal(result.state.quests[0].completed, true);
    assert.equal(result.xpAwarded, 50);
    assert.equal(result.leveledUp, true);
    assert.equal(result.newLevel, 2);
    assert.equal(result.state.character.level, 2);
    assert.equal(result.state.character.attributePoints, 2);
    assert.equal(result.state.stats.dailyXpCompletions, 1);
    assert.equal(result.denyReason, null);
  });

  it('conclui sem XP se criada há menos de 1 min', () => {
    const state = makeState({
      quests: [
        {
          id: 'q1',
          title: 'Rápida',
          category: 'OTHER',
          difficulty: 'EASY',
          xp: 10,
          completed: false,
          createdAt: '2026-11-11T10:04:30.000Z',
          recurring: false,
        },
      ],
    });
    const result = completeQuest(state, 'q1', new Date('2026-11-11T10:05:00.000Z'));
    assert.ok(result);
    assert.equal(result.state.quests[0].completed, true);
    assert.equal(result.xpAwarded, 0);
    assert.equal(result.leveledUp, false);
    assert.equal(result.denyReason, 'TOO_FAST');
    assert.equal(result.state.character.xp, 80);
    assert.equal(result.state.stats.dailyXpCompletions, 0);
    assert.equal(result.state.stats.dailyCompletions, 1);
    assert.equal(result.dailyGoalJustMet, true);
    assert.equal(result.xpAwarded, 0);
  });

  it('retorna null para quest inexistente', () => {
    assert.equal(completeQuest(makeState(), 'missing', new Date()), null);
  });

  it('quando concede XP, o progresso da barra sobe', () => {
    const state = makeState({
      character: {
        name: 'Lucas',
        characterClass: 'MAGE',
        level: 1,
        xp: 0,
        maxXp: INITIAL_MAX_XP,
        attributes: { ...CLASS_DEFAULTS.MAGE.attributes },
        attributePoints: 0,
      },
      quests: [
        {
          id: 'q1',
          title: 'Fácil',
          category: 'STUDY',
          difficulty: 'EASY',
          xp: 10,
          completed: false,
          createdAt: '2026-11-11T10:00:00.000Z',
          recurring: false,
        },
      ],
    });
    const before = xpProgressRatio(state.character.xp, state.character.maxXp);
    const result = completeQuest(state, 'q1', new Date('2026-11-11T10:05:00.000Z'));
    assert.ok(result);
    assert.equal(result.xpAwarded, 10);
    assert.equal(result.denyReason, null);
    const after = xpProgressRatio(result.state.character.xp, result.state.character.maxXp);
    assert.equal(before, 0);
    assert.equal(after, 0.1);
    assert.ok(after > before);
  });

  it('não conclui a mesma quest duas vezes (sem XP em dobro)', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const first = completeQuest(makeState(), 'q1', now);
    assert.ok(first);
    assert.equal(completeQuest(first.state, 'q1', now), null);
  });

  it('conclui sem XP quando o limite diário já foi atingido', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const base = makeState();
    const state = makeState({
      stats: {
        ...base.stats,
        dailyXpCompletions: MAX_XP_QUESTS_PER_DAY,
        dailyXpCompletionsDate: localIsoDate(now),
      },
    });
    const result = completeQuest(state, 'q1', now);
    assert.ok(result);
    assert.equal(result.xpAwarded, 0);
    assert.equal(result.denyReason, 'DAILY_LIMIT');
    assert.equal(result.state.quests[0].completed, true);
    assert.equal(result.state.character.xp, 80);
    assert.equal(result.state.stats.dailyXpCompletions, MAX_XP_QUESTS_PER_DAY);
    assert.equal(result.state.stats.totalXpEarned, 0);
  });

  it('usa o dia local do aparelho para streak e limite diário', () => {
    // 23h30 no relógio do jogador: ainda é dia 11, mesmo que em UTC já seja dia 12.
    const now = new Date(2026, 10, 11, 23, 30);
    const state = makeState({
      quests: [
        {
          id: 'q1',
          title: 'Noturna',
          category: 'OTHER',
          difficulty: 'EASY',
          xp: 10,
          completed: false,
          createdAt: new Date(2026, 10, 11, 23, 0).toISOString(),
          recurring: false,
        },
      ],
    });
    const result = completeQuest(state, 'q1', now);
    assert.ok(result);
    assert.equal(result.state.stats.lastCompletedDate, '2026-11-11');
    assert.equal(result.state.stats.dailyXpCompletionsDate, '2026-11-11');
  });

  it('registra completedAt, totais e melhor streak', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const base = makeState();
    const state = makeState({
      stats: { ...base.stats, streak: 2, bestStreak: 2, lastCompletedDate: '2026-11-10' },
    });
    const result = completeQuest(state, 'q1', now);
    assert.ok(result);
    assert.equal(result.state.quests[0].completedAt, now.toISOString());
    assert.equal(result.state.stats.totalQuestsCompleted, 1);
    assert.equal(result.state.stats.totalXpEarned, 55);
    assert.equal(result.bonusXp, 5);
    assert.equal(result.state.stats.streak, 3);
    assert.equal(result.state.stats.bestStreak, 3);
  });

  it('melhor streak não diminui quando o streak reinicia', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const base = makeState();
    const state = makeState({
      stats: { ...base.stats, streak: 5, bestStreak: 5, lastCompletedDate: '2026-11-01' },
    });
    const result = completeQuest(state, 'q1', now);
    assert.ok(result);
    assert.equal(result.state.stats.streak, 1);
    assert.equal(result.state.stats.bestStreak, 5);
    assert.equal(result.streakMilestone, null);
    assert.equal(result.dailyGoalJustMet, true);
  });

  it('fecha a meta sem furar o anti-farm e marca o marco de 3 dias', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const today = localIsoDate(now);
    const base = makeState();
    const first = completeQuest(
      makeState({
        stats: {
          ...base.stats,
          streak: 2,
          bestStreak: 2,
          lastCompletedDate: '2026-11-10',
        },
      }),
      'q1',
      now,
    );
    assert.ok(first);
    assert.equal(first.state.stats.streak, 3);
    assert.equal(first.streakMilestone?.days, 3);
    assert.equal(first.dailyGoalJustMet, true);
    assert.equal(first.state.stats.dailyXpCompletions, 1);
    assert.deepEqual(first.state.stats.completionDays, [today]);

    const again = completeQuest(
      {
        ...first.state,
        quests: [
          ...first.state.quests,
          {
            id: 'q2',
            title: 'Outra',
            category: 'OTHER',
            difficulty: 'EASY',
            xp: 10,
            completed: false,
            createdAt: '2026-11-11T10:00:00.000Z',
            recurring: false,
          },
        ],
      },
      'q2',
      now,
    );
    assert.ok(again);
    assert.equal(again.dailyGoalJustMet, false);
    assert.equal(again.streakMilestone, null);
    assert.equal(again.state.stats.dailyCompletions, 2);
    assert.equal(again.state.stats.dailyXpCompletions, 2);
    assert.deepEqual(again.state.stats.completionDays, [today]);
  });

  it('não muta o estado recebido', () => {
    const state = makeState();
    const snapshot = JSON.stringify(state);
    completeQuest(state, 'q1', new Date('2026-11-11T10:05:00.000Z'));
    assert.equal(JSON.stringify(state), snapshot);
  });

  it('derrota paga metade do XP base, sem bônus, e mantém o hábito', () => {
    const now = new Date(2026, 10, 11, 10, 5);
    const base = makeState();
    const state = makeState({
      character: {
        ...base.character,
        xp: 0,
        attributes: { ...base.character.attributes, intelligence: 8 },
      },
      stats: { ...base.stats, streak: 2, bestStreak: 2, lastCompletedDate: '2026-11-10' },
      quests: [{ ...base.quests[0], difficulty: 'EASY', xp: 10, category: 'STUDY' }],
    });
    const full = completeQuest(state, 'q1', now);
    const reduced = completeQuest(state, 'q1', now, { rewardTier: 'REDUCED' });
    assert.ok(full);
    assert.ok(reduced);
    assert.equal(full.xpAwarded, 18);
    assert.equal(full.bonusXp, 8);
    assert.equal(reduced.rewardTier, 'REDUCED');
    assert.equal(reduced.xpAwarded, 5);
    assert.equal(reduced.bonusXp, 0);
    assert.equal(reduced.state.character.xp, 5);
    assert.equal(reduced.state.stats.streak, 3);
    assert.equal(reduced.state.stats.dailyXpCompletions, 1);
    assert.equal(reduced.state.quests[0].completed, true);
    assert.equal(reduced.dailyGoalJustMet, true);
  });

  it('derrota não fura o anti-farm', () => {
    const now = new Date(2026, 10, 11, 10, 5);
    const tooFast = makeState({
      quests: [
        {
          id: 'q1',
          title: 'Rápida',
          category: 'OTHER',
          difficulty: 'EASY',
          xp: 10,
          completed: false,
          createdAt: new Date(2026, 10, 11, 10, 4, 30).toISOString(),
          recurring: false,
        },
      ],
    });
    const blocked = completeQuest(tooFast, 'q1', now, { rewardTier: 'REDUCED' });
    assert.ok(blocked);
    assert.equal(blocked.xpAwarded, 0);
    assert.equal(blocked.denyReason, 'TOO_FAST');
    assert.equal(blocked.state.stats.dailyXpCompletions, 0);

    const base = makeState();
    const limited = completeQuest(
      makeState({
        stats: {
          ...base.stats,
          dailyXpCompletions: MAX_XP_QUESTS_PER_DAY,
          dailyXpCompletionsDate: localIsoDate(now),
        },
      }),
      'q1',
      now,
      { rewardTier: 'REDUCED' },
    );
    assert.ok(limited);
    assert.equal(limited.xpAwarded, 0);
    assert.equal(limited.denyReason, 'DAILY_LIMIT');
    assert.equal(limited.state.stats.dailyXpCompletions, MAX_XP_QUESTS_PER_DAY);
  });

  it('abre batalha só quando a conclusão daria XP', () => {
    const now = new Date(2026, 10, 11, 10, 5);
    const state = makeState();
    assert.equal(planQuestCompletion(state, 'missing', now), 'REJECTED');
    assert.equal(planQuestCompletion(state, 'q1', now), 'BATTLE');

    const done = completeQuest(state, 'q1', now);
    assert.ok(done);
    assert.equal(planQuestCompletion(done.state, 'q1', now), 'REJECTED');

    const tooFast = makeState({
      quests: [
        {
          ...state.quests[0],
          createdAt: new Date(2026, 10, 11, 10, 4, 30).toISOString(),
        },
      ],
    });
    assert.equal(planQuestCompletion(tooFast, 'q1', now), 'BLOCKED');
  });
});
