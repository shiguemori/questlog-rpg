import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { FxKind } from '../../domain/battle';

/** Cor de cada efeito: [brilho, cor principal, sombra]. */
export const FX_COLORS: Record<FxKind, readonly [string, string, string]> = {
  SLASH: ['#FFFFFF', '#E2E8F0', '#94A3B8'],
  IMPACT: ['#FFF7ED', '#FDBA74', '#F97316'],
  FIRE: ['#FEF08A', '#FB923C', '#EF4444'],
  ICE: ['#ECFEFF', '#67E8F9', '#0EA5E9'],
  POISON: ['#ECFCCB', '#A3E635', '#4D7C0F'],
  ARCANE: ['#F5F3FF', '#C4B5FD', '#7C3AED'],
  SHADOW: ['#EDE9FE', '#A78BFA', '#4C1D95'],
  SHIELD: ['#EFF6FF', '#93C5FD', '#2563EB'],
  HEAL: ['#F0FDF4', '#86EFAC', '#16A34A'],
  BUFF: ['#FFFBEB', '#FCD34D', '#F59E0B'],
  DEBUFF: ['#F1F5F9', '#94A3B8', '#475569'],
  SMOKE: ['#F8FAFC', '#CBD5E1', '#64748B'],
};

type Pattern = 'BURST' | 'RISE' | 'SHARDS' | 'BUBBLES' | 'PUFF' | 'RING';

const PATTERN: Record<FxKind, Pattern> = {
  SLASH: 'BURST',
  IMPACT: 'BURST',
  FIRE: 'RISE',
  ICE: 'SHARDS',
  POISON: 'BUBBLES',
  ARCANE: 'BURST',
  SHADOW: 'PUFF',
  SHIELD: 'RING',
  HEAL: 'RISE',
  BUFF: 'RISE',
  DEBUFF: 'PUFF',
  SMOKE: 'PUFF',
};

/** Golpes que fazem clarão, linhas de impacto e onda de choque. */
const HITS: readonly FxKind[] = ['SLASH', 'IMPACT', 'FIRE', 'ICE', 'ARCANE', 'SHADOW', 'POISON'];

const PARTICLES = 14;
const FX_MS = 720;

export interface FxBurstProps {
  kind: FxKind;
  delay: number;
  reduceMotion: boolean;
  /** Tamanho do lutador: o efeito acompanha. */
  size: number;
  /** Crítico: tudo maior e com mais linhas. */
  big?: boolean;
}

/** Efeito no alvo. Monta, anima uma vez e some. */
export function FxBurst({ kind, delay, reduceMotion, size, big }: FxBurstProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: big ? FX_MS * 1.25 : FX_MS, easing: Easing.linear }),
    );
  }, [big, delay, progress]);

  if (reduceMotion) return null;
  const palette = FX_COLORS[kind];
  const pattern = PATTERN[kind];
  const hit = HITS.includes(kind);
  const scale = (size / 160) * (big ? 1.35 : 1);
  return (
    <View pointerEvents="none" style={styles.center}>
      {hit ? <Flash progress={progress} color={palette[0]} radius={70 * scale} /> : null}
      {hit ? <Shockwave progress={progress} color={palette[1]} radius={80 * scale} /> : null}
      {hit
        ? Array.from({ length: big ? 10 : 7 }, (_, index) => (
            <SpeedLine
              key={`l${index}`}
              index={index}
              count={big ? 10 : 7}
              progress={progress}
              color={palette[0]}
              length={64 * scale}
            />
          ))
        : null}
      {pattern === 'RING' ? (
        <>
          <Shockwave progress={progress} color={palette[1]} radius={92 * scale} thick />
          <Shockwave progress={progress} color={palette[0]} radius={70 * scale} lag={0.15} />
        </>
      ) : null}
      {Array.from({ length: PARTICLES }, (_, index) => (
        <Particle
          key={index}
          index={index}
          pattern={pattern}
          progress={progress}
          color={palette[index % 3]}
          spread={scale}
        />
      ))}
    </View>
  );
}

function Flash({
  progress,
  color,
  radius,
}: {
  progress: SharedValue<number>;
  color: string;
  radius: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const k = Math.min(1, t / 0.22);
    return {
      opacity: t === 0 || t > 0.3 ? 0 : 0.9 * (1 - k),
      transform: [{ scale: 0.3 + k * 1.1 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.disc,
        {
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          marginLeft: -radius,
          marginTop: -radius,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function Shockwave({
  progress,
  color,
  radius,
  thick,
  lag = 0,
}: {
  progress: SharedValue<number>;
  color: string;
  radius: number;
  thick?: boolean;
  lag?: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value - lag) / 0.55));
    return {
      opacity: progress.value === 0 || t >= 1 ? 0 : (1 - t) * 0.95,
      transform: [{ scale: 0.25 + t * 1.15 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.disc,
        {
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          marginLeft: -radius,
          marginTop: -radius,
          borderWidth: thick ? 6 : 3,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/** Traço de impacto que sai do centro, estilo mangá. */
function SpeedLine({
  index,
  count,
  progress,
  color,
  length,
}: {
  index: number;
  count: number;
  progress: SharedValue<number>;
  color: string;
  length: number;
}) {
  const angle = (index / count) * 360 + (index % 2) * 14;
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, progress.value / 0.4);
    const reach = 18 + t * length;
    return {
      opacity: progress.value === 0 || t >= 1 ? 0 : 1 - t,
      transform: [{ rotate: `${angle}deg` }, { translateX: reach }, { scaleX: 1.2 - t * 0.8 }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.line,
        { width: length * 0.7, marginLeft: -length * 0.35, backgroundColor: color },
        style,
      ]}
    />
  );
}

function Particle({
  index,
  pattern,
  progress,
  color,
  spread,
}: {
  index: number;
  pattern: Pattern;
  progress: SharedValue<number>;
  color: string;
  spread: number;
}) {
  // Valores fixos por índice: a explosão não depende de sorteio no render.
  const angle = (index / PARTICLES) * Math.PI * 2 + (index % 3) * 0.4;
  const distance = (46 + (index % 4) * 18) * spread;
  const size = (pattern === 'PUFF' ? 18 + (index % 3) * 8 : 5 + (index % 3) * 3) * spread;
  const round = pattern !== 'SHARDS' && index % 2 === 0;
  const lateral = ((index % 7) - 3) * 14 * spread;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    if (t === 0) return { opacity: 0 };
    let x = 0;
    let y = 0;
    let s = 1;
    let rot = 0;
    let opacity = 1 - t;
    const ease = 1 - (1 - t) * (1 - t);
    switch (pattern) {
      case 'BURST':
        x = Math.cos(angle) * distance * ease;
        // Gravidade: as faíscas sobem e caem.
        y = Math.sin(angle) * distance * ease + 70 * spread * t * t;
        s = 1.3 - t;
        rot = t * 360;
        break;
      case 'SHARDS':
        x = Math.cos(angle) * distance * 1.2 * ease;
        y = Math.sin(angle) * distance * 1.2 * ease;
        rot = (angle * 180) / Math.PI + 45;
        s = 1.2 - t * 0.6;
        break;
      case 'RISE': {
        const sway = Math.sin(t * 9 + index) * 10 * spread;
        x = lateral + sway;
        y = (20 - 120 * ease - (index % 3) * 16 * t) * spread;
        s = t < 0.2 ? t / 0.2 : 1.2 - t;
        opacity = t < 0.15 ? t / 0.15 : 1 - t;
        break;
      }
      case 'BUBBLES':
        x = lateral * 0.8;
        y = (10 - 90 * ease) * spread;
        s = 0.5 + ease;
        opacity = t > 0.8 ? (1 - t) / 0.2 : 0.85;
        break;
      case 'PUFF':
        x = Math.cos(angle) * distance * 0.6 * ease;
        y = Math.sin(angle) * distance * 0.4 * ease - 20 * t;
        s = 0.4 + ease * 1.1;
        opacity = (1 - t) * 0.7;
        break;
      case 'RING':
        x = Math.cos(angle + t * 2) * distance * 0.9;
        y = Math.sin(angle + t * 2) * distance * 0.9;
        s = 1 - t * 0.5;
        break;
      default:
        break;
    }
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${rot}deg` }, { scale: s }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: pattern === 'SHARDS' ? size * 0.6 : size,
          height: pattern === 'SHARDS' ? size * 2 : size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: round || pattern === 'PUFF' || pattern === 'BUBBLES' ? size : 1,
          backgroundColor: pattern === 'BUBBLES' ? 'transparent' : color,
          borderWidth: pattern === 'BUBBLES' ? 2 : 0,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export interface FloatingTextProps {
  text: string;
  color: string;
  big?: boolean;
  /** Texto pequeno acima do número ("CRÍTICO"). */
  label?: string;
  delay: number;
  reduceMotion: boolean;
  /** Desloca na horizontal para números do mesmo golpe não se sobreporem. */
  offset?: number;
}

/** Número que salta e some em cima do alvo (dano, cura, "Errou"). */
export function FloatingText({
  text,
  color,
  big,
  label,
  delay,
  reduceMotion,
  offset = 0,
}: FloatingTextProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: big ? 1300 : 1050, easing: Easing.linear }),
    );
  }, [big, delay, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    // Salta, passa do ponto, assenta e sobe devagar.
    const pop = t < 0.12 ? 0.3 + (t / 0.12) * 1.1 : t < 0.24 ? 1.4 - ((t - 0.12) / 0.12) * 0.4 : 1;
    const rise = t < 0.24 ? -30 * (t / 0.24) : -30 - 34 * ((t - 0.24) / 0.76);
    return {
      opacity: t === 0 ? 0 : t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
      transform: [
        { translateX: offset + (reduceMotion ? 0 : (offset / 26) * 10 * t) },
        { translateY: reduceMotion ? 0 : rise },
        { scale: reduceMotion ? 1 : pop },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.floatWrap, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {label ? <Animated.Text style={[styles.floatLabel, { color }]}>{label}</Animated.Text> : null}
      <Animated.Text style={[styles.floating, big && styles.floatingBig, { color }]}>
        {text}
      </Animated.Text>
    </Animated.View>
  );
}

const OUTLINE = '#0B1020';

const styles = StyleSheet.create({
  center: { position: 'absolute', left: '50%', top: '48%', width: 0, height: 0 },
  disc: { position: 'absolute', left: 0, top: 0 },
  line: { position: 'absolute', left: 0, top: -2, height: 4, borderRadius: 2 },
  particle: { position: 'absolute', left: 0, top: 0 },
  floatWrap: { position: 'absolute', alignSelf: 'center', top: '4%', alignItems: 'center' },
  floatLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: OUTLINE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  floating: {
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: OUTLINE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  floatingBig: { fontSize: 42 },
});
