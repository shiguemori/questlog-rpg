import React, { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { msUntilXpEligible } from '../domain/antiFarm';
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from '../domain/constants';
import {
  liveQuestStreak,
  nextRepeatRule,
  questStreakLabel,
  REPEAT_LABELS,
} from '../domain/schedule';
import type { Category, Quest } from '../domain/types';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { CharacterArt } from './CharacterArt';

/** Fundo do retrato do monstro: o tom do cômodo da arena dele. */
const SOCKET_TINT: Record<Category, string> = {
  STUDY: 'rgba(99, 102, 241, 0.22)',
  WORK: 'rgba(251, 146, 60, 0.2)',
  HEALTH: 'rgba(52, 211, 153, 0.2)',
  HOME: 'rgba(45, 212, 191, 0.2)',
  OTHER: 'rgba(168, 85, 247, 0.22)',
};

export interface QuestRowProps {
  quest: Quest;
  /**
   * Relógio compartilhado da lista. 0 = quest já liberada ou concluída
   * (a linha não precisa re-renderizar a cada segundo).
   */
  nowMs: number;
  onComplete: (questId: string) => void;
  onDelete: (questId: string) => void;
  onEdit: (questId: string) => void;
  onToggleRecurring: (questId: string) => void;
}

function QuestRowBase({
  quest,
  nowMs,
  onComplete,
  onDelete,
  onEdit,
  onToggleRecurring,
}: QuestRowProps) {
  // nowMs 0 = a lista já sabe que esta linha não está em contagem.
  const remainingMs = quest.completed || nowMs <= 0 ? 0 : msUntilXpEligible(quest, nowMs);
  const waitingForXp = !quest.completed && remainingMs > 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const nextRule = nextRepeatRule(quest.repeat);
  const streak = quest.repeat ? liveQuestStreak(quest, new Date()) : 0;

  const handleComplete = () => {
    if (!waitingForXp) {
      onComplete(quest.id);
      return;
    }
    // Anti-farm preservado: concluir cedo é permitido, mas sem XP — e o jogador decide sabendo disso.
    Alert.alert(
      'Concluir sem XP?',
      `Esta quest acabou de ser criada. Espere mais ${secondsLeft}s para ganhar +${quest.xp} XP.`,
      [
        { text: 'Esperar', style: 'cancel' },
        {
          text: 'Concluir sem XP',
          style: 'destructive',
          onPress: () => onComplete(quest.id),
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir quest?',
      `"${quest.title}" sai da sua lista. O XP que você já ganhou continua seu.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => onDelete(quest.id) },
      ],
    );
  };

  return (
    <View style={[styles.row, quest.completed && styles.rowDone]}>
      <View style={styles.top}>
        <View style={[styles.monster, { backgroundColor: SOCKET_TINT[quest.category] }]}>
          <CharacterArt assetKey={`enemy.${quest.category.toLowerCase()}`} size={52} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, quest.completed && styles.titleDone]}>{quest.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {CATEGORY_LABELS[quest.category]} · {DIFFICULTY_LABELS[quest.difficulty]}
            </Text>
            <Text style={styles.xpPill}>+{quest.xp} XP</Text>
          </View>
          {quest.repeat && streak > 1 ? (
            <Text style={styles.streak} testID={`quest-streak-${quest.id}`}>
              {questStreakLabel(quest.repeat, streak)}
            </Text>
          ) : null}
          {waitingForXp ? (
            <Text style={styles.waiting} testID={`quest-wait-${quest.id}`}>
              XP libera em {secondsLeft}s
            </Text>
          ) : null}
        </View>
        {quest.completed ? <Text style={styles.doneBadge}>Feita</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={`Excluir quest ${quest.title}`}
          hitSlop={4}
        >
          <Text style={styles.deleteBtnText}>×</Text>
        </Pressable>
      </View>

      {!quest.completed ? (
        <View style={styles.bottom}>
          <Pressable
            onPress={() => onEdit(quest.id)}
            accessibilityRole="button"
            accessibilityLabel={`Editar quest ${quest.title}`}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>Editar</Text>
          </Pressable>
          <Pressable
            onPress={() => onToggleRecurring(quest.id)}
            accessibilityRole="button"
            accessibilityLabel={`Repetição de ${quest.title}: ${
              quest.repeat ? REPEAT_LABELS[quest.repeat] : 'não repete'
            }`}
            accessibilityHint={`Toque para mudar para ${
              nextRule ? REPEAT_LABELS[nextRule].toLowerCase() : 'não repetir'
            }.`}
            style={styles.linkBtn}
            testID={`quest-repeat-${quest.id}`}
          >
            <Text style={[styles.linkText, quest.repeat && styles.linkTextOn]}>
              {quest.repeat ? REPEAT_LABELS[quest.repeat] : 'Repetir'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.completeBtn,
              waitingForXp && styles.completeBtnWaiting,
              pressed && styles.pressed,
            ]}
            onPress={handleComplete}
            accessibilityRole="button"
            accessibilityLabel={`Concluir quest ${quest.title}`}
            accessibilityHint={
              waitingForXp
                ? `XP libera em ${secondsLeft} segundos. Concluir agora não dá XP.`
                : `Ganha ${quest.xp} de XP.`
            }
          >
            <Text style={[styles.completeBtnText, waitingForXp && styles.completeBtnTextWaiting]}>
              Feito
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Linha da lista de quests. Memoizada: só re-renderiza se a própria quest mudar. */
export const QuestRow = memo(QuestRowBase);

const styles = StyleSheet.create({
  row: {
    gap: space.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: space.sm,
    marginHorizontal: space.gutter,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDone: { opacity: 0.7 },
  // Raio interno = externo − padding (regra 14).
  monster: {
    width: 60,
    height: 60,
    borderRadius: radius.lg - space.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  metaRow: {
    marginTop: space.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  meta: { fontSize: 12, color: colors.textMuted },
  xpPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    color: colors.amberSoft,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  waiting: { marginTop: space.xs + 2, fontSize: 12, fontWeight: '700', color: colors.amberSoft },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingLeft: 60 + space.md,
    paddingRight: space.xs,
  },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.amberSoft },
  linkTextOn: { color: colors.text },
  streak: {
    marginTop: space.xs,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  completeBtn: {
    marginLeft: 'auto',
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnWaiting: { backgroundColor: 'transparent' },
  completeBtnText: { fontWeight: '900', color: colors.bg, fontSize: 15 },
  completeBtnTextWaiting: { color: colors.amberSoft },
  doneBadge: {
    minWidth: 64,
    textAlign: 'center',
    color: colors.success,
    fontWeight: '800',
    fontSize: 12,
  },
  deleteBtn: {
    marginTop: -6,
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 22, lineHeight: 24, color: colors.textDim, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
