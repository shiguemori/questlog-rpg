import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  equipGear,
  GEAR,
  GEAR_IDS,
  gearBonus,
  MAX_POTIONS_PER_BATTLE,
  POTION_IDS,
  POTIONS,
  RARITY_LABELS,
  SLOT_LABELS,
  unequipSlot,
  type GearId,
  type GearSlot,
} from '../../domain/loot';
import type { AppState } from '../../domain/types';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { ITEM_ART } from '../actorArt';
import { RARITY_COLORS } from '../battle/lootView';

const SLOTS: readonly GearSlot[] = ['HEAD', 'CHARM'];

/** "+3% de crítico, +8 de vida" a partir do que está vestido. */
function bonusLine(state: AppState): string | null {
  const bonus = gearBonus(state.inventory);
  const parts: string[] = [];
  if (bonus.damagePct) parts.push(`+${bonus.damagePct}% de dano`);
  if (bonus.critChance) parts.push(`+${bonus.critChance}% de crítico`);
  if (bonus.maxHp) parts.push(`+${bonus.maxHp} de vida`);
  if (bonus.maxEnergy) parts.push(`+${bonus.maxEnergy} de energia`);
  if (bonus.shieldPct) parts.push(`+${bonus.shieldPct}% de escudo`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Mochila: o que o herói veste (chapéu aparece na arte), a coleção de equipamentos
 * e as poções. Itens ainda não encontrados aparecem em silhueta.
 */
export function Backpack({
  state,
  onHeroChange,
}: {
  state: AppState;
  onHeroChange: (change: (current: AppState) => AppState | null) => void;
}) {
  const { inventory } = state;
  const owned = new Set(inventory.gear);
  const bonus = bonusLine(state);

  const toggle = (id: GearId) => {
    const slot = GEAR[id].slot;
    onHeroChange((current) => {
      if (current.inventory.equipped[slot] === id) {
        return { ...current, inventory: unequipSlot(current.inventory, slot) };
      }
      const next = equipGear(current.inventory, id);
      return next ? { ...current, inventory: next } : null;
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.slots}>
        {SLOTS.map((slot) => {
          const id = inventory.equipped[slot];
          const gear = id ? GEAR[id] : null;
          return (
            <View key={slot} style={styles.slot}>
              <View
                style={[
                  styles.socket,
                  gear ? { borderColor: RARITY_COLORS[gear.rarity] } : styles.socketEmpty,
                ]}
              >
                {gear ? (
                  <Image source={ITEM_ART[gear.art]} style={styles.slotArt} resizeMode="contain" />
                ) : null}
              </View>
              <Text style={styles.slotLabel}>{SLOT_LABELS[slot]}</Text>
              <Text style={styles.slotName} numberOfLines={2}>
                {gear ? gear.name : 'Vazio'}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.bonus}>
        {bonus ? `Vestindo: ${bonus}.` : 'Nada vestido. Toque num item para vestir.'}
      </Text>

      <Text style={styles.section}>
        Equipamento {inventory.gear.length}/{GEAR_IDS.length}
      </Text>
      {inventory.gear.length === 0 ? (
        <Text style={styles.empty}>
          Vença lutas para encontrar itens. Monstros de elite e o chefe da semana sempre deixam
          algo.
        </Text>
      ) : null}
      <View style={styles.grid}>
        {GEAR_IDS.map((id) => {
          const gear = GEAR[id];
          const has = owned.has(id);
          const worn = inventory.equipped[gear.slot] === id;
          return (
            <Pressable
              key={id}
              disabled={!has}
              onPress={() => toggle(id)}
              style={({ pressed }) => [
                styles.item,
                worn && styles.itemWorn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !has, selected: worn }}
              accessibilityLabel={
                has
                  ? `${gear.name}, ${RARITY_LABELS[gear.rarity]}, ${SLOT_LABELS[gear.slot]}. ${gear.effect}.${worn ? ' Vestido.' : ''}`
                  : `Item ainda não encontrado, ${RARITY_LABELS[gear.rarity]}`
              }
              accessibilityHint={
                has ? (worn ? 'Toque para tirar.' : 'Toque para vestir.') : undefined
              }
              testID={`gear-${id}`}
            >
              <View
                style={[
                  styles.itemSocket,
                  { borderColor: has ? RARITY_COLORS[gear.rarity] : colors.border },
                ]}
              >
                <Image
                  source={ITEM_ART[gear.art]}
                  style={[styles.itemArt, !has && styles.itemArtLocked]}
                  resizeMode="contain"
                />
                {worn ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text style={[styles.itemName, !has && styles.itemNameLocked]} numberOfLines={2}>
                {has ? gear.name : '???'}
              </Text>
              {has ? (
                <Text style={styles.itemEffect} numberOfLines={2}>
                  {gear.effect}
                </Text>
              ) : (
                <Text style={[styles.itemEffect, { color: RARITY_COLORS[gear.rarity] }]}>
                  {RARITY_LABELS[gear.rarity]}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Poções</Text>
      <Text style={styles.empty}>
        Use na batalha, no lugar de um golpe. Até {MAX_POTIONS_PER_BATTLE} por luta.
      </Text>
      <View style={styles.potions}>
        {POTION_IDS.map((id) => {
          const potion = POTIONS[id];
          const count = inventory.potions[id];
          return (
            <View
              key={id}
              style={styles.potion}
              accessible
              accessibilityLabel={`${potion.name}: ${count}. ${potion.effect}.`}
            >
              <Image source={ITEM_ART[potion.art]} style={styles.potionArt} resizeMode="contain" />
              <View style={styles.potionCopy}>
                <Text style={styles.potionName}>{potion.name}</Text>
                <Text style={styles.itemEffect}>{potion.effect}</Text>
              </View>
              <Text style={styles.potionCount}>×{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ITEM_PAD = space.sm;

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  slots: { flexDirection: 'row', gap: space.md },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  socket: {
    width: 72,
    height: 72,
    borderRadius: radius.lg - space.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    marginBottom: space.xs,
  },
  socketEmpty: { borderColor: colors.border, borderStyle: 'dashed' },
  slotArt: { width: 56, height: 56 },
  slotLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  slotName: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  bonus: { fontSize: 14, color: colors.amberSoft, fontWeight: '700' },
  section: { marginTop: space.md, fontSize: 13, fontWeight: '800', color: colors.textMuted },
  empty: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    padding: ITEM_PAD,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemWorn: { borderColor: colors.amber },
  // Raio interno = externo − padding (regra 14).
  itemSocket: {
    width: 60,
    height: 60,
    borderRadius: Math.max(4, radius.md - ITEM_PAD),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    marginBottom: 2,
  },
  itemArt: { width: 46, height: 46 },
  itemArtLocked: { tintColor: '#334155' },
  check: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.amber,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
  },
  itemName: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
  itemNameLocked: { color: colors.textMuted },
  itemEffect: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  potions: { gap: space.sm },
  potion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
  },
  potionArt: { width: 44, height: 44 },
  potionCopy: { flex: 1, minWidth: 0 },
  potionName: { fontSize: 15, fontWeight: '800', color: colors.text },
  potionCount: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  pressed: { opacity: 0.85 },
});
