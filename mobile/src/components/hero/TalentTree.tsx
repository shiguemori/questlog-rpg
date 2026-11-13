import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  learnTalent,
  resetTalents,
  TALENT_BRANCH_LABELS,
  TALENT_BRANCHES,
  TALENT_TREES,
  talentPointsLeft,
  talentStatus,
  type TalentNode,
  type TalentStatus,
} from '../../domain/talents';
import type { AppState } from '../../domain/types';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { SkillIcon } from '../battle/SkillCast';

export interface TalentTreeProps {
  state: AppState;
  onHeroChange: (change: (current: AppState) => AppState | null) => void;
}

const STATUS_COPY: Record<TalentStatus, string> = {
  LEARNED: 'Aprendido',
  AVAILABLE: 'Disponível',
  NEEDS_PREVIOUS: 'Aprenda o de cima antes',
  NEEDS_LEVEL: 'Nível baixo',
  NO_POINTS: 'Sem pontos',
};

/** Texto curto do bônus, mostrado no lugar do ícone nos talentos passivos. */
function passiveBadge(node: TalentNode): string {
  const passive = node.passive ?? {};
  if (passive.damagePct) return `+${passive.damagePct}%`;
  if (passive.critChance) return `+${passive.critChance}%`;
  if (passive.shieldPct) return `+${passive.shieldPct}%`;
  if (passive.maxHp) return `+${passive.maxHp}`;
  if (passive.maxEnergy) return `+${passive.maxEnergy}`;
  return '+';
}

/**
 * Árvore de talentos: 3 ramos lado a lado, de cima para baixo. Tocar num talento mostra
 * o que ele faz; o botão aprende. Os pontos vêm do nível (1 por nível depois do 1).
 */
export function TalentTree({ state, onHeroChange }: TalentTreeProps) {
  const { character } = state;
  const tree = TALENT_TREES[character.characterClass];
  const points = talentPointsLeft(character);
  const [selectedId, setSelectedId] = useState<string>(tree[0].id);
  const selected = tree.find((node) => node.id === selectedId) ?? tree[0];
  const selectedStatus = talentStatus(character, selected);
  const anyLearned = tree.some((node) => talentStatus(character, node) === 'LEARNED');

  const confirmReset = () => {
    Alert.alert('Devolver talentos?', 'Todos os pontos voltam e você escolhe de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Devolver', onPress: () => onHeroChange(resetTalents) },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.points, points > 0 && styles.pointsActive]}>
        {points > 0
          ? `${points} ${points === 1 ? 'ponto' : 'pontos'} de talento para usar`
          : character.level < 2
            ? 'Suba para o nível 2 para ganhar o primeiro ponto.'
            : 'Sem pontos agora. Cada nível dá mais um.'}
      </Text>

      <View style={styles.columns}>
        {TALENT_BRANCHES.map((branch) => (
          <View key={branch} style={styles.column}>
            <Text style={styles.branch}>{TALENT_BRANCH_LABELS[branch]}</Text>
            {tree
              .filter((node) => node.branch === branch)
              .map((node, index) => {
                const status = talentStatus(character, node);
                const learned = status === 'LEARNED';
                const open = status === 'AVAILABLE';
                const isSelected = node.id === selected.id;
                return (
                  <View key={node.id} style={styles.nodeWrap}>
                    {index > 0 ? <View style={[styles.link, learned && styles.linkOn]} /> : null}
                    <Pressable
                      onPress={() => setSelectedId(node.id)}
                      style={[
                        styles.node,
                        learned && styles.nodeLearned,
                        open && styles.nodeOpen,
                        !learned && !open && styles.nodeLocked,
                        isSelected && styles.nodeSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${node.name}. ${node.description} ${STATUS_COPY[status]}.`}
                    >
                      {node.unlocksSkill ? (
                        <View style={!learned && !open ? styles.dim : undefined}>
                          <SkillIcon skillId={node.unlocksSkill} size={40} />
                        </View>
                      ) : (
                        <Text style={[styles.badge, learned && styles.badgeOn]}>
                          {passiveBadge(node)}
                        </Text>
                      )}
                      <Text style={styles.nodeName} numberOfLines={2}>
                        {node.name}
                      </Text>
                      {learned ? (
                        <View style={styles.mark}>
                          <Text style={styles.markText}>✓</Text>
                        </View>
                      ) : open ? (
                        <View style={[styles.mark, styles.markOpen]} />
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
          </View>
        ))}
      </View>

      <View style={styles.detail}>
        <Text style={styles.detailName}>{selected.name}</Text>
        <Text style={styles.detailText}>{selected.description}</Text>
        <Text style={styles.detailMeta}>
          {selectedStatus === 'NEEDS_LEVEL'
            ? `Libera no nível ${selected.minLevel}.`
            : STATUS_COPY[selectedStatus]}
        </Text>
        {selectedStatus === 'AVAILABLE' ? (
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={() => onHeroChange((current) => learnTalent(current, selected.id))}
            accessibilityRole="button"
            accessibilityLabel={`Aprender ${selected.name}`}
          >
            <Text style={styles.ctaText}>Aprender</Text>
          </Pressable>
        ) : null}
      </View>

      {anyLearned ? (
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={confirmReset}
          accessibilityRole="button"
          accessibilityLabel="Devolver pontos de talento"
        >
          <Text style={styles.secondaryText}>Devolver pontos de talento</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  points: { fontSize: 14, color: colors.textMuted },
  pointsActive: { color: colors.amberSoft, fontWeight: '700' },
  columns: { flexDirection: 'row', gap: space.sm },
  column: { flex: 1, alignItems: 'stretch' },
  branch: {
    marginBottom: space.sm,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textAlign: 'center',
  },
  nodeWrap: { alignItems: 'center' },
  link: { width: 4, height: space.md, backgroundColor: colors.border },
  linkOn: { backgroundColor: colors.amber },
  node: {
    alignSelf: 'stretch',
    minHeight: 96,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  nodeOpen: { borderWidth: 2, borderColor: colors.amber, backgroundColor: colors.bgElevated },
  nodeLearned: {
    borderWidth: 2,
    borderColor: colors.amber,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  nodeLocked: { opacity: 0.55 },
  nodeSelected: { borderWidth: 2, borderColor: colors.text, opacity: 1 },
  mark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOpen: { width: 10, height: 10, borderRadius: 5, top: 8, right: 8 },
  markText: { fontSize: 11, fontWeight: '900', color: colors.bg },
  dim: { opacity: 0.4 },
  badge: {
    fontSize: 18,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  badgeOn: { color: colors.amberSoft },
  nodeName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  detail: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    gap: space.xs,
  },
  detailName: { fontSize: 17, fontWeight: '800', color: colors.text },
  detailText: { fontSize: 14, lineHeight: 20, color: colors.text },
  detailMeta: { fontSize: 13, color: colors.textMuted },
  cta: {
    marginTop: space.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.bg },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  pressed: { opacity: 0.85 },
});
