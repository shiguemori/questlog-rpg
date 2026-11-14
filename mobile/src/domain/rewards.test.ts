import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completeQuest } from './completeQuest';
import { CLASS_DEFAULTS } from './constants';
import { localIsoDate } from './dates';
import { attributeBonusXp, canArmStreakShield, resolveStreak, streakBonusXp } from './rewards';
import { emptyBestiary } from './bestiary';
import { emptyWeeklyBoss } from './boss';
import { emptyDailyChallenges } from './challenges';
import { emptyInventory } from './loot';
import { defaultPlayerSettings } from './state';
import type { AppState, Character } from './types';

function mage(extraIntelligence = 0): Character {
  return {
    name: 'Lucas',
    characterClass: 'MAGE',
    level: 1,
    xp: 0,
    maxXp: 100,
    attributes: {
      ...CLASS_DEFAULTS.MAGE.attributes,
      intelligence: CLASS_DEFAULTS.MAGE.attributes.intelligence + extraIntelligence,
    },
    attributePoints: 0,
  };
}

describe('bônus de atributo e streak', () => {
  it('herói novo não ganha bônus; ponto investido soma até o teto', () => {
    assert.equal(attributeBonusXp(mage(0), 'STUDY'), 0);
    assert.equal(attributeBonusXp(mage(1), 'STUDY'), 1);
    assert.equal(attributeBonusXp(mage(40), 'STUDY'), 10);
    assert.equal(attributeBonusXp(mage(4), 'HEALTH'), 0);
  });

  it('streak só bonifica a partir de 3 e tem teto', () => {
    assert.equal(streakBonusXp(2), 0);
    assert.equal(streakBonusXp(3), 5);
    assert.equal(streakBonusXp(7), 10);
    assert.equal(streakBonusXp(14), 15);
    assert.equal(streakBonusXp(100), 15);
  });

  it('anti-farm ainda zera o bônus e o limite diário continua em 10', () => {
    const now = new Date('2026-11-11T10:05:00.000Z');
    const base = {
      onboardingDone: true,
      character: mage(3),
      quests: [
        {
          id: 'q1',
          title: 'Estudar',
          category: 'STUDY' as const,
          difficulty: 'EASY' as const,
          xp: 10,
          completed: false,
          createdAt: '2026-11-11T10:04:30.000Z',
          recurring: false,
        },
      ],
      stats: {
        streak: 10,
        bestStreak: 10,
        lastCompletedDate: '2026-11-10',
        totalXpEarned: 0,
        totalQuestsCompleted: 0,
        dailyXpCompletions: 10,
        dailyXpCompletionsDate: localIsoDate(now),
        dailyCompletions: 0,
        dailyCompletionsDate: null,
        completionDays: [],
      },
      settings: defaultPlayerSettings(),
      inventory: emptyInventory(),
      weeklyBoss: emptyWeeklyBoss(),
      dailyChallenges: emptyDailyChallenges(),
      weeks: [],
      bestiary: emptyBestiary(),
      focus: null,
    } satisfies AppState;
    const blocked = completeQuest(base, 'q1', new Date('2026-11-11T10:04:40.000Z'));
    assert.ok(blocked);
    assert.equal(blocked.xpAwarded, 0);
    assert.equal(blocked.bonusXp, 0);
    assert.equal(blocked.denyReason, 'TOO_FAST');

    const limited = completeQuest(
      {
        ...base,
        quests: [{ ...base.quests[0], createdAt: '2026-11-11T10:00:00.000Z' }],
      },
      'q1',
      now,
    );
    assert.ok(limited);
    assert.equal(limited.denyReason, 'DAILY_LIMIT');
    assert.equal(limited.xpAwarded, 0);
    assert.equal(limited.state.stats.dailyXpCompletions, 10);
  });
});

describe('escudo de streak', () => {
  const stats = {
    streak: 4,
    bestStreak: 4,
    lastCompletedDate: '2026-11-09',
    totalXpEarned: 0,
    totalQuestsCompleted: 0,
    dailyXpCompletions: 0,
    dailyXpCompletionsDate: null,
    dailyCompletions: 0,
    dailyCompletionsDate: null,
    completionDays: [],
  };

  it('cobre um dia perdido e não dá para usar de novo no mês', () => {
    const armed = { ...defaultPlayerSettings(), streakShieldArmed: true };
    const saved = resolveStreak(stats, '2026-11-11', armed);
    assert.equal(saved.streak, 5);
    assert.equal(saved.shieldConsumed, true);
    assert.equal(saved.settings.streakShieldArmed, false);
    assert.equal(canArmStreakShield(saved.settings, '2026-11-11'), false);
    assert.equal(canArmStreakShield(saved.settings, '2026-12-01'), true);
  });

  it('não cobre um buraco de dois dias', () => {
    const armed = { ...defaultPlayerSettings(), streakShieldArmed: true };
    const saved = resolveStreak({ ...stats, lastCompletedDate: '2026-11-08' }, '2026-11-11', armed);
    assert.equal(saved.streak, 1);
    assert.equal(saved.shieldConsumed, false);
    assert.equal(saved.settings.streakShieldArmed, true);
  });
});
