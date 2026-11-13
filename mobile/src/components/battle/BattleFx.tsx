import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { FxKind } from '../../domain/battle';

/** Cor de cada efeito. Partículas quadradas combinam com a arte em pixel. */
export const FX_COLORS: Record<FxKind, readonly string[]> = {
  SLASH: ['#F8FAFC', '#CBD5E1'],
  IMPACT: ['#FDBA74', '#F97316'],
  FIRE: ['#FDE047', '#F97316', '#EF4444'],
  ICE: ['#A5F3FC', '#22D3EE'],
  POISON: ['#BEF264', '#65A30D'],
  ARCANE: ['#C4B5FD', '#8B5CF6'],
  SHADOW: ['#A78BFA', '#4C1D95'],
  SHIELD: ['#93C5FD', '#3B82F6'],
  HEAL: ['#86EFAC', '#22C55E'],
  BUFF: ['#FCA5A5', '#F59E0B'],
  DEBUFF: ['#94A3B8', '#64748B'],
  SMOKE: ['#CBD5E1', '#94A3B8'],
};

/** Partículas que sobem (cura, fúria) em vez de explodir para os lados. */
const RISING: readonly FxKind[] = ['HEAL', 'BUFF'];
const PARTICLES = 10;

export interface FxBurstProps {
  kind: FxKind;
  delay: number;
  reduceMotion: boolean;
}

/** Explosão de partículas no alvo. Monta, anima uma vez e some. */
export function FxBurst({ kind, delay, reduceMotion }: FxBurstProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Reanimated: o shared value é mutável de propósito.

    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
  }, [delay, progress]);

  if (reduceMotion) return null;
  const palette = FX_COLORS[kind];
  return (
    <>
      {kind === 'SHIELD' ? <Ring progress={progress} color={palette[1]} /> : null}
      {Array.from({ length: PARTICLES }, (_, index) => (
        <Particle
          key={index}
          index={index}
          progress={progress}
          color={palette[index % palette.length]}
          rising={RISING.includes(kind)}
          size={kind === 'SLASH' ? 5 : 7}
        />
      ))}
    </>
  );
}

function Particle({
  index,
  progress,
  color,
  rising,
  size,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
  rising: boolean;
  size: number;
}) {
  // Ângulos e distâncias fixos por índice: a explosão não depende de sorteio no render.
  const angle = (index / PARTICLES) * Math.PI * 2 + (index % 2) * 0.35;
  const distance = 34 + (index % 3) * 14;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const x = rising ? ((index % 5) - 2) * 12 : Math.cos(angle) * distance * t;
    const y = rising ? -60 * t - (index % 3) * 8 * t : Math.sin(angle) * distance * t;
    return {
      opacity: t === 0 ? 0 : 1 - t,
      transform: [{ translateX: x }, { translateY: y }, { scale: 1.2 - t * 0.6 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.particle, { width: size, height: size, backgroundColor: color }, style]}
    />
  );
}

function Ring({ progress, color }: { progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 1 - progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.9 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, style]} />
  );
}

export interface FloatingTextProps {
  text: string;
  color: string;
  big?: boolean;
  delay: number;
  reduceMotion: boolean;
  /** Desloca na horizontal para números do mesmo golpe não se sobreporem. */
  offset?: number;
}

/** Número que sobe e some em cima do alvo (dano, cura, "Errou"). */
export function FloatingText({
  text,
  color,
  big,
  delay,
  reduceMotion,
  offset = 0,
}: FloatingTextProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.4);
    return {
      opacity: t === 0 ? 0 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
      transform: [
        { translateX: offset },
        { translateY: reduceMotion ? 0 : -54 * t },
        { scale: reduceMotion ? 1 : pop },
      ],
    };
  });

  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.floating, big && styles.floatingBig, { color }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    left: '50%',
    top: '45%',
  },
  ring: {
    position: 'absolute',
    alignSelf: 'center',
    top: '5%',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
  },
  floating: {
    position: 'absolute',
    alignSelf: 'center',
    top: '8%',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: '#0B1020',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  },
  floatingBig: { fontSize: 30 },
});
