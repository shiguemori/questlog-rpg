import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comboPartners, comboReady, HERO_SKILLS, startBattle, type BattleActor } from './battle';
import { CLASS_DEFAULTS } from './constants';
import {
  focusClock,
  focusDurationLabel,
  focusEndsAtMs,
  focusProgress,
  focusRemainingMs,
  sanitizeFocus,
  startFocus,
  stopFocus,
} from './focus';
import { QUEST_PRESETS } from './questPresets';
import { addQuest, deleteQuest } from './quests';
import { sanitizeState, startJourney } from './state';
import type { AppState, Category } from './types';

const NOW = new Date('2026-11-14T12:00:00.000Z');

function withQuest(): { state: AppState; questId: string } {
  const result = addQuest(
    startJourney('Ana', 'ROGUE'),
    { title: 'Estudar inglês', difficulty: 'MEDIUM', category: 'STUDY' },
    NOW,
  );
  assert.ok(result.ok);
  return { state: result.state, questId: result.state.quests[0].id };
}

describe('modo foco', () => {
  it('começa numa quest aberta e guarda início e duração', () => {
    const { state, questId } = withQuest();
    const result = startFocus(state, questId, 25, NOW);
    assert.ok(result.ok);
    assert.deepEqual(result.state.focus, {
      questId,
      startedAt: NOW.toISOString(),
      minutes: 25,
    });
  });

  it('recusa quest inexistente, concluída, duração fora da faixa e foco duplo', () => {
    const { state, questId } = withQuest();
    assert.equal(startFocus(state, 'nada', 25, NOW).ok, false);
    const done = {
      ...state,
      quests: state.quests.map((quest) => ({ ...quest, completed: true })),
    };
    assert.equal(startFocus(done, questId, 25, NOW).ok, false);
    const tooShort = startFocus(state, questId, 5, NOW);
    assert.equal(tooShort.ok, false);
    if (!tooShort.ok) assert.match(tooShort.message, /15 min e 4h/);
    assert.equal(startFocus(state, questId, 241, NOW).ok, false);
    assert.equal(startFocus(state, questId, 25.5, NOW).ok, false);
    const running = startFocus(state, questId, 25, NOW);
    assert.ok(running.ok);
    assert.equal(startFocus(running.state, questId, 25, NOW).ok, false);
  });

  it('o relógio vem do início: falta, progresso e fim', () => {
    const focus = { questId: 'q', startedAt: NOW.toISOString(), minutes: 90 };
    const start = NOW.getTime();
    assert.equal(focusEndsAtMs(focus), start + 90 * 60_000);
    assert.equal(focusRemainingMs(focus, start), 90 * 60_000);
    assert.equal(focusRemainingMs(focus, start + 30 * 60_000), 60 * 60_000);
    assert.equal(focusRemainingMs(focus, start + 200 * 60_000), 0);
    assert.equal(focusProgress(focus, start), 0);
    assert.equal(focusProgress(focus, start + 45 * 60_000), 0.5);
    assert.equal(focusProgress(focus, start + 999 * 60_000), 1);
  });

  it('formata o cronômetro e a duração', () => {
    assert.equal(focusClock(25 * 60_000), '25:00');
    assert.equal(focusClock(61_000), '1:01');
    assert.equal(focusClock(500), '0:01');
    assert.equal(focusClock(0), '0:00');
    assert.equal(focusClock(3_909_000), '1:05:09');
    assert.equal(focusDurationLabel(25), '25 min');
    assert.equal(focusDurationLabel(60), '1h');
    assert.equal(focusDurationLabel(90), '1h30');
  });

  it('parar e excluir a quest encerram o foco; a quest continua como estava', () => {
    const { state, questId } = withQuest();
    const running = startFocus(state, questId, 25, NOW);
    assert.ok(running.ok);
    const stopped = stopFocus(running.state);
    assert.equal(stopped.focus, null);
    assert.equal(stopped.quests[0].completed, false);
    assert.equal(stopFocus(stopped), stopped);
    assert.equal(deleteQuest(running.state, questId).focus, null);
  });

  it('save: foco válido volta; quebrado, antigo ou de quest fechada cai', () => {
    const open = new Set(['q1']);
    const valid = { questId: 'q1', startedAt: NOW.toISOString(), minutes: 45 };
    assert.deepEqual(sanitizeFocus(valid, open), valid);
    assert.equal(sanitizeFocus(undefined, open), null);
    assert.equal(sanitizeFocus({ ...valid, questId: 'q2' }, open), null);
    assert.equal(sanitizeFocus({ ...valid, startedAt: 'ontem' }, open), null);
    assert.equal(sanitizeFocus({ ...valid, minutes: 3 }, open), null);

    const { state, questId } = withQuest();
    const running = startFocus(state, questId, 45, NOW);
    assert.ok(running.ok);
    const raw = JSON.parse(JSON.stringify(running.state));
    assert.deepEqual(sanitizeState(raw)?.focus, running.state.focus);
    delete raw.focus;
    assert.equal(sanitizeState(raw)?.focus, null);
    assert.equal(sanitizeState(raw)?.settings.challengesCollapsed, false);
  });
});

describe('combos da batalha', () => {
  const skill = (id: string) => {
    const found = Object.values(HERO_SKILLS)
      .flat()
      .find((entry) => entry.id === id);
    assert.ok(found, id);
    return found;
  };
  const names = (list: readonly { name: string }[]) => list.map((entry) => entry.name).sort();

  it('Lembrete Chato e Pegadinha combinam nos dois sentidos', () => {
    const rogue = HERO_SKILLS.ROGUE;
    assert.deepEqual(names(comboPartners(rogue, skill('rogue.venom'))), ['Pegadinha']);
    assert.deepEqual(names(comboPartners(rogue, skill('rogue.backstab'))), ['Lembrete Chato']);
    assert.deepEqual(comboPartners(rogue, skill('rogue.smoke')), []);
  });

  it('Café Fervendo e Lista Riscada combinam no mago', () => {
    const mage = HERO_SKILLS.MAGE;
    assert.deepEqual(names(comboPartners(mage, skill('mage.fireball'))), ['Lista Riscada']);
    assert.deepEqual(names(comboPartners(mage, skill('mage.meteor'))), ['Café Fervendo']);
  });

  it('o combo fica pronto quando o monstro está com o status que o bônus pede', () => {
    const battle = startBattle({
      character: {
        name: 'Ana',
        characterClass: 'ROGUE',
        level: 3,
        xp: 0,
        maxXp: 100,
        attributes: { ...CLASS_DEFAULTS.ROGUE.attributes },
        attributePoints: 0,
      },
      category: 'WORK',
      difficulty: 'MEDIUM',
      heroName: 'Ana',
      seed: 7,
    });
    const backstab = skill('rogue.backstab');
    assert.equal(comboReady(battle.enemy, backstab), false);
    const poisoned: BattleActor = {
      ...battle.enemy,
      statuses: [{ id: 'POISON', turns: 2, potency: 3, stacks: 1 }],
    };
    assert.equal(comboReady(poisoned, backstab), true);
    assert.equal(comboReady(poisoned, skill('rogue.stab')), false);
  });
});

describe('atividades rápidas', () => {
  it('têm pelo menos duas por categoria, sem título repetido', () => {
    const byCategory = new Map<Category, number>();
    for (const preset of QUEST_PRESETS) {
      byCategory.set(preset.category, (byCategory.get(preset.category) ?? 0) + 1);
    }
    for (const category of ['STUDY', 'WORK', 'HEALTH', 'HOME', 'OTHER'] as const) {
      assert.ok((byCategory.get(category) ?? 0) >= 2, category);
    }
    assert.equal(new Set(QUEST_PRESETS.map((preset) => preset.title)).size, QUEST_PRESETS.length);
  });
});
