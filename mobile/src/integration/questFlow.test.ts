import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_XP_QUESTS_PER_DAY, buildDailyXpSummary } from '../domain/antiFarm';
import { completeQuest } from '../domain/completeQuest';
import { localIsoDate } from '../domain/dates';
import { spendAttributePoint, unlockedAchievementIds } from '../domain/progression';
import { addQuest, deleteQuest } from '../domain/quests';
import { startJourney } from '../domain/state';
import type { AppState, Difficulty } from '../domain/types';
import { xpProgressRatio } from '../domain/xpBar';
import {
  createMemoryStorage,
  createSafeStorage,
  createStateStore,
  STORAGE_KEY,
} from '../storage/stateStore';

const MINUTE = 60_000;

/** Horário local fixo: os testes valem em qualquer fuso (CI roda em UTC). */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, day, hour, minute, 0, 0);
}

/** Registra uma quest e a conclui `waitMs` depois. Devolve o novo estado e o resultado. */
function play(state: AppState, title: string, difficulty: Difficulty, createdAt: Date, waitMs: number) {
  const added = addQuest(state, { title, difficulty, category: 'STUDY' }, createdAt);
  assert.ok(added.ok, 'quest deveria ser registrada');
  const result = completeQuest(
    added.state,
    added.quest.id,
    new Date(createdAt.getTime() + waitMs),
  );
  assert.ok(result, 'quest deveria ser concluída');
  return result;
}

describe('fluxo complete → XP → level → persistência', () => {
  it('onboarding, quest com XP, level up, gasto de atributo e recarga do save', async () => {
    const storage = createMemoryStorage();
    const store = createStateStore(storage);

    const loaded = await store.load();
    assert.equal(loaded.status, 'EMPTY');

    let state = startJourney('Lucas', 'MAGE');
    await store.save(state);

    // 1ª quest: barra sai de 0% para 50%.
    const first = play(state, 'Estudar 25min', 'HARD', at(11, 9), 2 * MINUTE);
    assert.equal(first.xpAwarded, 50);
    assert.equal(first.leveledUp, false);
    assert.equal(xpProgressRatio(state.character.xp, state.character.maxXp), 0);
    assert.equal(xpProgressRatio(first.state.character.xp, first.state.character.maxXp), 0.5);
    state = first.state;
    await store.save(state);

    // 2ª quest: fecha os 100 XP → nível 2, barra recomeça do zero, +2 pontos.
    const second = play(state, 'Treino', 'HARD', at(11, 10), 2 * MINUTE);
    assert.equal(second.leveledUp, true);
    assert.equal(second.newLevel, 2);
    assert.equal(second.state.character.level, 2);
    assert.equal(second.state.character.xp, 0);
    assert.equal(second.state.character.maxXp, 150);
    assert.equal(second.state.character.attributePoints, 2);
    state = second.state;

    const spent = spendAttributePoint(state, 'intelligence');
    assert.ok(spent);
    state = spent;
    await store.save(state);

    // "Fechar e abrir o app": outro store sobre o mesmo armazenamento.
    const reloaded = await createStateStore(storage).load();
    assert.equal(reloaded.status, 'RESTORED');
    assert.deepEqual(reloaded.state, state);
    assert.equal(reloaded.state.character.attributes.intelligence, 6);
    assert.equal(reloaded.state.character.attributePoints, 1);
    assert.equal(reloaded.state.stats.totalXpEarned, 100);
    assert.equal(reloaded.state.stats.totalQuestsCompleted, 2);
    assert.equal(reloaded.state.stats.streak, 1);
    assert.deepEqual(unlockedAchievementIds(reloaded.state), ['FIRST_XP', 'XP_100']);
  });

  it('uma quest grande pode subir mais de um nível e a barra segue válida', () => {
    let state = startJourney('Ana', 'WARRIOR');
    state = { ...state, character: { ...state.character, xp: 90 } };
    // 90 + 50 = 140 → nível 2 com 40/150.
    const result = play(state, 'Maratona', 'HARD', at(11, 9), 5 * MINUTE);
    assert.equal(result.state.character.level, 2);
    assert.equal(result.state.character.xp, 40);
    const ratio = xpProgressRatio(result.state.character.xp, result.state.character.maxXp);
    assert.ok(ratio > 0 && ratio < 1);
  });
});

describe('anti-farm fim a fim', () => {
  it('concluir antes de 1 minuto marca a quest, não dá XP e não gasta o limite diário', () => {
    const state = startJourney('Lucas', 'MAGE');
    const result = play(state, 'Rápida demais', 'HARD', at(11, 9), 30_000);
    assert.equal(result.xpAwarded, 0);
    assert.equal(result.denyReason, 'TOO_FAST');
    assert.equal(result.state.character.xp, 0);
    assert.equal(result.state.quests[0].completed, true);
    assert.equal(result.state.stats.dailyXpCompletions, 0);
    assert.equal(result.state.stats.totalXpEarned, 0);
    assert.deepEqual(unlockedAchievementIds(result.state), []);
  });

  it('criar e concluir em massa não rende XP', () => {
    let state = startJourney('Lucas', 'MAGE');
    for (let i = 0; i < 20; i += 1) {
      state = play(state, `Spam ${i}`, 'HARD', at(11, 9, i), 1_000).state;
    }
    assert.equal(state.character.level, 1);
    assert.equal(state.character.xp, 0);
    assert.equal(state.stats.totalQuestsCompleted, 20);
  });

  it('a 11ª quest com XP do dia fica sem XP; no dia seguinte libera e o streak sobe', () => {
    let state = startJourney('Lucas', 'MAGE');

    for (let i = 0; i < MAX_XP_QUESTS_PER_DAY; i += 1) {
      const result = play(state, `Quest ${i}`, 'EASY', at(11, 8 + i), 2 * MINUTE);
      assert.equal(result.xpAwarded, 10, `quest ${i} deveria dar XP`);
      state = result.state;
    }
    assert.equal(state.stats.totalXpEarned, 100);
    assert.equal(buildDailyXpSummary(state.stats, localIsoDate(at(11, 20))).limitReached, true);

    const eleventh = play(state, 'Uma a mais', 'HARD', at(11, 20), 2 * MINUTE);
    assert.equal(eleventh.xpAwarded, 0);
    assert.equal(eleventh.denyReason, 'DAILY_LIMIT');
    assert.equal(eleventh.state.stats.totalXpEarned, 100);
    state = eleventh.state;
    assert.equal(state.stats.streak, 1);

    const nextDay = play(state, 'Novo dia', 'EASY', at(12, 8), 2 * MINUTE);
    assert.equal(nextDay.xpAwarded, 10);
    assert.equal(nextDay.state.stats.streak, 2);
    assert.equal(nextDay.state.stats.bestStreak, 2);
    assert.equal(nextDay.state.stats.dailyXpCompletions, 1);
  });

  it('excluir uma quest concluída não devolve nem duplica XP', () => {
    const state = startJourney('Lucas', 'MAGE');
    const done = play(state, 'Treino', 'MEDIUM', at(11, 9), 2 * MINUTE);
    const afterDelete = deleteQuest(done.state, done.state.quests[0].id);
    assert.equal(afterDelete.quests.length, 0);
    assert.equal(afterDelete.character.xp, 25);
    assert.equal(afterDelete.stats.dailyXpCompletions, 1);
    assert.equal(afterDelete.stats.totalXpEarned, 25);
  });

  it('pular um dia reinicia o streak, mas preserva o melhor', () => {
    let state = startJourney('Lucas', 'MAGE');
    state = play(state, 'Dia 1', 'EASY', at(11, 9), 2 * MINUTE).state;
    state = play(state, 'Dia 2', 'EASY', at(12, 9), 2 * MINUTE).state;
    state = play(state, 'Dia 3', 'EASY', at(13, 9), 2 * MINUTE).state;
    assert.equal(state.stats.streak, 3);
    state = play(state, 'Depois da pausa', 'EASY', at(16, 9), 2 * MINUTE).state;
    assert.equal(state.stats.streak, 1);
    assert.equal(state.stats.bestStreak, 3);
    assert.ok(unlockedAchievementIds(state).includes('STREAK_3'));
  });
});

describe('persistência em condições ruins', () => {
  it('sem módulo nativo de armazenamento a sessão é jogável e avisa que não salvou', async () => {
    const store = createStateStore(createSafeStorage(null));
    const loaded = await store.load();
    assert.equal(loaded.status, 'UNAVAILABLE');

    const result = play(startJourney('Lucas', 'MAGE'), 'Estudar', 'MEDIUM', at(11, 9), 2 * MINUTE);
    assert.equal(result.xpAwarded, 25);
    assert.deepEqual(await store.save(result.state), { ok: false });
  });

  it('save antigo (sem campos novos) carrega, joga e regrava no formato atual', async () => {
    const legacy = {
      onboardingDone: true,
      character: {
        name: 'Veterano',
        characterClass: 'ROGUE',
        level: 1,
        xp: 95,
        maxXp: 100,
        attributes: { strength: 2, intelligence: 2, agility: 5, vitality: 2 },
        attributePoints: 0,
      },
      quests: [
        {
          id: 'old-1',
          title: 'Quest antiga',
          category: 'HOME',
          difficulty: 'EASY',
          xp: 10,
          completed: false,
          createdAt: '2026-11-01T12:00:00.000Z',
        },
      ],
      stats: {
        streak: 0,
        lastCompletedDate: null,
        totalXpEarned: 95,
        totalQuestsCompleted: 7,
        dailyXpCompletions: 0,
        dailyXpCompletionsDate: null,
      },
    };
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });
    const store = createStateStore(storage);

    const loaded = await store.load();
    assert.equal(loaded.status, 'RESTORED');
    assert.equal(loaded.state.stats.bestStreak, 0);

    const result = completeQuest(loaded.state, 'old-1', at(11, 9));
    assert.ok(result);
    assert.equal(result.leveledUp, true);
    assert.equal(result.state.character.level, 2);
    assert.equal(result.state.character.xp, 5);

    await store.save(result.state);
    const persisted = JSON.parse((await storage.getItem(STORAGE_KEY)) as string);
    assert.equal(persisted.stats.bestStreak, 1);
    assert.equal(typeof persisted.quests[0].completedAt, 'string');
  });
});
