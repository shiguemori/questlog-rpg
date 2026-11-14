import {
  GEAR,
  gearEffect,
  lootLabel,
  POTIONS,
  RARITY_LABELS,
  type LootDrop,
  type Rarity,
} from '../../domain/loot';
import { ITEM_ART } from '../actorArt';
import type { LootView } from './BattleMoments';

/** Cor de cada raridade (moldura do item e rótulo). Convenção de RPG: cinza, azul, roxo. */
export const RARITY_COLORS: Record<Rarity, string> = {
  COMMON: '#CBD5E1',
  RARE: '#60A5FA',
  EPIC: '#C084FC',
};

/** Item que caiu → cartão do resultado da batalha. */
export function lootViewOf(drop: LootDrop | null): LootView | null {
  if (!drop) return null;
  if (drop.type === 'GEAR') {
    const gear = GEAR[drop.id];
    return {
      name: gear.name,
      rarityLabel: RARITY_LABELS[gear.rarity],
      rarityColor: RARITY_COLORS[gear.rarity],
      effect: gearEffect(drop.id),
      art: ITEM_ART[gear.art],
      chest: ITEM_ART.chest,
    };
  }
  if (drop.type === 'FRAGMENTS') {
    return {
      name: lootLabel(drop),
      effect: drop.from
        ? `${GEAR[drop.from].name} repetido virou fragmentos. Use na mochila para aprimorar.`
        : 'Use na mochila para aprimorar um equipamento.',
      art: ITEM_ART.fragment,
      chest: ITEM_ART.chest,
    };
  }
  const potion = POTIONS[drop.id];
  return {
    name: lootLabel(drop),
    effect: potion.effect,
    art: ITEM_ART[potion.art],
    chest: ITEM_ART.chest,
  };
}
