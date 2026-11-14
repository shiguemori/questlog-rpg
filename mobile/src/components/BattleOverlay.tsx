import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { overshoot } from '../motion/easing';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
  type EdgeInsets,
} from 'react-native-safe-area-context';
import { BOSSES, turnLimitFor, type BattleSkill, type BattleState } from '../domain/battle';
import type { PotionId } from '../domain/loot';
import type { MusicVolume } from '../domain/types';
import { useBattleMusic } from '../platform/battleMusic';
import { playChestCue, useBattleCues } from '../platform/battleCues';
import { useReducedMotion } from '../platform/feedback';
import { battle as tone, colors } from '../theme/colors';
import { space } from '../theme/spacing';
import {
  EnemyPlate,
  HeroBar,
  PotionRow,
  SkillDetail,
  SkillGrid,
  TurnPill,
} from './battle/BattleHud';
import {
  BattleBanner,
  BattleResult,
  BattleTutorial,
  Confetti,
  type LootView,
} from './battle/BattleMoments';
import { ActorStage, EVENT_STEP_MS, WINDUP_MS } from './battle/BattleStage';
import { SkillCastLayer } from './battle/SkillCast';

export interface BattleRewardView {
  xpAwarded: number;
  reduced: boolean;
  habitLine: string | null;
  /** Vida guardada depois da luta, ex.: "Vida 23/48 · enche em 3h". */
  vitalsLine?: string | null;
  /** Item que o monstro deixou. */
  loot?: LootView | null;
  /** Troca a frase do XP (ex.: derrota contra o chefe). */
  summary?: string;
  /** Desafios do dia que fecharam nesta luta ("Desafio do dia: … · +1 Café Forte"). */
  challengeLines?: string[];
}

export interface BattleOverlayProps {
  battle: BattleState | null;
  reward: BattleRewardView | null;
  onMove: (moveId: string) => void;
  /** Usar poção da mochila (gasta o turno). */
  onItem?: (potionId: PotionId) => void;
  onDismiss: () => void;
  onUndo?: () => void;
  /** Som de golpes (Ajustes → Som). */
  soundEnabled?: boolean;
  /** Primeira batalha: mostra como lutar até a pessoa agir ou dispensar. */
  /** Primeira luta: a dica de como lutar já abre. Depois, só pelo botão "?". */
  showTutorial?: boolean;
  /** Trilha da arena (Ajustes → Música). 0 = desligada. */
  musicVolume?: MusicVolume;
  /** Luta fácil: resolve na hora, sem animação (o herói escolhe os golpes). */
  onAutoResolve?: () => void;
}

/**
 * Cenário da arena, pela categoria do monstro. Renderizados no Blender (1080×1350),
 * fonte em `assets/blender/sources/battle-characters.blend` (raízes `arena2_*`).
 */
const ARENA: Record<string, ImageSourcePropType> = {
  'enemy.study': require('../../assets/battle/arena-study.jpg'),
  'enemy.work': require('../../assets/battle/arena-work.jpg'),
  'enemy.health': require('../../assets/battle/arena-health.jpg'),
  'enemy.home': require('../../assets/battle/arena-home.jpg'),
  'enemy.other': require('../../assets/battle/arena-other.jpg'),
  'enemy.boss': require('../../assets/battle/arena-boss.jpg'),
  'enemy.clutter': require('../../assets/battle/arena-clutter.jpg'),
  'enemy.couch': require('../../assets/battle/arena-couch.jpg'),
  'enemy.meeting': require('../../assets/battle/arena-meeting.jpg'),
};

/** `enemy.study+elite` usa a arena do `enemy.study`. */
export function arenaKeyOf(assetKey: string): string {
  const base = assetKey.split('+')[0];
  return base in ARENA ? base : 'enemy.other';
}

/** Altura do painel de baixo: legenda, barra do herói, 3 linhas de golpes. */
const PANEL_MIN = 352;
/** A fileira de poções, quando o herói tem alguma. */
const POTION_ROW = 48;

export function BattleOverlay(props: BattleOverlayProps) {
  const { battle, reward, onDismiss } = props;
  // Insets da janela principal: dentro do Modal o Android às vezes mede 0.
  const outerInsets = useSafeAreaInsets();
  if (!battle) return null;
  const finished = reward != null || battle.phase === 'VICTORY' || battle.phase === 'DEFEAT';
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (finished) onDismiss();
      }}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* O Modal é outra janela no Android: a área segura precisa ser medida dentro dele. */}
      <SafeAreaProvider>
        <BattleScreen {...props} battle={battle} outerInsets={outerInsets} />
      </SafeAreaProvider>
    </Modal>
  );
}

/** Tempo até a última animação da ação terminar (para o resultado não atropelar). */
function settleMs(battle: BattleState): number {
  return WINDUP_MS + battle.events.length * EVENT_STEP_MS + 800;
}

function BattleScreen({
  battle,
  reward,
  onMove,
  onAutoResolve,
  onItem,
  onDismiss,
  onUndo,
  soundEnabled = false,
  showTutorial = false,
  musicVolume = 0,
  outerInsets,
}: BattleOverlayProps & { battle: BattleState; outerInsets: EdgeInsets }) {
  const inner = useSafeAreaInsets();
  const insets = {
    top: Math.max(inner.top, outerInsets.top),
    // Piso de 24 para nunca ficar embaixo da barra de navegação do Android.
    bottom: Math.max(inner.bottom, outerInsets.bottom, 24),
  };
  const { height, width } = useWindowDimensions();
  const [inspected, setInspected] = useState<BattleSkill | null>(null);
  const [helpOpen, setHelpOpen] = useState(showTutorial);
  const reduceMotion = useReducedMotion();
  const arenaShake = useSharedValue(0);
  const critFlash = useSharedValue(0);
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  const lastShakeSeq = useRef(0);

  const finished = reward != null || battle.phase === 'VICTORY' || battle.phase === 'DEFEAT';
  const won = battle.phase === 'VICTORY';
  const waiting = !finished && battle.phase === 'ENEMY_TURN';

  // O resultado espera o último golpe terminar de animar.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!finished) return undefined;
    const timer = setTimeout(() => setRevealed(true), reduceMotion ? 0 : settleMs(battle));
    return () => clearTimeout(timer);
    // Só quando a luta termina; os eventos finais já estão no estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  const showResult = finished && revealed;

  useBattleCues(battle.events, soundEnabled, reduceMotion);
  const hasLoot = showResult && won && reward?.loot != null;
  useEffect(() => {
    if (!hasLoot) return undefined;
    // O baú abre 860 ms depois do resultado aparecer (ver LootReveal).
    const timer = setTimeout(() => playChestCue(soundEnabled), reduceMotion ? 0 : 860);
    return () => clearTimeout(timer);
  }, [hasLoot, reduceMotion, soundEnabled]);
  const arenaKey = arenaKeyOf(battle.enemy.assetKey);
  useBattleMusic(arenaKey, musicVolume, finished);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: reduceMotion ? 0 : 520,
      easing: overshoot(1.4),
    });
  }, [entrance, reduceMotion]);

  // Tremor da arena: forte no crítico, leve quando o herói apanha.
  const events = battle.events;
  useEffect(() => {
    if (reduceMotion) return;
    const index = events.findIndex(
      (event) =>
        event.kind === 'DAMAGE' &&
        event.seq > lastShakeSeq.current &&
        (event.crit || event.combo || event.target === 'PLAYER'),
    );
    if (index < 0) return;
    const hit = events[index];
    lastShakeSeq.current = events[events.length - 1].seq;
    const at = WINDUP_MS + index * EVENT_STEP_MS + 70;
    const amp = hit.crit || hit.combo ? 9 : 4;
    arenaShake.value = withDelay(
      at,
      withSequence(
        withTiming(-amp, { duration: 40 }),
        withTiming(amp, { duration: 40 }),
        withTiming(-amp / 2, { duration: 40 }),
        withTiming(amp / 3, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      ),
    );
    if (hit.crit) {
      critFlash.value = withDelay(
        at,
        withSequence(withTiming(0.55, { duration: 50 }), withTiming(0, { duration: 260 })),
      );
    }
  }, [arenaShake, critFlash, events, reduceMotion]);

  const arenaStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arenaShake.value }, { translateY: arenaShake.value * 0.4 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: critFlash.value }));
  const enemyIn = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * -40 }],
  }));
  const heroIn = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateX: (1 - entrance.value) * -60 }],
  }));

  // A arena vai até o topo da tela; o painel de baixo fica com o que precisa.
  const hasPotions = battle.potions['potion.water'] + battle.potions['potion.coffee'] > 0;
  const panelMin = PANEL_MIN + (hasPotions ? POTION_ROW : 0);
  const arenaHeight = Math.round(Math.max(300, Math.min(560, height - insets.bottom - panelMin)));
  const stageTop = insets.top + 64;
  const stageHeight = arenaHeight - stageTop;
  const heroSize = Math.round(Math.max(118, Math.min(220, stageHeight * 0.56, width * 0.46)));
  const boss = battle.variant === 'BOSS';
  const enemySize = Math.round(
    Math.min(heroSize * (boss ? 1.3 : 1.06), width * (boss ? 0.56 : 0.5)),
  );
  const heroStage = { w: heroSize * 1.25, h: heroSize * 1.12 };
  const enemyStage = { w: enemySize * 1.25, h: enemySize * 1.12 };
  const heroPos = { left: width * 0.02, bottom: space.sm };
  const enemyPos = {
    right: width * 0.02,
    top: stageTop + Math.max(0, stageHeight * 0.42 - enemyStage.h * 0.5),
  };
  // Centros dos lutadores, para os objetos das habilidades voarem de um ao outro.
  const heroCenter = {
    x: heroPos.left + heroStage.w / 2,
    y: arenaHeight - heroPos.bottom - heroStage.h * 0.5,
  };
  const enemyCenter = {
    x: width - enemyPos.right - enemyStage.w / 2,
    y: enemyPos.top + enemyStage.h * 0.55,
  };
  const arena = ARENA[arenaKey];
  // O chefe muda de fase: a faixa anuncia, como na abertura.
  const bossDef = boss ? BOSSES[battle.enemy.bossId ?? 'procrastination'] : null;
  const phaseShift = bossDef
    ? battle.events.find(
        (event) => event.kind === 'TRAIT' && event.skillName === bossDef.trait.name,
      )
    : undefined;
  const lines = battle.log.filter((entry) => entry.text !== battle.victoryTitle).slice(-2);
  const turnLimit = turnLimitFor(battle);
  const turnShown = Math.min(turnLimit, battle.turn + (finished ? 0 : 1));
  const intro = battle.turn === 0 && battle.events.length === 0 && !finished;

  const resultLines = [
    reward?.vitalsLine,
    reward?.habitLine,
    ...(reward?.challengeLines ?? []),
  ].filter((line): line is string => typeof line === 'string' && line.length > 0);

  return (
    <View style={styles.screen} accessibilityViewIsModal testID="battle-overlay">
      <Animated.View style={[styles.arena, { height: arenaHeight }, arenaStyle]}>
        <Image
          source={arena}
          style={styles.backdrop}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          colors={tone.scrimTop}
          style={[styles.scrimTop, { height: insets.top + 110 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={tone.scrimBottom}
          locations={[0, 0.7, 1]}
          style={styles.scrimBottom}
          pointerEvents="none"
        />

        <Animated.View
          style={[styles.fighter, { right: enemyPos.right, top: enemyPos.top }, enemyIn]}
        >
          <ActorStage
            actor={battle.enemy}
            events={battle.events}
            size={enemySize}
            reduceMotion={reduceMotion}
            knockedOut={battle.enemy.hp <= 0}
            celebrating={showResult && !won}
          />
        </Animated.View>
        <Animated.View
          style={[styles.fighter, { left: heroPos.left, bottom: heroPos.bottom }, heroIn]}
        >
          <ActorStage
            actor={battle.hero}
            events={battle.events}
            size={heroSize}
            reduceMotion={reduceMotion}
            knockedOut={battle.hero.hp <= 0}
            celebrating={showResult && won}
          />
        </Animated.View>
        <SkillCastLayer
          events={battle.events}
          hero={heroCenter}
          enemy={enemyCenter}
          size={Math.round(heroSize * 0.5)}
          reduceMotion={reduceMotion}
        />

        <View style={[styles.topRow, { paddingTop: insets.top + space.sm }]}>
          <EnemyPlate actor={battle.enemy} reduceMotion={reduceMotion} />
          <View style={styles.topRight}>
            <TurnPill
              label={finished ? 'Fim da luta' : waiting ? `${battle.enemy.name} age` : 'Sua vez'}
              turn={`Turno ${turnShown} de ${turnLimit}`}
              mine={!waiting && !finished}
              reduceMotion={reduceMotion}
            />
            {!finished ? (
              <Pressable
                onPress={() => setHelpOpen((open) => !open)}
                style={({ pressed }) => [
                  styles.helpBtn,
                  helpOpen && styles.helpBtnOn,
                  pressed && styles.autoBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={helpOpen ? 'Fechar dica de como lutar' : 'Como lutar'}
                accessibilityState={{ expanded: helpOpen }}
                hitSlop={8}
                testID="battle-help"
              >
                <Text style={[styles.helpText, helpOpen && styles.helpTextOn]}>?</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {helpOpen && !finished ? (
          <BattleTutorial energyLabel={battle.hero.energyLabel} onDone={() => setHelpOpen(false)} />
        ) : null}
        {intro ? (
          <BattleBanner text={battle.log[0]?.text ?? ''} reduceMotion={reduceMotion} />
        ) : null}
        {phaseShift ? (
          <BattleBanner
            key={phaseShift.seq}
            text={bossDef?.phaseBanner ?? 'Fase 2!'}
            reduceMotion={reduceMotion}
          />
        ) : null}
        <Animated.View pointerEvents="none" style={[styles.critFlash, flashStyle]} />
      </Animated.View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + space.md }]}>
        {showResult ? (
          <BattleResult
            won={won}
            title={won ? battle.victoryTitle : 'Você caiu'}
            xpLine={rewardCopy(won, reward)}
            xpValue={won && reward && !reward.reduced ? reward.xpAwarded : 0}
            lines={resultLines}
            onDismiss={onDismiss}
            onUndo={onUndo}
            reduceMotion={reduceMotion}
            loot={won ? reward?.loot : null}
          />
        ) : (
          <>
            <View style={styles.log} accessibilityLiveRegion="polite">
              {lines.map((entry, index) => (
                <Text
                  key={entry.id}
                  style={index === lines.length - 1 ? styles.logNow : styles.logPast}
                  numberOfLines={2}
                >
                  {entry.text}
                </Text>
              ))}
              {battle.turn === 0 && !finished ? (
                <Text style={styles.logPast}>Segure um golpe para ler tudo o que ele faz.</Text>
              ) : null}
            </View>
            <HeroBar actor={battle.hero} reduceMotion={reduceMotion} />
            <PotionRow
              battle={battle}
              disabled={waiting || finished}
              onUse={(id) => {
                setHelpOpen(false);
                onItem?.(id);
              }}
            />
            <View style={styles.controls}>
              <SkillGrid
                hero={battle.hero}
                enemy={battle.enemy}
                disabled={waiting || finished}
                onSkill={(skillId) => {
                  setHelpOpen(false);
                  onMove(skillId);
                }}
                onInspect={setInspected}
              />
              {onAutoResolve && battle.turn === 0 && !waiting ? (
                <Pressable
                  onPress={onAutoResolve}
                  style={({ pressed }) => [styles.autoBtn, pressed && styles.autoBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Resolver a luta agora"
                  accessibilityHint="Luta fácil: o herói escolhe os golpes e o resultado aparece na hora."
                  hitSlop={8}
                  testID="battle-auto-resolve"
                >
                  <Text style={styles.autoText}>Resolver agora</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </View>

      {showResult && won && !reduceMotion ? <Confetti width={width} height={height} /> : null}
      {inspected && !finished ? (
        <SkillDetail
          skill={inspected}
          hero={battle.hero}
          enemy={battle.enemy}
          onClose={() => setInspected(null)}
        />
      ) : null}
    </View>
  );
}

function rewardCopy(won: boolean, reward: BattleRewardView | null): string {
  if (reward?.summary) return reward.summary;
  if (!reward || reward.xpAwarded <= 0) return 'A quest conta, sem XP desta vez.';
  if (won && !reward.reduced) return `+${reward.xpAwarded} XP`;
  return `A quest conta. +${reward.xpAwarded} XP, sem bônus.`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tone.panel },
  arena: { width: '100%', overflow: 'hidden', backgroundColor: colors.bgElevated },
  backdrop: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  scrimTop: { position: 'absolute', left: 0, right: 0, top: 0 },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  fighter: { position: 'absolute' },
  topRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  topRight: { alignItems: 'flex-end', gap: space.sm },
  // Alvo de 44 pt com o círculo visível de 32 (hitSlop cobre o resto).
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(5, 8, 20, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnOn: { borderColor: colors.amber, backgroundColor: colors.amberWash },
  helpText: { fontSize: 16, fontWeight: '900', color: colors.text, marginTop: -1 },
  helpTextOn: { color: colors.amberSoft },
  critFlash: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF' },

  panel: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    gap: space.md,
    backgroundColor: tone.panel,
  },
  log: { minHeight: 40, justifyContent: 'center' },
  logPast: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  logNow: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: colors.text },
  // Empurra as habilidades para o rodapé, perto do polegar.
  controls: { marginTop: 'auto' },
  autoBtn: {
    alignSelf: 'center',
    marginTop: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  autoBtnPressed: { opacity: 0.6 },
  autoText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
