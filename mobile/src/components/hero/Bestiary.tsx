import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BOSSES } from '../../domain/battle';
import { bestiaryView } from '../../domain/bestiary';
import { CATEGORY_LABELS } from '../../domain/constants';
import type { AppState } from '../../domain/types';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { CharacterArt } from '../CharacterArt';

/**
 * Bestiário: cada monstro dos cômodos e cada chefe, com as vitórias e os jeitos de lutar.
 * Quem ainda não foi vencido aparece em silhueta; jeito não visto fica em "???".
 */
export function Bestiary({ state }: { state: AppState }) {
  const view = bestiaryView(state.bestiary);

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>
        {view.found} de {view.total} vencidos
        {state.bestiary.elites > 0
          ? ` · ${state.bestiary.elites} ${state.bestiary.elites === 1 ? 'elite' : 'elites'}`
          : ''}
      </Text>

      <Text style={styles.section}>Monstros dos cômodos</Text>
      {view.monsters.map((monster) => {
        const known = monster.defeats > 0;
        return (
          <View key={monster.category} style={styles.entry} testID={`bestiary-${monster.category}`}>
            <View style={styles.portrait}>
              <CharacterArt
                assetKey={`enemy.${monster.category.toLowerCase()}`}
                size={56}
                tint={known ? undefined : '#334155'}
                accessibilityLabel={monster.name}
              />
            </View>
            <View style={styles.copy}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{known ? monster.name : '???'}</Text>
                <Text style={styles.defeats}>
                  {monster.defeats} {monster.defeats === 1 ? 'vitória' : 'vitórias'}
                </Text>
              </View>
              <Text style={styles.meta}>{CATEGORY_LABELS[monster.category]}</Text>
              {known ? <Text style={styles.lore}>{monster.lore}</Text> : null}
              {monster.traits.map(({ trait, seen }) => (
                <Text key={trait.id} style={[styles.trait, !seen && styles.traitUnknown]}>
                  {seen
                    ? `${trait.name}: ${trait.hint.toLowerCase()}`
                    : 'Jeito de lutar ainda não visto'}
                </Text>
              ))}
            </View>
          </View>
        );
      })}

      <Text style={styles.section}>Chefes da semana</Text>
      {view.bosses.map((boss) => {
        const known = boss.defeats > 0;
        return (
          <View key={boss.id} style={styles.entry} testID={`bestiary-boss-${boss.id}`}>
            <View style={[styles.portrait, styles.portraitBoss]}>
              <CharacterArt
                assetKey={BOSSES[boss.id].assetKey}
                size={56}
                tint={known ? undefined : '#334155'}
                accessibilityLabel={boss.name}
              />
            </View>
            <View style={styles.copy}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{known ? boss.name : '???'}</Text>
                <Text style={styles.defeats}>
                  {boss.defeats} {boss.defeats === 1 ? 'vitória' : 'vitórias'}
                </Text>
              </View>
              <Text style={styles.meta}>Chefe · {CATEGORY_LABELS[boss.home]}</Text>
              <Text style={styles.lore}>
                {known ? boss.lore : 'Um chefe por semana, em rodízio. Vença para conhecer.'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const PAD = space.sm;

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  summary: { fontSize: 14, fontWeight: '800', color: colors.amberSoft },
  section: { marginTop: space.md, fontSize: 13, fontWeight: '800', color: colors.textMuted },
  entry: {
    flexDirection: 'row',
    gap: space.md,
    padding: PAD,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  // Raio interno = externo − padding (regra 14).
  portrait: {
    width: 64,
    height: 64,
    borderRadius: radius.lg - PAD,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitBoss: { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '900', color: colors.text },
  defeats: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  meta: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  lore: { fontSize: 13, lineHeight: 18, color: colors.text },
  trait: { fontSize: 12, lineHeight: 17, color: colors.amberSoft },
  traitUnknown: { color: colors.textDim },
});
