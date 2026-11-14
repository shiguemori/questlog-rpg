import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  autoBattle,
  applyEnemyMove,
  applyPlayerMove,
  BOSSES,
  BOSS_IDS,
  enemyTraitOf,
  ENEMY_TRAITS,
  ENEMY_TRAITS_ALT,
  rollEnemyTrait,
  startBattle,
  type BattleState,
} from './battle';
import { bestiaryView, emptyBestiary, recordBestiary, sanitizeBestiary } from './bestiary';
import { bossOfWeek, bossStatus, settleBossBattle } from './boss';
import { CLASS_DEFAULTS } from './constants';
import { startJourney } from './state';
import type { Character } from './types';

function hero(level = 5): Character {
  return {
    name: 'Ana',
    characterClass: 'WARRIOR',
    level,
    xp: 0,
    maxXp: 100,
    attributes: { ...CLASS_DEFAULTS.WARRIOR.attributes },
    attributePoints: 0,
  };
}

function play(state: BattleState, rounds: number): BattleState {
  let current = state;
  for (let i = 0; i < rounds; i += 1) {
    if (current.phase === 'PLAYER_TURN') {
      const ready = current.hero.skills.find((entry) => entry.power > 0 && entry.cost === 0);
      current = applyPlayerMove(current, (ready ?? current.hero.skills[0]).id);
    } else if (current.phase === 'ENEMY_TURN') current = applyEnemyMove(current);
    else break;
  }
  return current;
}

describe('chefes em rodízio', () => {
  it('cada semana tem um chefe e os quatro se revezam', () => {
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'];
    const bosses = weeks.map(bossOfWeek);
    assert.equal(new Set(bosses.slice(0, 4)).size, 4);
    assert.equal(bosses[4], bosses[0]);
    const status = bossStatus(
      { weekKey: '2026-11-09', wins: 5, beatenWeek: null, triedOn: null },
      new Date(2026, 10, 13, 12),
      4,
    );
    assert.equal(status.bossId, bossOfWeek('2026-11-09'));
  });

  it('cada chefe tem nome, arena, golpes e fase 2 próprios', () => {
    for (const id of BOSS_IDS) {
      const battle = startBattle({
        character: hero(),
        category: 'OTHER',
        difficulty: 'HARD',
        heroName: 'Ana',
        variant: 'BOSS',
        bossId: id,
      });
      assert.equal(battle.enemy.name, BOSSES[id].name);
      assert.equal(battle.enemy.assetKey, BOSSES[id].assetKey);
      assert.equal(enemyTraitOf(battle.enemy)?.name, BOSSES[id].trait.name);
      assert.notDeepEqual(
        BOSSES[id].skills.map((entry) => entry.id),
        BOSSES[id].phase2Skills.map((entry) => entry.id),
      );
    }
    const names = new Set(BOSS_IDS.map((id) => BOSSES[id].name));
    assert.equal(names.size, BOSS_IDS.length);
  });

  it('a fase 2 troca a arte e os golpes do chefe certo', () => {
    let battle = startBattle({
      character: hero(8),
      category: 'OTHER',
      difficulty: 'HARD',
      heroName: 'Ana',
      variant: 'BOSS',
      bossId: 'couch',
      seed: 42,
    });
    battle = { ...battle, enemy: { ...battle.enemy, hp: Math.floor(battle.enemy.maxHp / 2) } };
    battle = play(battle, 2);
    assert.equal(battle.enemy.assetKey, 'enemy.couch+phase2');
    assert.ok(battle.enemy.skills.some((entry) => entry.id === 'couch.heavy'));
  });

  it('vencer anota o chefe no bestiário e no resumo da semana', () => {
    const base = startJourney('Ana', 'WARRIOR');
    const battle = startBattle({
      character: base.character,
      category: 'OTHER',
      difficulty: 'HARD',
      heroName: 'Ana',
      variant: 'BOSS',
      bossId: 'meeting',
    });
    const outcome = settleBossBattle(base, {
      won: true,
      heroHp: 10,
      seed: 9,
      now: new Date(2026, 10, 13, 12),
      battle,
    });
    assert.equal(outcome.state.bestiary.bosses.meeting, 1);
    assert.deepEqual(outcome.state.weeks.at(-1)?.boss, { id: 'meeting', result: 'BEATEN' });
  });
});

describe('segundo jeito de lutar', () => {
  it('só a partir do nível 3, e a semente decide', () => {
    assert.equal(rollEnemyTrait(1, 'STUDY', 2), 'MORE_TABS');
    const seen = new Set<string>();
    for (let seed = 1; seed < 200; seed += 1) seen.add(rollEnemyTrait(seed * 31, 'STUDY', 5));
    assert.deepEqual([...seen].sort(), ['MORE_TABS', 'REFLECT']);
  });

  it('traço fora do cômodo é ignorado', () => {
    const battle = startBattle({
      character: hero(),
      category: 'WORK',
      difficulty: 'MEDIUM',
      heroName: 'Ana',
      trait: 'REFLECT',
    });
    assert.equal(battle.enemy.trait, ENEMY_TRAITS.WORK.id);
  });

  it('Cacos no chão devolve parte do golpe físico, sem derrubar o herói', () => {
    const battle = startBattle({
      character: hero(),
      category: 'HOME',
      difficulty: 'MEDIUM',
      heroName: 'Ana',
      trait: 'THORNS',
      seed: 7,
    });
    const physical = battle.hero.skills.find(
      (entry) => entry.kind === 'PHYSICAL' && entry.cost === 0,
    );
    assert.ok(physical);
    const after = applyPlayerMove(battle, physical.id);
    const hitEnemy = after.events.some(
      (event) => event.kind === 'DAMAGE' && event.target === 'ENEMY',
    );
    if (hitEnemy) {
      assert.ok(after.hero.hp < battle.hero.hp);
      assert.ok(after.events.some((event) => event.kind === 'DAMAGE' && event.target === 'PLAYER'));
    }
    assert.ok(after.hero.hp >= 1);
  });

  it('Vira duas tarefas: na metade da vida, cada golpe sai em dois', () => {
    let battle = startBattle({
      character: hero(),
      category: 'WORK',
      difficulty: 'MEDIUM',
      heroName: 'Ana',
      trait: 'SPLIT',
      seed: 3,
    });
    battle = { ...battle, phase: 'ENEMY_TURN', enemy: { ...battle.enemy, hp: 1 } };
    const after = applyEnemyMove(battle);
    assert.equal(after.enemy.split, true);
  });

  it('Puxa a atenção rouba energia no turno do monstro', () => {
    let battle = startBattle({
      character: hero(),
      category: 'OTHER',
      difficulty: 'MEDIUM',
      heroName: 'Ana',
      trait: 'DISTRACT',
    });
    battle = { ...battle, phase: 'ENEMY_TURN' };
    const after = applyEnemyMove(battle);
    assert.ok(after.events.some((event) => event.kind === 'ENERGY' && (event.amount ?? 0) < 0));
  });

  it('todos os cômodos têm dois jeitos diferentes', () => {
    for (const category of Object.keys(ENEMY_TRAITS) as (keyof typeof ENEMY_TRAITS)[]) {
      assert.notEqual(ENEMY_TRAITS[category].id, ENEMY_TRAITS_ALT[category].id);
    }
  });
});

describe('bestiário', () => {
  it('conta vitórias, elites e jeitos vistos (o jeito conta mesmo na derrota)', () => {
    const battle = startBattle({
      character: hero(),
      category: 'STUDY',
      difficulty: 'HARD',
      heroName: 'Ana',
      trait: 'REFLECT',
      variant: 'ELITE',
    });
    let bestiary = recordBestiary(emptyBestiary(), battle, 'STUDY', false);
    assert.equal(bestiary.defeats.STUDY, 0);
    assert.deepEqual(bestiary.traits, ['REFLECT']);
    bestiary = recordBestiary(bestiary, battle, 'STUDY', true);
    assert.equal(bestiary.defeats.STUDY, 1);
    assert.equal(bestiary.elites, 1);
    const view = bestiaryView(bestiary);
    assert.equal(view.found, 1);
    assert.equal(view.total, 5 + BOSS_IDS.length);
    const study = view.monsters.find((entry) => entry.category === 'STUDY');
    assert.deepEqual(
      study?.traits.map((entry) => entry.seen),
      [false, true],
    );
  });

  it('sanitize descarta jeito e chefe inventados', () => {
    const clean = sanitizeBestiary({
      defeats: { STUDY: 3, WORK: -1 },
      bosses: { couch: 2, dragao: 9 },
      traits: ['REFLECT', 'LASER', 'REFLECT'],
    });
    assert.equal(clean.defeats.STUDY, 3);
    assert.equal(clean.defeats.WORK, 0);
    assert.deepEqual(clean.bosses, { couch: 2 });
    assert.deepEqual(clean.traits, ['REFLECT']);
  });
});

describe('luta rápida', () => {
  it('joga até o fim sem poções e repete o resultado com a mesma semente', () => {
    const start = startBattle({
      character: hero(3),
      category: 'STUDY',
      difficulty: 'EASY',
      heroName: 'Ana',
      seed: 99,
      potions: { 'potion.water': 2 },
    });
    const a = autoBattle(start);
    const b = autoBattle(start);
    assert.ok(a.phase === 'VICTORY' || a.phase === 'DEFEAT');
    assert.equal(a.phase, b.phase);
    assert.equal(a.turn, b.turn);
    assert.equal(a.potionsUsed['potion.water'], 0);
  });

  it('fácil quase sempre vence', () => {
    let wins = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const end = autoBattle(
        startBattle({
          character: hero(2),
          category: 'HOME',
          difficulty: 'EASY',
          heroName: 'Ana',
          seed: seed * 7919,
        }),
      );
      if (end.phase === 'VICTORY') wins += 1;
    }
    assert.ok(wins >= 54, `venceu ${wins} de 60`);
  });
});
