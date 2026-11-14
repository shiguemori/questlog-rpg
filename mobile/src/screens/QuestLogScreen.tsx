import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressScale } from '../motion/PressScale';
import { BossCard } from '../components/BossCard';
import { Chevron } from '../components/Chevron';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FocusPicker } from '../components/FocusScreen';
import { InfoSheet } from '../components/InfoSheet';
import { DailyChallengesCard } from '../components/DailyChallengesCard';
import { CharacterArt } from '../components/CharacterArt';
import { heroArtKey, heroLayers } from '../domain/loot';
import { HeroSheet } from '../components/HeroSheet';
import { HeroVitalsBar } from '../components/HeroVitalsBar';
import { QuestCreateModal } from '../components/QuestCreateModal';
import { QuestRow } from '../components/QuestRow';
import { WeekStrip } from '../components/WeekStrip';
import { WeeklyRecap } from '../components/WeeklyRecap';
import { XpBar } from '../components/XpBar';
import { buildDailyXpSummary, msUntilXpEligible } from '../domain/antiFarm';
import { BOSS_MIN_LEVEL, bossStatus, type BossStatus } from '../domain/boss';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CLASS_DEFAULTS,
  DIFFICULTY_LABELS,
  XP_REWARDS,
} from '../domain/constants';
import { localIsoDate } from '../domain/dates';
import {
  buildDailyGoal,
  buildHabitCue,
  buildWeekStrip,
  latestQuestDraft,
  shouldOfferReturn,
  streakTitle,
  suggestionForDay,
} from '../domain/engagement';
import { heroRankForLevel, nextRankHint } from '../domain/progression';
import { presetXp, QUEST_PRESETS, type QuestPreset } from '../domain/questPresets';
import { splitQuests, type CategoryFilter, type NewQuestInput } from '../domain/quests';
import { recapWeekFor } from '../domain/weekly';
import type {
  AppState,
  AttributeKey,
  Category,
  CharacterClass,
  Difficulty,
  PlayerSettings,
  Quest,
} from '../domain/types';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

/** Cenário atrás do herói no topo: o cômodo que combina com a classe. */
const HERO_BACKDROP: Record<string, ImageSourcePropType> = {
  WARRIOR: require('../../assets/battle/arena-health.jpg'),
  MAGE: require('../../assets/battle/arena-study.jpg'),
  ROGUE: require('../../assets/battle/arena-other.jpg'),
};

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
  onShareWeek: () => void;
  onCalendarDay: () => void;
  /** Muda de valor para abrir a folha do herói (ex.: "Usar os pontos" do level up). */
  heroRequest?: number;
  /** Abre a luta contra o chefe da semana. */
  onStartBoss?: () => void;
  /** Começa o modo foco numa quest. Devolve a mensagem de erro ou null. */
  onStartFocus?: (questId: string, minutes: number) => string | null;
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
  onShareWeek,
  onCalendarDay,
  heroRequest = 0,
  onStartBoss,
  onStartFocus,
}: QuestLogScreenProps) {
  const insets = useSafeAreaInsets();
  const today = useLocalToday();
  useEffect(() => {
    onCalendarDay();
  }, [today, onCalendarDay]);
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [heroOpen, setHeroOpen] = useState(false);
  const [lastHeroRequest, setLastHeroRequest] = useState(heroRequest);
  if (heroRequest !== lastHeroRequest) {
    // Ajuste de estado durante o render (padrão do React para reagir a prop).
    setLastHeroRequest(heroRequest);
    if (heroRequest > 0) setHeroOpen(true);
  }
  const [showAllDone, setShowAllDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);
  const [bossOpen, setBossOpen] = useState(false);
  const [askClear, setAskClear] = useState(false);
  const [focusQuestId, setFocusQuestId] = useState<string | null>(null);

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
  const recap = recapWeekFor(state, today);
  const weekDays = buildWeekStrip(stats.completionDays, today).filter((cell) => cell.done).length;
  const boss = bossStatus(state.weeklyBoss, new Date(), character.level);
  const focusQuest = state.quests.find((quest) => quest.id === focusQuestId) ?? null;
  // Filtro de categoria vale para os atalhos; a sugestão de hoje não aparece duas vezes.
  const presets = QUEST_PRESETS.filter((preset) =>
    filter === 'ALL'
      ? !(showSuggestion && preset.id === suggestion.id)
      : preset.category === filter,
  );

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

  const listHeader = (
    <View>
      <View style={styles.habitBlock}>
        <Text style={styles.habitCue} testID="habit-cue">
          {cue.message}
        </Text>
        {daily.limitReached ? (
          <Text style={styles.limitNote}>
            Limite diário atingido. Quests concluídas hoje não rendem mais XP. Volte amanhã.
          </Text>
        ) : null}
      </View>

      {recap ? (
        <WeeklyRecap
          week={recap}
          onDismiss={() => onPatchSettings({ dismissedRecapWeek: recap.weekKey })}
        />
      ) : null}
      <DailyChallengesCard
        challenges={state.dailyChallenges}
        today={today}
        collapsed={state.settings.challengesCollapsed}
        onToggle={() =>
          onPatchSettings({ challengesCollapsed: !state.settings.challengesCollapsed })
        }
      />

      <View style={styles.quickBlock}>
        <Text style={[styles.label, styles.padded]}>Atividades rápidas · um toque registra</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroller}
        >
          {repeatDraft && filter === 'ALL' ? (
            <QuickChip
              kicker="De novo"
              title={repeatDraft.title}
              category={repeatDraft.category}
              difficulty={repeatDraft.difficulty}
              onPress={() =>
                setPresetError(
                  onAddQuest({
                    title: repeatDraft.title,
                    difficulty: repeatDraft.difficulty,
                    category: repeatDraft.category,
                  }),
                )
              }
              accessibilityLabel={`Repetir a última quest ${repeatDraft.title}`}
            />
          ) : null}
          {showSuggestion && filter === 'ALL' ? (
            <QuickChip
              kicker="Sugestão de hoje"
              title={suggestion.title}
              category={suggestion.category}
              difficulty={suggestion.difficulty}
              onPress={() =>
                setPresetError(
                  onAddQuest({
                    title: suggestion.title,
                    difficulty: suggestion.difficulty,
                    category: suggestion.category,
                  }),
                )
              }
              onDismiss={() => onPatchSettings({ dismissedSuggestionDate: today })}
              accessibilityLabel={`Sugestão de hoje: ${suggestion.title}`}
            />
          ) : null}
          {presets.map((preset) => (
            <QuickChip
              key={preset.id}
              title={preset.title}
              category={preset.category}
              difficulty={preset.difficulty}
              onPress={() => addPreset(preset)}
              accessibilityLabel={`Adicionar quest ${preset.title}, mais ${presetXp(preset)} de XP`}
            />
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
          onPress={() => setAskClear(true)}
          accessibilityRole="button"
        >
          <Text style={styles.ghostBtnText}>Limpar concluídas</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.heroBlock, { paddingTop: insets.top + space.md }]}>
        <Image
          source={HERO_BACKDROP[character.characterClass]}
          style={styles.heroBackdrop}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.55)', 'rgba(15, 23, 42, 0.78)', colors.bg]}
          locations={[0, 0.55, 1]}
          style={styles.heroBackdrop}
          pointerEvents="none"
        />
        <Pressable
          style={({ pressed }) => [styles.heroRow, pressed && styles.pressedSoft]}
          onPress={() => setHeroOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir folha do herói ${character.name}`}
          accessibilityHint={
            points > 0 ? `Você tem ${points} pontos de atributo para distribuir.` : undefined
          }
        >
          <View style={styles.heroStage}>
            <View style={styles.heroShadow} />
            <CharacterArt
              assetKey={heroArtKey(character.characterClass, state.inventory)}
              layers={heroLayers(character.characterClass, state.inventory)}
              size={HERO_ART}
              accessibilityLabel={`${classLabel} ${character.name}`}
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroName} numberOfLines={1}>
              {character.name}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {heroRankForLevel(character.level)} · {classLabel}
            </Text>
            <Text style={styles.heroStats} numberOfLines={1}>
              <Text>Streak {stats.streak}d</Text>
              {'  ·  '}
              <Text style={goal.met ? styles.heroStatsDone : undefined} testID="daily-goal-chip">
                Meta {goal.done}/{goal.target}
              </Text>
            </Text>
          </View>
          <View style={[styles.profilePill, points > 0 && styles.profilePillActive]}>
            <Text style={[styles.profilePillText, points > 0 && styles.profilePillTextActive]}>
              {points > 0 ? `+${points} pontos` : 'Perfil'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.meters}>
          <View style={styles.meter}>
            <XpBar xp={character.xp} maxXp={character.maxXp} level={character.level} />
          </View>
          <View style={styles.meter}>
            <HeroVitalsBar character={character} compact />
          </View>
        </View>

        <View style={styles.statRow}>
          <Pressable
            style={({ pressed }) => [styles.panelChip, pressed && styles.pressedSoft]}
            onPress={() => setWeekOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Sua semana: ${weekDays} de 7 dias com quest. Abrir detalhes.`}
            hitSlop={6}
            testID="week-open"
          >
            <Text style={styles.panelChipText}>Semana {weekDays}/7</Text>
            <Chevron direction="right" />
          </Pressable>
          {onStartBoss ? (
            <Pressable
              style={({ pressed }) => [
                styles.panelChip,
                boss.availability === 'READY' && styles.panelChipBoss,
                pressed && styles.pressedSoft,
              ]}
              onPress={() => setBossOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Chefe da semana: ${bossChipLabel(boss)}. Abrir detalhes.`}
              hitSlop={6}
              testID="boss-open"
            >
              <Text
                style={[
                  styles.panelChipText,
                  boss.availability === 'READY' && styles.panelChipTextBoss,
                ]}
              >
                {bossChipLabel(boss)}
              </Text>
              <Chevron
                direction="right"
                color={boss.availability === 'READY' ? BOSS_TINT : undefined}
              />
            </Pressable>
          ) : null}
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
        onFocus={onStartFocus ? setFocusQuestId : undefined}
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

      <InfoSheet
        visible={weekOpen}
        title="Sua semana"
        onClose={() => setWeekOpen(false)}
        testID="week-sheet"
      >
        <WeekStrip days={stats.completionDays} today={today} />
        <View style={styles.sheetStats}>
          <Text style={styles.statChip}>
            Streak {stats.streak}d{streakName ? ` · ${streakName}` : ''}
          </Text>
          <Text
            style={[styles.statChip, daily.limitReached && styles.statChipAlert]}
            testID="daily-xp-chip"
          >
            XP hoje {daily.xpQuestsToday}/{daily.xpQuestsLimit}
          </Text>
        </View>
        <Text style={styles.rankHint} testID="next-rank">
          {nextRankHint(character.level)}
        </Text>
      </InfoSheet>

      {onStartBoss ? (
        <InfoSheet
          visible={bossOpen}
          title="Chefe da semana"
          onClose={() => setBossOpen(false)}
          testID="boss-sheet"
        >
          <BossCard
            boss={state.weeklyBoss}
            level={character.level}
            now={new Date()}
            onStart={() => {
              setBossOpen(false);
              onStartBoss();
            }}
          />
          <Text style={styles.rankHint}>
            Cada luta vencida na semana conta. Um chefe diferente a cada segunda.
          </Text>
        </InfoSheet>
      ) : null}

      <FocusPicker
        key={focusQuestId ?? 'none'}
        quest={focusQuest}
        onClose={() => setFocusQuestId(null)}
        onStart={(questId, minutes) => {
          if (!onStartFocus) return 'Modo foco indisponível.';
          const message = onStartFocus(questId, minutes);
          if (!message) setFocusQuestId(null);
          return message;
        }}
      />

      <ConfirmDialog
        visible={askClear}
        title="Limpar concluídas?"
        message="As quests concluídas saem da lista. Seu XP, nível e streak continuam iguais."
        confirmLabel="Limpar"
        onCancel={() => setAskClear(false)}
        onConfirm={() => {
          setAskClear(false);
          onClearCompleted();
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
        onShareWeek={onShareWeek}
      />
    </View>
  );
}

const HERO_ART = 72;
const BOSS_TINT = '#D8B4FE';

function bossChipLabel(boss: BossStatus): string {
  switch (boss.availability) {
    case 'READY':
      return 'Chefe pronto';
    case 'LOCKED':
      return `Chefe ${boss.wins}/${boss.needed}`;
    case 'BEATEN':
      return 'Chefe vencido';
    case 'TRIED_TODAY':
      return 'Chefe amanhã';
    default:
      return `Chefe no nv. ${BOSS_MIN_LEVEL}`;
  }
}

/** Atividade rápida: o que é, de que tipo e quanto vale, antes de tocar. */
function QuickChip({
  kicker,
  title,
  category,
  difficulty,
  onPress,
  onDismiss,
  accessibilityLabel,
}: {
  kicker?: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  onPress: () => void;
  onDismiss?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {kicker ? <Text style={styles.presetKicker}>{kicker}</Text> : null}
      <Text style={styles.presetChipTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.presetChipMeta} numberOfLines={1}>
        {CATEGORY_LABELS[category]} · {DIFFICULTY_LABELS[difficulty]}
      </Text>
      <View style={styles.presetFoot}>
        <Text style={styles.presetXp}>+{XP_REWARDS[difficulty]} XP</Text>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dispensar sugestão de hoje"
            hitSlop={8}
          >
            <Text style={styles.presetDismiss}>Dispensar</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
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
  onFocus,
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
  onFocus?: (questId: string) => void;
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
          onFocus={onFocus}
        />
      );
    },
    [nowMs, onComplete, onDelete, onEdit, onToggleRecurring, onFocus],
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
    paddingBottom: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  heroBackdrop: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroStage: {
    width: HERO_ART,
    height: HERO_ART,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heroShadow: {
    position: 'absolute',
    bottom: 2,
    left: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5, 8, 20, 0.55)',
    transform: [{ scaleY: 0.18 }],
  },
  meters: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  meter: { flex: 1, minWidth: 0 },
  habitBlock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  heroRow: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    minHeight: HERO_ART,
  },
  heroCopy: { flex: 1, gap: 2 },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroMeta: { fontSize: 14, fontWeight: '600', color: '#CBD5E1' },
  heroStats: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  heroStatsDone: { color: colors.amberSoft },
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
    color: '#CBD5E1',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  statChipAlert: { color: colors.amberSoft, backgroundColor: colors.amberWash },
  panelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 30,
    paddingLeft: space.md,
    paddingRight: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  panelChipBoss: { borderColor: 'rgba(192, 132, 252, 0.8)' },
  panelChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  panelChipTextBoss: { color: BOSS_TINT },
  sheetStats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
  quickBlock: { paddingTop: space.xs, gap: space.md },
  filterBlock: { paddingTop: space.xl, paddingBottom: space.xs, gap: space.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  padded: { paddingHorizontal: space.gutter },
  errorText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  chipScroller: { paddingHorizontal: space.gutter, gap: space.sm, paddingVertical: 2 },
  presetChip: {
    width: 148,
    minHeight: 96,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
    gap: 2,
  },
  presetKicker: { fontSize: 11, fontWeight: '800', color: colors.amberSoft },
  presetChipTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.text },
  presetChipMeta: { fontSize: 12, color: colors.textMuted },
  presetFoot: {
    marginTop: 'auto',
    paddingTop: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetXp: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  presetDismiss: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
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
