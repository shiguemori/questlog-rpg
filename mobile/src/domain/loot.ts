import type { HeroBonus } from './battle';

/**
 * Loot: o que o monstro derrotado pode deixar e a mochila do herói.
 *
 * - Equipamento (chapéu e amuleto) dá bônus pequeno e permanente. O chapéu aparece no herói.
 * - Poções são de uso único na batalha (no máximo 2 por luta).
 * - O sorteio usa a semente da luta: a mesma luta sempre deixa o mesmo item.
 * - Não existe loja: item só vem de luta (fora do MVP: loja de cosméticos).
 */

export type Rarity = 'COMMON' | 'RARE' | 'EPIC';
export type GearSlot = 'HEAD' | 'CHARM';
export type GearId =
  | 'hat.cap'
  | 'hat.beanie'
  | 'hat.hardhat'
  | 'hat.pointy'
  | 'hat.crown'
  | 'charm.clover'
  | 'charm.heart'
  | 'charm.hourglass'
  | 'charm.star';
export type PotionId = 'potion.water' | 'potion.coffee';

/** De onde veio a luta. Elite e chefe sempre deixam item. */
export type LootSource = 'NORMAL' | 'ELITE' | 'BOSS';

export interface Gear {
  id: GearId;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  /** Efeito em uma linha ("+3% de crítico"). */
  effect: string;
  bonus: Partial<HeroBonus>;
  /** Chave da arte do ícone (`assets/items`). */
  art: string;
  /** Só chapéus: o visual que o herói veste (`hero.mage+cap`). */
  look?: string;
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
}

export type LootDrop =
  { type: 'GEAR'; id: GearId } | { type: 'POTION'; id: PotionId; amount: number };

export const RARITY_LABELS: Record<Rarity, string> = {
  COMMON: 'Comum',
  RARE: 'Raro',
  EPIC: 'Épico',
};

export const SLOT_LABELS: Record<GearSlot, string> = {
  HEAD: 'Chapéu',
  CHARM: 'Amuleto',
};

export const GEAR: Record<GearId, Gear> = {
  'hat.cap': {
    id: 'hat.cap',
    name: 'Boné da Sorte',
    slot: 'HEAD',
    rarity: 'COMMON',
    effect: '+3% de crítico',
    bonus: { critChance: 3 },
    art: 'hat-cap',
    look: 'cap',
  },
  'hat.beanie': {
    id: 'hat.beanie',
    name: 'Gorro de Lã',
    slot: 'HEAD',
    rarity: 'COMMON',
    effect: '+6 de vida',
    bonus: { maxHp: 6 },
    art: 'hat-beanie',
    look: 'beanie',
  },
  'hat.hardhat': {
    id: 'hat.hardhat',
    name: 'Capacete de Obra',
    slot: 'HEAD',
    rarity: 'RARE',
    effect: '+15% de escudo e +4 de vida',
    bonus: { shieldPct: 15, maxHp: 4 },
    art: 'hat-hardhat',
    look: 'hardhat',
  },
  'hat.pointy': {
    id: 'hat.pointy',
    name: 'Chapéu Pontudo',
    slot: 'HEAD',
    rarity: 'RARE',
    effect: '+3 de energia e +4% de dano',
    bonus: { maxEnergy: 3, damagePct: 4 },
    art: 'hat-pointy',
    look: 'pointy',
  },
  'hat.crown': {
    id: 'hat.crown',
    name: 'Coroa da Rotina',
    slot: 'HEAD',
    rarity: 'EPIC',
    effect: '+8% de dano e +4% de crítico',
    bonus: { damagePct: 8, critChance: 4 },
    art: 'hat-crown',
    look: 'crown',
  },
  'charm.clover': {
    id: 'charm.clover',
    name: 'Trevo de Quatro Folhas',
    slot: 'CHARM',
    rarity: 'COMMON',
    effect: '+4% de crítico',
    bonus: { critChance: 4 },
    art: 'charm-clover',
  },
  'charm.heart': {
    id: 'charm.heart',
    name: 'Coração de Pelúcia',
    slot: 'CHARM',
    rarity: 'COMMON',
    effect: '+8 de vida',
    bonus: { maxHp: 8 },
    art: 'charm-heart',
  },
  'charm.hourglass': {
    id: 'charm.hourglass',
    name: 'Ampulheta',
    slot: 'CHARM',
    rarity: 'RARE',
    effect: '+4 de energia',
    bonus: { maxEnergy: 4 },
    art: 'charm-hourglass',
  },
  'charm.star': {
    id: 'charm.star',
    name: 'Estrela Dourada',
    slot: 'CHARM',
    rarity: 'EPIC',
    effect: '+10% de dano',
    bonus: { damagePct: 10 },
    art: 'charm-star',
  },
};

export const GEAR_IDS = Object.keys(GEAR) as GearId[];

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

/** Chance de deixar algo, por dificuldade (luta comum). */
export const DROP_CHANCE: Record<'EASY' | 'MEDIUM' | 'HARD', number> = {
  EASY: 0.3,
  MEDIUM: 0.45,
  HARD: 0.6,
};

/** Dos itens que caem, quantos são equipamento (o resto é poção). */
const GEAR_SHARE: Record<LootSource, number> = { NORMAL: 0.35, ELITE: 0.7, BOSS: 1 };

/** Peso de cada raridade quando cai equipamento. */
const RARITY_WEIGHTS: Record<LootSource, Record<Rarity, number>> = {
  NORMAL: { COMMON: 70, RARE: 27, EPIC: 3 },
  ELITE: { COMMON: 30, RARE: 55, EPIC: 15 },
  BOSS: { COMMON: 0, RARE: 40, EPIC: 60 },
};

export function emptyInventory(): Inventory {
  return {
    gear: [],
    equipped: { HEAD: null, CHARM: null },
    potions: { 'potion.water': 1, 'potion.coffee': 0 },
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
  for (const rarity of ['COMMON', 'RARE', 'EPIC'] as const) {
    cursor -= weights[rarity];
    if (cursor < 0) return rarity;
  }
  return 'EPIC';
}

/** Ordem de tentativa quando a raridade sorteada já está completa na mochila. */
const RARITY_FALLBACK: Record<Rarity, readonly Rarity[]> = {
  COMMON: ['COMMON', 'RARE', 'EPIC'],
  RARE: ['RARE', 'EPIC', 'COMMON'],
  EPIC: ['EPIC', 'RARE', 'COMMON'],
};

/**
 * Sorteia o que o monstro deixa. Null = nada desta vez.
 * Equipamento repetido não cai: vira outra peça ou, se a coleção estiver completa, poção.
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

  const potion = (): LootDrop => ({
    type: 'POTION',
    id: draw() < 0.6 ? 'potion.water' : 'potion.coffee',
    amount: input.source === 'NORMAL' ? 1 : 2,
  });

  if (draw() >= GEAR_SHARE[input.source]) return potion();

  const owned = new Set(input.owned);
  const rolled = pickRarity(draw(), input.source);
  for (const rarity of RARITY_FALLBACK[rolled]) {
    if (RARITY_WEIGHTS[input.source][rarity] === 0) continue;
    const open = GEAR_IDS.filter((id) => GEAR[id].rarity === rarity && !owned.has(id));
    if (open.length > 0) return { type: 'GEAR', id: open[Math.floor(draw() * open.length)] };
  }
  return potion();
}

/** Guarda o item na mochila. Poção respeita o teto. */
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
  if (inventory.gear.includes(drop.id)) return inventory;
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

/** Soma dos bônus do que está vestido. */
export function gearBonus(inventory: Inventory): HeroBonus {
  const worn = Object.values(inventory.equipped).filter((id): id is GearId => id != null);
  return mergeBonus(...worn.map((id) => GEAR[id].bonus));
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

/** Texto curto do item que caiu ("Boné da Sorte" / "2× Café Forte"). */
export function lootLabel(drop: LootDrop): string {
  if (drop.type === 'GEAR') return GEAR[drop.id].name;
  const name = POTIONS[drop.id].name;
  return drop.amount > 1 ? `${drop.amount}× ${name}` : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGearId(value: unknown): value is GearId {
  return typeof value === 'string' && value in GEAR;
}

/** Mochila de qualquer JSON. Save antigo começa com uma garrafa d'água. */
export function sanitizeInventory(raw: unknown): Inventory {
  const base = emptyInventory();
  if (!isRecord(raw)) return base;
  const gear: GearId[] = [];
  if (Array.isArray(raw.gear)) {
    for (const id of raw.gear) if (isGearId(id) && !gear.includes(id)) gear.push(id);
  }
  const equipped: Record<GearSlot, GearId | null> = { HEAD: null, CHARM: null };
  if (isRecord(raw.equipped)) {
    for (const slot of ['HEAD', 'CHARM'] as const) {
      const id = raw.equipped[slot];
      if (isGearId(id) && gear.includes(id) && GEAR[id].slot === slot) equipped[slot] = id;
    }
  }
  const potions = { ...base.potions };
  if (isRecord(raw.potions)) {
    for (const id of POTION_IDS) {
      const count = raw.potions[id];
      potions[id] =
        typeof count === 'number' && Number.isFinite(count)
          ? Math.max(0, Math.min(POTION_CAP, Math.floor(count)))
          : 0;
    }
  }
  return { gear, equipped, potions };
}
