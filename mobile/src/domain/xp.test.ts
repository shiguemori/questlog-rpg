import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyXp, maxXpForLevel, nextStreak } from './xp';

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
          bestStreak: 0,
          lastCompletedDate: null,
          totalXpEarned: 0,
          totalQuestsCompleted: 0,
          dailyXpCompletions: 0,
          dailyXpCompletionsDate: null,
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
          bestStreak: 3,
          lastCompletedDate: '2026-11-10',
          totalXpEarned: 100,
          totalQuestsCompleted: 4,
          dailyXpCompletions: 2,
          dailyXpCompletionsDate: '2026-11-10',
        },
        '2026-11-11',
      ),
      4,
    );
  });

  const statsOn = (lastCompletedDate: string | null, streak: number) => ({
    streak,
    bestStreak: streak,
    lastCompletedDate,
    totalXpEarned: 0,
    totalQuestsCompleted: 0,
    dailyXpCompletions: 0,
    dailyXpCompletionsDate: null,
  });

  it('mantém streak no mesmo dia', () => {
    assert.equal(nextStreak(statsOn('2026-11-11', 5), '2026-11-11'), 5);
  });

  it('reinicia em 1 quando pula um dia', () => {
    assert.equal(nextStreak(statsOn('2026-11-09', 5), '2026-11-11'), 1);
  });

  it('incrementa na virada de mês e de ano', () => {
    assert.equal(nextStreak(statsOn('2026-10-31', 2), '2026-11-01'), 3);
    assert.equal(nextStreak(statsOn('2026-12-31', 9), '2027-01-01'), 10);
  });

  it('não zera streak se o relógio do aparelho voltar', () => {
    assert.equal(nextStreak(statsOn('2026-11-12', 4), '2026-11-11'), 4);
  });
});

describe('applyXp — guardas', () => {
  it('sobe vários níveis de uma vez', () => {
    const result = applyXp(1, 0, 100, 260);
    assert.equal(result.level, 3);
    assert.equal(result.xp, 10);
    assert.equal(result.maxXp, 225);
    assert.equal(result.attributePointsGained, 4);
  });

  it('XP exatamente igual ao máximo sobe de nível com sobra zero', () => {
    const result = applyXp(1, 90, 100, 10);
    assert.equal(result.level, 2);
    assert.equal(result.xp, 0);
  });

  it('ignora quantidade negativa, NaN ou infinita', () => {
    assert.equal(applyXp(1, 40, 100, -30).xp, 40);
    assert.equal(applyXp(1, 40, 100, Number.NaN).xp, 40);
    assert.equal(applyXp(1, 40, 100, Number.POSITIVE_INFINITY).xp, 40);
  });

  it('não trava com maxXp inválido (save corrompido)', () => {
    const result = applyXp(1, 0, 0, 10);
    assert.equal(result.level, 1);
    assert.equal(result.maxXp, 100);
    assert.equal(result.xp, 10);
  });
});

describe('maxXpForLevel', () => {
  it('segue a curva 100 → 150 → 225', () => {
    assert.equal(maxXpForLevel(1), 100);
    assert.equal(maxXpForLevel(2), 150);
    assert.equal(maxXpForLevel(3), 225);
  });
});
