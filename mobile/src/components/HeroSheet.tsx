import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, CLASS_DEFAULTS } from '../domain/constants';
import { streakTitle } from '../domain/engagement';
import { ACHIEVEMENTS, heroRankForLevel } from '../domain/progression';
import type { AppState, AttributeKey } from '../domain/types';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';
import { HeroAvatar } from './HeroAvatar';
import { XpBar } from './XpBar';

export interface HeroSheetProps {
  visible: boolean;
  state: AppState;
  onClose: () => void;
  onSpendAttributePoint: (attribute: AttributeKey) => void;
  onResetJourney: () => void;
}

/**
 * Folha do herói: atributos (gasto de pontos do level up), estatísticas,
 * conquistas e reinício da jornada. Modal nativo — ocasional, sem motion próprio.
 */
export function HeroSheet({
  visible,
  state,
  onClose,
  onSpendAttributePoint,
  onResetJourney,
}: HeroSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { character, stats } = state;
  const points = character.attributePoints;
  const classLabel = CLASS_DEFAULTS[character.characterClass].label;
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.isUnlocked(state)).length;

  const confirmReset = () => {
    Alert.alert(
      'Reiniciar jornada?',
      'Seu herói, quests, XP e conquistas serão apagados deste aparelho. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar tudo', style: 'destructive', onPress: onResetJourney },
      ],
    );
  };

  const journey: { label: string; value: string }[] = [
    { label: 'XP total', value: String(stats.totalXpEarned) },
    { label: 'Quests concluídas', value: String(stats.totalQuestsCompleted) },
    { label: 'Streak atual', value: `${stats.streak}d` },
    ...(streakTitle(stats.streak)
      ? [{ label: 'Título do streak', value: streakTitle(stats.streak) as string }]
      : []),
    { label: 'Melhor streak', value: `${stats.bestStreak}d` },
  ];

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>Folha do herói</Text>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar folha do herói"
          >
            <Text style={styles.closeBtnText}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identity}>
            <HeroAvatar
              characterClass={character.characterClass}
              initial={character.name}
              size={88}
            />
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{character.name}</Text>
              <Text style={styles.rank}>
                {heroRankForLevel(character.level)} · {classLabel}
              </Text>
            </View>
          </View>
          <XpBar xp={character.xp} maxXp={character.maxXp} level={character.level} />

          <Text style={styles.section}>Atributos</Text>
          <Text style={[styles.hint, points > 0 && styles.hintActive]}>
            {points > 0
              ? `Você tem ${points} ${points === 1 ? 'ponto' : 'pontos'} para distribuir.`
              : 'Suba de nível para ganhar pontos de atributo.'}
          </Text>
          <View style={styles.card}>
            {ATTRIBUTE_KEYS.map((key, index) => (
              <View key={key} style={[styles.attributeRow, index > 0 && styles.divider]}>
                <Text style={styles.attributeLabel}>{ATTRIBUTE_LABELS[key]}</Text>
                <Text style={styles.attributeValue} testID={`attribute-${key}`}>
                  {character.attributes[key]}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.plusBtn,
                    points <= 0 && styles.plusBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={points <= 0}
                  onPress={() => onSpendAttributePoint(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Aumentar ${ATTRIBUTE_LABELS[key]}`}
                  accessibilityState={{ disabled: points <= 0 }}
                >
                  <Text style={styles.plusBtnText}>+</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Text style={styles.section}>Jornada</Text>
          <View style={styles.statGrid}>
            {journey.map((entry) => (
              <View key={entry.label} style={styles.statCard}>
                <Text style={styles.statValue}>{entry.value}</Text>
                <Text style={styles.statLabel}>{entry.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>
            Conquistas {unlockedCount}/{ACHIEVEMENTS.length}
          </Text>
          <View style={styles.card}>
            {ACHIEVEMENTS.map((achievement, index) => {
              const unlocked = achievement.isUnlocked(state);
              return (
                <View
                  key={achievement.id}
                  style={[styles.achievementRow, index > 0 && styles.divider]}
                  accessible
                  accessibilityLabel={`${achievement.title}. ${achievement.description} ${
                    unlocked ? 'Desbloqueada.' : 'Bloqueada.'
                  }`}
                >
                  <View style={[styles.medal, unlocked && styles.medalUnlocked]} />
                  <View style={styles.achievementCopy}>
                    <Text style={[styles.achievementTitle, !unlocked && styles.locked]}>
                      {achievement.title}
                    </Text>
                    <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
            onPress={confirmReset}
            accessibilityRole="button"
            accessibilityLabel="Reiniciar jornada"
          >
            <Text style={styles.resetBtnText}>Reiniciar jornada</Text>
          </Pressable>

          <Text style={styles.footer}>QuestLog v{appConfig.expo.version} · Shiguemori</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  identityCopy: { flex: 1 },
  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  rank: { marginTop: 4, fontSize: 14, fontWeight: '600', color: colors.amberSoft },
  section: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  hintActive: { color: colors.amberSoft, fontWeight: '700' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  attributeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 },
  attributeLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  attributeValue: {
    minWidth: 32,
    textAlign: 'right',
    fontSize: 18,
    fontWeight: '800',
    color: colors.amberSoft,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnDisabled: { backgroundColor: colors.bgSoft, opacity: 0.5 },
  plusBtnText: { fontSize: 22, lineHeight: 24, fontWeight: '800', color: colors.bg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { marginTop: 2, fontSize: 12, fontWeight: '600', color: colors.textMuted },
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  medal: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  medalUnlocked: { borderColor: colors.amber, backgroundColor: colors.amber },
  achievementCopy: { flex: 1 },
  achievementTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  achievementDescription: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  locked: { color: colors.textDim },
  resetBtn: {
    marginTop: 28,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  footer: { marginTop: 20, textAlign: 'center', fontSize: 12, color: colors.textDim },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
