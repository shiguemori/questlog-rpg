import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEnemyMove,
  applyPlayerItem,
  BOSS_NAME,
  BOSS_PHASE2_SKILLS,
  BOSS_SKILLS,
  BOSS_TRAIT,
  BOSS_MAX_TURNS,
  ELITE_HP_MULTIPLIER,
  enemyMaxHp,
  MAX_BATTLE_TURNS,
  potionBlock,
  rollEnemyVariant,
  startBattle,
  turnLimitFor,
  type BattleState,
} from './battle';
import { applyBattleSpoils } from './battleSpoils';
import {
  BOSS_MIN_LEVEL,
  BOSS_WINS_NEEDED,
  bossStatus,
  bossXpFor,
  emptyWeeklyBoss,
  recordBattleWin,
  sanitizeWeeklyBoss,
  settleBossBattle,
  weekKeyOf,
} from './boss';
import { GEAR } from './loot';
import { startJourney } from './state';
import type { Character } from './types';

const FRIDAY = new Date(2026, 10, 13, 12);
const NEXT_MONDAY = new Date(2026, 10, 16, 9);

function hero(level = 4): Character {
  const base = startJourney('Ana', 'MAGE').character;
  return { ...base, level, attributes: { ...base.attributes, intelligence: 8, vitality: 5 } };
}

function battle(variant: 'NORMAL' | 'ELITE' | 'BOSS' = 'NORMAL', extra = {}): BattleState {
  return startBattle({
    character: hero(),
    category: 'STUDY',
    difficulty: 'MEDIUM',
    heroName: 'Ana',
    seed: 42,
    variant,
    ...extra,
  });
}

describe('elite e chefe no começo da luta', () => {
  it('elite tem mais vida, a arte própria e o aviso na placa', () => {
    const normal = battle('NORMAL');
    const elite = battle('ELITE');
    assert.equal(elite.enemy.maxHp, Math.round(enemyMaxHp('MEDIUM', 4) * ELITE_HP_MULTIPLIER));
    assert.ok(elite.enemy.maxHp > normal.enemy.maxHp);
    assert.ok(elite.enemy.attributes.strength > normal.enemy.attributes.strength);
    assert.equal(elite.enemy.assetKey, 'enemy.study+elite');
    assert.match(elite.enemy.subtitle, /^Elite · /);
    assert.equal(elite.variant, 'ELITE');
  });

  it('chefe usa os golpes, o jeito e o nome dele, com mais turnos', () => {
    const boss = battle('BOSS');
    assert.equal(boss.enemy.name, BOSS_NAME);
    assert.equal(boss.enemy.skills, BOSS_SKILLS);
    assert.equal(boss.enemy.trait, BOSS_TRAIT.id);
    assert.equal(boss.enemy.assetKey, 'enemy.boss');
    assert.equal(boss.victoryTitle, `${BOSS_NAME} derrotada!`);
    assert.equal(turnLimitFor(boss), BOSS_MAX_TURNS);
    assert.equal(turnLimitFor(battle()), MAX_BATTLE_TURNS);
  });

  it('o chapéu vestido muda a arte do herói', () => {
    assert.equal(battle('NORMAL', { heroLook: 'crown' }).hero.assetKey, 'hero.mage+crown');
    assert.equal(battle().hero.assetKey, 'hero.mage');
  });

  it('na metade da vida o chefe entra na fase 2: golpes, arte e cura', () => {
    const start = battle('BOSS');
    const half = Math.floor(start.enemy.maxHp / 2);
    const state: BattleState = {
      ...start,
      phase: 'ENEMY_TURN',
      enemy: { ...start.enemy, hp: half },
    };
    const after = applyEnemyMove(state);
    assert.equal(after.enemy.traitUsed, true);
    assert.equal(after.enemy.skills, BOSS_PHASE2_SKILLS);
    assert.equal(after.enemy.assetKey, 'enemy.boss+phase2');
    assert.ok(after.events.some((event) => event.kind === 'TRAIT'));
    assert.ok(after.events.some((event) => event.kind === 'HEAL' && event.target === 'ENEMY'));
  });

  it('elite só a partir do nível 2 e nunca em luta fácil; vem às vezes', () => {
    assert.equal(rollEnemyVariant(5, 'EASY', 9), 'NORMAL');
    assert.equal(rollEnemyVariant(5, 'HARD', 1), 'NORMAL');
    let elites = 0;
    for (let seed = 1; seed <= 2000; seed += 1) {
      if (rollEnemyVariant(seed * 104729, 'MEDIUM', 3) === 'ELITE') elites += 1;
    }
    assert.ok(elites > 150 && elites < 350, `elites ${elites}`);
  });
});

describe('poções na batalha', () => {
  it('água cura, gasta o turno e conta como usada', () => {
    const start = battle('NORMAL', { potions: { 'potion.water': 1 } });
    const hurt: BattleState = { ...start, hero: { ...start.hero, hp: 5 } };
    const after = applyPlayerItem(hurt, 'potion.water');
    assert.equal(after.phase, 'ENEMY_TURN');
    assert.ok(after.hero.hp > 5);
    assert.equal(after.potionsUsed['potion.water'], 1);
    assert.equal(potionBlock(after, 'potion.water'), 'NOT_YOUR_TURN');
  });

  it('café devolve energia e avisa com o evento de energia', () => {
    const start = battle('NORMAL', { potions: { 'potion.coffee': 1 } });
    const tired: BattleState = { ...start, hero: { ...start.hero, energy: 0 } };
    const after = applyPlayerItem(tired, 'potion.coffee');
    assert.ok(after.hero.energy > 0);
    assert.ok(after.events.some((event) => event.kind === 'ENERGY'));
  });

  it('não usa sem ter, com a vida cheia ou acima do limite da luta', () => {
    const none = battle('NORMAL');
    assert.equal(potionBlock(none, 'potion.water'), 'NONE_LEFT');
    assert.equal(applyPlayerItem(none, 'potion.water'), none);
    const full = battle('NORMAL', { potions: { 'potion.water': 3 } });
    assert.equal(potionBlock(full, 'potion.water'), 'FULL');
    const limited: BattleState = {
      ...full,
      hero: { ...full.hero, hp: 1 },
      potionsUsed: { 'potion.water': 1, 'potion.coffee': 1 },
    };
    assert.equal(potionBlock(limited, 'potion.water'), 'LIMIT');
  });
});

describe('chefe da semana', () => {
  it('a semana vai de segunda a domingo', () => {
    assert.equal(weekKeyOf('2026-11-13'), '2026-11-09');
    assert.equal(weekKeyOf('2026-11-15'), '2026-11-09');
    assert.equal(weekKeyOf('2026-11-16'), '2026-11-16');
  });

  it('libera com as vitórias da semana; a semana nova zera', () => {
    let boss = emptyWeeklyBoss();
    assert.equal(bossStatus(boss, FRIDAY, 1).availability, 'TOO_EARLY');
    for (let i = 0; i < BOSS_WINS_NEEDED - 1; i += 1) boss = recordBattleWin(boss, FRIDAY);
    assert.equal(bossStatus(boss, FRIDAY, BOSS_MIN_LEVEL).availability, 'LOCKED');
    boss = recordBattleWin(boss, FRIDAY);
    assert.equal(bossStatus(boss, FRIDAY, BOSS_MIN_LEVEL).availability, 'READY');
    assert.equal(bossStatus(boss, NEXT_MONDAY, BOSS_MIN_LEVEL).wins, 0);
    assert.equal(recordBattleWin(boss, NEXT_MONDAY).wins, 1);
  });

  it('vitória dá XP, equipamento raro ou épico e some até a semana seguinte', () => {
    const base = { ...startJourney('Ana', 'MAGE'), character: hero(5) };
    const ready = {
      ...base,
      weeklyBoss: { weekKey: '2026-11-09', wins: 5, beatenWeek: null, triedOn: null },
      inventory: { ...base.inventory, potions: { 'potion.water': 2, 'potion.coffee': 0 } },
    };
    const outcome = settleBossBattle(ready, {
      won: true,
      heroHp: 10,
      seed: 77,
      now: FRIDAY,
      potionsUsed: { 'potion.water': 1 },
    });
    assert.equal(outcome.xpAwarded, bossXpFor(5));
    assert.ok(outcome.drop && outcome.drop.type === 'GEAR');
    assert.notEqual(GEAR[outcome.drop.id].rarity, 'COMMON');
    assert.ok(outcome.state.inventory.gear.includes(outcome.drop.id));
    assert.equal(outcome.state.inventory.potions['potion.water'], 1);
    assert.equal(bossStatus(outcome.state.weeklyBoss, FRIDAY, 5).availability, 'BEATEN');
    assert.equal(outcome.state.stats.totalXpEarned, base.stats.totalXpEarned + outcome.xpAwarded);
  });

  it('derrota não dá nada e só deixa tentar de novo amanhã', () => {
    const base = startJourney('Ana', 'MAGE');
    const ready = {
      ...base,
      character: hero(5),
      weeklyBoss: { weekKey: '2026-11-09', wins: 5, beatenWeek: null, triedOn: null },
    };
    const outcome = settleBossBattle(ready, { won: false, heroHp: 0, seed: 1, now: FRIDAY });
    assert.equal(outcome.xpAwarded, 0);
    assert.equal(outcome.drop, null);
    assert.equal(bossStatus(outcome.state.weeklyBoss, FRIDAY, 5).availability, 'TRIED_TODAY');
    const saturday = new Date(2026, 10, 14, 10);
    assert.equal(bossStatus(outcome.state.weeklyBoss, saturday, 5).availability, 'READY');
  });

  it('save estranho vira progresso vazio', () => {
    assert.deepEqual(sanitizeWeeklyBoss('x'), emptyWeeklyBoss());
    assert.deepEqual(sanitizeWeeklyBoss({ weekKey: 'ontem', wins: -4, triedOn: '2026-11-13' }), {
      weekKey: null,
      wins: 0,
      beatenWeek: null,
      triedOn: '2026-11-13',
    });
  });
});

describe('saque da luta de quest', () => {
  it('desconta poções sempre; na vitória conta para o chefe e pode deixar item', () => {
    const state = startJourney('Ana', 'MAGE');
    const fought: BattleState = {
      ...battle('ELITE', { potions: { 'potion.water': 1 } }),
      potionsUsed: { 'potion.water': 1, 'potion.coffee': 0 },
    };
    const lost = applyBattleSpoils(state, {
      battle: fought,
      won: false,
      seed: 3,
      difficulty: 'MEDIUM',
      now: FRIDAY,
    });
    assert.equal(lost.drop, null);
    assert.equal(lost.state.inventory.potions['potion.water'], 0);
    assert.equal(lost.state.weeklyBoss.wins, 0);

    const won = applyBattleSpoils(state, {
      battle: fought,
      won: true,
      seed: 3,
      difficulty: 'MEDIUM',
      now: FRIDAY,
    });
    assert.ok(won.drop, 'elite sempre deixa item');
    assert.equal(won.state.weeklyBoss.wins, 1);
  });
});
