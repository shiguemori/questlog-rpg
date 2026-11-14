import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  bonusText,
  effectiveRarity,
  equipGear,
  GEAR,
  GEAR_IDS,
  GEAR_SETS,
  gearBonus,
  gearEffect,
  MAX_POTIONS_PER_BATTLE,
  POTION_IDS,
  POTIONS,
  RARITY_LABELS,
  setProgress,
  SLOT_LABELS,
  SLOTS,
  unequipSlot,
  upgradeBlock,
  upgradeCost,
  upgradeGear,
  upgradeLevel,
  type GearId,
} from '../../domain/loot';
import type { AppState } from '../../domain/types';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { ITEM_ART } from '../actorArt';
import { RARITY_COLORS } from '../battle/lootView';

/**
 * Mochila: o que o herói veste (chapéu, arma e capa aparecem na arte), os conjuntos,
 * a coleção, os fragmentos para aprimorar e as poções. Item não encontrado fica em silhueta.
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
  const bonus = bonusText(gearBonus(inventory));
  const sets = setProgress(inventory);
  const [selected, setSelected] = useState<GearId | null>(null);
  const picked = selected && owned.has(selected) ? selected : null;

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

  const upgrade = (id: GearId) => {
    onHeroChange((current) => {
      const next = upgradeGear(current.inventory, id);
      return next ? { ...current, inventory: next } : null;
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.slots}>
        {SLOTS.map((slot) => {
          const id = inventory.equipped[slot];
          const level = id ? upgradeLevel(inventory, id) : 0;
          const rarity = id ? effectiveRarity(id, level) : null;
          return (
            <View
              key={slot}
              style={styles.slot}
              accessible
              accessibilityLabel={`${SLOT_LABELS[slot]}: ${id ? GEAR[id].name : 'vazio'}`}
            >
              <View
                style={[
                  styles.socket,
                  rarity ? { borderColor: RARITY_COLORS[rarity] } : styles.socketEmpty,
                ]}
              >
                {id ? (
                  <Image
                    source={ITEM_ART[GEAR[id].art]}
                    style={styles.slotArt}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
              <Text style={styles.slotLabel}>{SLOT_LABELS[slot]}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.bonus}>
        {bonus ? `Vestindo: ${bonus}.` : 'Nada vestido. Toque num item e depois em Vestir.'}
      </Text>
      {sets.length > 0 ? (
        <View style={styles.sets}>
          {sets.map((entry) => (
            <Text key={entry.set.id} style={[styles.setLine, entry.active && styles.setLineActive]}>
              {entry.set.name} {entry.worn}/{entry.set.pieces.length}
              {entry.active
                ? ` · ${bonusText(entry.set.bonus)}`
                : ` · com 2 peças: ${bonusText(entry.set.bonus)}`}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>
          Equipamento {inventory.gear.length}/{GEAR_IDS.length}
        </Text>
        <Text style={styles.fragments} accessibilityLabel={`${inventory.fragments} fragmentos`}>
          {inventory.fragments} fragmentos
        </Text>
      </View>
      {inventory.gear.length === 0 ? (
        <Text style={styles.empty}>
          Vença lutas para encontrar itens. Monstros de elite e o chefe da semana sempre deixam
          algo. Peça repetida vira fragmentos.
        </Text>
      ) : null}
      <View style={styles.grid}>
        {GEAR_IDS.map((id) => {
          const gear = GEAR[id];
          const has = owned.has(id);
          const worn = inventory.equipped[gear.slot] === id;
          const level = upgradeLevel(inventory, id);
          const rarity = effectiveRarity(id, level);
          const isPicked = picked === id;
          return (
            <Pressable
              key={id}
              disabled={!has}
              onPress={() => setSelected(isPicked ? null : id)}
              style={({ pressed }) => [
                styles.item,
                worn && styles.itemWorn,
                isPicked && styles.itemPicked,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !has, selected: isPicked }}
              accessibilityLabel={
                has
                  ? `${gear.name}, ${RARITY_LABELS[rarity]}, ${SLOT_LABELS[gear.slot]}. ${gearEffect(id, level)}.${worn ? ' Vestido.' : ''}`
                  : `Item ainda não encontrado, ${RARITY_LABELS[gear.rarity]}`
              }
              accessibilityHint={has ? 'Toque para vestir ou aprimorar.' : undefined}
              testID={`gear-${id}`}
            >
              <View
                style={[
                  styles.itemSocket,
                  { borderColor: has ? RARITY_COLORS[rarity] : colors.border },
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
              <Text style={[styles.itemMeta, { color: RARITY_COLORS[rarity] }]}>
                {RARITY_LABELS[has ? rarity : gear.rarity]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {picked ? (
        <GearDetail
          state={state}
          id={picked}
          onToggle={() => toggle(picked)}
          onUpgrade={() => upgrade(picked)}
        />
      ) : null}

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
                <Text style={styles.potionEffect}>{potion.effect}</Text>
              </View>
              <Text style={styles.potionCount}>×{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Painel da peça escolhida: vestir/tirar (ação principal) e aprimorar. */
function GearDetail({
  state,
  id,
  onToggle,
  onUpgrade,
}: {
  state: AppState;
  id: GearId;
  onToggle: () => void;
  onUpgrade: () => void;
}) {
  const { inventory } = state;
  const gear = GEAR[id];
  const level = upgradeLevel(inventory, id);
  const rarity = effectiveRarity(id, level);
  const worn = inventory.equipped[gear.slot] === id;
  const cost = upgradeCost(inventory, id);
  const block = upgradeBlock(inventory, id);
  const next = cost != null ? effectiveRarity(id, level + 1) : null;
  const set = gear.set ? GEAR_SETS[gear.set] : null;

  return (
    <View style={styles.detail} testID="gear-detail">
      <View style={styles.detailHead}>
        <Image source={ITEM_ART[gear.art]} style={styles.detailArt} resizeMode="contain" />
        <View style={styles.detailCopy}>
          <Text style={styles.detailName}>{gear.name}</Text>
          <Text style={[styles.detailRarity, { color: RARITY_COLORS[rarity] }]}>
            {RARITY_LABELS[rarity]} · {SLOT_LABELS[gear.slot]}
          </Text>
          <Text style={styles.detailEffect}>{gearEffect(id, level)}</Text>
          {set ? <Text style={styles.detailSet}>Conjunto {set.name}</Text> : null}
        </View>
      </View>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="gear-toggle"
      >
        <Text style={styles.primaryText}>{worn ? 'Tirar' : 'Vestir'}</Text>
      </Pressable>
      {cost != null && next ? (
        <Pressable
          onPress={onUpgrade}
          disabled={block != null}
          style={({ pressed }) => [
            styles.secondary,
            block != null && styles.secondaryOff,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: block != null }}
          accessibilityLabel={`Aprimorar para ${RARITY_LABELS[next]} por ${cost} fragmentos`}
          testID="gear-upgrade"
        >
          <Text style={[styles.secondaryText, block != null && styles.secondaryTextOff]}>
            Aprimorar para {RARITY_LABELS[next]} · {cost} fragmentos
          </Text>
          <Text style={styles.secondaryHint}>
            {block === 'NO_FRAGMENTS'
              ? `Faltam ${cost - inventory.fragments} fragmentos.`
              : `Fica ${gearEffect(id, level + 1)}.`}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.detailMax}>Raridade máxima.</Text>
      )}
    </View>
  );
}

const ITEM_PAD = space.sm;

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  slots: { flexDirection: 'row', gap: space.sm },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
  },
  socket: {
    width: 56,
    height: 56,
    borderRadius: Math.max(4, radius.md - space.xs),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  socketEmpty: { borderColor: colors.border, borderStyle: 'dashed' },
  slotArt: { width: 44, height: 44 },
  slotLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  bonus: { fontSize: 14, color: colors.amberSoft, fontWeight: '700' },
  sets: { gap: space.xs },
  setLine: { fontSize: 13, color: colors.textMuted },
  setLineActive: { color: colors.text, fontWeight: '700' },
  sectionRow: {
    marginTop: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  section: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  fragments: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
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
  itemWorn: { borderColor: colors.border },
  itemPicked: { borderColor: colors.amber },
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
  itemMeta: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  detail: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  detailHead: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  detailArt: { width: 56, height: 56 },
  detailCopy: { flex: 1, minWidth: 0, gap: 2 },
  detailName: { fontSize: 16, fontWeight: '800', color: colors.text },
  detailRarity: { fontSize: 13, fontWeight: '800' },
  detailEffect: { fontSize: 14, color: colors.text },
  detailSet: { fontSize: 13, color: colors.textMuted },
  detailMax: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  primary: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '900', color: colors.bg },
  secondary: {
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  secondaryOff: { opacity: 0.7 },
  secondaryText: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  secondaryTextOff: { color: colors.textMuted },
  secondaryHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
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
  potionEffect: { fontSize: 12, color: colors.textMuted },
  potionCount: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  pressed: { opacity: 0.85 },
});
