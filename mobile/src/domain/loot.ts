import type { HeroBonus } from './battle';

/**
 * Loot: o que o monstro derrotado pode deixar e a mochila do herói.
 *
 * - Equipamento em 4 espaços (chapéu, arma, capa, amuleto) dá bônus pequeno e permanente.
 *   Chapéu, arma e capa aparecem na arte do herói.
 * - Duas peças do mesmo conjunto vestidas dão um bônus extra.
 * - Peça repetida vira fragmentos. Fragmentos aprimoram uma peça: ela sobe uma raridade
 *   e o bônus cresce 50% por passo.
 * - Poções são de uso único na batalha (no máximo 2 por luta).
 * - O sorteio usa a semente da luta: a mesma luta sempre deixa o mesmo item.
 * - Não existe loja: item só vem de luta e dos desafios do dia.
 */

export type Rarity = 'COMMON' | 'RARE' | 'EPIC';
export type GearSlot = 'HEAD' | 'WEAPON' | 'CAPE' | 'CHARM';
export type GearId =
  | 'hat.cap'
  | 'hat.beanie'
  | 'hat.hardhat'
  | 'hat.pointy'
  | 'hat.crown'
  | 'weapon.ember'
  | 'weapon.frost'
  | 'weapon.gold'
  | 'cape.red'
  | 'cape.travel'
  | 'cape.night'
  | 'charm.clover'
  | 'charm.heart'
  | 'charm.hourglass'
  | 'charm.star';
export type PotionId = 'potion.water' | 'potion.coffee';
export type GearSetId = 'set.luck' | 'set.cozy' | 'set.craft' | 'set.arcane' | 'set.royal';

/** De onde veio a luta. Elite e chefe sempre deixam item. */
export type LootSource = 'NORMAL' | 'ELITE' | 'BOSS';

export interface Gear {
  id: GearId;
  name: string;
  slot: GearSlot;
  /** Raridade de origem (sem aprimoramento). */
  rarity: Rarity;
  bonus: Partial<HeroBonus>;
  /** Chave da arte do ícone (`assets/items`). */
  art: string;
  /** Chapéu, arma e capa: o visual que o herói veste (`crown`, `ember`, `red`). */
  look?: string;
  set?: GearSetId;
}

export interface GearSet {
  id: GearSetId;
  name: string;
  pieces: readonly GearId[];
  /** Vale com 2 peças vestidas. */
  bonus: Partial<HeroBonus>;
}

export interface Potion {
  id: PotionId;
  name: string;
  effect: string;
  art: string;
  /** Cura em % da vida máxima. */
  healPct?: number;
  /** Energia em % da energia máxima. */
  energyPct?: number;
}

export type PotionStock = Record<PotionId, number>;

export interface Inventory {
  /** Equipamentos já ganhos, sem repetição, na ordem em que vieram. */
  gear: GearId[];
  equipped: Record<GearSlot, GearId | null>;
  potions: PotionStock;
  /** Vêm de peça repetida e dos desafios do dia. Gastos no aprimoramento. */
  fragments: number;
  /** Passos de aprimoramento por peça (0 = original). */
  upgrades: Partial<Record<GearId, number>>;
}

export type LootDrop =
  | { type: 'GEAR'; id: GearId }
  | { type: 'POTION'; id: PotionId; amount: number }
  /** `from` = a peça repetida que virou fragmentos. */
  | { type: 'FRAGMENTS'; amount: number; from?: GearId };

export const RARITY_ORDER: readonly Rarity[] = ['COMMON', 'RARE', 'EPIC'];

export const RARITY_LABELS: Record<Rarity, string> = {
  COMMON: 'Comum',
  RARE: 'Raro',
  EPIC: 'Épico',
};

export const SLOTS: readonly GearSlot[] = ['HEAD', 'WEAPON', 'CAPE', 'CHARM'];

export const SLOT_LABELS: Record<GearSlot, string> = {
  HEAD: 'Chapéu',
  WEAPON: 'Arma',
  CAPE: 'Capa',
  CHARM: 'Amuleto',
};

export const GEAR: Record<GearId, Gear> = {
  'hat.cap': {
    id: 'hat.cap',
    name: 'Boné da Sorte',
    slot: 'HEAD',
    rarity: 'COMMON',
    bonus: { critChance: 3 },
    art: 'hat-cap',
    look: 'cap',
    set: 'set.luck',
  },
  'hat.beanie': {
    id: 'hat.beanie',
    name: 'Gorro de Lã',
    slot: 'HEAD',
    rarity: 'COMMON',
    bonus: { maxHp: 6 },
    art: 'hat-beanie',
    look: 'beanie',
    set: 'set.cozy',
  },
  'hat.hardhat': {
    id: 'hat.hardhat',
    name: 'Capacete de Obra',
    slot: 'HEAD',
    rarity: 'RARE',
    bonus: { shieldPct: 15, maxHp: 4 },
    art: 'hat-hardhat',
    look: 'hardhat',
    set: 'set.craft',
  },
  'hat.pointy': {
    id: 'hat.pointy',
    name: 'Chapéu Pontudo',
    slot: 'HEAD',
    rarity: 'RARE',
    bonus: { maxEnergy: 3, damagePct: 4 },
    art: 'hat-pointy',
    look: 'pointy',
    set: 'set.arcane',
  },
  'hat.crown': {
    id: 'hat.crown',
    name: 'Coroa da Rotina',
    slot: 'HEAD',
    rarity: 'EPIC',
    bonus: { damagePct: 8, critChance: 4 },
    art: 'hat-crown',
    look: 'crown',
    set: 'set.royal',
  },
  'weapon.ember': {
    id: 'weapon.ember',
    name: 'Arma em Brasa',
    slot: 'WEAPON',
    rarity: 'COMMON',
    bonus: { damagePct: 5 },
    art: 'weapon-ember',
    look: 'ember',
    set: 'set.craft',
  },
  'weapon.frost': {
    id: 'weapon.frost',
    name: 'Arma de Gelo',
    slot: 'WEAPON',
    rarity: 'RARE',
    bonus: { damagePct: 5, critChance: 3 },
    art: 'weapon-frost',
    look: 'frost',
    set: 'set.arcane',
  },
  'weapon.gold': {
    id: 'weapon.gold',
    name: 'Arma Dourada',
    slot: 'WEAPON',
    rarity: 'EPIC',
    bonus: { damagePct: 9, maxEnergy: 3 },
    art: 'weapon-gold',
    look: 'gold',
    set: 'set.royal',
  },
  'cape.red': {
    id: 'cape.red',
    name: 'Capa Vermelha',
    slot: 'CAPE',
    rarity: 'COMMON',
    bonus: { maxHp: 7 },
    art: 'cape-red',
    look: 'red',
    set: 'set.cozy',
  },
  'cape.travel': {
    id: 'cape.travel',
    name: 'Capa de Viagem',
    slot: 'CAPE',
    rarity: 'RARE',
    bonus: { shieldPct: 10, maxEnergy: 3 },
    art: 'cape-travel',
    look: 'travel',
    set: 'set.craft',
  },
  'cape.night': {
    id: 'cape.night',
    name: 'Capa Estrelada',
    slot: 'CAPE',
    rarity: 'EPIC',
    bonus: { critChance: 5, maxHp: 8 },
    art: 'cape-night',
    look: 'night',
    set: 'set.royal',
  },
  'charm.clover': {
    id: 'charm.clover',
    name: 'Trevo de Quatro Folhas',
    slot: 'CHARM',
    rarity: 'COMMON',
    bonus: { critChance: 4 },
    art: 'charm-clover',
    set: 'set.luck',
  },
  'charm.heart': {
    id: 'charm.heart',
    name: 'Coração de Pelúcia',
    slot: 'CHARM',
    rarity: 'COMMON',
    bonus: { maxHp: 8 },
    art: 'charm-heart',
    set: 'set.cozy',
  },
  'charm.hourglass': {
    id: 'charm.hourglass',
    name: 'Ampulheta',
    slot: 'CHARM',
    rarity: 'RARE',
    bonus: { maxEnergy: 4 },
    art: 'charm-hourglass',
    set: 'set.arcane',
  },
  'charm.star': {
    id: 'charm.star',
    name: 'Estrela Dourada',
    slot: 'CHARM',
    rarity: 'EPIC',
    bonus: { damagePct: 10 },
    art: 'charm-star',
    set: 'set.royal',
  },
};

export const GEAR_IDS = Object.keys(GEAR) as GearId[];

export const GEAR_SETS: Record<GearSetId, GearSet> = {
  'set.luck': {
    id: 'set.luck',
    name: 'Sorte Grande',
    pieces: ['hat.cap', 'charm.clover'],
    bonus: { critChance: 4 },
  },
  'set.cozy': {
    id: 'set.cozy',
    name: 'Aconchego',
    pieces: ['hat.beanie', 'cape.red', 'charm.heart'],
    bonus: { maxHp: 8 },
  },
  'set.craft': {
    id: 'set.craft',
    name: 'Mão na Massa',
    pieces: ['hat.hardhat', 'weapon.ember', 'cape.travel'],
    bonus: { damagePct: 5 },
  },
  'set.arcane': {
    id: 'set.arcane',
    name: 'Arcano',
    pieces: ['hat.pointy', 'weapon.frost', 'charm.hourglass'],
    bonus: { maxEnergy: 3 },
  },
  'set.royal': {
    id: 'set.royal',
    name: 'Realeza',
    pieces: ['hat.crown', 'weapon.gold', 'cape.night', 'charm.star'],
    bonus: { damagePct: 5 },
  },
};

export const GEAR_SET_IDS = Object.keys(GEAR_SETS) as GearSetId[];
/** Peças vestidas do mesmo conjunto para o bônus valer. */
export const SET_PIECES_NEEDED = 2;

export const POTIONS: Record<PotionId, Potion> = {
  'potion.water': {
    id: 'potion.water',
    name: "Garrafa d'Água",
    effect: 'Recupera 35% da vida',
    art: 'potion-water',
    healPct: 35,
  },
  'potion.coffee': {
    id: 'potion.coffee',
    name: 'Café Forte',
    effect: 'Recupera 60% da energia',
    art: 'potion-coffee',
    energyPct: 60,
  },
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

/** Poções usadas por luta. */
export const MAX_POTIONS_PER_BATTLE = 2;
/** Teto de cada poção na mochila. */
export const POTION_CAP = 9;
/** Teto de fragmentos guardados. */
export const FRAGMENT_CAP = 99;

/** Chance de deixar algo, por dificuldade (luta comum). */
export const DROP_CHANCE: Record<'EASY' | 'MEDIUM' | 'HARD', number> = {
  EASY: 0.3,
  MEDIUM: 0.45,
  HARD: 0.6,
};

/** Fragmentos que uma peça repetida vira, pela raridade dela. */
export const DUPLICATE_FRAGMENTS: Record<Rarity, number> = { COMMON: 2, RARE: 4, EPIC: 6 };

/** Fragmentos para subir um passo, pela raridade atual da peça. */
export const UPGRADE_COST: Record<Exclude<Rarity, 'EPIC'>, number> = { COMMON: 5, RARE: 10 };
/** Cada passo de aprimoramento soma 50% ao bônus original. */
export const UPGRADE_STEP_BONUS = 0.5;

/**
 * Quando a raridade sorteada ainda tem peça nova, ela vem nesta proporção das vezes.
 * No resto, sai uma peça qualquer da raridade e, se repetida, vira fragmentos.
 */
const NEW_PIECE_SHARE = 0.75;

/** Dos itens que caem, quantos são equipamento (o resto é poção). */
const GEAR_SHARE: Record<LootSource, number> = { NORMAL: 0.35, ELITE: 0.7, BOSS: 1 };

/** Peso de cada raridade quando cai equipamento. */
const RARITY_WEIGHTS: Record<LootSource, Record<Rarity, number>> = {
  NORMAL: { COMMON: 70, RARE: 27, EPIC: 3 },
  ELITE: { COMMON: 30, RARE: 55, EPIC: 15 },
  BOSS: { COMMON: 0, RARE: 40, EPIC: 60 },
};

function emptyEquipped(): Record<GearSlot, GearId | null> {
  return { HEAD: null, WEAPON: null, CAPE: null, CHARM: null };
}

export function emptyInventory(): Inventory {
  return {
    gear: [],
    equipped: emptyEquipped(),
    potions: { 'potion.water': 1, 'potion.coffee': 0 },
    fragments: 0,
    upgrades: {},
  };
}

/** Mesmo gerador da batalha (mulberry32), para a semente valer igual. */
function nextRandom(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

function pickRarity(value: number, source: LootSource): Rarity {
  const weights = RARITY_WEIGHTS[source];
  const total = weights.COMMON + weights.RARE + weights.EPIC;
  let cursor = value * total;
  for (const rarity of RARITY_ORDER) {
    cursor -= weights[rarity];
    if (cursor < 0) return rarity;
  }
  return 'EPIC';
}

/**
 * Sorteia o que o monstro deixa. Null = nada desta vez.
 * Peça nova é a mais provável; peça repetida vira fragmentos.
 */
export function rollLoot(input: {
  seed: number;
  source: LootSource;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  owned: readonly GearId[];
}): LootDrop | null {
  let rng = (input.seed ^ 0x9e3779b9) >>> 0;
  const draw = (): number => {
    const [value, next] = nextRandom(rng);
    rng = next;
    return value;
  };

  const chance = input.source === 'NORMAL' ? DROP_CHANCE[input.difficulty] : 1;
  if (draw() >= chance) return null;

  if (draw() >= GEAR_SHARE[input.source]) {
    return {
      type: 'POTION',
      id: draw() < 0.6 ? 'potion.water' : 'potion.coffee',
      amount: input.source === 'NORMAL' ? 1 : 2,
    };
  }

  const owned = new Set(input.owned);
  const rarity = pickRarity(draw(), input.source);
  const pool = GEAR_IDS.filter((id) => GEAR[id].rarity === rarity);
  const fresh = pool.filter((id) => !owned.has(id));
  const preferFresh = draw() < NEW_PIECE_SHARE;
  const from = fresh.length > 0 && preferFresh ? fresh : pool;
  const id = from[Math.floor(draw() * from.length)];
  if (!owned.has(id)) return { type: 'GEAR', id };
  return { type: 'FRAGMENTS', amount: DUPLICATE_FRAGMENTS[rarity], from: id };
}

/** Guarda o item na mochila. Poção e fragmento respeitam o teto. */
export function addLoot(inventory: Inventory, drop: LootDrop): Inventory {
  if (drop.type === 'POTION') {
    return {
      ...inventory,
      potions: {
        ...inventory.potions,
        [drop.id]: Math.min(POTION_CAP, inventory.potions[drop.id] + drop.amount),
      },
    };
  }
  if (drop.type === 'FRAGMENTS') {
    return {
      ...inventory,
      fragments: Math.min(FRAGMENT_CAP, inventory.fragments + Math.max(0, drop.amount)),
    };
  }
  if (inventory.gear.includes(drop.id)) {
    return addLoot(inventory, {
      type: 'FRAGMENTS',
      amount: DUPLICATE_FRAGMENTS[GEAR[drop.id].rarity],
    });
  }
  const gear = GEAR[drop.id];
  // Primeira peça do espaço já vai para o corpo: o jogador vê o item na hora.
  const equipped =
    inventory.equipped[gear.slot] == null
      ? { ...inventory.equipped, [gear.slot]: drop.id }
      : inventory.equipped;
  return { ...inventory, gear: [...inventory.gear, drop.id], equipped };
}

/** Veste a peça (troca a do mesmo espaço). Null se o herói não tem a peça. */
export function equipGear(inventory: Inventory, id: GearId): Inventory | null {
  if (!inventory.gear.includes(id)) return null;
  return { ...inventory, equipped: { ...inventory.equipped, [GEAR[id].slot]: id } };
}

export function unequipSlot(inventory: Inventory, slot: GearSlot): Inventory {
  return { ...inventory, equipped: { ...inventory.equipped, [slot]: null } };
}

/** Desconta as poções gastas na luta. */
export function spendPotions(inventory: Inventory, used: Partial<PotionStock>): Inventory {
  const potions = { ...inventory.potions };
  for (const id of POTION_IDS) {
    potions[id] = Math.max(0, potions[id] - Math.max(0, Math.floor(used[id] ?? 0)));
  }
  return { ...inventory, potions };
}

export function upgradeLevel(inventory: Inventory, id: GearId): number {
  return inventory.upgrades[id] ?? 0;
}

/** Raridade mostrada: a de origem mais os passos de aprimoramento. */
export function effectiveRarity(id: GearId, level: number): Rarity {
  const start = RARITY_ORDER.indexOf(GEAR[id].rarity);
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, start + Math.max(0, level))];
}

/** Custo do próximo passo. Null = já é épica. */
export function upgradeCost(inventory: Inventory, id: GearId): number | null {
  const rarity = effectiveRarity(id, upgradeLevel(inventory, id));
  return rarity === 'EPIC' ? null : UPGRADE_COST[rarity];
}

export type UpgradeBlock = 'NOT_OWNED' | 'MAXED' | 'NO_FRAGMENTS';

export function upgradeBlock(inventory: Inventory, id: GearId): UpgradeBlock | null {
  if (!inventory.gear.includes(id)) return 'NOT_OWNED';
  const cost = upgradeCost(inventory, id);
  if (cost == null) return 'MAXED';
  if (inventory.fragments < cost) return 'NO_FRAGMENTS';
  return null;
}

/** Gasta fragmentos e sobe a peça uma raridade. Null quando não dá. */
export function upgradeGear(inventory: Inventory, id: GearId): Inventory | null {
  if (upgradeBlock(inventory, id) != null) return null;
  const cost = upgradeCost(inventory, id) ?? 0;
  return {
    ...inventory,
    fragments: inventory.fragments - cost,
    upgrades: { ...inventory.upgrades, [id]: upgradeLevel(inventory, id) + 1 },
  };
}

/** Bônus da peça com o aprimoramento (cada passo +50%, arredondado). */
export function gearPieceBonus(id: GearId, level: number): Partial<HeroBonus> {
  const factor = 1 + UPGRADE_STEP_BONUS * Math.max(0, level);
  const bonus: Partial<HeroBonus> = {};
  for (const [key, value] of Object.entries(GEAR[id].bonus) as [keyof HeroBonus, number][]) {
    bonus[key] = Math.round(value * factor);
  }
  return bonus;
}

const BONUS_TEXT: readonly [keyof HeroBonus, (value: number) => string][] = [
  ['damagePct', (value) => `+${value}% de dano`],
  ['critChance', (value) => `+${value}% de crítico`],
  ['maxHp', (value) => `+${value} de vida`],
  ['maxEnergy', (value) => `+${value} de energia`],
  ['shieldPct', (value) => `+${value}% de escudo`],
];

/** "+8% de dano e +4% de crítico". */
export function bonusText(bonus: Partial<HeroBonus>): string {
  const parts = BONUS_TEXT.filter(([key]) => (bonus[key] ?? 0) > 0).map(([key, text]) =>
    text(bonus[key] ?? 0),
  );
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** Efeito da peça em uma linha, já com o aprimoramento. */
export function gearEffect(id: GearId, level = 0): string {
  return bonusText(gearPieceBonus(id, level));
}

/** Junta bônus de talento e de equipamento. */
export function mergeBonus(...parts: Partial<HeroBonus>[]): HeroBonus {
  const total: HeroBonus = { damagePct: 0, maxHp: 0, critChance: 0, shieldPct: 0, maxEnergy: 0 };
  for (const part of parts) {
    for (const [key, value] of Object.entries(part) as [keyof HeroBonus, number][]) {
      total[key] += value ?? 0;
    }
  }
  return total;
}

function wornIds(inventory: Inventory): GearId[] {
  return Object.values(inventory.equipped).filter((id): id is GearId => id != null);
}

export interface SetProgress {
  set: GearSet;
  worn: number;
  active: boolean;
}

/** Conjuntos com pelo menos uma peça vestida. */
export function setProgress(inventory: Inventory): SetProgress[] {
  const worn = new Set(wornIds(inventory));
  return GEAR_SET_IDS.map((id) => {
    const set = GEAR_SETS[id];
    const count = set.pieces.filter((piece) => worn.has(piece)).length;
    return { set, worn: count, active: count >= SET_PIECES_NEEDED };
  }).filter((entry) => entry.worn > 0);
}

/** Soma dos bônus do que está vestido, com aprimoramentos e conjuntos. */
export function gearBonus(inventory: Inventory): HeroBonus {
  const pieces = wornIds(inventory).map((id) => gearPieceBonus(id, upgradeLevel(inventory, id)));
  const sets = setProgress(inventory)
    .filter((entry) => entry.active)
    .map((entry) => entry.set.bonus);
  return mergeBonus(...pieces, ...sets);
}

/** O chapéu que o herói veste (`cap`, `crown`…) ou null. */
export function heroLook(inventory: Inventory): string | null {
  const head = inventory.equipped.HEAD;
  return head ? (GEAR[head].look ?? null) : null;
}

/** Chave da arte do herói com o chapéu vestido (`hero.mage+crown`). */
export function heroArtKey(characterClass: string, inventory: Inventory): string {
  const look = heroLook(inventory);
  return `hero.${characterClass.toLowerCase()}${look ? `+${look}` : ''}`;
}

/** Camadas da arte do herói: capa por baixo, arma por cima (`layer.mage+cape-red`). */
export interface HeroLayers {
  under: string[];
  over: string[];
}

export const NO_LAYERS: HeroLayers = { under: [], over: [] };

export function heroLayers(characterClass: string, inventory: Inventory): HeroLayers {
  const cls = characterClass.toLowerCase();
  const cape = inventory.equipped.CAPE;
  const weapon = inventory.equipped.WEAPON;
  return {
    under: cape && GEAR[cape].look ? [`layer.${cls}+cape-${GEAR[cape].look}`] : [],
    over: weapon && GEAR[weapon].look ? [`layer.${cls}+weapon-${GEAR[weapon].look}`] : [],
  };
}

/** Texto curto do item que caiu ("Boné da Sorte" / "2× Café Forte" / "4 fragmentos"). */
export function lootLabel(drop: LootDrop): string {
  if (drop.type === 'GEAR') return GEAR[drop.id].name;
  if (drop.type === 'FRAGMENTS') return `${drop.amount} fragmentos`;
  const name = POTIONS[drop.id].name;
  return drop.amount > 1 ? `${drop.amount}× ${name}` : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGearId(value: unknown): value is GearId {
  return typeof value === 'string' && value in GEAR;
}

function toCount(value: unknown, cap: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(cap, Math.floor(value)))
    : 0;
}

/** Mochila de qualquer JSON. Save antigo começa com uma garrafa d'água. */
export function sanitizeInventory(raw: unknown): Inventory {
  const base = emptyInventory();
  if (!isRecord(raw)) return base;
  const gear: GearId[] = [];
  if (Array.isArray(raw.gear)) {
    for (const id of raw.gear) if (isGearId(id) && !gear.includes(id)) gear.push(id);
  }
  const equipped = emptyEquipped();
  if (isRecord(raw.equipped)) {
    for (const slot of SLOTS) {
      const id = raw.equipped[slot];
      if (isGearId(id) && gear.includes(id) && GEAR[id].slot === slot) equipped[slot] = id;
    }
  }
  const potions = { ...base.potions };
  if (isRecord(raw.potions)) {
    for (const id of POTION_IDS) potions[id] = toCount(raw.potions[id], POTION_CAP);
  }
  const upgrades: Partial<Record<GearId, number>> = {};
  if (isRecord(raw.upgrades)) {
    for (const id of gear) {
      const max = RARITY_ORDER.length - 1 - RARITY_ORDER.indexOf(GEAR[id].rarity);
      const level = toCount(raw.upgrades[id], max);
      if (level > 0) upgrades[id] = level;
    }
  }
  return { gear, equipped, potions, fragments: toCount(raw.fragments, FRAGMENT_CAP), upgrades };
}
