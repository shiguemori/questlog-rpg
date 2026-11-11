import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addQuest,
  clearCompletedQuests,
  deleteQuest,
  MAX_OPEN_QUESTS,
  QUEST_TITLE_MAX_LENGTH,
  splitQuests,
  validateQuestTitle,
} from './quests';
import { startJourney } from './state';
import type { AppState, Quest } from './types';

const NOW = new Date('2026-11-11T10:00:00.000Z');

function heroState(): AppState {
  return startJourney('Lucas', 'MAGE');
}

function quest(overrides: Partial<Quest>): Quest {
  return {
    id: 'q',
    title: 'Quest',
    category: 'OTHER',
    difficulty: 'EASY',
    xp: 10,
    completed: false,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('validateQuestTitle', () => {
  it('aceita e normaliza espaços', () => {
    assert.deepEqual(validateQuestTitle('  Beber   2L de água '), {
      ok: true,
      title: 'Beber 2L de água',
    });
  });

  it('rejeita vazio, curto e longo com mensagem em português', () => {
    const empty = validateQuestTitle('   ');
    assert.equal(empty.ok, false);
    assert.equal(!empty.ok && empty.error, 'EMPTY');
    assert.equal(!empty.ok && empty.message, 'Dê um nome para a quest.');

    const short = validateQuestTitle('a');
    assert.equal(!short.ok && short.error, 'TOO_SHORT');

    const long = validateQuestTitle('x'.repeat(QUEST_TITLE_MAX_LENGTH + 1));
    assert.equal(!long.ok && long.error, 'TOO_LONG');
  });

  it('aceita exatamente o tamanho máximo', () => {
    assert.equal(validateQuestTitle('x'.repeat(QUEST_TITLE_MAX_LENGTH)).ok, true);
  });
});

describe('addQuest', () => {
  it('registra no topo com XP da tabela e data de criação', () => {
    const first = addQuest(
      heroState(),
      { title: 'Treino', difficulty: 'HARD', category: 'HEALTH' },
      NOW,
      () => 'aaa',
    );
    assert.ok(first.ok);
    const second = addQuest(
      first.state,
      { title: 'Água', difficulty: 'EASY', category: 'HEALTH' },
      NOW,
      () => 'bbb',
    );
    assert.ok(second.ok);
    assert.equal(second.state.quests.length, 2);
    assert.equal(second.state.quests[0].title, 'Água');
    assert.equal(second.quest.xp, 10);
    assert.equal(first.quest.xp, 50);
    assert.equal(first.quest.completed, false);
    assert.equal(first.quest.createdAt, NOW.toISOString());
  });

  it('não altera o estado quando o título é inválido', () => {
    const state = heroState();
    const result = addQuest(state, { title: ' ', difficulty: 'EASY', category: 'OTHER' }, NOW);
    assert.equal(result.ok, false);
    assert.equal(state.quests.length, 0);
  });

  it('gera ids únicos mesmo no mesmo milissegundo e com sufixo repetido', () => {
    let state = heroState();
    for (let i = 0; i < 3; i += 1) {
      const result = addQuest(
        state,
        { title: `Quest ${i}`, difficulty: 'EASY', category: 'OTHER' },
        NOW,
        () => 'same',
      );
      assert.ok(result.ok);
      state = result.state;
    }
    assert.equal(new Set(state.quests.map((q) => q.id)).size, 3);
  });

  it('bloqueia acima do teto de quests abertas', () => {
    const state: AppState = {
      ...heroState(),
      quests: Array.from({ length: MAX_OPEN_QUESTS }, (_, i) => quest({ id: `q${i}` })),
    };
    const result = addQuest(state, { title: 'Mais uma', difficulty: 'EASY', category: 'OTHER' });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, 'TOO_MANY_OPEN');
  });

  it('quests concluídas não contam para o teto', () => {
    const state: AppState = {
      ...heroState(),
      quests: Array.from({ length: MAX_OPEN_QUESTS }, (_, i) =>
        quest({ id: `q${i}`, completed: true }),
      ),
    };
    assert.equal(
      addQuest(state, { title: 'Nova', difficulty: 'EASY', category: 'OTHER' }).ok,
      true,
    );
  });
});

describe('deleteQuest / clearCompletedQuests', () => {
  const base: AppState = {
    ...heroState(),
    quests: [
      quest({ id: 'open' }),
      quest({ id: 'done', completed: true, completedAt: '2026-11-11T10:05:00.000Z' }),
    ],
    stats: { ...heroState().stats, totalXpEarned: 10, totalQuestsCompleted: 1, streak: 1 },
  };

  it('exclui a quest sem mexer em XP, streak ou totais', () => {
    const next = deleteQuest(base, 'done');
    assert.deepEqual(
      next.quests.map((q) => q.id),
      ['open'],
    );
    assert.deepEqual(next.stats, base.stats);
    assert.deepEqual(next.character, base.character);
  });

  it('devolve o mesmo estado para id inexistente', () => {
    assert.equal(deleteQuest(base, 'nope'), base);
  });

  it('limpa só as concluídas', () => {
    const next = clearCompletedQuests(base);
    assert.deepEqual(
      next.quests.map((q) => q.id),
      ['open'],
    );
    assert.deepEqual(next.stats, base.stats);
    assert.equal(clearCompletedQuests(next), next);
  });
});

describe('splitQuests', () => {
  const quests: Quest[] = [
    quest({ id: 'a', category: 'STUDY' }),
    quest({ id: 'b', category: 'HEALTH', completed: true, completedAt: '2026-11-11T09:00:00.000Z' }),
    quest({ id: 'c', category: 'STUDY', completed: true, completedAt: '2026-11-11T11:00:00.000Z' }),
    quest({ id: 'd', category: 'HEALTH' }),
  ];

  it('separa abertas e concluídas (mais recente primeiro)', () => {
    const { open, done } = splitQuests(quests, 'ALL');
    assert.deepEqual(
      open.map((q) => q.id),
      ['a', 'd'],
    );
    assert.deepEqual(
      done.map((q) => q.id),
      ['c', 'b'],
    );
  });

  it('filtra por categoria', () => {
    const { open, done } = splitQuests(quests, 'HEALTH');
    assert.deepEqual(
      open.map((q) => q.id),
      ['d'],
    );
    assert.deepEqual(
      done.map((q) => q.id),
      ['b'],
    );
  });
});
