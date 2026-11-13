import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressScale } from '../motion/PressScale';
import { HeroAvatar } from '../components/HeroAvatar';
import { HeroSheet } from '../components/HeroSheet';
import { HeroVitalsBar } from '../components/HeroVitalsBar';
import { QuestCreateModal } from '../components/QuestCreateModal';
import { QuestRow } from '../components/QuestRow';
import { WeekStrip } from '../components/WeekStrip';
import { XpBar } from '../components/XpBar';
import { buildDailyXpSummary, msUntilXpEligible } from '../domain/antiFarm';
import { CATEGORIES, CATEGORY_LABELS, CLASS_DEFAULTS } from '../domain/constants';
import { localIsoDate } from '../domain/dates';
import {
  buildDailyGoal,
  buildHabitCue,
  latestQuestDraft,
  shouldOfferReturn,
  streakTitle,
  suggestionForDay,
} from '../domain/engagement';
import { heroRankForLevel, nextRankHint } from '../domain/progression';
import { presetXp, QUEST_PRESETS, type QuestPreset } from '../domain/questPresets';
import { splitQuests, type CategoryFilter, type NewQuestInput } from '../domain/quests';
import type {
  AppState,
  AttributeKey,
  Category,
  CharacterClass,
  PlayerSettings,
  Quest,
} from '../domain/types';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

interface QuestLogScreenProps {
  state: AppState;
  feedback: string | null;
  /** Aviso de armazenamento (save ilegível ou aparelho sem gravar). */
  storageNotice: string | null;
  /** Devolve a mensagem de erro ou null se a quest foi registrada. */
  onAddQuest: (input: NewQuestInput) => string | null;
  onCompleteQuest: (questId: string) => void;
  onDeleteQuest: (questId: string) => void;
  onClearCompleted: () => void;
  onSpendAttributePoint: (attribute: AttributeKey) => void;
  onHeroChange: (change: (current: AppState) => AppState | null) => void;
  onResetJourney: () => void;
  onDismissFeedback: () => void;
  onDismissStorageNotice: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onEditQuest: (questId: string, title: string, category: Category) => string | null;
  onToggleRecurring: (questId: string) => void;
  onRename: (name: string) => string | null;
  onChangeClass: (characterClass: CharacterClass) => void;
  onPatchSettings: (partial: Partial<PlayerSettings>) => void;
  onToggleShield: () => void;
  onImportSave: (raw: string) => string | null;
  onExportSave: () => void;
  onShareWeek: () => void;
  onCalendarDay: () => void;
}

interface QuestSection {
  key: 'open' | 'done';
  title: string;
  data: Quest[];
}

/** Concluídas visíveis antes de "Ver todas". */
const DONE_PREVIEW_COUNT = 5;

export function QuestLogScreen({
  state,
  feedback,
  storageNotice,
  onAddQuest,
  onCompleteQuest,
  onDeleteQuest,
  onClearCompleted,
  onSpendAttributePoint,
  onHeroChange,
  onResetJourney,
  onDismissFeedback,
  onDismissStorageNotice,
  canUndo,
  onUndo,
  onEditQuest,
  onToggleRecurring,
  onRename,
  onChangeClass,
  onPatchSettings,
  onToggleShield,
  onImportSave,
  onExportSave,
  onShareWeek,
  onCalendarDay,
}: QuestLogScreenProps) {
  const insets = useSafeAreaInsets();
  const today = useLocalToday();
  useEffect(() => {
    onCalendarDay();
  }, [today, onCalendarDay]);
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [heroOpen, setHeroOpen] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { character, stats } = state;
  const classLabel = CLASS_DEFAULTS[character.characterClass].label;
  const daily = buildDailyXpSummary(stats, today);
  const goal = buildDailyGoal(stats, today, state.settings.dailyGoalTarget);
  const suggestion = suggestionForDay(today);
  const showSuggestion = state.settings.dismissedSuggestionDate !== today;
  const showReturn = shouldOfferReturn(stats, state.settings, today);
  const editing = state.quests.find((quest) => quest.id === editingId) ?? null;
  const cue = buildHabitCue(stats, today);
  const streakName = streakTitle(stats.streak);
  const repeatDraft = latestQuestDraft(state.quests);
  const points = character.attributePoints;

  const { open, done } = useMemo(() => splitQuests(state.quests, filter), [state.quests, filter]);

  const sections = useMemo<QuestSection[]>(() => {
    const result: QuestSection[] = [{ key: 'open', title: 'Quests abertas', data: open }];
    if (done.length > 0) {
      result.push({
        key: 'done',
        title: 'Concluídas',
        data: showAllDone ? done : done.slice(0, DONE_PREVIEW_COUNT),
      });
    }
    return result;
  }, [open, done, showAllDone]);

  const [presetError, setPresetError] = useState<string | null>(null);

  const addPreset = (preset: QuestPreset) => {
    setPresetError(
      onAddQuest({
        title: preset.title,
        difficulty: preset.difficulty,
        category: preset.category,
      }),
    );
  };

  const confirmClearCompleted = () => {
    Alert.alert(
      'Limpar concluídas?',
      'As quests concluídas saem da lista. Seu XP, nível e streak continuam iguais.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: onClearCompleted },
      ],
    );
  };

  const listHeader = (
    <View>
      <View style={styles.habitBlock}>
        <Text style={styles.habitCue} testID="habit-cue">
          {cue.message}
        </Text>
        <WeekStrip days={stats.completionDays} today={today} />
        <Text style={styles.rankHint} testID="next-rank">
          {nextRankHint(character.level)}
        </Text>
        {daily.limitReached ? (
          <Text style={styles.limitNote}>
            Limite diário atingido. Quests concluídas hoje não rendem mais XP. Volte amanhã.
          </Text>
        ) : null}
      </View>

      <View style={styles.quickBlock}>
        <Text style={[styles.label, styles.padded]}>Atividades rápidas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroller}
        >
          {repeatDraft ? (
            <Pressable
              style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
              onPress={() =>
                setPresetError(
                  onAddQuest({
                    title: repeatDraft.title,
                    difficulty: repeatDraft.difficulty,
                    category: repeatDraft.category,
                  }),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Repetir a última quest ${repeatDraft.title}`}
            >
              <Text style={styles.presetChipTitle} numberOfLines={1}>
                De novo · {repeatDraft.title}
              </Text>
            </Pressable>
          ) : null}
          {showSuggestion ? (
            <Pressable
              style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
              onPress={() =>
                setPresetError(
                  onAddQuest({
                    title: suggestion.title,
                    difficulty: suggestion.difficulty,
                    category: suggestion.category,
                  }),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Sugestão de hoje: ${suggestion.title}`}
            >
              <Text style={styles.presetChipTitle} numberOfLines={2}>
                Hoje · {suggestion.chip}
              </Text>
              <Pressable
                onPress={() => onPatchSettings({ dismissedSuggestionDate: today })}
                accessibilityRole="button"
                accessibilityLabel="Dispensar sugestão de hoje"
              >
                <Text style={styles.presetChipMeta}>Dispensar</Text>
              </Pressable>
            </Pressable>
          ) : null}
          {QUEST_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
              onPress={() => addPreset(preset)}
              accessibilityRole="button"
              accessibilityLabel={`Adicionar quest ${preset.title}, mais ${presetXp(preset)} de XP`}
            >
              <Text style={styles.presetChipTitle}>{preset.chip}</Text>
              <Text style={styles.presetChipMeta}>+{presetXp(preset)} XP</Text>
            </Pressable>
          ))}
        </ScrollView>
        {presetError ? <Text style={[styles.errorText, styles.padded]}>{presetError}</Text> : null}
      </View>

      <View style={styles.filterBlock}>
        <Text style={[styles.label, styles.padded]}>Filtrar por categoria</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroller}
          accessibilityRole="radiogroup"
        >
          {(['ALL', ...CATEGORIES] as CategoryFilter[]).map((option) => {
            const selected = filter === option;
            return (
              <Pressable
                key={`filter-${option}`}
                onPress={() => setFilter(option)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option === 'ALL' ? 'Todas' : CATEGORY_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  const renderSectionFooter = ({ section }: { section: QuestSection }) => {
    if (section.key === 'open') {
      if (section.data.length > 0) return null;
      const noQuestsAtAll = state.quests.length === 0;
      return (
        <View style={styles.emptyBlock}>
          <Text style={styles.empty}>
            {filter === 'ALL'
              ? goal.met
                ? 'Meta de hoje feita. Amanhã uma quest mantém o streak.'
                : noQuestsAtAll
                  ? 'Feche 1 quest hoje. Isso basta para a meta do dia.'
                  : 'Tudo concluído por aqui. Falta a quest de hoje para a meta.'
              : `Nenhuma quest aberta em ${CATEGORY_LABELS[filter]}.`}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
            onPress={() => setModalOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.emptyCtaText}>Criar quest</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.doneActions}>
        {done.length > DONE_PREVIEW_COUNT ? (
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            onPress={() => setShowAllDone((value) => !value)}
            accessibilityRole="button"
          >
            <Text style={styles.ghostBtnText}>
              {showAllDone ? 'Mostrar menos' : `Ver todas (${done.length})`}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          onPress={confirmClearCompleted}
          accessibilityRole="button"
        >
          <Text style={styles.ghostBtnText}>Limpar concluídas</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.heroBlock}>
        <Text style={styles.brand}>QuestLog</Text>
        <Pressable
          style={({ pressed }) => [styles.heroRow, pressed && styles.pressedSoft]}
          onPress={() => setHeroOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir folha do herói ${character.name}`}
          accessibilityHint={
            points > 0 ? `Você tem ${points} pontos de atributo para distribuir.` : undefined
          }
        >
          <HeroAvatar
            characterClass={character.characterClass}
            initial={character.name}
            size={64}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.heroName} numberOfLines={2}>
              {character.name}
            </Text>
            <Text style={styles.heroMeta}>
              {heroRankForLevel(character.level)} · {classLabel}
            </Text>
          </View>
          <View style={[styles.profilePill, points > 0 && styles.profilePillActive]}>
            <Text style={[styles.profilePillText, points > 0 && styles.profilePillTextActive]}>
              {points > 0 ? `+${points} pontos` : 'Perfil'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.meters}>
          <XpBar xp={character.xp} maxXp={character.maxXp} level={character.level} />
          <HeroVitalsBar character={character} />
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statChip}>Streak {stats.streak}d</Text>
          {streakName ? <Text style={styles.statChip}>{streakName}</Text> : null}
          <Text
            style={[styles.statChip, goal.met && styles.statChipAlert]}
            testID="daily-goal-chip"
          >
            Meta {goal.done}/{goal.target}
          </Text>
          <Text
            style={[styles.statChip, daily.limitReached && styles.statChipAlert]}
            testID="daily-xp-chip"
          >
            XP hoje {daily.xpQuestsToday}/{daily.xpQuestsLimit}
          </Text>
        </View>
      </View>

      {storageNotice ? (
        <Pressable
          style={styles.warningBanner}
          onPress={onDismissStorageNotice}
          accessibilityRole="button"
          accessibilityLabel={`${storageNotice} Toque para dispensar.`}
        >
          <Text style={styles.warningText}>{storageNotice}</Text>
        </Pressable>
      ) : null}

      {feedback ? (
        <Pressable
          style={styles.feedbackBanner}
          onPress={onDismissFeedback}
          accessibilityRole="button"
          accessibilityLabel={`${feedback} Toque para dispensar.`}
        >
          <Text style={styles.feedbackText}>{feedback}</Text>
        </Pressable>
      ) : null}

      {showReturn ? (
        <Pressable
          style={styles.feedbackBanner}
          onPress={() => onPatchSettings({ dismissedReturnGap: stats.lastCompletedDate })}
          accessibilityRole="button"
          accessibilityLabel="Recomeço leve. Uma quest hoje abre um streak novo. Toque para dispensar."
        >
          <Text style={styles.feedbackText}>
            Recomeço leve. Uma quest hoje abre um streak novo.
          </Text>
        </Pressable>
      ) : null}

      {canUndo ? (
        <Pressable
          style={styles.undoBanner}
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel="Desfazer conclusão"
          testID="undo-completion"
        >
          <Text style={styles.undoText}>Desfazer conclusão</Text>
        </Pressable>
      ) : null}

      <QuestSections
        quests={state.quests}
        sections={sections}
        listHeader={listHeader}
        renderSectionFooter={renderSectionFooter}
        onComplete={onCompleteQuest}
        onDelete={onDeleteQuest}
        onEdit={setEditingId}
        onToggleRecurring={onToggleRecurring}
        bottomInset={insets.bottom}
      />

      <PressScale
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Criar quest personalizada"
      >
        <Text style={styles.fabText}>+</Text>
      </PressScale>

      <QuestCreateModal
        visible={modalOpen || editing != null}
        initial={
          editing
            ? {
                title: editing.title,
                category: editing.category,
                difficulty: editing.difficulty,
              }
            : undefined
        }
        lockDifficulty={editing != null}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        onSubmit={(input) => {
          if (!editing) return onAddQuest(input);
          const message = onEditQuest(editing.id, input.title, input.category);
          if (!message) setEditingId(null);
          return message;
        }}
      />

      <HeroSheet
        visible={heroOpen}
        state={state}
        onClose={() => setHeroOpen(false)}
        onSpendAttributePoint={onSpendAttributePoint}
        onHeroChange={onHeroChange}
        onResetJourney={() => {
          setHeroOpen(false);
          onResetJourney();
        }}
        onRename={onRename}
        onChangeClass={onChangeClass}
        onPatchSettings={onPatchSettings}
        onToggleShield={onToggleShield}
        onImportSave={onImportSave}
        onExportSave={onExportSave}
        onShareWeek={onShareWeek}
      />
    </View>
  );
}

function useLocalToday(): string {
  const [today, setToday] = useState(() => localIsoDate(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const next = localIsoDate(new Date());
      setToday((current) => (current === next ? current : next));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

/** A lista é o único lugar com relógio de 1s. O cabeçalho não re-renderiza com ele. */
const QuestSections = memo(function QuestSections({
  quests,
  sections,
  listHeader,
  renderSectionFooter,
  onComplete,
  onDelete,
  onEdit,
  onToggleRecurring,
  bottomInset,
}: {
  quests: readonly Quest[];
  sections: QuestSection[];
  listHeader: React.ReactElement;
  renderSectionFooter: (info: { section: QuestSection }) => React.ReactElement | null;
  onComplete: (questId: string) => void;
  onDelete: (questId: string) => void;
  onEdit: (questId: string) => void;
  onToggleRecurring: (questId: string) => void;
  bottomInset: number;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const anyWaiting = useMemo(
    () => quests.some((quest) => !quest.completed && msUntilXpEligible(quest, nowMs) > 0),
    [quests, nowMs],
  );

  useEffect(() => {
    if (!anyWaiting) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyWaiting]);

  const renderQuest = useCallback(
    ({ item }: { item: Quest }) => {
      const ticking = !item.completed && msUntilXpEligible(item, nowMs) > 0;
      return (
        <QuestRow
          quest={item}
          nowMs={ticking ? nowMs : 0}
          onComplete={onComplete}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleRecurring={onToggleRecurring}
        />
      );
    },
    [nowMs, onComplete, onDelete, onEdit, onToggleRecurring],
  );

  return (
    <SectionList
      style={styles.questList}
      sections={sections}
      keyExtractor={(quest) => quest.id}
      renderItem={renderQuest}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.section, section.key === 'done' && styles.sectionSpaced]}>
          {section.title}
        </Text>
      )}
      renderSectionFooter={renderSectionFooter}
      ListHeaderComponent={listHeader}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 104 }]}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
    />
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  heroBlock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: space.lg,
  },
  meters: { gap: space.md },
  habitBlock: { paddingHorizontal: space.gutter, paddingTop: space.lg, gap: space.md },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  heroRow: {
    flexDirection: 'row',
    gap: space.lg,
    alignItems: 'center',
    minHeight: 64,
  },
  heroCopy: { flex: 1, gap: space.xs },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroMeta: { fontSize: 13, color: colors.textMuted },
  profilePill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePillActive: { borderColor: colors.amber, backgroundColor: colors.amberWash },
  profilePillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  profilePillTextActive: { color: colors.amberSoft },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statChip: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  statChipAlert: { color: colors.amberSoft, backgroundColor: colors.amberWash },
  rankHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  habitCue: { fontSize: 14, lineHeight: 20, color: colors.text },
  limitNote: { fontSize: 12, lineHeight: 17, color: colors.amberSoft },
  warningBanner: {
    marginHorizontal: space.gutter,
    marginTop: space.md,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  warningText: { color: colors.dangerText, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  feedbackBanner: {
    marginHorizontal: space.gutter,
    marginTop: space.md,
    borderRadius: 12,
    backgroundColor: colors.amberWash,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  feedbackText: { color: colors.amberSoft, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  undoBanner: {
    marginHorizontal: space.gutter,
    marginTop: space.md,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoText: { fontSize: 14, fontWeight: '800', color: colors.text },
  questList: { flex: 1 },
  quickBlock: { paddingTop: space.xl, gap: space.md },
  filterBlock: { paddingTop: space.xl, paddingBottom: space.xs, gap: space.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  padded: { paddingHorizontal: space.gutter },
  errorText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  chipScroller: { paddingHorizontal: space.gutter, gap: space.sm, paddingVertical: 2 },
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
  presetChipTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  presetChipMeta: { marginTop: 2, fontSize: 11, fontWeight: '600', color: colors.amberSoft },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: colors.amber, backgroundColor: colors.amberWash },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  chipTextSelected: { color: colors.amberSoft },
  list: { paddingBottom: 104 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: space.md,
    marginTop: space.xl,
    paddingHorizontal: space.gutter,
  },
  sectionSpaced: { marginTop: space.xxl },
  emptyBlock: { paddingHorizontal: space.gutter, gap: space.md, alignItems: 'flex-start' },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  emptyCta: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: { fontSize: 14, fontWeight: '800', color: colors.bg },
  doneActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.gutter,
    marginTop: space.sm,
  },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.bg,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 32, fontWeight: '700', color: colors.bg, marginTop: -2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  pressedSoft: { opacity: 0.8 },
});
