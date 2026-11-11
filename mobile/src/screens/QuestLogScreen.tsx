import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CLASS_DEFAULTS, DIFFICULTY_LABELS, XP_REWARDS } from '../domain/constants';
import type { AppState, Difficulty, Quest } from '../domain/types';

interface QuestLogScreenProps {
  state: AppState;
  onAddQuest: (title: string, difficulty: Difficulty) => void;
  onCompleteQuest: (id: string) => void;
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export function QuestLogScreen({
  state,
  onAddQuest,
  onCompleteQuest,
}: QuestLogScreenProps) {
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const classLabel = CLASS_DEFAULTS[state.character.characterClass].label;

  const openQuests = useMemo(
    () => state.quests.filter((q) => !q.completed),
    [state.quests],
  );
  const doneQuests = useMemo(
    () => state.quests.filter((q) => q.completed).slice(0, 8),
    [state.quests],
  );

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddQuest(trimmed, difficulty);
    setTitle('');
  };

  const renderQuest = (quest: Quest, actionable: boolean) => (
    <View key={quest.id} style={[styles.questRow, quest.completed && styles.questDone]}>
      <View style={styles.questText}>
        <Text style={[styles.questTitle, quest.completed && styles.questTitleDone]}>
          {quest.title}
        </Text>
        <Text style={styles.questMeta}>
          {DIFFICULTY_LABELS[quest.difficulty]} · +{quest.xp} XP
        </Text>
      </View>
      {actionable ? (
        <Pressable
          style={styles.completeBtn}
          onPress={() => onCompleteQuest(quest.id)}
          accessibilityRole="button"
          accessibilityLabel={`Concluir quest ${quest.title}`}
        >
          <Text style={styles.completeBtnText}>Feito</Text>
        </Pressable>
      ) : (
        <Text style={styles.doneBadge}>OK</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>QuestLog</Text>
          <Text style={styles.heroName}>{state.character.name}</Text>
          <Text style={styles.heroMeta}>
            {classLabel} · Nv. {state.character.level} · Streak {state.stats.streak}d
          </Text>
        </View>
        <View style={styles.xpBox}>
          <Text style={styles.xpLabel}>XP</Text>
          <Text style={styles.xpValue}>
            {state.character.xp}/{state.character.maxXp}
          </Text>
        </View>
      </View>

      <View style={styles.composer}>
        <Text style={styles.label}>Nova quest</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="ex: Beber 2L de água"
          placeholderTextColor="#64748B"
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <View style={styles.diffRow}>
          {DIFFICULTIES.map((d) => {
            const selected = difficulty === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.diffChip, selected && styles.diffChipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.diffText, selected && styles.diffTextSelected]}>
                  {DIFFICULTY_LABELS[d]} (+{XP_REWARDS[d]})
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={[styles.cta, !title.trim() && styles.ctaDisabled]}
          disabled={!title.trim()}
          onPress={submit}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Registrar quest</Text>
        </Pressable>
      </View>

      <FlatList
        data={[{ key: 'list' }]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        renderItem={() => (
          <View>
            <Text style={styles.section}>Quests abertas</Text>
            {openQuests.length === 0 ? (
              <Text style={styles.empty}>Nenhuma quest ainda. Crie a primeira acima.</Text>
            ) : (
              openQuests.map((q) => renderQuest(q, true))
            )}
            {doneQuests.length > 0 && (
              <>
                <Text style={[styles.section, styles.sectionSpaced]}>Concluídas</Text>
                {doneQuests.map((q) => renderQuest(q, false))}
              </>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#F59E0B',
  },
  heroName: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginTop: 4 },
  heroMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  xpBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 88,
  },
  xpLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  xpValue: { fontSize: 14, fontWeight: '800', color: '#FBBF24', marginTop: 2 },
  composer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#CBD5E1' },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 16,
  },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diffChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  diffChipSelected: { borderColor: '#F59E0B', backgroundColor: '#292524' },
  diffText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  diffTextSelected: { color: '#FBBF24' },
  cta: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionSpaced: { marginTop: 20 },
  empty: { color: '#64748B', fontSize: 14, lineHeight: 20 },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  questDone: { opacity: 0.65 },
  questText: { flex: 1 },
  questTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  questTitleDone: { textDecorationLine: 'line-through', color: '#94A3B8' },
  questMeta: { marginTop: 4, fontSize: 12, color: '#94A3B8' },
  completeBtn: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: { fontWeight: '800', color: '#0F172A', fontSize: 13 },
  doneBadge: { color: '#22C55E', fontWeight: '800', fontSize: 12 },
});
