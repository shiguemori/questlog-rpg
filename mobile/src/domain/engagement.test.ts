import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shiftIsoDate, weekdayIndex } from './dates';
import {
  backfillCompletionDays,
  buildDailyGoal,
  buildHabitCue,
  buildWeekPace,
  buildWeekStrip,
  celebrationLine,
  COMPLETION_DAY_CAP,
  DAILY_GOAL_TARGET,
  latestQuestDraft,
  nextCompletionDays,
  streakMilestoneCrossed,
  streakTitle,
  sundayReview,
} from './engagement';
import type { Quest, UserStats } from './types';

function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
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
    ...overrides,
  };
}

describe('meta diária', () => {
  it('começa em 0/1 e fecha com uma conclusão', () => {
    const open = buildDailyGoal(stats(), '2026-11-11');
    assert.equal(open.done, 0);
    assert.equal(open.target, DAILY_GOAL_TARGET);
    assert.equal(open.met, false);

    const done = buildDailyGoal(
      stats({ dailyCompletions: 1, dailyCompletionsDate: '2026-11-11' }),
      '2026-11-11',
    );
    assert.equal(done.met, true);
    assert.equal(done.done, 1);
  });

  it('zera a meta quando o dia vira, sem mexer no limite de XP', () => {
    const goal = buildDailyGoal(
      stats({
        dailyCompletions: 4,
        dailyCompletionsDate: '2026-11-10',
        dailyXpCompletions: 10,
        dailyXpCompletionsDate: '2026-11-10',
      }),
      '2026-11-11',
    );
    assert.equal(goal.met, false);
    assert.equal(goal.done, 0);
  });

  it('save antigo com conclusão hoje já conta a meta', () => {
    const goal = buildDailyGoal(
      stats({ lastCompletedDate: '2026-11-11', totalQuestsCompleted: 2 }),
      '2026-11-11',
    );
    assert.equal(goal.met, true);
  });
});

describe('ritual de retorno', () => {
  it('pede a primeira quest sem pressão', () => {
    assert.equal(buildHabitCue(stats(), '2026-11-11').kind, 'FIRST_STEP');
  });

  it('lembra o streak vivo de ontem', () => {
    const cue = buildHabitCue(
      stats({ streak: 4, lastCompletedDate: '2026-11-10' }),
      '2026-11-11',
    );
    assert.equal(cue.kind, 'STREAK_WAITING');
    assert.match(cue.message, /4 dias/);
  });

  it('recomeça sem culpa depois de um buraco', () => {
    const cue = buildHabitCue(
      stats({ streak: 5, lastCompletedDate: '2026-11-01' }),
      '2026-11-11',
    );
    assert.equal(cue.kind, 'FRESH_START');
    assert.match(cue.message, /Recomeço leve/);
  });

  it('depois da vitória de hoje aponta para amanhã', () => {
    const cue = buildHabitCue(
      stats({ dailyCompletions: 1, dailyCompletionsDate: '2026-11-11', lastCompletedDate: '2026-11-11' }),
      '2026-11-11',
    );
    assert.equal(cue.kind, 'DONE_TODAY');
    assert.match(cue.message, /Amanhã/);
  });
});

describe('streak', () => {
  it('dá título sem dar XP', () => {
    assert.equal(streakTitle(0), null);
    assert.equal(streakTitle(1), 'Faísca');
    assert.equal(streakTitle(3), 'Chama');
    assert.equal(streakTitle(7), 'Semana');
    assert.equal(streakTitle(100), 'Lenda do hábito');
  });

  it('celebra o marco uma vez e ignora o mesmo dia', () => {
    assert.equal(streakMilestoneCrossed(2, 3)?.days, 3);
    assert.equal(streakMilestoneCrossed(3, 3), null);
    assert.equal(streakMilestoneCrossed(1, 1), null);
    assert.equal(streakMilestoneCrossed(0, 1), null);
    assert.equal(streakMilestoneCrossed(6, 14)?.days, 14);
  });

  it('a linha da cena prioriza o marco e some quando não há o que dizer', () => {
    const milestone = streakMilestoneCrossed(2, 3);
    assert.match(celebrationLine({ dailyGoalJustMet: true, milestone }) ?? '', /Três dias/);
    assert.match(
      celebrationLine({ dailyGoalJustMet: true, milestone: null }) ?? '',
      /Meta do dia/,
    );
    assert.equal(celebrationLine({ dailyGoalJustMet: false, milestone: null }), null);
  });
});

describe('semana', () => {
  it('mostra 7 dias terminando hoje', () => {
    const cells = buildWeekStrip(['2026-11-11', '2026-11-09'], '2026-11-11');
    assert.equal(cells.length, 7);
    assert.equal(cells[6].isToday, true);
    assert.equal(cells[6].done, true);
    assert.equal(cells[4].iso, '2026-11-09');
    assert.equal(cells[4].done, true);
    assert.equal(cells[0].done, false);
  });

  it('compara com a semana anterior sem tom de cobrança', () => {
    const ahead = buildWeekPace(['2026-11-11', '2026-11-10', '2026-11-04'], '2026-11-11');
    assert.equal(ahead.thisWeek, 2);
    assert.equal(ahead.lastWeek, 1);
    assert.match(ahead.message, /Esta semana: 2/);

    const behind = buildWeekPace(
      ['2026-11-11', '2026-11-04', '2026-11-03', '2026-11-02'],
      '2026-11-11',
    );
    assert.match(behind.message, /Sem pressa/);
    assert.match(buildWeekPace([], '2026-11-11').message, /começa com a quest de hoje/);
  });

  it('só fecha a semana no domingo', () => {
    let sunday = '2026-11-11';
    for (let i = 0; i < 7; i += 1) {
      const candidate = shiftIsoDate('2026-11-11', i);
      if (candidate && weekdayIndex(candidate) === 0) sunday = candidate;
    }
    assert.equal(weekdayIndex(sunday), 0);
    assert.match(sundayReview([sunday], sunday) ?? '', /Fechamento/);
    assert.equal(sundayReview(['2026-11-11'], '2026-11-11'), null);
  });

  it('guarda no máximo 120 dias e preenche o streak antigo', () => {
    const many = Array.from({ length: 130 }, (_, index) => {
      const day = shiftIsoDate('2026-11-11', -index);
      if (!day) throw new Error('data');
      return day;
    });
    const capped = nextCompletionDays(many, '2026-11-11');
    assert.equal(capped.length, COMPLETION_DAY_CAP);
    assert.equal(capped.at(-1), '2026-11-11');
    assert.deepEqual(backfillCompletionDays('2026-11-10', 3), [
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ]);
    assert.deepEqual(backfillCompletionDays(null, 4), []);
  });
});

describe('repetir a última quest', () => {
  it('escolhe a criada por último', () => {
    const older: Quest = {
      id: 'a',
      title: 'Antiga',
      category: 'HOME',
      difficulty: 'EASY',
      xp: 10,
      completed: true,
      createdAt: '2026-11-10T10:00:00.000Z',
    };
    const newer: Quest = {
      id: 'b',
      title: 'Beber água',
      category: 'HEALTH',
      difficulty: 'EASY',
      xp: 10,
      completed: false,
      createdAt: '2026-11-11T10:00:00.000Z',
    };
    assert.equal(latestQuestDraft([older, newer])?.title, 'Beber água');
    assert.equal(latestQuestDraft([]), null);
  });
});
