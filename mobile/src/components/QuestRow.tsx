import React, { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { msUntilXpEligible } from '../domain/antiFarm';
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from '../domain/constants';
import type { Quest } from '../domain/types';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { CharacterArt } from './CharacterArt';

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
      <View style={styles.monster}>
        <CharacterArt assetKey={`enemy.${quest.category.toLowerCase()}`} size={44} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, quest.completed && styles.titleDone]}>{quest.title}</Text>
        <Text style={styles.meta}>
          {CATEGORY_LABELS[quest.category]} · {DIFFICULTY_LABELS[quest.difficulty]} · +{quest.xp} XP
        </Text>
        {waitingForXp ? (
          <Text style={styles.waiting} testID={`quest-wait-${quest.id}`}>
            XP libera em {secondsLeft}s
          </Text>
        ) : null}
        {!quest.completed ? (
          <View style={styles.rowActions}>
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
              accessibilityLabel={
                quest.recurring
                  ? `Tirar hábito diário de ${quest.title}`
                  : `Tornar ${quest.title} um hábito diário`
              }
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>{quest.recurring ? 'Diária' : 'Fixar'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {quest.completed ? (
        <Text style={styles.doneBadge}>Feita</Text>
      ) : (
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
      )}

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
  );
}

/** Linha da lista de quests. Memoizada: só re-renderiza se a própria quest mudar. */
export const QuestRow = memo(QuestRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    marginHorizontal: space.gutter,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDone: { opacity: 0.7 },
  monster: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { marginTop: space.xs + 2, fontSize: 12, color: colors.textMuted },
  waiting: { marginTop: space.xs + 2, fontSize: 12, fontWeight: '700', color: colors.amberSoft },
  rowActions: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.amberSoft },
  completeBtn: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnWaiting: { backgroundColor: 'transparent' },
  completeBtnText: { fontWeight: '800', color: colors.bg, fontSize: 13 },
  completeBtnTextWaiting: { color: colors.amberSoft },
  doneBadge: {
    minWidth: 64,
    textAlign: 'center',
    color: colors.success,
    fontWeight: '800',
    fontSize: 12,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 22, lineHeight: 24, color: colors.textDim, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
