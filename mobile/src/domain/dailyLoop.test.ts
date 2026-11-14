import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  challengeText,
  ensureDailyChallenges,
  generateChallenges,
  progressChallenges,
  sanitizeDailyChallenges,
} from './challenges';
import { completeQuest } from './completeQuest';
import { addQuest, reopenDueRecurring, setQuestRepeat } from './quests';
import {
  isDueAgain,
  liveQuestStreak,
  nextQuestStreak,
  nextRepeatRule,
  previousSlot,
} from './schedule';
import { sanitizeState, startJourney } from './state';
import type { AppState, Quest } from './types';
import { noteWeek, recapWeekFor, sanitizeWeeks, weekRangeLabel } from './weekly';

/** 2026-11-13 é sexta-feira. */
const FRIDAY = '2026-11-13';
const at = (iso: string, hour = 12) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00`);

function quest(partial: Partial<Quest>): Quest {
  return {
    id: 'q1',
    title: 'Ler',
    category: 'STUDY',
    difficulty: 'EASY',
    xp: 10,
    completed: false,
    createdAt: at('2026-11-01').toISOString(),
    recurring: true,
    ...partial,
  };
}

describe('agenda das missões que repetem', () => {
  it('todo dia reabre no dia seguinte; seg a sex pula o fim de semana', () => {
    assert.equal(isDueAgain('DAILY', FRIDAY, '2026-11-14'), true);
    assert.equal(isDueAgain('WEEKDAYS', FRIDAY, '2026-11-14'), false, 'sábado');
    assert.equal(isDueAgain('WEEKDAYS', FRIDAY, '2026-11-16'), true, 'segunda');
    assert.equal(isDueAgain('DAILY', FRIDAY, FRIDAY), false);
  });

  it('semanal só reabre na semana seguinte', () => {
    assert.equal(isDueAgain('WEEKLY', '2026-11-10', FRIDAY), false);
    assert.equal(isDueAgain('WEEKLY', FRIDAY, '2026-11-16'), true);
  });

  it('vez anterior: ontem, a sexta antes da segunda, a semana passada', () => {
    assert.equal(previousSlot('DAILY', FRIDAY), '2026-11-12');
    assert.equal(previousSlot('WEEKDAYS', '2026-11-16'), FRIDAY);
    assert.equal(previousSlot('WEEKLY', FRIDAY), '2026-11-02');
  });

  it('sequência soma na vez certa e zera se pulou', () => {
    assert.equal(nextQuestStreak(quest({ repeat: 'DAILY' }), FRIDAY), 1);
    const yesterday = quest({ repeat: 'DAILY', streak: 4, lastDoneOn: '2026-11-12' });
    assert.equal(nextQuestStreak(yesterday, FRIDAY), 5);
    const skipped = quest({ repeat: 'DAILY', streak: 4, lastDoneOn: '2026-11-10' });
    assert.equal(nextQuestStreak(skipped, FRIDAY), 1);
    const weekday = quest({ repeat: 'WEEKDAYS', streak: 3, lastDoneOn: FRIDAY });
    assert.equal(nextQuestStreak(weekday, '2026-11-16'), 4, 'sexta → segunda continua');
    assert.equal(nextQuestStreak(quest({ repeat: undefined }), FRIDAY), undefined);
  });

  it('sequência na tela some quando a vez passou sem conclusão', () => {
    const done = quest({ repeat: 'DAILY', streak: 6, lastDoneOn: '2026-11-12' });
    assert.equal(liveQuestStreak(done, at(FRIDAY)), 6);
    assert.equal(liveQuestStreak(done, at('2026-11-14')), 0);
  });

  it('o botão da linha passa por todas as regras e volta a "não repete"', () => {
    assert.equal(nextRepeatRule(undefined), 'DAILY');
    assert.equal(nextRepeatRule('DAILY'), 'WEEKDAYS');
    assert.equal(nextRepeatRule('WEEKDAYS'), 'WEEKLY');
    assert.equal(nextRepeatRule('WEEKLY'), undefined);
  });

  it('reabre conforme a regra e guarda a sequência ao concluir', () => {
    let state: AppState = startJourney('Ana', 'MAGE');
    const added = addQuest(
      state,
      { title: 'Ler', category: 'STUDY', difficulty: 'EASY', repeat: 'WEEKDAYS' },
      at('2026-11-12', 8),
    );
    assert.ok(added.ok);
    state = added.state;
    const id = added.quest.id;
    const done = completeQuest(state, id, at(FRIDAY));
    assert.ok(done);
    assert.equal(done.state.quests[0].streak, 1);
    assert.equal(done.state.quests[0].lastDoneOn, FRIDAY);
    assert.equal(reopenDueRecurring(done.state, at('2026-11-14')).quests[0].completed, true);
    const monday = reopenDueRecurring(done.state, at('2026-11-16'));
    assert.equal(monday.quests[0].completed, false);
    const cleared = setQuestRepeat(monday, id, undefined);
    assert.equal(cleared.quests[0].recurring, false);
    assert.equal(cleared.quests[0].streak, undefined);
  });

  it('save antigo com recurring vira "todo dia"', () => {
    const state = sanitizeState({ quests: [{ id: 'a', title: 'Correr', recurring: true }] });
    assert.equal(state?.quests[0].repeat, 'DAILY');
  });
});

describe('desafios do dia', () => {
  it('a mesma data dá os mesmos desafios; um de missão e dois de batalha distintos', () => {
    const a = generateChallenges(FRIDAY, { HEALTH: 2 });
    assert.deepEqual(a, generateChallenges(FRIDAY, { HEALTH: 2 }));
    assert.equal(a.length, 3);
    assert.equal(a[0].kind, 'COMPLETE_CATEGORY');
    assert.equal(a[0].category, 'HEALTH');
    assert.notEqual(a[1].kind, a[2].kind);
    assert.ok(a.slice(1).every((entry) => entry.kind.startsWith('WIN_')));
    assert.equal(generateChallenges(FRIDAY, {})[0].kind, 'COMPLETE_ANY');
    assert.match(challengeText(a[0]), /Saúde/);
  });

  it('cada desafio dá poção; os três juntos dão fragmentos', () => {
    let state = ensureDailyChallenges(startJourney('Ana', 'WARRIOR'), at(FRIDAY));
    state = {
      ...state,
      dailyChallenges: {
        ...state.dailyChallenges,
        list: [
          { id: 'x0', kind: 'COMPLETE_ANY', target: 1, progress: 0, reward: 'potion.water' },
          { id: 'x1', kind: 'WIN_NO_POTION', target: 1, progress: 0, reward: 'potion.coffee' },
          { id: 'x2', kind: 'WIN_FAST', target: 1, progress: 0, reward: 'potion.coffee' },
        ],
      },
    };
    const quest = progressChallenges(state, { type: 'QUEST', category: 'STUDY' }, at(FRIDAY));
    assert.equal(quest.finished.length, 1);
    assert.equal(quest.state.inventory.potions['potion.water'], 2);
    const battle = progressChallenges(
      quest.state,
      {
        type: 'BATTLE',
        won: true,
        difficulty: 'EASY',
        boss: false,
        potionsUsed: 0,
        turns: 3,
        hpPct: 0.9,
      },
      at(FRIDAY),
    );
    assert.equal(battle.finished.length, 2);
    assert.deepEqual(battle.bonus, { type: 'FRAGMENTS', amount: 5 });
    assert.equal(battle.state.inventory.fragments, 5);
    const again = progressChallenges(
      battle.state,
      { type: 'QUEST', category: 'STUDY' },
      at(FRIDAY),
    );
    assert.equal(again.bonus, null, 'bônus só uma vez');
  });

  it('derrota não conta; o dia novo sorteia desafios novos', () => {
    const state = ensureDailyChallenges(startJourney('Ana', 'WARRIOR'), at(FRIDAY));
    const lost = progressChallenges(
      state,
      {
        type: 'BATTLE',
        won: false,
        difficulty: 'HARD',
        boss: false,
        potionsUsed: 0,
        turns: 2,
        hpPct: 0,
      },
      at(FRIDAY),
    );
    assert.equal(lost.finished.length, 0);
    const tomorrow = ensureDailyChallenges(lost.state, at('2026-11-14'));
    assert.equal(tomorrow.dailyChallenges.date, '2026-11-14');
  });

  it('só conclusão com XP conta', () => {
    let state: AppState = startJourney('Ana', 'WARRIOR');
    const added = addQuest(
      state,
      { title: 'Ler', category: 'STUDY', difficulty: 'EASY' },
      at(FRIDAY, 11),
    );
    assert.ok(added.ok);
    state = ensureDailyChallenges(added.state, at(FRIDAY, 11));
    const early = completeQuest(state, added.quest.id, new Date(at(FRIDAY, 11).getTime() + 5_000));
    assert.ok(early);
    assert.equal(early.xpAwarded, 0);
    assert.equal(early.challengesFinished.length, 0);
  });

  it('sanitize descarta lixo', () => {
    assert.equal(sanitizeDailyChallenges({ date: 'ontem' }).date, null);
    const clean = sanitizeDailyChallenges({
      date: FRIDAY,
      list: [{ id: 'a', kind: 'COMPLETE_ANY', target: 50, progress: -2, reward: 'ouro' }],
    });
    assert.equal(clean.list[0].target, 3);
    assert.equal(clean.list[0].progress, 0);
    assert.equal(clean.list[0].reward, 'potion.water');
  });
});

describe('resumo da semana', () => {
  it('anota por categoria e aparece no domingo e na segunda, até ser visto', () => {
    let state: AppState = startJourney('Ana', 'ROGUE');
    state = noteWeek(state, at(FRIDAY), { quest: { category: 'HEALTH', streak: 4 } });
    state = noteWeek(state, at(FRIDAY), { battle: { won: true }, items: 1 });
    state = noteWeek(state, at('2026-11-14'), { boss: { id: 'couch', won: false } });
    state = noteWeek(state, at('2026-11-14'), { boss: { id: 'couch', won: true } });
    const week = state.weeks[0];
    assert.equal(week.weekKey, '2026-11-09');
    assert.equal(week.byCategory.HEALTH, 1);
    assert.equal(week.bestStreak, 4);
    assert.equal(week.boss?.result, 'BEATEN', 'vitória depois de derrota fica');
    assert.equal(recapWeekFor(state, FRIDAY), null);
    assert.equal(recapWeekFor(state, '2026-11-15')?.weekKey, '2026-11-09');
    assert.equal(recapWeekFor(state, '2026-11-16')?.weekKey, '2026-11-09');
    assert.equal(recapWeekFor(state, '2026-11-18'), null, 'quarta já não mostra');
    const seen = { ...state, settings: { ...state.settings, dismissedRecapWeek: '2026-11-09' } };
    assert.equal(recapWeekFor(seen, '2026-11-15'), null);
  });

  it('período em texto e sanitize', () => {
    assert.equal(weekRangeLabel('2026-11-09'), '9 a 15 de nov');
    assert.equal(weekRangeLabel('2026-11-30'), '30 de nov a 6 de dez');
    const weeks = sanitizeWeeks([
      { weekKey: '2026-11-09', byCategory: { STUDY: -1, WORK: 3 } },
      { weekKey: 'x' },
    ]);
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0].byCategory.STUDY, 0);
    assert.equal(weeks[0].byCategory.WORK, 3);
  });
});
