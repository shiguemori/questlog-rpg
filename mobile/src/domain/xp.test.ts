import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyXp, nextStreak } from './xp';

describe('applyXp', () => {
  it('acumula XP sem level up', () => {
    const result = applyXp(1, 10, 100, 25);
    assert.equal(result.level, 1);
    assert.equal(result.xp, 35);
    assert.equal(result.maxXp, 100);
    assert.equal(result.attributePointsGained, 0);
  });

  it('sobe de nível e concede +2 atributos', () => {
    const result = applyXp(1, 90, 100, 25);
    assert.equal(result.level, 2);
    assert.equal(result.xp, 15);
    assert.equal(result.maxXp, 150);
    assert.equal(result.attributePointsGained, 2);
  });
});

describe('nextStreak', () => {
  it('inicia streak em 1', () => {
    assert.equal(
      nextStreak(
        {
          streak: 0,
          lastCompletedDate: null,
          totalXpEarned: 0,
          totalQuestsCompleted: 0,
        },
        '2026-11-11',
      ),
      1,
    );
  });

  it('incrementa em dias consecutivos', () => {
    assert.equal(
      nextStreak(
        {
          streak: 3,
          lastCompletedDate: '2026-11-10',
          totalXpEarned: 100,
          totalQuestsCompleted: 4,
        },
        '2026-11-11',
      ),
      4,
    );
  });
});
