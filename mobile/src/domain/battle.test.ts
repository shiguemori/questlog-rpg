import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEnemyMove,
  applyPlayerMove,
  chooseEnemySkill,
  enemyIntent,
  ENEMY_SKILLS,
  ENERGY_REGEN_PER_TURN,
  HERO_SKILLS,
  MAX_BATTLE_TURNS,
  POISON_MAX_STACKS,
  previewDamage,
  skillBlock,
  startBattle,
  type BattleActor,
  type BattleState,
  type StatusEffect,
} from './battle';
import { CLASS_DEFAULTS } from './constants';
import type { Attributes, Category, Character, CharacterClass, Difficulty } from './types';

function hero(
  characterClass: CharacterClass,
  attributes: Attributes = CLASS_DEFAULTS[characterClass].attributes,
  level = 1,
): Character {
  return {
    name: 'Ana',
    characterClass,
    level,
    xp: 0,
    maxXp: 100,
    attributes: { ...attributes },
    attributePoints: 0,
  };
}

function begin(
  characterClass: CharacterClass = 'WARRIOR',
  difficulty: Difficulty = 'EASY',
  category: Category = 'HEALTH',
  extra: { heroHp?: number; seed?: number; attributes?: Attributes; level?: number } = {},
): BattleState {
  return startBattle({
    character: hero(characterClass, extra.attributes, extra.level),
    category,
    difficulty,
    heroName: 'Ana',
    heroHp: extra.heroHp,
    seed: extra.seed ?? 7,
  });
}

/** Sem sorte: zera crítico e esquiva dos dois lados, para números exatos. */
function noLuck(state: BattleState): BattleState {
  return {
    ...state,
    hero: { ...state.hero, critChance: 0, dodgeChance: 0 },
    enemy: { ...state.enemy, critChance: 0, dodgeChance: 0 },
  };
}

function withEnemy(state: BattleState, patch: Partial<BattleActor>): BattleState {
  return { ...state, enemy: { ...state.enemy, ...patch } };
}

function withHero(state: BattleState, patch: Partial<BattleActor>): BattleState {
  return { ...state, hero: { ...state.hero, ...patch } };
}

function status(id: StatusEffect['id'], turns: number, potency = 0, stacks = 1): StatusEffect {
  return { id, turns, potency, stacks };
}

describe('catálogo', () => {
  it('cada classe tem 6 habilidades próprias, com ids únicos entre classes', () => {
    const all = Object.values(HERO_SKILLS).flat();
    for (const skills of Object.values(HERO_SKILLS)) assert.equal(skills.length, 6);
    assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
    const names = (cls: CharacterClass) => HERO_SKILLS[cls].map((entry) => entry.name).join(',');
    assert.notEqual(names('WARRIOR'), names('MAGE'));
    assert.notEqual(names('MAGE'), names('ROGUE'));
  });

  it('cada classe escala pelo próprio atributo', () => {
    assert.equal(HERO_SKILLS.WARRIOR[0].scaling, 'strength');
    assert.equal(HERO_SKILLS.MAGE[0].scaling, 'intelligence');
    assert.equal(HERO_SKILLS.ROGUE[0].scaling, 'agility');
  });

  it('cada categoria tem um monstro com 4 golpes próprios', () => {
    const all = Object.values(ENEMY_SKILLS).flat();
    for (const skills of Object.values(ENEMY_SKILLS)) assert.equal(skills.length, 4);
    assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
  });

  it('o monstro muda com a categoria da quest', () => {
    assert.equal(begin('MAGE', 'EASY', 'STUDY').enemy.assetKey, 'enemy.study');
    assert.equal(begin('MAGE', 'EASY', 'WORK').enemy.assetKey, 'enemy.work');
    assert.equal(begin('MAGE', 'EASY', 'HOME').enemy.name, 'Bagunça');
  });
});

describe('atributos afetam a luta', () => {
  it('vitalidade dá vida e defesa; inteligência dá energia; agilidade dá crítico', () => {
    const warrior = begin('WARRIOR');
    assert.equal(warrior.hero.maxHp, 24 + 4 * 6);
    assert.equal(warrior.hero.defense, 2);
    assert.equal(warrior.hero.maxEnergy, 12 + 1 * 2);
    assert.equal(begin('MAGE').hero.maxEnergy, 12 + 5 * 2);
    assert.ok(begin('ROGUE').hero.critChance > begin('WARRIOR').hero.critChance);
  });

  it('mais Força, mais dano no Golpe do guerreiro', () => {
    const base = begin('WARRIOR');
    const strong = begin('WARRIOR', 'EASY', 'HEALTH', {
      attributes: { ...CLASS_DEFAULTS.WARRIOR.attributes, strength: 9 },
    });
    const strike = HERO_SKILLS.WARRIOR[0];
    assert.ok(
      previewDamage(strong.hero, strong.enemy, strike) >
        previewDamage(base.hero, base.enemy, strike),
    );
  });

  it('o escudo da Muralha cresce com Vitalidade', () => {
    const after = applyPlayerMove(noLuck(begin('WARRIOR')), 'warrior.wall');
    assert.equal(after.hero.shield, Math.floor(6 + 4 * 2.5));
  });

  it('o monstro sobe de vida e atributos com o nível do herói', () => {
    const low = begin('MAGE', 'MEDIUM', 'STUDY', { level: 1 });
    const high = begin('MAGE', 'MEDIUM', 'STUDY', { level: 5 });
    assert.ok(high.enemy.maxHp > low.enemy.maxHp);
    assert.ok(high.enemy.attributes.strength > low.enemy.attributes.strength);
  });
});

describe('energia e recarga', () => {
  it('habilidade custa energia e entra em recarga', () => {
    const state = noLuck(begin('WARRIOR'));
    const after = applyPlayerMove(state, 'warrior.bash');
    assert.equal(after.hero.energy, state.hero.energy - 5);
    // A recarga anda 1 no fim do turno do herói.
    assert.equal(after.hero.cooldowns['warrior.bash'], 2);
    const again: BattleState = { ...after, phase: 'PLAYER_TURN' };
    assert.equal(skillBlock(again.hero, HERO_SKILLS.WARRIOR[1]), 'COOLDOWN');
    assert.equal(applyPlayerMove(again, 'warrior.bash'), again);
  });

  it('sem energia a habilidade não sai', () => {
    const state = withHero(noLuck(begin('MAGE')), { energy: 2 });
    assert.equal(skillBlock(state.hero, HERO_SKILLS.MAGE[1]), 'ENERGY');
    assert.equal(applyPlayerMove(state, 'mage.fireball'), state);
  });

  it('o herói recupera energia a cada turno e Defender devolve mais', () => {
    const state = withHero(noLuck(begin('MAGE')), { energy: 5 });
    const defended = applyPlayerMove(state, 'mage.defend');
    assert.equal(defended.hero.energy, 8);
    const back = applyEnemyMove(defended);
    assert.equal(back.hero.energy, Math.min(back.hero.maxEnergy, 8 + ENERGY_REGEN_PER_TURN));
  });
});

describe('status', () => {
  it('queimadura tira vida no começo do turno do monstro', () => {
    const after = applyPlayerMove(noLuck(begin('MAGE', 'EASY', 'WORK')), 'mage.fireball');
    assert.ok(after.enemy.statuses.some((entry) => entry.id === 'BURN'));
    const ticked = applyEnemyMove(after);
    assert.ok(
      ticked.events.some(
        (event) => event.kind === 'TICK' && event.target === 'ENEMY' && event.status === 'BURN',
      ),
    );
  });

  it('veneno acumula doses até o teto', () => {
    let state = withHero(noLuck(begin('ROGUE', 'HARD', 'HOME')), { energy: 99, maxEnergy: 99 });
    for (let index = 0; index < 5; index += 1) {
      state = applyPlayerMove({ ...state, phase: 'PLAYER_TURN' }, 'rogue.venom');
    }
    const poison = state.enemy.statuses.find((entry) => entry.id === 'POISON');
    assert.equal(poison?.stacks, POISON_MAX_STACKS);
  });

  it('atordoar faz o monstro perder a vez', () => {
    const bashed = applyPlayerMove(noLuck(begin('WARRIOR', 'HARD', 'WORK')), 'warrior.bash');
    const skipped = applyEnemyMove(bashed);
    assert.ok(skipped.events.some((event) => event.kind === 'SKIP' && event.target === 'ENEMY'));
    assert.equal(skipped.hero.hp, bashed.hero.hp);
    assert.equal(skipped.phase, 'PLAYER_TURN');
  });

  it('herói atordoado perde a vez e o monstro age de novo', () => {
    const state = withHero(
      { ...noLuck(begin('MAGE', 'EASY', 'WORK')), phase: 'ENEMY_TURN' },
      { statuses: [status('STUN', 1)] },
    );
    const after = applyEnemyMove(state);
    assert.equal(after.phase, 'ENEMY_TURN');
    assert.equal(after.turn, state.turn + 1);
    assert.ok(after.events.some((event) => event.kind === 'SKIP' && event.target === 'PLAYER'));
  });

  it('fúria aumenta e fraqueza reduz o dano', () => {
    const state = noLuck(begin('WARRIOR'));
    const strike = HERO_SKILLS.WARRIOR[0];
    const plain = previewDamage(state.hero, state.enemy, strike);
    const angry = withHero(state, { statuses: [status('EMPOWER', 2, 40)] });
    const weak = withHero(state, { statuses: [status('WEAKEN', 2, 30)] });
    assert.ok(previewDamage(angry.hero, angry.enemy, strike) > plain);
    assert.ok(previewDamage(weak.hero, weak.enemy, strike) < plain);
  });

  it('esquiva faz o próximo golpe errar e some', () => {
    const state = withEnemy(noLuck(begin('WARRIOR')), { statuses: [status('EVADE', 1)] });
    const after = applyPlayerMove(state, 'warrior.strike');
    assert.equal(after.enemy.hp, state.enemy.hp);
    assert.ok(after.events.some((event) => event.kind === 'MISS'));
    assert.ok(!after.enemy.statuses.some((entry) => entry.id === 'EVADE'));
  });

  it('guarda corta o golpe pela metade e escudo absorve antes da vida', () => {
    const state = noLuck(begin('WARRIOR', 'HARD'));
    const plain = applyPlayerMove(state, 'warrior.strike');
    const guarded = applyPlayerMove(
      withEnemy(state, { statuses: [status('GUARD', 1, 50)] }),
      'warrior.strike',
    );
    assert.ok(state.enemy.hp - guarded.enemy.hp < state.enemy.hp - plain.enemy.hp);

    const shielded = applyPlayerMove(withEnemy(state, { shield: 100 }), 'warrior.strike');
    assert.equal(shielded.enemy.hp, state.enemy.hp);
    assert.ok(shielded.enemy.shield < 100);
  });
});

describe('bônus condicionais', () => {
  it('Execução dobra o dano com o monstro em vida baixa', () => {
    const state = noLuck(begin('WARRIOR', 'HARD'));
    const execute = HERO_SKILLS.WARRIOR[4];
    const full = previewDamage(state.hero, state.enemy, execute);
    const low = withEnemy(state, { hp: 5 });
    assert.ok(previewDamage(low.hero, low.enemy, execute) > full * 1.5);
  });

  it('Golpe nas Costas é sempre crítico em alvo envenenado', () => {
    const state = withEnemy(noLuck(begin('ROGUE', 'HARD')), {
      statuses: [status('POISON', 3, 2)],
    });
    const after = applyPlayerMove(state, 'rogue.backstab');
    assert.ok(after.events.some((event) => event.kind === 'DAMAGE' && event.crit === true));
  });
});

describe('fluxo da luta', () => {
  it('o monstro mostra o próximo golpe e usa o que mostrou', () => {
    const state = noLuck(begin('WARRIOR', 'MEDIUM', 'HOME'));
    const intent = enemyIntent(state);
    assert.ok(intent);
    const after = applyEnemyMove(applyPlayerMove(state, 'warrior.defend'));
    assert.equal(after.lastEnemyMoveId, intent.id);
    assert.ok(enemyIntent(after));
  });

  it('a mesma semente gera a mesma luta', () => {
    const play = (seed: number) => {
      let state = begin('ROGUE', 'MEDIUM', 'OTHER', { seed });
      for (let step = 0; step < 6; step += 1) {
        state =
          state.phase === 'PLAYER_TURN'
            ? applyPlayerMove(state, 'rogue.stab')
            : applyEnemyMove(state);
      }
      return JSON.stringify([state.hero.hp, state.enemy.hp, state.rng]);
    };
    assert.equal(play(42), play(42));
  });

  it('entra com a vida guardada, limitada à vida máxima', () => {
    assert.equal(begin('WARRIOR', 'EASY', 'HEALTH', { heroHp: 10 }).hero.hp, 10);
    assert.equal(begin('WARRIOR', 'EASY', 'HEALTH', { heroHp: 999 }).hero.hp, 48);
  });

  it(`passar de ${MAX_BATTLE_TURNS} turnos do herói é derrota`, () => {
    let state = withEnemy(noLuck(begin('MAGE', 'HARD', 'HEALTH')), { hp: 9999, maxHp: 9999 });
    state = withHero(state, { hp: 9999, maxHp: 9999 });
    for (let step = 0; step < 60 && state.phase !== 'DEFEAT'; step += 1) {
      state =
        state.phase === 'PLAYER_TURN'
          ? applyPlayerMove(state, 'mage.defend')
          : applyEnemyMove(state);
    }
    assert.equal(state.phase, 'DEFEAT');
    assert.equal(state.turn, MAX_BATTLE_TURNS);
  });

  it('nocaute do monstro vira vitória com evento KO', () => {
    const after = applyPlayerMove(withEnemy(noLuck(begin('WARRIOR')), { hp: 1 }), 'warrior.strike');
    assert.equal(after.phase, 'VICTORY');
    assert.ok(after.events.some((event) => event.kind === 'KO' && event.target === 'ENEMY'));
  });

  it('monstro ferido prefere se curar', () => {
    const state = withEnemy(begin('MAGE', 'MEDIUM', 'STUDY'), { hp: 5 });
    assert.equal(chooseEnemySkill(state).id, 'study.nap');
  });

  it('com estratégia, toda classe vence o monstro fácil de cada categoria', () => {
    const plan: Record<CharacterClass, string[]> = {
      WARRIOR: ['warrior.execute', 'warrior.warcry', 'warrior.strike'],
      MAGE: ['mage.fireball', 'mage.meteor', 'mage.spark'],
      ROGUE: ['rogue.venom', 'rogue.backstab', 'rogue.stab'],
    };
    for (const cls of Object.keys(plan) as CharacterClass[]) {
      for (const category of Object.keys(ENEMY_SKILLS) as Category[]) {
        let state = begin(cls, 'EASY', category, { seed: 3 });
        for (let step = 0; step < 60; step += 1) {
          if (state.phase === 'ENEMY_TURN') {
            state = applyEnemyMove(state);
          } else if (state.phase === 'PLAYER_TURN') {
            const current = state;
            const pick =
              plan[cls].find((id) => {
                const entry = current.hero.skills.find((item) => item.id === id);
                return entry != null && skillBlock(current.hero, entry) == null;
              }) ?? plan[cls][plan[cls].length - 1];
            state = applyPlayerMove(state, pick);
          } else {
            break;
          }
        }
        assert.equal(state.phase, 'VICTORY', `${cls} contra ${category}`);
      }
    }
  });
});
