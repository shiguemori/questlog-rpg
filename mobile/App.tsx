import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LevelUpOverlay } from './src/components/LevelUpOverlay';
import { BattleOverlay, type BattleRewardView } from './src/components/BattleOverlay';
import { VillainDefeatOverlay } from './src/components/VillainDefeatOverlay';
import { XP_DENY_COPY } from './src/domain/antiFarm';
import {
  applyEnemyMove,
  applyPlayerItem,
  applyPlayerMove,
  rollEnemyVariant,
  startBattle,
  type BattleState,
} from './src/domain/battle';
import { applyBattleSpoils } from './src/domain/battleSpoils';
import { bossStatus, settleBossBattle } from './src/domain/boss';
import { gearBonus, heroArtKey, heroLook, mergeBonus, type PotionId } from './src/domain/loot';
import { lootViewOf } from './src/components/battle/lootView';
import {
  completeQuest,
  planQuestCompletion,
  type QuestRewardTier,
} from './src/domain/completeQuest';
import { celebrationLine, weekShareText, UNDO_COMPLETION_MS } from './src/domain/engagement';
import { newlyUnlockedAchievements, spendAttributePoint } from './src/domain/progression';
import { battleSkillsFor, heroBonus, TALENT_TIER_LEVEL } from './src/domain/talents';
import { ATTRIBUTE_POINTS_PER_LEVEL } from './src/domain/constants';
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
  startJourney,
  updateHero,
} from './src/domain/state';
import type {
  AppState,
  AttributeKey,
  Category,
  CharacterClass,
  Difficulty,
  PlayerSettings,
} from './src/domain/types';
import { localIsoDate } from './src/domain/dates';
import {
  battleStartHp,
  currentHeroHp,
  heroMaxHpFor,
  minutesUntilFullHp,
  settleHeroVitals,
} from './src/domain/vitals';
import { syncDailyReminder } from './src/platform/reminder';
import { playVictorySound } from './src/platform/sound';
import { buildVictoryEvent, type QuestVictoryEvent } from './src/domain/victory';
import { EVENT_STEP_MS, WINDUP_MS } from './src/components/battle/timing';
import { announce, playHaptic, useReducedMotion } from './src/platform/feedback';
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
/** Pausa mínima para ver o golpe do herói (animação e números) antes do monstro agir. */
const ENEMY_TURN_MS = 1000;
/** Teto da pausa: golpes com muitos eventos não podem travar a luta. */
const ENEMY_TURN_MAX_MS = 1700;
/** Com "Reduzir movimento" não há animação, mas o texto ainda precisa ser lido. */
const ENEMY_TURN_REDUCED_MS = 400;

/** A pausa acompanha a animação: preparo + um passo por evento + o fim do efeito. */
function enemyTurnDelay(eventCount: number): number {
  const animation = WINDUP_MS + eventCount * EVENT_STEP_MS + 420;
  return Math.min(ENEMY_TURN_MAX_MS, Math.max(ENEMY_TURN_MS, animation));
}

/** O que cada nível dá (mostrado no level up). */
function levelUpRewards(): { value: string; label: string }[] {
  return [
    { value: `+${ATTRIBUTE_POINTS_PER_LEVEL}`, label: 'pontos de atributo' },
    { value: '+1', label: 'ponto de talento' },
  ];
}

/** Camada nova da árvore de talentos que abriu exatamente neste nível. */
function levelUpUnlock(level: number | null): string | null {
  if (level == null) return null;
  const tier = (Object.entries(TALENT_TIER_LEVEL) as [string, number][]).find(
    ([, minLevel]) => minLevel === level,
  );
  if (!tier) return null;
  return tier[0] === '1'
    ? 'A árvore de talentos abriu. Escolha seu primeiro talento.'
    : `Talentos da camada ${tier[0]} liberados na árvore.`;
}

function vitalsLine(character: AppState['character'], now: Date): string {
  const hp = currentHeroHp(character, now);
  const maxHp = heroMaxHpFor(character);
  const minutes = minutesUntilFullHp(character, now);
  if (minutes <= 0) return `Vida cheia: ${hp}/${maxHp}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const wait =
    hours > 0 ? `${hours}h${rest > 0 ? String(rest).padStart(2, '0') : ''}` : `${rest} min`;
  return `Vida ${hp}/${maxHp} · enche em ${wait}`;
}

interface BattleSession {
  /** Luta de quest (conclui a quest) ou o chefe da semana. */
  kind: 'QUEST' | 'BOSS';
  questId: string | null;
  difficulty: Difficulty;
  /** Semente da luta: decide a sorte e o loot. */
  seed: number;
  startedAtMs: number;
  snapshot: AppState;
  battle: BattleState;
  reward: BattleRewardView | null;
  leveledUp: boolean;
  newLevel: number | null;
}

export interface QuestLogAppProps {
  /** Injetável nos testes; no aparelho usa o AsyncStorage protegido. */
  store?: StateStore;
}

export function QuestLogApp({ store = stateStore }: QuestLogAppProps) {
  const [state, setState] = useState<AppState | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [heroRequest, setHeroRequest] = useState(0);
  const [victoryEvent, setVictoryEvent] = useState<QuestVictoryEvent | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<AppState | null>(null);
  const undoRef = useRef<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const enemyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<BattleSession | null>(null);
  const settledRef = useRef(false);
  const [session, setSession] = useState<BattleSession | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearUndo = useCallback(() => {
    undoRef.current = null;
    setUndoState(null);
  }, []);

  const clearEnemyTimer = useCallback(() => {
    if (enemyTimer.current) clearTimeout(enemyTimer.current);
    enemyTimer.current = null;
  }, []);

  const clearBattle = useCallback(() => {
    clearEnemyTimer();
    settledRef.current = false;
    sessionRef.current = null;
    setSession(null);
  }, [clearEnemyTimer]);

  useEffect(() => () => clearEnemyTimer(), [clearEnemyTimer]);

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
    clearBattle();
    setState(snapshot);
    setFeedback('Conclusão desfeita. XP e streak voltaram.');
    announce('Conclusão desfeita. XP e streak voltaram.');
    playHaptic('TAP');
  }, [clearBattle]);

  const resolveBattle = useCallback(
    (base: BattleSession, battle: BattleState, phase: 'VICTORY' | 'DEFEAT') => {
      if (settledRef.current) return;
      settledRef.current = true;
      clearEnemyTimer();
      const won = phase === 'VICTORY';

      if (base.kind === 'BOSS' || base.questId == null) {
        const endedAt = new Date();
        const outcome = settleBossBattle(base.snapshot, {
          won,
          heroHp: battle.hero.hp,
          seed: base.seed,
          now: endedAt,
          potionsUsed: battle.potionsUsed,
        });
        const bossReward: BattleRewardView = {
          vitalsLine: vitalsLine(outcome.state.character, endedAt),
          xpAwarded: outcome.xpAwarded,
          reduced: false,
          habitLine: won ? 'Ele volta na semana que vem.' : 'Dá para tentar de novo amanhã.',
          summary: won ? undefined : 'Sem XP desta vez.',
          loot: lootViewOf(outcome.drop),
        };
        const settled: BattleSession = {
          ...base,
          battle,
          reward: bossReward,
          leveledUp: outcome.leveledUp,
          newLevel: outcome.newLevel,
        };
        sessionRef.current = settled;
        setSession(settled);
        setState(outcome.state);
        if (won) {
          playHaptic('SUCCESS');
          void playVictorySound(base.snapshot.settings.soundEnabled);
          announce(`Chefe derrotado! Mais ${outcome.xpAwarded} de XP.`);
        } else {
          playHaptic('WARNING');
          announce('Você caiu. Dá para tentar de novo amanhã.');
        }
        return;
      }

      const rewardTier: QuestRewardTier = won ? 'FULL' : 'REDUCED';
      const completed = completeQuest(base.snapshot, base.questId, new Date(base.startedAtMs), {
        rewardTier,
      });
      // A vida que sobrou fica guardada para a próxima luta (level up enche).
      const endedAt = new Date();
      const spoils = completed
        ? applyBattleSpoils(completed.state, {
            battle,
            won,
            seed: base.seed,
            difficulty: base.difficulty,
            now: endedAt,
          })
        : null;
      const result =
        completed && spoils
          ? {
              ...completed,
              state: {
                ...spoils.state,
                character: settleHeroVitals(
                  spoils.state.character,
                  battle.hero.hp,
                  endedAt,
                  completed.leveledUp,
                ),
              },
            }
          : null;
      const reward: BattleRewardView = {
        vitalsLine: result ? vitalsLine(result.state.character, endedAt) : null,
        xpAwarded: result?.xpAwarded ?? 0,
        reduced: rewardTier === 'REDUCED' && (result?.xpAwarded ?? 0) > 0,
        habitLine: result
          ? celebrationLine({
              dailyGoalJustMet: result.dailyGoalJustMet,
              milestone: result.streakMilestone,
            })
          : null,
        loot: lootViewOf(spoils?.drop ?? null),
      };
      const next: BattleSession = {
        ...base,
        battle,
        reward,
        leveledUp: result?.leveledUp ?? false,
        newLevel: result?.newLevel ?? null,
      };
      sessionRef.current = next;
      setSession(next);
      if (!result) return;

      undoRef.current = base.snapshot;
      setUndoState(base.snapshot);
      setState(result.state);

      const spoken = reward.habitLine ? ` ${reward.habitLine}` : '';
      const line =
        result.xpAwarded <= 0
          ? result.denyReason
            ? XP_DENY_COPY[result.denyReason]
            : 'Quest concluída sem XP.'
          : reward.reduced
            ? `Quest concluída. Mais ${result.xpAwarded} de XP, sem bônus.`
            : `Quest concluída. Mais ${result.xpAwarded} de XP.`;
      if (result.xpAwarded > 0) {
        playHaptic('SUCCESS');
        void playVictorySound(base.snapshot.settings.soundEnabled);
      } else {
        playHaptic('WARNING');
      }
      announce(`${line}${spoken}`);

      const unlocked = newlyUnlockedAchievements(base.snapshot, result.state);
      if (unlocked.length > 0) {
        setFeedback(`Conquista desbloqueada: ${unlocked.map((item) => item.title).join(', ')}`);
      } else if (result.shieldConsumed) {
        setFeedback('Escudo usado. O streak continua. Isso não dá XP.');
      }
    },
    [clearEnemyTimer],
  );

  /**
   * Turno do monstro depois de uma pausa. Se o herói estiver atordoado, o motor
   * devolve ENEMY_TURN de novo e o monstro age mais uma vez (via ref, sem recursão de hook).
   */
  const scheduleRef = useRef<() => void>(() => undefined);
  const scheduleEnemyTurn = useCallback(() => {
    clearEnemyTimer();
    enemyTimer.current = setTimeout(
      () => {
        const live = sessionRef.current;
        if (!live || live.reward || settledRef.current) return;
        if (live.battle.phase !== 'ENEMY_TURN') return;
        const after = applyEnemyMove(live.battle);
        if (after.phase === 'VICTORY' || after.phase === 'DEFEAT') {
          resolveBattle(live, after, after.phase);
          return;
        }
        const updated: BattleSession = { ...live, battle: after };
        sessionRef.current = updated;
        setSession(updated);
        if (after.phase === 'ENEMY_TURN') scheduleRef.current();
      },
      reduceMotion
        ? ENEMY_TURN_REDUCED_MS
        : enemyTurnDelay(sessionRef.current?.battle.events.length ?? 0),
    );
  }, [clearEnemyTimer, reduceMotion, resolveBattle]);
  useEffect(() => {
    scheduleRef.current = scheduleEnemyTurn;
  }, [scheduleEnemyTurn]);

  const handlePlayerMove = useCallback(
    (moveId: string) => {
      const current = sessionRef.current;
      if (!current || current.reward || settledRef.current) return;
      if (current.battle.phase !== 'PLAYER_TURN') return;
      const nextBattle = applyPlayerMove(current.battle, moveId);
      if (nextBattle === current.battle) return;
      if (nextBattle.phase === 'VICTORY' || nextBattle.phase === 'DEFEAT') {
        resolveBattle(current, nextBattle, nextBattle.phase);
        return;
      }
      const pending: BattleSession = { ...current, battle: nextBattle };
      sessionRef.current = pending;
      setSession(pending);
      scheduleEnemyTurn();
    },
    [resolveBattle, scheduleEnemyTurn],
  );

  const handlePlayerItem = useCallback(
    (potionId: PotionId) => {
      const current = sessionRef.current;
      if (!current || current.reward || settledRef.current) return;
      const nextBattle = applyPlayerItem(current.battle, potionId);
      if (nextBattle === current.battle) return;
      const pending: BattleSession = { ...current, battle: nextBattle };
      sessionRef.current = pending;
      setSession(pending);
      scheduleEnemyTurn();
    },
    [scheduleEnemyTurn],
  );

  /** Chefe da semana: só com as vitórias da semana e uma tentativa por dia. */
  const handleStartBoss = useCallback(() => {
    const current = stateRef.current;
    if (!current || sessionRef.current) return;
    const now = new Date();
    if (bossStatus(current.weeklyBoss, now, current.character.level).availability !== 'READY')
      return;
    clearUndo();
    settledRef.current = false;
    const seed = now.getTime() >>> 0;
    const next: BattleSession = {
      kind: 'BOSS',
      questId: null,
      difficulty: 'HARD',
      seed,
      startedAtMs: now.getTime(),
      snapshot: current,
      battle: startBattle({
        character: current.character,
        category: 'OTHER',
        difficulty: 'HARD',
        variant: 'BOSS',
        heroName: current.character.name,
        heroHp: battleStartHp(current.character, now),
        seed,
        skills: battleSkillsFor(current.character),
        bonus: mergeBonus(heroBonus(current.character), gearBonus(current.inventory)),
        potions: current.inventory.potions,
        heroLook: heroLook(current.inventory),
      }),
      reward: null,
      leveledUp: false,
      newLevel: null,
    };
    sessionRef.current = next;
    setSession(next);
    announce(`Chefe da semana: ${next.battle.enemy.name}.`);
    playHaptic('TAP');
  }, [clearUndo]);

  const dismissBattle = useCallback(() => {
    const pending = sessionRef.current;
    const level = pending?.leveledUp ? pending.newLevel : null;
    clearBattle();
    if (level != null) {
      setLevelUpLevel(level);
      playHaptic('SUCCESS');
      announce(`Level up! Você chegou ao nível ${level}.`);
    }
  }, [clearBattle]);

  const handleCompleteQuest = useCallback(
    (questId: string) => {
      const current = stateRef.current;
      if (!current || sessionRef.current) return;
      const quest = current.quests.find((item) => item.id === questId);
      const now = new Date();
      const plan = planQuestCompletion(current, questId, now);
      if (plan === 'REJECTED' || !quest) return;
      if (plan === 'BATTLE') {
        clearUndo();
        settledRef.current = false;
        const seed = now.getTime() >>> 0;
        const next: BattleSession = {
          kind: 'QUEST',
          questId,
          difficulty: quest.difficulty,
          seed,
          startedAtMs: now.getTime(),
          snapshot: current,
          battle: startBattle({
            character: current.character,
            category: quest.category,
            difficulty: quest.difficulty,
            variant: rollEnemyVariant(seed, quest.difficulty, current.character.level),
            heroName: current.character.name,
            heroHp: battleStartHp(current.character, now),
            seed,
            skills: battleSkillsFor(current.character),
            bonus: mergeBonus(heroBonus(current.character), gearBonus(current.inventory)),
            potions: current.inventory.potions,
            heroLook: heroLook(current.inventory),
          }),
          reward: null,
          leveledUp: false,
          newLevel: null,
        };
        sessionRef.current = next;
        setSession(next);
        announce(`Batalha contra ${next.battle.enemy.name}.`);
        playHaptic('TAP');
        return;
      }

      const result = completeQuest(current, questId, now);
      if (!result) return;

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
    },
    [clearUndo],
  );

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

  /** Talentos, loadout e reset de atributos: casos de uso que devolvem null quando não dá. */
  const handleHeroChange = useCallback(
    (change: (current: AppState) => AppState | null) => {
      clearUndo();
      setState((current) => (current ? (change(current) ?? current) : current));
      playHaptic('TAP');
    },
    [clearUndo],
  );

  const handleResetJourney = useCallback(() => {
    clearUndo();
    clearBattle();
    setVictoryEvent(null);
    setLevelUpLevel(null);
    setFeedback(null);
    void store.clear();
    setState(createInitialState());
  }, [store, clearUndo, clearBattle]);

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
          onHeroChange={handleHeroChange}
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
          onShareWeek={() => {
            void handleShareWeek();
          }}
          onCalendarDay={handleCalendarDay}
          heroRequest={heroRequest}
          onStartBoss={handleStartBoss}
        />
      ) : (
        <OnboardingScreen onComplete={handleOnboarding} />
      )}
      {session ? (
        <BattleOverlay
          battle={session.battle}
          reward={session.reward}
          onMove={handlePlayerMove}
          onItem={handlePlayerItem}
          onDismiss={dismissBattle}
          onUndo={undoState && session.kind === 'QUEST' ? handleUndo : undefined}
          soundEnabled={state?.settings.soundEnabled ?? false}
          musicVolume={state?.settings.musicVolume ?? 0}
          showTutorial={state ? !state.settings.battleTutorialDone : false}
          onTutorialDone={() => patchSettings({ battleTutorialDone: true })}
        />
      ) : null}
      <VillainDefeatOverlay
        event={victoryEvent}
        onDismiss={dismissVictory}
        onUndo={undoState ? handleUndo : undefined}
      />
      <LevelUpOverlay
        visible={levelUpLevel != null}
        level={levelUpLevel ?? state.character.level}
        heroName={state.character.name || DEFAULT_HERO_NAME}
        assetKey={heroArtKey(state.character.characterClass, state.inventory)}
        rewards={levelUpRewards()}
        unlockLine={levelUpUnlock(levelUpLevel)}
        onDismiss={() => setLevelUpLevel(null)}
        onOpenHero={() => {
          setLevelUpLevel(null);
          setHeroRequest((value) => value + 1);
        }}
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
