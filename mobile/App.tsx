import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LevelUpOverlay } from './src/components/LevelUpOverlay';
import { VillainDefeatOverlay } from './src/components/VillainDefeatOverlay';
import { XP_DENY_COPY } from './src/domain/antiFarm';
import { completeQuest } from './src/domain/completeQuest';
import { celebrationLine, UNDO_COMPLETION_MS } from './src/domain/engagement';
import { newlyUnlockedAchievements, spendAttributePoint } from './src/domain/progression';
import {
  addQuest,
  clearCompletedQuests,
  deleteQuest,
  type NewQuestInput,
} from './src/domain/quests';
import { createInitialState, DEFAULT_HERO_NAME, startJourney } from './src/domain/state';
import type { AppState, AttributeKey, CharacterClass } from './src/domain/types';
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
    setVictoryEvent(event);

    const spoken = habitLine ? ` ${habitLine}` : '';
    if (event.outcome === 'VICTORY') {
      playHaptic('SUCCESS');
      announce(`Quest concluída. Mais ${result.xpAwarded} de XP.${spoken}`);
    } else {
      playHaptic('WARNING');
      announce(
        `${result.denyReason ? XP_DENY_COPY[result.denyReason] : 'Quest concluída sem XP.'}${spoken}`,
      );
    }

    const unlocked = newlyUnlockedAchievements(current, result.state);
    if (unlocked.length > 0) {
      setFeedback(`Conquista desbloqueada: ${unlocked.map((item) => item.title).join(', ')}`);
    }
  }, []);

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
