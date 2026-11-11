import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HeroAvatar } from '../components/HeroAvatar';
import { QuestCreateModal } from '../components/QuestCreateModal';
import { XpBar } from '../components/XpBar';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CLASS_DEFAULTS,
  DIFFICULTY_LABELS,
} from '../domain/constants';
import {
  presetXp,
  QUEST_PRESETS,
  type QuestPreset,
} from '../domain/questPresets';
import type { AppState, Category, Difficulty, Quest } from '../domain/types';
import { colors } from '../theme/colors';

interface QuestLogScreenProps {
  state: AppState;
  feedback: string | null;
  loadWarning: string | null;
  onAddQuest: (title: string, difficulty: Difficulty, category: Category) => void;
  onCompleteQuest: (id: string) => void;
  onDismissFeedback: () => void;
}

type CategoryFilter = Category | 'ALL';

export function QuestLogScreen({
  state,
  feedback,
  loadWarning,
  onAddQuest,
  onCompleteQuest,
  onDismissFeedback,
}: QuestLogScreenProps) {
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
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

  const addPreset = (preset: QuestPreset) => {
    onAddQuest(preset.title, preset.difficulty, preset.category);
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
      <View style={styles.atmosphere} pointerEvents="none">
        <View style={styles.glowOrb} />
        <View style={styles.glowOrbSoft} />
      </View>

      <View style={styles.heroBlock}>
        <Text style={styles.brand}>QuestLog</Text>
        <View style={styles.heroRow}>
          <HeroAvatar
            characterClass={state.character.characterClass}
            initial={state.character.name}
            size={78}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.heroName}>{state.character.name}</Text>
            <Text style={styles.heroMeta}>
              {classLabel} · Streak {state.stats.streak}d · XP hoje {xpToday}/10
            </Text>
            <XpBar
              xp={state.character.xp}
              maxXp={state.character.maxXp}
              level={state.character.level}
            />
          </View>
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

      <View style={styles.quickBlock}>
        <Text style={[styles.label, styles.labelPad]}>Atividades rápidas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {QUEST_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              style={styles.presetChip}
              onPress={() => addPreset(preset)}
              accessibilityRole="button"
              accessibilityLabel={`Adicionar ${preset.title}`}
            >
              <Text style={styles.presetChipTitle}>{preset.chip}</Text>
              <Text style={styles.presetChipMeta}>+{presetXp(preset)} XP</Text>
            </Pressable>
          ))}
        </ScrollView>
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
                  ? 'Nenhuma quest ainda. Toque em um preset ou no +.'
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

      <Pressable
        style={styles.fab}
        onPress={() => setModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Criar quest personalizada"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <QuestCreateModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddQuest}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  atmosphere: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  glowOrbSoft: {
    position: 'absolute',
    top: 120,
    left: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.amber,
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  heroCopy: { flex: 1, gap: 4 },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroMeta: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  warningBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: { color: colors.dangerText, fontSize: 13, fontWeight: '600' },
  feedbackBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.amberWash,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackText: { color: colors.amberSoft, fontSize: 13, fontWeight: '600' },
  quickBlock: {
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelPad: {
    paddingHorizontal: 20,
  },
  presetRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 4,
  },
  presetChip: {
    minHeight: 56,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
    justifyContent: 'center',
  },
  presetChipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  presetChipMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.amberSoft,
  },
  filterBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.amberWash,
  },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  chipTextSelected: { color: colors.amberSoft },
  list: { paddingHorizontal: 20, paddingBottom: 96 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionSpaced: { marginTop: 20 },
  empty: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questDone: { opacity: 0.65 },
  questText: { flex: 1 },
  questTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  questTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  questMeta: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  completeBtn: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: { fontWeight: '800', color: colors.bg, fontSize: 13 },
  doneBadge: { color: colors.success, fontWeight: '800', fontSize: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.bg,
    marginTop: -2,
  },
});
