import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CLASS_DEFAULTS, XP_REWARDS } from './src/domain/constants';
import type { AppState, CharacterClass, Difficulty, Quest } from './src/domain/types';
import { applyXp, nextStreak } from './src/domain/xp';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { QuestLogScreen } from './src/screens/QuestLogScreen';
import { createInitialState, loadState, saveState } from './src/storage/persist';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadState().then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    void saveState(state);
  }, [state]);

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

  const handleAddQuest = (title: string, difficulty: Difficulty) => {
    const quest: Quest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      category: 'OTHER',
      difficulty,
      xp: XP_REWARDS[difficulty],
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => (prev ? { ...prev, quests: [quest, ...prev.quests] } : prev));
  };

  const handleCompleteQuest = (id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const quest = prev.quests.find((q) => q.id === id);
      if (!quest || quest.completed) return prev;

      const today = new Date().toISOString().split('T')[0];
      const progress = applyXp(
        prev.character.level,
        prev.character.xp,
        prev.character.maxXp,
        quest.xp,
      );

      return {
        ...prev,
        quests: prev.quests.map((q) => (q.id === id ? { ...q, completed: true } : q)),
        character: {
          ...prev.character,
          level: progress.level,
          xp: progress.xp,
          maxXp: progress.maxXp,
          attributePoints:
            prev.character.attributePoints + progress.attributePointsGained,
        },
        stats: {
          ...prev.stats,
          streak: nextStreak(prev.stats, today),
          lastCompletedDate: today,
          totalXpEarned: prev.stats.totalXpEarned + quest.xp,
          totalQuestsCompleted: prev.stats.totalQuestsCompleted + 1,
        },
      };
    });
  };

  return (
    <>
      <StatusBar style="light" />
      {state.onboardingDone ? (
        <QuestLogScreen
          state={state}
          onAddQuest={handleAddQuest}
          onCompleteQuest={handleCompleteQuest}
        />
      ) : (
        <OnboardingScreen onComplete={handleOnboarding} />
      )}
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
