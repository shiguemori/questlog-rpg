import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LevelUpOverlay } from './src/components/LevelUpOverlay';
import { CLASS_DEFAULTS, XP_REWARDS } from './src/domain/constants';
import { completeQuest } from './src/domain/completeQuest';
import type {
  AppState,
  Category,
  CharacterClass,
  Difficulty,
  Quest,
} from './src/domain/types';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { QuestLogScreen } from './src/screens/QuestLogScreen';
import { createInitialState, loadState, saveState } from './src/storage/persist';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setState(createInitialState());
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    void saveState(state);
  }, [state]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4200);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!state) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#F59E0B" size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  const handleOnboarding = (name: string, characterClass: CharacterClass) => {
    const base = createInitialState();
    setState({
      ...base,
      onboardingDone: true,
      character: {
        ...base.character,
        name,
        characterClass,
        attributes: { ...CLASS_DEFAULTS[characterClass].attributes },
      },
    });
  };

  const handleAddQuest = (title: string, difficulty: Difficulty, category: Category) => {
    const quest: Quest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      category,
      difficulty,
      xp: XP_REWARDS[difficulty],
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => (prev ? { ...prev, quests: [quest, ...prev.quests] } : prev));
    setFeedback('Quest registrada. Espere 1 min para ganhar XP ao concluir.');
  };

  const handleCompleteQuest = (id: string) => {
    if (!state) return;
    const result = completeQuest(state, id);
    if (!result) return;

    setState(result.state);

    if (result.leveledUp && result.newLevel != null) {
      setLevelUpLevel(result.newLevel);
    } else if (result.denyReason === 'TOO_FAST') {
      setFeedback('Quest concluída sem XP — espere 1 minuto após criar.');
    } else if (result.denyReason === 'DAILY_LIMIT') {
      setFeedback('Limite diário de 10 quests com XP. A quest foi marcada como feita.');
    } else if (result.xpAwarded > 0) {
      setFeedback(`+${result.xpAwarded} XP conquistados!`);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      {state.onboardingDone ? (
        <QuestLogScreen
          state={state}
          feedback={feedback}
          loadWarning={loadError ? 'Não deu para restaurar o save. Começamos limpo.' : null}
          onAddQuest={handleAddQuest}
          onCompleteQuest={handleCompleteQuest}
          onDismissFeedback={() => setFeedback(null)}
        />
      ) : (
        <OnboardingScreen onComplete={handleOnboarding} />
      )}
      <LevelUpOverlay
        visible={levelUpLevel != null}
        level={levelUpLevel ?? state.character.level}
        heroName={state.character.name || 'Herói'}
        onDismiss={() => setLevelUpLevel(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
