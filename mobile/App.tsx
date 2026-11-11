import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LevelUpOverlay } from './src/components/LevelUpOverlay';
import { VillainDefeatOverlay } from './src/components/VillainDefeatOverlay';
import { XP_DENY_COPY } from './src/domain/antiFarm';
import { completeQuest } from './src/domain/completeQuest';
import { celebrationLine, weekShareText, UNDO_COMPLETION_MS } from './src/domain/engagement';
import { newlyUnlockedAchievements, spendAttributePoint } from './src/domain/progression';
import {
  addQuest,
  clearCompletedQuests,
  deleteQuest,
  editQuest,
  reopenDueRecurring,
  setQuestRecurring,
  type NewQuestInput,
} from './src/domain/quests';
import { canArmStreakShield } from './src/domain/rewards';
import {
  createInitialState,
  DEFAULT_HERO_NAME,
  exportSaveJson,
  importSaveJson,
  startJourney,
  updateHero,
} from './src/domain/state';
import type {
  AppState,
  AttributeKey,
  Category,
  CharacterClass,
  PlayerSettings,
} from './src/domain/types';
import { localIsoDate } from './src/domain/dates';
import { syncDailyReminder } from './src/platform/reminder';
import { playVictorySound } from './src/platform/sound';
import { buildVictoryEvent, type QuestVictoryEvent } from './src/domain/victory';
import { announce, playHaptic } from './src/platform/feedback';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { QuestLogScreen } from './src/screens/QuestLogScreen';
import { stateStore } from './src/storage/persist';
import type { LoadStatus, StateStore } from './src/storage/stateStore';
import { colors } from './src/theme/colors';

const NOTICE_NOT_SAVING =
  'O armazenamento do aparelho não respondeu. Dá para jogar, mas o progresso desta sessão pode não ficar salvo.';

const LOAD_NOTICE: Record<LoadStatus, string | null> = {
  EMPTY: null,
  RESTORED: null,
  CORRUPTED: 'Não conseguimos ler seu save anterior. Começamos uma jornada nova.',
  UNAVAILABLE: NOTICE_NOT_SAVING,
};

const FEEDBACK_VISIBLE_MS = 4200;

export interface QuestLogAppProps {
  /** Injetável nos testes; no aparelho usa o AsyncStorage protegido. */
  store?: StateStore;
}

export function QuestLogApp({ store = stateStore }: QuestLogAppProps) {
  const [state, setState] = useState<AppState | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [victoryEvent, setVictoryEvent] = useState<QuestVictoryEvent | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<AppState | null>(null);
  const undoRef = useRef<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearUndo = useCallback(() => {
    undoRef.current = null;
    setUndoState(null);
  }, []);

  // Hidratação: `load` nunca rejeita, então o app sempre sai do boot.
  useEffect(() => {
    let cancelled = false;
    store.load().then((result) => {
      if (cancelled) return;
      setState(result.state);
      setStorageNotice(LOAD_NOTICE[result.status]);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Persistência: só depois de hidratar (state != null); falha vira aviso, nunca crash.
  useEffect(() => {
    if (!state) return undefined;
    let cancelled = false;
    store.save(state).then((result) => {
      if (cancelled) return;
      setStorageNotice((current) => {
        if (!result.ok) return NOTICE_NOT_SAVING;
        return current === NOTICE_NOT_SAVING ? null : current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [state, store]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!undoState) return undefined;
    const timer = setTimeout(() => {
      undoRef.current = null;
      setUndoState(null);
    }, UNDO_COMPLETION_MS);
    return () => clearTimeout(timer);
  }, [undoState]);

  const handleOnboarding = useCallback((name: string, characterClass: CharacterClass) => {
    setState(startJourney(name, characterClass));
  }, []);

  const handleAddQuest = useCallback(
    (input: NewQuestInput): string | null => {
      const current = stateRef.current;
      if (!current) return null;
      const result = addQuest(current, input);
      if (!result.ok) return result.message;
      clearUndo();
      setState(result.state);
      announce('Quest registrada. O XP libera em 1 minuto.');
      return null;
    },
    [clearUndo],
  );

  const handleUndo = useCallback(() => {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    undoRef.current = null;
    setUndoState(null);
    setVictoryEvent(null);
    setLevelUpLevel(null);
    setState(snapshot);
    setFeedback('Conclusão desfeita. XP e streak voltaram.');
    announce('Conclusão desfeita. XP e streak voltaram.');
    playHaptic('TAP');
  }, []);

  const handleCompleteQuest = useCallback((questId: string) => {
    const current = stateRef.current;
    if (!current) return;
    const quest = current.quests.find((item) => item.id === questId);
    const result = completeQuest(current, questId);
    if (!result || !quest) return;

    undoRef.current = current;
    setUndoState(current);
    setState(result.state);

    const habitLine = celebrationLine({
      dailyGoalJustMet: result.dailyGoalJustMet,
      milestone: result.streakMilestone,
    });
    const event = buildVictoryEvent({
      questTitle: quest.title,
      category: quest.category,
      xpAwarded: result.xpAwarded,
      denyReason: result.denyReason,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      habitLine,
    });
    const spoken = habitLine ? ` ${habitLine}` : '';
    const discreet =
      result.xpAwarded > 0
        ? `Quest concluída. +${result.xpAwarded} XP.`
        : result.denyReason
          ? XP_DENY_COPY[result.denyReason]
          : 'Quest concluída sem XP.';

    if (result.showVillainScene) {
      setVictoryEvent(event);
    } else if (result.leveledUp && result.newLevel != null) {
      setVictoryEvent(null);
      setLevelUpLevel(result.newLevel);
      announce(`Level up! Você chegou ao nível ${result.newLevel}.`);
    } else {
      setVictoryEvent(null);
    }

    if (result.xpAwarded > 0) {
      playHaptic('SUCCESS');
      announce(`Quest concluída. Mais ${result.xpAwarded} de XP.${spoken}`);
      void playVictorySound(current.settings.soundEnabled);
    } else {
      playHaptic('WARNING');
      announce(`${discreet}${spoken}`);
    }

    const unlocked = newlyUnlockedAchievements(current, result.state);
    if (unlocked.length > 0) {
      setFeedback(`Conquista desbloqueada: ${unlocked.map((item) => item.title).join(', ')}`);
    } else if (result.shieldConsumed) {
      setFeedback('Escudo usado. O streak continua. Isso não dá XP.');
    } else if (!result.showVillainScene) {
      setFeedback(habitLine ?? discreet);
    }
  }, []);

  const handleCalendarDay = useCallback(() => {
    setState((current) => (current ? reopenDueRecurring(current) : current));
  }, []);

  const reminder = state?.settings.reminder ?? null;
  useEffect(() => {
    void syncDailyReminder(reminder);
  }, [reminder]);

  const patchSettings = useCallback((partial: Partial<PlayerSettings>) => {
    setState((current) =>
      current ? { ...current, settings: { ...current.settings, ...partial } } : current,
    );
  }, []);

  const handleEditQuest = useCallback((questId: string, title: string, category: Category) => {
    const current = stateRef.current;
    if (!current) return 'A jornada ainda está carregando.';
    const result = editQuest(current, questId, { title, category });
    if (!result.ok) return result.message;
    setState(result.state);
    return null;
  }, []);

  const handleToggleRecurring = useCallback((questId: string) => {
    setState((current) => {
      if (!current) return current;
      const quest = current.quests.find((item) => item.id === questId);
      if (!quest) return current;
      return setQuestRecurring(current, questId, !quest.recurring);
    });
  }, []);

  const handleRename = useCallback((name: string) => {
    const current = stateRef.current;
    if (!current) return 'A jornada ainda está carregando.';
    const result = updateHero(current, { name });
    if (!result.ok) return result.message;
    setState(result.state);
    return null;
  }, []);

  const handleChangeClass = useCallback((characterClass: CharacterClass) => {
    setState((current) => {
      if (!current) return current;
      const result = updateHero(current, { characterClass });
      return result.ok ? result.state : current;
    });
  }, []);

  const handleImport = useCallback(
    (raw: string) => {
      const result = importSaveJson(raw);
      if (!result.ok) return result.message;
      clearUndo();
      setVictoryEvent(null);
      setLevelUpLevel(null);
      setState(result.state);
      setFeedback('Save importado neste aparelho.');
      return null;
    },
    [clearUndo],
  );

  const handleExport = useCallback(async () => {
    const current = stateRef.current;
    if (!current) return;
    await Share.share({ message: exportSaveJson(current) });
  }, []);

  const handleShareWeek = useCallback(async () => {
    const current = stateRef.current;
    if (!current) return;
    await Share.share({
      message: weekShareText(current.stats.completionDays, localIsoDate(new Date())),
    });
  }, []);

  const handleToggleShield = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const today = localIsoDate(new Date());
    if (current.settings.streakShieldArmed) {
      patchSettings({ streakShieldArmed: false });
      return;
    }
    if (!canArmStreakShield(current.settings, today)) {
      setFeedback('O escudo deste mês já foi usado.');
      return;
    }
    patchSettings({ streakShieldArmed: true });
    setFeedback('Escudo armado. Ele cobre um dia perdido e não dá XP.');
  }, [patchSettings]);

  const handleDeleteQuest = useCallback(
    (questId: string) => {
      clearUndo();
      setState((current) => (current ? deleteQuest(current, questId) : current));
    },
    [clearUndo],
  );

  const handleClearCompleted = useCallback(() => {
    clearUndo();
    setState((current) => (current ? clearCompletedQuests(current) : current));
  }, [clearUndo]);

  const handleSpendAttributePoint = useCallback(
    (attribute: AttributeKey) => {
      clearUndo();
      setState((current) => {
        if (!current) return current;
        return spendAttributePoint(current, attribute) ?? current;
      });
      playHaptic('TAP');
    },
    [clearUndo],
  );

  const handleResetJourney = useCallback(() => {
    clearUndo();
    setVictoryEvent(null);
    setLevelUpLevel(null);
    setFeedback(null);
    void store.clear();
    setState(createInitialState());
  }, [store, clearUndo]);

  const dismissFeedback = useCallback(() => setFeedback(null), []);
  const dismissStorageNotice = useCallback(() => setStorageNotice(null), []);

  const dismissVictory = () => {
    const pendingLevel = victoryEvent?.leveledUp ? victoryEvent.newLevel : null;
    setVictoryEvent(null);
    if (pendingLevel != null) {
      setLevelUpLevel(pendingLevel);
      playHaptic('SUCCESS');
      announce(`Level up! Você chegou ao nível ${pendingLevel}.`);
    }
  };

  if (!state) return <BootSkeleton />;

  return (
    <>
      <StatusBar style="light" />
      {state.onboardingDone ? (
        <QuestLogScreen
          state={state}
          feedback={feedback}
          storageNotice={storageNotice}
          onAddQuest={handleAddQuest}
          onCompleteQuest={handleCompleteQuest}
          onDeleteQuest={handleDeleteQuest}
          onClearCompleted={handleClearCompleted}
          onSpendAttributePoint={handleSpendAttributePoint}
          onResetJourney={handleResetJourney}
          onDismissFeedback={dismissFeedback}
          onDismissStorageNotice={dismissStorageNotice}
          canUndo={undoState != null}
          onUndo={handleUndo}
          onEditQuest={handleEditQuest}
          onToggleRecurring={handleToggleRecurring}
          onRename={handleRename}
          onChangeClass={handleChangeClass}
          onPatchSettings={patchSettings}
          onToggleShield={handleToggleShield}
          onImportSave={handleImport}
          onExportSave={() => {
            void handleExport();
          }}
          onShareWeek={() => {
            void handleShareWeek();
          }}
          onCalendarDay={handleCalendarDay}
        />
      ) : (
        <OnboardingScreen onComplete={handleOnboarding} />
      )}
      <VillainDefeatOverlay
        event={victoryEvent}
        onDismiss={dismissVictory}
        onUndo={undoState ? handleUndo : undefined}
      />
      <LevelUpOverlay
        visible={levelUpLevel != null}
        level={levelUpLevel ?? state.character.level}
        heroName={state.character.name || DEFAULT_HERO_NAME}
        onDismiss={() => setLevelUpLevel(null)}
        onUndo={undoState ? handleUndo : undefined}
      />
    </>
  );
}

/** Esqueleto do boot — mesma silhueta da tela principal, sem spinner. */
function BootSkeleton() {
  return (
    <View
      style={styles.boot}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando sua jornada"
      testID="boot-skeleton"
    >
      <StatusBar style="light" />
      <View style={styles.bootHero}>
        <View style={styles.bootAvatar} />
        <View style={styles.bootLines}>
          <View style={[styles.bootLine, styles.bootLineWide]} />
          <View style={[styles.bootLine, styles.bootLineShort]} />
        </View>
      </View>
      <View style={styles.bootBar} />
      <View style={styles.bootCard} />
      <View style={styles.bootCard} />
      <View style={styles.bootCard} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QuestLogApp />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 72,
    gap: 12,
  },
  bootHero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bootAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bgElevated },
  bootLines: { flex: 1, gap: 10 },
  bootLine: { height: 14, borderRadius: 7, backgroundColor: colors.bgElevated },
  bootLineWide: { width: '70%' },
  bootLineShort: { width: '45%' },
  bootBar: { height: 10, borderRadius: 5, backgroundColor: colors.bgElevated, marginBottom: 12 },
  bootCard: { height: 64, borderRadius: 14, backgroundColor: colors.bgElevated },
});
