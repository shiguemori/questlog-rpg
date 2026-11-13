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
import {
  SafeAreaProvider,
  useSafeAreaInsets,
  type EdgeInsets,
} from 'react-native-safe-area-context';
import { MAX_BATTLE_TURNS, type BattleSkill, type BattleState } from '../domain/battle';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { ActorCard, SkillDetail, SkillGrid } from './battle/BattleHud';
import { ActorStage, EVENT_STEP_MS } from './battle/BattleStage';
import { SkillCastLayer } from './battle/SkillCast';

export interface BattleRewardView {
  xpAwarded: number;
  reduced: boolean;
  habitLine: string | null;
  /** Vida guardada depois da luta, ex.: "Vida 23/48 · enche em 3h". */
  vitalsLine?: string | null;
}

export interface BattleOverlayProps {
  battle: BattleState | null;
  reward: BattleRewardView | null;
  onMove: (moveId: string) => void;
  onDismiss: () => void;
  onUndo?: () => void;
}

/**
 * Cenário da arena, pela categoria do monstro. Renderizados no Blender (1080×1080),
 * fonte em `assets/blender/sources/battle-characters.blend` (coleções `arena_*`).
 */
const ARENA: Record<string, ImageSourcePropType> = {
  'enemy.study': require('../../assets/battle/arena-study.jpg'),
  'enemy.work': require('../../assets/battle/arena-work.jpg'),
  'enemy.health': require('../../assets/battle/arena-health.jpg'),
  'enemy.home': require('../../assets/battle/arena-home.jpg'),
  'enemy.other': require('../../assets/battle/arena-other.jpg'),
};

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

function BattleScreen({
  battle,
  reward,
  onMove,
  onDismiss,
  onUndo,
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
  const reduceMotion = useReducedMotion();
  const arenaShake = useSharedValue(0);
  const lastCrit = useRef(0);

  const events = battle.events;
  useEffect(() => {
    if (reduceMotion) return;
    const index = events.findIndex((event) => event.crit && event.seq > lastCrit.current);
    if (index < 0) return;
    lastCrit.current = events[index].seq;
    // Reanimated: shared value mutável de propósito.

    arenaShake.value = withDelay(
      index * EVENT_STEP_MS + 90,
      withSequence(
        withTiming(-6, { duration: 40 }),
        withTiming(6, { duration: 40 }),
        withTiming(-3, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      ),
    );
  }, [arenaShake, events, reduceMotion]);

  const arenaStyle = useAnimatedStyle(() => ({ transform: [{ translateX: arenaShake.value }] }));

  const finished = reward != null || battle.phase === 'VICTORY' || battle.phase === 'DEFEAT';
  const won = battle.phase === 'VICTORY';
  const waiting = !finished && battle.phase === 'ENEMY_TURN';
  // A arena tem altura fixa: o resto da tela é das habilidades, que precisam caber inteiras.
  // Habilidades (3 linhas), log e cabeçalho ocupam ~370; a arena fica com o resto.
  const arenaHeight = Math.round(
    Math.max(260, Math.min(540, height - insets.top - insets.bottom - 370)),
  );
  const heroSize = Math.round(Math.max(100, Math.min(184, arenaHeight * 0.4)));
  const enemySize = Math.round(heroSize * 1.1);
  // Centros dos lutadores na arena, para os objetos das habilidades voarem de um ao outro.
  const arenaWidth = width - space.lg * 2;
  const heroCenter = {
    x: space.md + (heroSize + 32) / 2,
    y: arenaHeight - space.md - (heroSize + 28) / 2,
  };
  const enemyCenter = {
    x: arenaWidth - space.md - (enemySize + 32) / 2,
    y: space.md + (enemySize + 28) / 2,
  };
  const arena = ARENA[battle.enemy.assetKey] ?? ARENA['enemy.other'];
  const lines = battle.log.filter((entry) => entry.text !== battle.victoryTitle).slice(-2);
  const turnShown = Math.min(MAX_BATTLE_TURNS, battle.turn + (finished ? 0 : 1));

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg },
      ]}
      accessibilityViewIsModal
      testID="battle-overlay"
    >
      <View style={styles.header}>
        <Text style={styles.turn}>
          Turno {turnShown} de {MAX_BATTLE_TURNS}
        </Text>
        <View style={[styles.phase, waiting && styles.phaseEnemy, finished && styles.phaseDone]}>
          <Text style={[styles.phaseText, !waiting && !finished && styles.phaseTextOnAmber]}>
            {finished ? 'Fim da luta' : waiting ? `${battle.enemy.name} age` : 'Sua vez'}
          </Text>
        </View>
      </View>

      <Animated.View style={[styles.arena, { height: arenaHeight }, arenaStyle]}>
        <Image
          source={arena}
          style={styles.backdrop}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.scrim} />
        <View style={styles.enemyRow}>
          <ActorCard actor={battle.enemy} reduceMotion={reduceMotion} />
          <ActorStage
            actor={battle.enemy}
            events={battle.events}
            size={enemySize}
            reduceMotion={reduceMotion}
            knockedOut={battle.enemy.hp <= 0}
          />
        </View>
        <View style={styles.heroRow}>
          <ActorStage
            actor={battle.hero}
            events={battle.events}
            size={heroSize}
            reduceMotion={reduceMotion}
            knockedOut={battle.hero.hp <= 0}
          />
          <ActorCard actor={battle.hero} reduceMotion={reduceMotion} />
        </View>
        <SkillCastLayer
          events={battle.events}
          hero={heroCenter}
          enemy={enemyCenter}
          size={Math.round(heroSize * 0.55)}
          reduceMotion={reduceMotion}
        />
      </Animated.View>

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

      {finished ? (
        <View style={styles.result}>
          <Text style={[styles.resultTitle, !won && styles.resultLost]}>
            {won ? battle.victoryTitle : 'Você caiu'}
          </Text>
          <Text style={styles.resultXp}>{rewardCopy(won, reward)}</Text>
          {reward?.vitalsLine ? <Text style={styles.resultLine}>{reward.vitalsLine}</Text> : null}
          {reward?.habitLine ? <Text style={styles.habit}>{reward.habitLine}</Text> : null}
          <Pressable
            style={styles.cta}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Fechar batalha"
          >
            <Text style={styles.ctaText}>Continuar</Text>
          </Pressable>
          {onUndo ? (
            <Pressable
              style={styles.undo}
              onPress={onUndo}
              accessibilityRole="button"
              accessibilityLabel="Desfazer esta conclusão"
            >
              <Text style={styles.undoText}>Desfazer</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.controls}>
          <SkillGrid
            hero={battle.hero}
            enemy={battle.enemy}
            disabled={waiting}
            onSkill={onMove}
            onInspect={setInspected}
          />
        </View>
      )}
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
  if (!reward || reward.xpAwarded <= 0) return 'A quest conta, sem XP desta vez.';
  if (won && !reward.reduced) return `+${reward.xpAwarded} XP`;
  return `A quest conta. +${reward.xpAwarded} XP, sem bônus.`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turn: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  phase: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.amber,
  },
  phaseEnemy: { backgroundColor: colors.dangerBg },
  phaseDone: { backgroundColor: colors.bgElevated },
  phaseText: { fontSize: 12, fontWeight: '800', color: colors.text },
  phaseTextOnAmber: { color: colors.bg },

  arena: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: space.md,
    justifyContent: 'space-between',
  },
  backdrop: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  // Véu leve: o cenário fica atrás, os cartões e personagens na frente.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11, 16, 32, 0.18)' },
  enemyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },

  log: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  logPast: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  logNow: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.text },

  // Empurra as habilidades para o rodapé, perto do polegar.
  controls: { marginTop: 'auto', gap: space.md },

  result: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  resultTitle: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  resultLost: { color: colors.dangerText },
  resultXp: {
    marginTop: space.sm,
    fontSize: 22,
    fontWeight: '800',
    color: colors.amberSoft,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resultLine: {
    marginTop: space.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  habit: {
    marginTop: space.sm,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.amberSoft,
    textAlign: 'center',
  },
  cta: {
    marginTop: space.xl,
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: colors.bg },
  undo: {
    marginTop: space.sm,
    minHeight: 44,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
