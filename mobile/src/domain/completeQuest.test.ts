import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completeQuest } from './completeQuest';
import { CLASS_DEFAULTS, INITIAL_MAX_XP } from './constants';
import type { AppState, Quest } from './types';

function makeState(overrides: Partial<AppState> = {}): AppState {
  const quest: Quest = {
    id: 'q1',
    title: 'Estudar 25 min',
    category: 'STUDY',
    difficulty: 'HARD',
    xp: 50,
    completed: false,
    createdAt: '2026-11-11T10:00:00.000Z',
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
      lastCompletedDate: null,
      totalXpEarned: 0,
      totalQuestsCompleted: 0,
      dailyXpCompletions: 0,
      dailyXpCompletionsDate: null,
    },
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
  });

  it('retorna null para quest inexistente', () => {
    assert.equal(completeQuest(makeState(), 'missing', new Date()), null);
  });
});
