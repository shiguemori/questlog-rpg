import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEnemyMove,
  applyPlayerMove,
  battleDamage,
  chooseEnemyMove,
  ENEMY_MOVES,
  ENEMY_SCALE,
  HERO_MOVES,
  MAX_BATTLE_TURNS,
  startBattle,
  type BattleState,
} from './battle';
import { CLASS_DEFAULTS } from './constants';
import type { Character, CharacterClass, Difficulty } from './types';
import { VILLAIN_BY_CATEGORY } from './victory';

function hero(
  characterClass: CharacterClass,
  attributes = CLASS_DEFAULTS[characterClass].attributes,
): Character {
  return {
    name: 'Ana',
    characterClass,
    level: 1,
    xp: 0,
    maxXp: 100,
    attributes: { ...attributes },
    attributePoints: 0,
  };
}

function begin(
  characterClass: CharacterClass = 'WARRIOR',
  difficulty: Difficulty = 'EASY',
  category: 'HEALTH' | 'STUDY' = 'HEALTH',
): BattleState {
  return startBattle({
    character: hero(characterClass),
    category,
    difficulty,
    heroName: 'Ana',
  });
}

function fight(state: BattleState, moveId: string): BattleState {
  let current = state;
  for (
    let step = 0;
    step < 20 && (current.phase === 'PLAYER_TURN' || current.phase === 'ENEMY_TURN');
    step += 1
  ) {
    current =
      current.phase === 'PLAYER_TURN' ? applyPlayerMove(current, moveId) : applyEnemyMove(current);
  }
  return current;
}

describe('catálogo de golpes', () => {
  it('cada classe e cada categoria tem 4 golpes com ids únicos', () => {
    for (const moves of Object.values(HERO_MOVES)) {
      assert.equal(moves.length, 4);
      assert.equal(new Set(moves.map((entry) => entry.id)).size, 4);
    }
    for (const moves of Object.values(ENEMY_MOVES)) {
      assert.equal(moves.length, 4);
      assert.equal(new Set(moves.map((entry) => entry.id)).size, 4);
    }
  });

  it('fixa o nome, o efeito e o poder de cada golpe', () => {
    assert.deepEqual(
      HERO_MOVES.WARRIOR.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Corte', 'DAMAGE', 8],
        ['Postura', 'GUARD', 50],
        ['Investida', 'DAMAGE', 14],
        ['Fôlego', 'HEAL', 10],
      ],
    );
    assert.deepEqual(
      HERO_MOVES.MAGE.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Faísca', 'DAMAGE', 7],
        ['Barreira', 'GUARD', 55],
        ['Rajada', 'DAMAGE', 15],
        ['Cura', 'HEAL', 9],
      ],
    );
    assert.deepEqual(
      HERO_MOVES.ROGUE.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Punhalada', 'DAMAGE', 9],
        ['Esquiva', 'GUARD', 45],
        ['Golpe baixo', 'DAMAGE', 13],
        ['Trago', 'HEAL', 7],
      ],
    );
    assert.deepEqual(
      ENEMY_MOVES.STUDY.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Notificação', 'DAMAGE', 6],
        ['Aba nova', 'DAMAGE', 10],
        ['Rolagem', 'GUARD', 30],
        ['Cochilo', 'HEAL', 6],
      ],
    );
    assert.deepEqual(
      ENEMY_MOVES.WORK.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Urgência', 'DAMAGE', 7],
        ['Reunião', 'DAMAGE', 11],
        ['Protocolo', 'GUARD', 35],
        ['Café', 'HEAL', 6],
      ],
    );
    assert.deepEqual(
      ENEMY_MOVES.HEALTH.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Adiar', 'DAMAGE', 5],
        ['Sofá', 'DAMAGE', 10],
        ['Desculpa', 'GUARD', 40],
        ['Soneca', 'HEAL', 8],
      ],
    );
    assert.deepEqual(
      ENEMY_MOVES.HOME.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Pilha', 'DAMAGE', 6],
        ['Entulho', 'DAMAGE', 11],
        ['Empurrar', 'GUARD', 30],
        ['Recolher', 'HEAL', 5],
      ],
    );
    assert.deepEqual(
      ENEMY_MOVES.OTHER.map((entry) => [entry.name, entry.effect, entry.power]),
      [
        ['Sussurro', 'DAMAGE', 6],
        ['Garra', 'DAMAGE', 11],
        ['Névoa', 'GUARD', 35],
        ['Reforma', 'HEAL', 6],
      ],
    );
  });
});

describe('startBattle', () => {
  it('monta herói e monstro com HP, asset e o vilão da categoria', () => {
    const battle = begin();
    assert.equal(battle.phase, 'PLAYER_TURN');
    assert.equal(battle.turn, 0);
    assert.equal(battle.hero.name, 'Ana');
    assert.equal(battle.hero.subtitle, 'Guerreiro');
    assert.equal(battle.hero.assetKey, 'hero.warrior');
    assert.equal(battle.hero.maxHp, 24 + 4 * 6);
    assert.equal(battle.hero.hp, battle.hero.maxHp);
    assert.equal(battle.hero.attack, 5);
    assert.equal(battle.hero.defense, 2);
    assert.equal(battle.hero.moves.length, 4);
    assert.equal(battle.enemy.name, 'Preguiça');
    assert.equal(battle.enemy.assetKey, 'enemy.health');
    assert.equal(battle.enemy.maxHp, ENEMY_SCALE.EASY.hp);
    assert.equal(battle.enemy.attack, ENEMY_SCALE.EASY.attack);
    assert.equal(battle.victoryTitle, VILLAIN_BY_CATEGORY.HEALTH.defeatedTitle);
    assert.equal(battle.log[0]?.text, 'Preguiça apareceu!');
  });

  it('usa o atributo de ataque da classe e a vitalidade no HP', () => {
    const warrior = begin();
    const stronger = startBattle({
      character: hero('WARRIOR', {
        ...CLASS_DEFAULTS.WARRIOR.attributes,
        strength: 8,
        vitality: 6,
      }),
      category: 'HEALTH',
      difficulty: 'EASY',
      heroName: 'Ana',
    });
    assert.equal(stronger.hero.attack, warrior.hero.attack + 3);
    assert.equal(stronger.hero.maxHp, 24 + 6 * 6);
    assert.equal(stronger.hero.defense, 3);

    const mage = startBattle({
      character: hero('MAGE', { ...CLASS_DEFAULTS.MAGE.attributes, strength: 9 }),
      category: 'STUDY',
      difficulty: 'MEDIUM',
      heroName: 'Ana',
    });
    assert.equal(mage.hero.attack, CLASS_DEFAULTS.MAGE.attributes.intelligence);
    assert.equal(mage.hero.assetKey, 'hero.mage');
    assert.equal(mage.enemy.name, 'Distração');
    assert.equal(mage.enemy.maxHp, ENEMY_SCALE.MEDIUM.hp);
  });

  it('nome vazio vira Herói', () => {
    const battle = startBattle({
      character: hero('ROGUE'),
      category: 'OTHER',
      difficulty: 'HARD',
      heroName: '   ',
    });
    assert.equal(battle.hero.name, 'Herói');
    assert.equal(battle.hero.assetKey, 'hero.rogue');
    assert.equal(battle.enemy.name, 'Sombra');
    assert.equal(battle.enemy.maxHp, ENEMY_SCALE.HARD.hp);
  });

  it('não muta o estado de origem ao aplicar um golpe', () => {
    const battle = begin();
    const snapshot = JSON.stringify(battle);
    applyPlayerMove(battle, 'warrior.charge');
    assert.equal(JSON.stringify(battle), snapshot);
  });
});

describe('turnos', () => {
  it('golpe do herói causa dano e passa a vez', () => {
    const battle = begin();
    const after = applyPlayerMove(battle, 'warrior.charge');
    assert.equal(after.enemy.hp, 30 - 19);
    assert.equal(after.phase, 'ENEMY_TURN');
    assert.equal(after.turn, 1);
    assert.equal(after.lastPlayerMoveId, 'warrior.charge');
    assert.equal(after.log.at(-1)?.text, 'Preguiça perde 19 de HP.');
    assert.equal(battle.enemy.hp, 30);
  });

  it('força a mais aumenta o dano na mesma proporção', () => {
    const base = applyPlayerMove(begin(), 'warrior.charge');
    const stronger = applyPlayerMove(
      startBattle({
        character: hero('WARRIOR', { ...CLASS_DEFAULTS.WARRIOR.attributes, strength: 8 }),
        category: 'HEALTH',
        difficulty: 'EASY',
        heroName: 'Ana',
      }),
      'warrior.charge',
    );
    assert.equal(base.enemy.hp - stronger.enemy.hp, 3);
  });

  it('ignora golpe desconhecido e fase errada', () => {
    const battle = begin();
    assert.equal(applyPlayerMove(battle, 'nope'), battle);
    const enemyPhase = applyPlayerMove(battle, 'warrior.slash');
    assert.equal(applyPlayerMove(enemyPhase, 'warrior.slash'), enemyPhase);
    assert.equal(applyEnemyMove(battle), battle);
  });

  it('guarda reduz o próximo golpe e depois some', () => {
    const guarded = applyPlayerMove(begin(), 'warrior.guard');
    assert.equal(guarded.hero.guard, 50);
    assert.equal(guarded.log.at(-1)?.text, 'O próximo golpe vai doer menos.');
    const hit = applyEnemyMove(guarded);
    assert.equal(hit.hero.hp, 48 - 1);
    assert.equal(hit.hero.guard, 0);
    assert.equal(hit.phase, 'PLAYER_TURN');
    assert.equal(hit.lastEnemyMoveId, 'health.delay');
  });

  it('cura não passa do máximo e anuncia HP cheio', () => {
    const healed = applyPlayerMove(begin(), 'warrior.breath');
    assert.equal(healed.hero.hp, healed.hero.maxHp);
    assert.equal(healed.log.at(-1)?.text, 'Ana já está com HP cheio.');

    const hurt = applyEnemyMove(applyPlayerMove(begin(), 'warrior.slash'));
    const recovered = applyPlayerMove(hurt, 'warrior.breath');
    assert.equal(recovered.hero.hp, Math.min(hurt.hero.maxHp, hurt.hero.hp + 12));
    assert.match(recovered.log.at(-1)?.text ?? '', /recupera/);
  });

  it('monstro difícil tira mais HP no mesmo golpe', () => {
    const exchange = (difficulty: Difficulty) => {
      const started = startBattle({
        character: hero('WARRIOR'),
        category: 'HEALTH',
        difficulty,
        heroName: 'Ana',
      });
      return applyEnemyMove(applyPlayerMove(started, 'warrior.charge')).hero.hp;
    };
    assert.ok(exchange('HARD') < exchange('MEDIUM'));
    assert.ok(exchange('MEDIUM') < exchange('EASY'));
  });

  it('golpe que zera o HP vence sem o monstro agir', () => {
    const won = fight(begin('MAGE', 'MEDIUM', 'STUDY'), 'mage.burst');
    assert.equal(won.phase, 'VICTORY');
    assert.equal(won.enemy.hp, 0);
    assert.equal(won.enemyTurns, 2);
    assert.equal(won.log.at(-1)?.text, 'Distração derrotada!');
  });

  it('golpe fraco contra quest difícil derruba o herói', () => {
    const lost = fight(begin('ROGUE', 'HARD', 'HEALTH'), 'rogue.stab');
    assert.equal(lost.phase, 'DEFEAT');
    assert.equal(lost.hero.hp, 0);
    assert.equal(lost.log.at(-1)?.text, 'Ana caiu.');
  });

  it('só curar até o teto de turnos é derrota com o herói ainda de pé', () => {
    const stalled = fight(begin(), 'warrior.breath');
    assert.equal(stalled.phase, 'DEFEAT');
    assert.equal(stalled.turn, MAX_BATTLE_TURNS);
    assert.ok(stalled.hero.hp > 0);
    assert.equal(stalled.log.at(-1)?.text, 'Ana não aguenta mais.');
  });

  it('monstro cheio não cura e guarda ativa não se repete', () => {
    const battle = begin();
    const full = { ...battle.enemy, hp: battle.enemy.maxHp };
    assert.equal(chooseEnemyMove(full, 3).id, 'health.delay');

    const guarding = { ...battle.enemy, hp: 10, guard: 40 };
    assert.equal(chooseEnemyMove(guarding, 2).id, 'health.snooze');
  });

  it('monstro sem golpe útil usa o primeiro mesmo assim', () => {
    const battle = begin();
    const heal = battle.enemy.moves[3];
    assert.ok(heal);
    const onlyHeal = {
      ...battle,
      phase: 'ENEMY_TURN' as const,
      enemy: { ...battle.enemy, moves: [heal] },
    };
    const after = applyEnemyMove(onlyHeal);
    assert.equal(after.phase, 'PLAYER_TURN');
    assert.equal(after.lastEnemyMoveId, heal.id);
    assert.match(after.log.at(-1)?.text ?? '', /cheio/);
  });

  it('dano mínimo é 1 mesmo com defesa alta', () => {
    assert.equal(battleDamage(1, 0, 0, 99), 1);
    const battle = begin();
    const tank = applyEnemyMove({
      ...applyPlayerMove(battle, 'warrior.guard'),
      hero: { ...battle.hero, defense: 99, guard: 0 },
    });
    assert.equal(tank.hero.hp, battle.hero.maxHp - 1);
  });
});
