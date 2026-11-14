import {
  BOSS_IDS,
  BOSSES,
  ENEMY_TRAITS,
  ENEMY_TRAITS_ALT,
  type BattleState,
  type BossId,
  type EnemyTrait,
  type EnemyTraitId,
} from './battle';
import { CATEGORIES } from './constants';
import type { Category } from './types';
import { VILLAIN_BY_CATEGORY } from './victory';

/**
 * Bestiário: os monstros que o herói já venceu, quantas vezes, e os jeitos de
 * lutar que já viu. O que ainda não apareceu fica em "???".
 */

export interface Bestiary {
  defeats: Record<Category, number>;
  /** Vitórias contra monstros de elite. */
  elites: number;
  bosses: Partial<Record<BossId, number>>;
  /** Jeitos de lutar já enfrentados (mesmo em derrota). */
  traits: EnemyTraitId[];
}

/** Uma frase de cada monstro dos cômodos. */
export const MONSTER_LORE: Record<Category, string> = {
  STUDY: 'Um celular de muitas abas que pisca bem na hora de estudar.',
  WORK: 'Uma nuvem de tarefas que troveja prazos e cresce se ninguém mexer.',
  HEALTH: 'Uma bola mole que boceja e convence você a deixar o treino para amanhã.',
  HOME: 'Um monte de roupa e louça que acorda quando a casa fica parada.',
  OTHER: 'Uma sombra de capuz que some quando você olha e volta quando você esquece.',
};

export function emptyBestiary(): Bestiary {
  return {
    defeats: { STUDY: 0, WORK: 0, HEALTH: 0, HOME: 0, OTHER: 0 },
    elites: 0,
    bosses: {},
    traits: [],
  };
}

/** Anota a luta: o jeito visto sempre; a vitória, só se venceu. */
export function recordBestiary(
  bestiary: Bestiary,
  battle: BattleState,
  category: Category,
  won: boolean,
): Bestiary {
  const trait = battle.enemy.trait;
  const traits =
    trait && !bestiary.traits.includes(trait) ? [...bestiary.traits, trait] : bestiary.traits;
  if (!won) return traits === bestiary.traits ? bestiary : { ...bestiary, traits };
  if (battle.variant === 'BOSS') {
    const id = battle.enemy.bossId ?? 'procrastination';
    return {
      ...bestiary,
      traits,
      bosses: { ...bestiary.bosses, [id]: (bestiary.bosses[id] ?? 0) + 1 },
    };
  }
  return {
    ...bestiary,
    traits,
    elites: bestiary.elites + (battle.variant === 'ELITE' ? 1 : 0),
    defeats: { ...bestiary.defeats, [category]: bestiary.defeats[category] + 1 },
  };
}

export interface BestiaryTrait {
  trait: EnemyTrait;
  seen: boolean;
}

export interface BestiaryMonster {
  category: Category;
  name: string;
  lore: string;
  defeats: number;
  traits: BestiaryTrait[];
}

export interface BestiaryBoss {
  id: BossId;
  name: string;
  lore: string;
  defeats: number;
  home: Category;
}

export interface BestiaryView {
  monsters: BestiaryMonster[];
  bosses: BestiaryBoss[];
  /** Entradas com pelo menos uma vitória. */
  found: number;
  total: number;
}

export function bestiaryView(bestiary: Bestiary): BestiaryView {
  const seen = new Set(bestiary.traits);
  const monsters = CATEGORIES.map((category): BestiaryMonster => ({
    category,
    name: VILLAIN_BY_CATEGORY[category].name,
    lore: MONSTER_LORE[category],
    defeats: bestiary.defeats[category],
    traits: [ENEMY_TRAITS[category], ENEMY_TRAITS_ALT[category]].map((trait) => ({
      trait,
      seen: seen.has(trait.id),
    })),
  }));
  const bosses = BOSS_IDS.map((id): BestiaryBoss => ({
    id,
    name: BOSSES[id].name,
    lore: BOSSES[id].lore,
    defeats: bestiary.bosses[id] ?? 0,
    home: BOSSES[id].home,
  }));
  const found =
    monsters.filter((entry) => entry.defeats > 0).length +
    bosses.filter((entry) => entry.defeats > 0).length;
  return { monsters, bosses, found, total: monsters.length + bosses.length };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(99999, Math.floor(value)))
    : 0;
}

const TRAIT_IDS = new Set<string>([
  ...Object.values(ENEMY_TRAITS).map((trait) => trait.id),
  ...Object.values(ENEMY_TRAITS_ALT).map((trait) => trait.id),
  'TWO_PHASES',
]);

export function sanitizeBestiary(raw: unknown): Bestiary {
  const base = emptyBestiary();
  if (!isRecord(raw)) return base;
  if (isRecord(raw.defeats)) {
    for (const category of CATEGORIES) base.defeats[category] = count(raw.defeats[category]);
  }
  base.elites = count(raw.elites);
  if (isRecord(raw.bosses)) {
    for (const id of BOSS_IDS) {
      const value = count(raw.bosses[id]);
      if (value > 0) base.bosses[id] = value;
    }
  }
  if (Array.isArray(raw.traits)) {
    for (const id of raw.traits) {
      if (
        typeof id === 'string' &&
        TRAIT_IDS.has(id) &&
        !base.traits.includes(id as EnemyTraitId)
      ) {
        base.traits.push(id as EnemyTraitId);
      }
    }
  }
  return base;
}
