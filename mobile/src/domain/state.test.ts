import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLASS_DEFAULTS } from './constants';
import {
  ACHIEVEMENTS,
  heroRankForLevel,
  nextRankHint,
  newlyUnlockedAchievements,
  spendAttributePoint,
  unlockedAchievementIds,
} from './progression';
import { createInitialState, sanitizeState, startJourney } from './state';
import type { AppState } from './types';

describe('createInitialState / startJourney', () => {
  it('começa antes do onboarding, nível 1 e sem quests', () => {
    const state = createInitialState();
    assert.equal(state.onboardingDone, false);
    assert.equal(state.character.level, 1);
    assert.equal(state.character.maxXp, 100);
    assert.deepEqual(state.quests, []);
    assert.equal(state.stats.bestStreak, 0);
  });

  it('startJourney aplica nome e atributos da classe', () => {
    const state = startJourney('  Lucas ', 'MAGE');
    assert.equal(state.onboardingDone, true);
    assert.equal(state.character.name, 'Lucas');
    assert.deepEqual(state.character.attributes, CLASS_DEFAULTS.MAGE.attributes);
  });

  it('startJourney não deixa herói sem nome', () => {
    assert.equal(startJourney('   ', 'ROGUE').character.name, 'Herói');
  });
});

describe('sanitizeState', () => {
  it('recusa o que não é objeto', () => {
    assert.equal(sanitizeState(null), null);
    assert.equal(sanitizeState('texto'), null);
    assert.equal(sanitizeState([1, 2]), null);
    assert.equal(sanitizeState(42), null);
  });

  it('preserva um save válido sem alterar nada', () => {
    const saved: AppState = {
      ...startJourney('Lucas', 'WARRIOR'),
      quests: [
        {
          id: 'q1',
          title: 'Treino',
          category: 'HEALTH',
          difficulty: 'HARD',
          xp: 50,
          completed: true,
          createdAt: '2026-11-11T10:00:00.000Z',
          completedAt: '2026-11-11T10:05:00.000Z',
          recurring: false,
        },
      ],
      stats: {
        streak: 2,
        bestStreak: 4,
        lastCompletedDate: '2026-11-11',
        totalXpEarned: 50,
        totalQuestsCompleted: 1,
        dailyXpCompletions: 1,
        dailyXpCompletionsDate: '2026-11-11',
        dailyCompletions: 1,
        dailyCompletionsDate: '2026-11-11',
        completionDays: ['2026-11-10', '2026-11-11'],
      },
    };
    assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(saved))), saved);
  });

  it('migra save antigo sem bestStreak nem completedAt', () => {
    const legacy = {
      onboardingDone: true,
      character: { name: 'Ana', characterClass: 'ROGUE', level: 2, xp: 30, maxXp: 150 },
      quests: [
        {
          id: 'q1',
          title: 'Ler',
          category: 'STUDY',
          difficulty: 'MEDIUM',
          xp: 25,
          completed: true,
          createdAt: '2026-11-01T10:00:00.000Z',
        },
      ],
      stats: { streak: 3, lastCompletedDate: '2026-11-10', totalXpEarned: 130 },
    };
    const state = sanitizeState(legacy);
    assert.ok(state);
    assert.equal(state.stats.bestStreak, 3);
    assert.equal(state.stats.totalQuestsCompleted, 0);
    assert.equal(state.stats.dailyXpCompletions, 0);
    assert.equal(state.stats.dailyCompletions, 0);
    assert.deepEqual(state.stats.completionDays, ['2026-11-08', '2026-11-09', '2026-11-10']);
    assert.deepEqual(state.character.attributes, CLASS_DEFAULTS.ROGUE.attributes);
    assert.equal(state.character.attributePoints, 0);
    assert.equal(state.quests[0].completedAt, undefined);
  });

  it('save antigo sem a dica da batalha mostra a dica uma vez; o salvo é respeitado', () => {
    const fresh = startJourney('Ana', 'MAGE');
    assert.equal(fresh.settings.battleTutorialDone, false);
    const raw = JSON.parse(JSON.stringify(fresh)) as { settings: Record<string, unknown> };
    delete raw.settings.battleTutorialDone;
    assert.equal(sanitizeState(raw)?.settings.battleTutorialDone, false);
    raw.settings.battleTutorialDone = true;
    assert.equal(sanitizeState(raw)?.settings.battleTutorialDone, true);
    raw.settings.battleTutorialDone = 'sim';
    assert.equal(sanitizeState(raw)?.settings.battleTutorialDone, false);
  });

  it('corrige herói inválido: classe, nível, teto de XP', () => {
    const state = sanitizeState({
      onboardingDone: true,
      character: { name: '', characterClass: 'DRAGON', level: -4, xp: 'muito', maxXp: 0 },
    });
    assert.ok(state);
    assert.equal(state.character.characterClass, 'WARRIOR');
    assert.equal(state.character.level, 1);
    assert.equal(state.character.maxXp, 100);
    assert.equal(state.character.xp, 0);
    assert.equal(state.character.name, 'Herói');
  });

  it('XP acima do teto vira níveis de verdade (barra nunca estoura)', () => {
    const state = sanitizeState({
      onboardingDone: true,
      character: { name: 'Lucas', characterClass: 'MAGE', level: 1, xp: 260, maxXp: 100 },
    });
    assert.ok(state);
    assert.equal(state.character.level, 3);
    assert.equal(state.character.xp, 10);
    assert.equal(state.character.maxXp, 225);
    assert.equal(state.character.attributePoints, 4);
    assert.ok(state.character.xp < state.character.maxXp);
  });

  it('descarta quests inválidas e duplicadas; XP volta para a tabela oficial', () => {
    const state = sanitizeState({
      onboardingDone: true,
      character: { name: 'Lucas' },
      quests: [
        {
          id: 'a',
          title: 'Ok',
          category: 'WORK',
          difficulty: 'HARD',
          xp: 99999,
          completed: false,
          createdAt: '2026-11-11T10:00:00.000Z',
        },
        { id: 'a', title: 'Duplicada', category: 'WORK', difficulty: 'EASY', xp: 10 },
        { id: '', title: 'Sem id' },
        { id: 'b', title: '   ' },
        'lixo',
        {
          id: 'c',
          title: 'Campos tortos',
          category: 'MAGIA',
          difficulty: 'IMPOSSIBLE',
          createdAt: 'ontem',
        },
      ],
    });
    assert.ok(state);
    assert.deepEqual(
      state.quests.map((q) => q.id),
      ['a', 'c'],
    );
    assert.equal(state.quests[0].xp, 50);
    assert.equal(state.quests[1].category, 'OTHER');
    assert.equal(state.quests[1].difficulty, 'EASY');
    assert.equal(state.quests[1].xp, 10);
    assert.equal(state.quests[1].completed, false);
    assert.ok(!Number.isNaN(Date.parse(state.quests[1].createdAt)));
  });

  it('zera contagem diária sem data válida', () => {
    const state = sanitizeState({
      stats: { dailyXpCompletions: 7, dailyXpCompletionsDate: '11/11/2026', streak: -2 },
    });
    assert.ok(state);
    assert.equal(state.stats.dailyXpCompletions, 0);
    assert.equal(state.stats.dailyXpCompletionsDate, null);
    assert.equal(state.stats.streak, 0);
  });
});

describe('spendAttributePoint', () => {
  it('gasta 1 ponto e aumenta o atributo escolhido', () => {
    const base = startJourney('Lucas', 'MAGE');
    const state: AppState = { ...base, character: { ...base.character, attributePoints: 2 } };
    const next = spendAttributePoint(state, 'intelligence');
    assert.ok(next);
    assert.equal(next.character.attributePoints, 1);
    assert.equal(next.character.attributes.intelligence, 6);
    assert.equal(next.character.attributes.strength, 1);
    assert.equal(state.character.attributes.intelligence, 5);
  });

  it('devolve null sem pontos disponíveis', () => {
    assert.equal(spendAttributePoint(startJourney('Lucas', 'MAGE'), 'strength'), null);
  });
});

describe('heroRankForLevel', () => {
  it('sobe de título nos marcos de nível', () => {
    assert.equal(heroRankForLevel(1), 'Aprendiz');
    assert.equal(heroRankForLevel(2), 'Aprendiz');
    assert.equal(heroRankForLevel(3), 'Aventureiro');
    assert.equal(heroRankForLevel(6), 'Veterano');
    assert.equal(heroRankForLevel(10), 'Campeão');
    assert.equal(heroRankForLevel(15), 'Lenda');
    assert.equal(heroRankForLevel(16), 'Lenda');
  });

  it('diz quantos níveis faltam para o próximo título', () => {
    assert.equal(nextRankHint(1), 'Mais 2 níveis para Aventureiro.');
    assert.equal(nextRankHint(2), 'Mais 1 nível para Aventureiro.');
    assert.equal(nextRankHint(15), 'Você é Lenda. O hábito é a recompensa.');
  });
});

describe('conquistas', () => {
  const fresh = startJourney('Lucas', 'MAGE');

  it('herói novo não tem conquistas', () => {
    assert.deepEqual(unlockedAchievementIds(fresh), []);
  });

  it('ids são únicos', () => {
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  });

  it('desbloqueia por XP total, streak e nível', () => {
    const state: AppState = {
      ...fresh,
      character: { ...fresh.character, level: 3 },
      stats: { ...fresh.stats, totalXpEarned: 120, bestStreak: 3 },
    };
    assert.deepEqual(unlockedAchievementIds(state), ['FIRST_XP', 'XP_100', 'STREAK_3', 'LEVEL_3']);
  });

  it('quest concluída sem XP não desbloqueia nada (anti-farm)', () => {
    const state: AppState = {
      ...fresh,
      stats: { ...fresh.stats, totalQuestsCompleted: 40, streak: 1, bestStreak: 1 },
    };
    assert.deepEqual(unlockedAchievementIds(state), []);
  });

  it('avisa só as conquistas novas entre dois estados', () => {
    const before: AppState = { ...fresh, stats: { ...fresh.stats, totalXpEarned: 90 } };
    const after: AppState = { ...fresh, stats: { ...fresh.stats, totalXpEarned: 100 } };
    assert.deepEqual(
      newlyUnlockedAchievements(before, after).map((a) => a.id),
      ['XP_100'],
    );
    assert.deepEqual(newlyUnlockedAchievements(after, after), []);
  });
});

describe('sanitizeState — loot, chefe e música', () => {
  it('save antigo ganha mochila inicial, chefe zerado e música média', () => {
    const legacy = startJourney('Ana', 'MAGE') as unknown as Record<string, unknown>;
    delete legacy.inventory;
    delete legacy.weeklyBoss;
    const state = sanitizeState({ ...legacy, settings: { soundEnabled: true } });
    assert.ok(state);
    assert.deepEqual(state.inventory.gear, []);
    assert.equal(state.inventory.potions['potion.water'], 1);
    assert.equal(state.weeklyBoss.wins, 0);
    assert.equal(state.settings.musicVolume, 0.6);
  });

  it('volume de música fora da lista volta para o padrão', () => {
    const state = sanitizeState({ ...startJourney('Ana', 'MAGE'), settings: { musicVolume: 7 } });
    assert.equal(state?.settings.musicVolume, 0.6);
    const off = sanitizeState({ ...startJourney('Ana', 'MAGE'), settings: { musicVolume: 0 } });
    assert.equal(off?.settings.musicVolume, 0);
  });
});
