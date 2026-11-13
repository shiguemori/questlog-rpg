import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEnemyMove,
  ENEMY_TRAITS,
  enemyTraitOf,
  startBattle,
  type BattleEvent,
  type BattleState,
} from './battle';
import { CLASS_DEFAULTS } from './constants';
import type { Category } from './types';

function begin(category: Category): BattleState {
  return startBattle({
    character: {
      name: 'Ana',
      characterClass: 'WARRIOR',
      level: 1,
      xp: 0,
      maxXp: 100,
      attributes: { ...CLASS_DEFAULTS.WARRIOR.attributes },
      attributePoints: 0,
    },
    category,
    difficulty: 'EASY',
    heroName: 'Ana',
    seed: 7,
  });
}

/** Turno do monstro direto, com o herói cheio de vida para não cair no meio. */
function enemyTurn(state: BattleState, previous: readonly BattleEvent[] = []): BattleState {
  return applyEnemyMove({
    ...state,
    phase: 'ENEMY_TURN',
    events: previous,
    hero: { ...state.hero, hp: 999, maxHp: 999 },
  });
}

const playerHit: BattleEvent = {
  seq: 1,
  kind: 'DAMAGE',
  target: 'ENEMY',
  source: 'PLAYER',
  amount: 3,
};

function traitFired(state: BattleState): boolean {
  return state.events.some((event) => event.kind === 'TRAIT');
}

describe('jeito próprio de cada monstro', () => {
  it('todo monstro nasce com o traço da categoria', () => {
    for (const category of Object.keys(ENEMY_TRAITS) as Category[]) {
      const state = begin(category);
      assert.equal(state.enemy.trait, ENEMY_TRAITS[category].id);
      assert.equal(enemyTraitOf(state.enemy)?.name, ENEMY_TRAITS[category].name);
    }
    assert.equal(enemyTraitOf(begin('STUDY').hero), null);
  });

  it('Distração: abre mais abas na metade da vida, uma vez só', () => {
    const start = begin('STUDY');
    assert.equal(traitFired(enemyTurn(start)), false);
    const hurt = { ...start, enemy: { ...start.enemy, hp: Math.floor(start.enemy.maxHp / 2) } };
    const after = enemyTurn(hurt);
    assert.ok(traitFired(after));
    assert.ok(after.enemy.statuses.some((effect) => effect.id === 'EMPOWER'));
    assert.equal(after.enemy.traitUsed, true);
    assert.equal(traitFired(enemyTurn(after)), false);
  });

  it('Trabalho: acumula +10% de dano por turno, até +40%', () => {
    let state = begin('WORK');
    const bonuses: number[] = [];
    for (let turn = 0; turn < 5; turn += 1) {
      state = enemyTurn(state);
      bonuses.push(state.enemy.damageBonus);
    }
    assert.deepEqual(bonuses, [10, 20, 30, 40, 40]);
  });

  it('Preguiça: se cura quando o herói não causa dano', () => {
    const start = begin('HEALTH');
    const hurt = { ...start, enemy: { ...start.enemy, hp: start.enemy.hp - 10 } };
    const idle = enemyTurn(hurt);
    assert.ok(traitFired(idle));
    assert.ok(idle.enemy.hp > hurt.enemy.hp);
    const hit = enemyTurn(hurt, [playerHit]);
    assert.equal(traitFired(hit), false);
  });

  it('Casa: a pilha ganha escudo a cada 3 turnos', () => {
    let state = begin('HOME');
    const shields: number[] = [];
    for (let turn = 0; turn < 3; turn += 1) {
      state = enemyTurn(state);
      shields.push(state.enemy.shield);
    }
    assert.equal(shields[0], 0);
    assert.equal(shields[1], 0);
    assert.equal(shields[2], Math.round(state.enemy.maxHp * 0.12));
  });

  it('Fantasma: some de vista na metade da vida e esquiva o próximo golpe', () => {
    const start = begin('OTHER');
    const hurt = { ...start, enemy: { ...start.enemy, hp: Math.floor(start.enemy.maxHp / 2) } };
    const after = enemyTurn(hurt);
    assert.ok(traitFired(after));
    assert.ok(after.enemy.statuses.some((effect) => effect.id === 'EVADE'));
    assert.equal(traitFired(enemyTurn(after)), false);
  });
});
