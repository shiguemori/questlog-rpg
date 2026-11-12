import React, { useEffect } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BattleActor, BattleMove, BattleState } from '../domain/battle';
import { PressScale } from '../motion/PressScale';
import { playHaptic, useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';
import { BATTLE_SPRITE_EMOJI, BATTLE_SPRITE_SOURCES } from './battleSprites';

export interface BattleRewardView {
  xpAwarded: number;
  reduced: boolean;
  habitLine: string | null;
}

export interface BattleOverlayProps {
  battle: BattleState | null;
  reward: BattleRewardView | null;
  onMove: (moveId: string) => void;
  onDismiss: () => void;
  onUndo?: () => void;
}

/**
 * Estádio 2D da batalha. Placeholders no lugar dos sprites.
 * Delight raro: a barra de HP anima na thread de UI; o resto é estado.
 */
export function BattleOverlay({ battle, reward, onMove, onDismiss, onUndo }: BattleOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!battle) return null;

  const finished = reward != null || battle.phase === 'VICTORY' || battle.phase === 'DEFEAT';
  const won = battle.phase === 'VICTORY';
  const waiting = !finished && battle.phase === 'ENEMY_TURN';
  const lines = battle.log.filter((entry) => entry.text !== battle.victoryTitle).slice(-2);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => {
        if (finished) onDismiss();
      }}
      statusBarTranslucent
    >
      <View
        style={[styles.field, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12 }]}
        accessibilityViewIsModal
        testID="battle-overlay"
      >
        <Text style={styles.eyebrow}>
          {waiting ? 'Aguarde' : finished ? 'Resultado' : 'Sua vez'}
        </Text>
        <ActorRow actor={battle.enemy} align="right" />
        <ActorRow actor={battle.hero} align="left" />

        <View style={styles.log} accessibilityLiveRegion="polite">
          {lines.map((entry, index) => (
            <Text
              key={entry.id}
              style={index === lines.length - 1 ? styles.logNow : styles.logPast}
            >
              {entry.text}
            </Text>
          ))}
        </View>

        {finished ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>{won ? battle.victoryTitle : 'Você caiu'}</Text>
            <Text style={styles.resultXp}>{rewardCopy(won, reward)}</Text>
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
          <MoveMenu moves={battle.hero.moves} disabled={waiting} onMove={onMove} />
        )}
      </View>
    </Modal>
  );
}

function rewardCopy(won: boolean, reward: BattleRewardView | null): string {
  if (!reward || reward.xpAwarded <= 0) return 'A quest conta, sem XP desta vez.';
  if (won && !reward.reduced) return `+${reward.xpAwarded} XP`;
  return `A quest conta. +${reward.xpAwarded} XP, sem bônus.`;
}

function ActorRow({ actor, align }: { actor: BattleActor; align: 'left' | 'right' }) {
  const info = (
    <View style={styles.actorInfo}>
      <Text style={styles.actorName} numberOfLines={1}>
        {actor.name}
      </Text>
      <Text style={styles.actorSub}>{actor.subtitle}</Text>
      <HpBar
        hp={actor.hp}
        maxHp={actor.maxHp}
        tint={actor.side === 'PLAYER' ? colors.amber : colors.danger}
        label={`HP de ${actor.name}`}
      />
      <Text style={styles.hpText}>
        {actor.hp}/{actor.maxHp}
      </Text>
    </View>
  );
  const sprite = <BattleSprite assetKey={actor.assetKey} side={actor.side} />;
  return (
    <View style={[styles.actorRow, align === 'right' ? styles.actorRight : styles.actorLeft]}>
      {align === 'left' ? (
        <>
          {sprite}
          {info}
        </>
      ) : (
        <>
          {info}
          {sprite}
        </>
      )}
    </View>
  );
}

function BattleSprite({ assetKey, side }: { assetKey: string; side: 'PLAYER' | 'ENEMY' }) {
  const source = BATTLE_SPRITE_SOURCES[assetKey] ?? null;
  const accent = side === 'PLAYER' ? colors.amber : colors.danger;
  return (
    <View style={styles.platform}>
      <View
        style={[styles.sprite, { borderColor: accent }]}
        accessibilityLabel={`Placeholder de arte ${assetKey}`}
      >
        {source ? (
          <Image
            source={source}
            style={styles.spriteImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <>
            <View style={[styles.spriteMark, { backgroundColor: accent }]} />
            <Text style={styles.spriteEmoji}>{BATTLE_SPRITE_EMOJI[assetKey] ?? '●'}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function HpBar({
  hp,
  maxHp,
  tint,
  label,
}: {
  hp: number;
  maxHp: number;
  tint: string;
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  const ratio = maxHp <= 0 ? 0 : Math.max(0, Math.min(1, hp / maxHp));
  const width = useSharedValue(ratio);

  useEffect(() => {
    width.value = withTiming(ratio, { duration: reduceMotion ? 0 : 280 });
  }, [ratio, reduceMotion, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const low = ratio > 0 && ratio <= 0.25;

  return (
    <View
      style={styles.hpTrack}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: maxHp, now: hp }}
    >
      <Animated.View
        style={[styles.hpFill, { backgroundColor: low ? colors.dangerText : tint }, fill]}
      />
    </View>
  );
}

function MoveMenu({
  moves,
  disabled,
  onMove,
}: {
  moves: readonly BattleMove[];
  disabled: boolean;
  onMove: (moveId: string) => void;
}) {
  const rows = [moves.slice(0, 2), moves.slice(2, 4)];
  return (
    <View style={styles.menu}>
      {rows.map((row) => (
        <View key={row.map((entry) => entry.id).join('-')} style={styles.moveRow}>
          {row.map((entry) => (
            <View
              key={entry.id}
              style={[styles.moveSlot, disabled && styles.moveSlotOff]}
              pointerEvents={disabled ? 'none' : 'auto'}
            >
              <PressScale
                containerStyle={styles.moveFill}
                style={styles.move}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${entry.name}`}
                accessibilityHint={entry.blurb}
                accessibilityState={{ disabled }}
                onPress={() => {
                  playHaptic('TAP');
                  onMove(entry.id);
                }}
              >
                <Text style={styles.moveName}>{entry.name}</Text>
                <Text style={styles.moveBlurb}>{entry.blurb}</Text>
              </PressScale>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    backgroundColor: '#14532D',
    paddingHorizontal: 16,
  },
  eyebrow: {
    alignSelf: 'center',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amberSoft,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  actorRight: { justifyContent: 'flex-end', paddingLeft: 36 },
  actorLeft: { justifyContent: 'flex-start', paddingRight: 36, marginTop: 28 },
  actorInfo: { flexShrink: 1, minWidth: 140, maxWidth: 220 },
  actorName: { fontSize: 18, fontWeight: '800', color: colors.text },
  actorSub: { marginTop: 2, fontSize: 13, color: colors.amberSoft },
  hpText: { marginTop: 4, fontSize: 12, fontWeight: '700', color: colors.text },
  platform: { alignItems: 'center' },
  sprite: {
    width: 84,
    height: 84,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spriteImage: { width: 76, height: 76 },
  spriteMark: {
    position: 'absolute',
    top: 8,
    width: 18,
    height: 8,
    borderRadius: 4,
  },
  spriteEmoji: { fontSize: 32 },
  hpTrack: {
    marginTop: 8,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  hpFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  log: {
    marginTop: 28,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.amberDeep,
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  logPast: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  logNow: { marginTop: 2, fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text },
  menu: { marginTop: 12, gap: 8 },
  moveRow: { flexDirection: 'row', gap: 8 },
  moveSlot: { flex: 1 },
  moveSlotOff: { opacity: 0.45 },
  moveFill: { flex: 1 },
  move: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  moveName: { fontSize: 15, fontWeight: '800', color: colors.text },
  moveBlurb: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  result: { marginTop: 12, alignItems: 'center' },
  resultTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  resultXp: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: colors.amberSoft,
    textAlign: 'center',
  },
  habit: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.amberSoft,
    textAlign: 'center',
  },
  cta: {
    marginTop: 16,
    minHeight: 48,
    minWidth: 180,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.bg },
  undo: {
    marginTop: 4,
    minHeight: 44,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
