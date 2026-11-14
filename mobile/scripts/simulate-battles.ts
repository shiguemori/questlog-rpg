/**
 * Simulação de balanceamento: milhares de lutas por classe, monstro, dificuldade e nível.
 * Uso: npx tsx scripts/simulate-battles.ts
 *
 * O herói joga "bem, sem ser perfeito": usa o golpe de mais dano disponível e, com
 * pouca vida, prefere cura ou escudo. Talentos e atributos seguem uma build comum.
 */
import {
  applyEnemyMove,
  applyPlayerItem,
  HERO_SKILLS,
  applyPlayerMove,
  potionBlock,
  type EnemyVariant,
  previewDamage,
  skillBlock,
  startBattle,
  type BattleSkill,
  type BattleState,
} from '../src/domain/battle';
import { CLASS_DEFAULTS, ATTRIBUTE_POINTS_PER_LEVEL } from '../src/domain/constants';
import { battleSkillsFor, heroBonus, TALENT_TREES, TALENT_TIER_LEVEL } from '../src/domain/talents';
import type { Category, Character, CharacterClass, Difficulty } from '../src/domain/types';

const CLASSES: CharacterClass[] = ['WARRIOR', 'MAGE', 'ROGUE'];
const CATEGORIES: Category[] = ['STUDY', 'WORK', 'HEALTH', 'HOME', 'OTHER'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const LEVELS = [1, 3, 5, 8];
const RUNS = 300;

const OFFENSE: Record<CharacterClass, 'strength' | 'intelligence' | 'agility'> = {
  WARRIOR: 'strength',
  MAGE: 'intelligence',
  ROGUE: 'agility',
};

function buildHero(cls: CharacterClass, level: number): Character {
  const attributes = { ...CLASS_DEFAULTS[cls].attributes };
  const points = (level - 1) * ATTRIBUTE_POINTS_PER_LEVEL;
  for (let i = 0; i < points; i += 1) {
    if (i % 3 === 2) attributes.vitality += 1;
    else attributes[OFFENSE[cls]] += 1;
  }
  const order = [
    'attack.1',
    'guard.1',
    'routine.1',
    'attack.2',
    'guard.2',
    'routine.2',
    'attack.3',
    'guard.3',
    'routine.3',
  ];
  const prefix = cls.toLowerCase();
  const talents: string[] = [];
  for (const id of order) {
    if (talents.length >= level - 1) break;
    const node = TALENT_TREES[cls].find((entry) => entry.id === `${prefix}.${id}`);
    if (!node || level < TALENT_TIER_LEVEL[node.tier]) continue;
    if (node.requires && !talents.includes(node.requires)) continue;
    talents.push(node.id);
  }
  const character: Character = {
    name: 'Sim',
    characterClass: cls,
    level,
    xp: 0,
    maxXp: 100,
    attributes,
    attributePoints: 0,
    talents,
  };
  // Leva os golpes da árvore primeiro.
  const unlocked = TALENT_TREES[cls]
    .filter((node) => talents.includes(node.id) && node.unlocksSkill)
    .map((node) => node.unlocksSkill as string);
  const base = HERO_SKILLS[cls].slice(0, -1).map((entry) => entry.id);
  return { ...character, loadout: [...unlocked, ...base].slice(0, 5) };
}

/** Com pouca vida, bebe água (se tiver); sem energia, café. */
function choosePotion(state: BattleState): 'potion.water' | 'potion.coffee' | null {
  const { hero } = state;
  if (hero.hp / hero.maxHp < 0.4 && potionBlock(state, 'potion.water') == null)
    return 'potion.water';
  if (hero.energy < 4 && potionBlock(state, 'potion.coffee') == null) return 'potion.coffee';
  return null;
}

function choose(state: BattleState): BattleSkill {
  const { hero, enemy } = state;
  const ready = hero.skills.filter((entry) => skillBlock(hero, entry) == null);
  const low = hero.hp / hero.maxHp < 0.35;
  if (low) {
    const sustain = ready.find((entry) => entry.heal || entry.shield);
    if (sustain) return sustain;
  }
  let best = ready[ready.length - 1];
  let bestDamage = -1;
  for (const entry of ready) {
    const damage = previewDamage(hero, enemy, entry) + (entry.applies?.length ?? 0) * 2;
    if (damage > bestDamage) {
      best = entry;
      bestDamage = damage;
    }
  }
  return best;
}

interface Result {
  won: boolean;
  turns: number;
  hpLeft: number;
}

function fight(
  cls: CharacterClass,
  category: Category,
  difficulty: Difficulty,
  level: number,
  seed: number,
  variant: EnemyVariant = 'NORMAL',
): Result {
  const character = buildHero(cls, level);
  let state = startBattle({
    character,
    category,
    difficulty,
    heroName: 'Sim',
    seed,
    skills: battleSkillsFor(character),
    bonus: heroBonus(character),
    variant,
    // Quem chega no chefe costuma ter juntado algumas poções.
    potions: variant === 'NORMAL' ? {} : { 'potion.water': 2, 'potion.coffee': 1 },
  });
  for (let guard = 0; guard < 120; guard += 1) {
    const potion = state.phase === 'PLAYER_TURN' ? choosePotion(state) : null;
    if (potion) state = applyPlayerItem(state, potion);
    else if (state.phase === 'PLAYER_TURN') state = applyPlayerMove(state, choose(state).id);
    else if (state.phase === 'ENEMY_TURN') state = applyEnemyMove(state);
    else break;
  }
  return {
    won: state.phase === 'VICTORY',
    turns: state.turn,
    hpLeft: state.hero.hp / state.hero.maxHp,
  };
}

// `npx tsx scripts/simulate-battles.ts especiais`: só elite e chefe.
if (process.argv[2] === 'especiais') {
  const lines: string[] = [];
  for (const variant of ['ELITE', 'BOSS'] as const) {
    for (const level of [2, 3, 5, 8]) {
      const cells: string[] = [];
      for (const cls of CLASSES) {
        let wins = 0;
        let turns = 0;
        const cats: Category[] = variant === 'BOSS' ? ['OTHER'] : CATEGORIES;
        for (const category of cats) {
          for (let run = 0; run < RUNS; run += 1) {
            const result = fight(cls, category, 'HARD', level, 1000 + run * 7919, variant);
            if (result.won) wins += 1;
            turns += result.turns;
          }
        }
        const total = RUNS * cats.length;
        cells.push(
          `${cls.padEnd(7)} ${((wins / total) * 100).toFixed(0).padStart(3)}% ${(turns / total).toFixed(1)}t`,
        );
      }
      lines.push(`${variant.padEnd(5)} nv${String(level).padEnd(2)} | ${cells.join(' | ')}`);
    }
  }
  console.log(lines.join(String.fromCharCode(10)));
  process.exit(0);
}

const rows: string[] = [];
const flags: string[] = [];
for (const difficulty of DIFFICULTIES) {
  for (const level of LEVELS) {
    for (const cls of CLASSES) {
      const line: string[] = [];
      for (const category of CATEGORIES) {
        let wins = 0;
        let turns = 0;
        let hp = 0;
        for (let run = 0; run < RUNS; run += 1) {
          const result = fight(cls, category, difficulty, level, 1000 + run * 7919);
          if (result.won) wins += 1;
          turns += result.turns;
          hp += result.hpLeft;
        }
        const rate = wins / RUNS;
        line.push(
          `${category.padEnd(6)} ${(rate * 100).toFixed(0).padStart(3)}% ${(turns / RUNS).toFixed(1).padStart(4)}t ${((hp / RUNS) * 100).toFixed(0).padStart(3)}%hp`,
        );
        const target =
          difficulty === 'EASY' ? [0.9, 1] : difficulty === 'MEDIUM' ? [0.75, 0.98] : [0.5, 0.9];
        if (rate < target[0] || rate > target[1]) {
          flags.push(
            `${difficulty} nv${level} ${cls} vs ${category}: ${(rate * 100).toFixed(0)}% (alvo ${target[0] * 100}–${target[1] * 100}%)`,
          );
        }
      }
      rows.push(
        `${difficulty.padEnd(6)} nv${String(level).padEnd(2)} ${cls.padEnd(7)} | ${line.join(' | ')}`,
      );
    }
  }
}
console.log(rows.join('\n'));
console.log(`\nFora do alvo (${flags.length}):`);
console.log(flags.join('\n'));
