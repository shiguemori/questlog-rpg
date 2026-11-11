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
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CLASS_DEFAULTS,
  DIFFICULTY_LABELS,
  XP_REWARDS,
} from '../domain/constants';
import type { AppState, Category, Difficulty, Quest } from '../domain/types';

interface QuestLogScreenProps {
  state: AppState;
  feedback: string | null;
  loadWarning: string | null;
  onAddQuest: (title: string, difficulty: Difficulty, category: Category) => void;
  onCompleteQuest: (id: string) => void;
  onDismissFeedback: () => void;
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
type CategoryFilter = Category | 'ALL';

export function QuestLogScreen({
  state,
  feedback,
  loadWarning,
  onAddQuest,
  onCompleteQuest,
  onDismissFeedback,
}: QuestLogScreenProps) {
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [category, setCategory] = useState<Category>('OTHER');
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const classLabel = CLASS_DEFAULTS[state.character.characterClass].label;

  const openQuests = useMemo(() => {
    return state.quests.filter((q) => {
      if (q.completed) return false;
      if (filter === 'ALL') return true;
      return q.category === filter;
    });
  }, [state.quests, filter]);

  const doneQuests = useMemo(() => {
    return state.quests
      .filter((q) => {
        if (!q.completed) return false;
        if (filter === 'ALL') return true;
        return q.category === filter;
      })
      .slice(0, 8);
  }, [state.quests, filter]);

  const today = new Date().toISOString().split('T')[0];
  const xpToday =
    state.stats.dailyXpCompletionsDate === today ? state.stats.dailyXpCompletions : 0;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddQuest(trimmed, difficulty, category);
    setTitle('');
  };

  const renderQuest = (quest: Quest, actionable: boolean) => (
    <View key={quest.id} style={[styles.questRow, quest.completed && styles.questDone]}>
      <View style={styles.questText}>
        <Text style={[styles.questTitle, quest.completed && styles.questTitleDone]}>
          {quest.title}
        </Text>
        <Text style={styles.questMeta}>
          {CATEGORY_LABELS[quest.category]} · {DIFFICULTY_LABELS[quest.difficulty]} · +
          {quest.xp} XP
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
          <Text style={styles.heroMeta}>XP hoje: {xpToday}/10</Text>
        </View>
        <View style={styles.xpBox}>
          <Text style={styles.xpLabel}>XP</Text>
          <Text style={styles.xpValue}>
            {state.character.xp}/{state.character.maxXp}
          </Text>
        </View>
      </View>

      {loadWarning ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{loadWarning}</Text>
        </View>
      ) : null}

      {feedback ? (
        <Pressable
          style={styles.feedbackBanner}
          onPress={onDismissFeedback}
          accessibilityRole="button"
          accessibilityLabel="Dispensar mensagem"
        >
          <Text style={styles.feedbackText}>{feedback}</Text>
        </Pressable>
      ) : null}

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

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => {
            const selected = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Dificuldade</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => {
            const selected = difficulty === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
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

      <View style={styles.filterBlock}>
        <Text style={styles.label}>Filtrar</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setFilter('ALL')}
            style={[styles.chip, filter === 'ALL' && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'ALL' }}
          >
            <Text style={[styles.chipText, filter === 'ALL' && styles.chipTextSelected]}>
              Todas
            </Text>
          </Pressable>
          {CATEGORIES.map((c) => {
            const selected = filter === c;
            return (
              <Pressable
                key={`filter-${c}`}
                onPress={() => setFilter(c)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={[{ key: 'list' }]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        renderItem={() => (
          <View>
            <Text style={styles.section}>Quests abertas</Text>
            {openQuests.length === 0 ? (
              <Text style={styles.empty}>
                {filter === 'ALL'
                  ? 'Nenhuma quest ainda. Crie a primeira acima.'
                  : `Nenhuma quest aberta em ${CATEGORY_LABELS[filter]}.`}
              </Text>
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
  warningBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: { color: '#FECACA', fontSize: 13, fontWeight: '600' },
  feedbackBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#292524',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackText: { color: '#FBBF24', fontSize: 13, fontWeight: '600' },
  composer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  filterBlock: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 8,
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: '#F59E0B', backgroundColor: '#292524' },
  chipText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  chipTextSelected: { color: '#FBBF24' },
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
