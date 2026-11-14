import React, { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Faixa de abertura ("Distração apareceu!")
// ---------------------------------------------------------------------------

/** Faixa que cruza a arena no começo da luta e some sozinha. */
export function BattleBanner({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 0 : 320, easing: Easing.out(Easing.cubic) }),
      withDelay(
        1100,
        withTiming(2, { duration: reduceMotion ? 0 : 280, easing: Easing.in(Easing.cubic) }),
      ),
    );
  }, [reduceMotion, t]);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    const x = v <= 1 ? (1 - v) * -420 : (v - 1) * 420;
    return {
      opacity: v <= 0 || v >= 2 ? 0 : 1,
      transform: [{ translateX: reduceMotion ? 0 : x }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, style]}>
      <View style={styles.bannerEdge} />
      <Text style={styles.bannerText}>{text}</Text>
      <View style={styles.bannerEdge} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Dica da primeira batalha
// ---------------------------------------------------------------------------

/** Como lutar, em três linhas. Some ao usar o primeiro golpe ou tocar em "Entendi". */
export function BattleTutorial({
  energyLabel,
  onDone,
}: {
  energyLabel: string;
  onDone: () => void;
}) {
  const steps = [
    'Toque num golpe para usar.',
    'Segure o golpe para ler tudo o que ele faz.',
    `Golpes gastam ${energyLabel.toLowerCase()}. Respirar Fundo recupera.`,
  ];
  return (
    <View style={styles.tutorial} accessibilityRole="summary">
      <Text style={styles.tutorialTitle}>Como lutar</Text>
      {steps.map((step, index) => (
        <View key={step} style={styles.tutorialRow}>
          <Text style={styles.tutorialNumber}>{index + 1}</Text>
          <Text style={styles.tutorialText}>{step}</Text>
        </View>
      ))}
      <Pressable
        style={({ pressed }) => [styles.tutorialButton, pressed && styles.pressed]}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Entendi, fechar dica de como lutar"
      >
        <Text style={styles.tutorialButtonText}>Entendi</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export interface BattleResultProps {
  won: boolean;
  title: string;
  /** "+25 XP" ou a frase de quando não houve XP. */
  xpLine: string;
  /** Número do XP para contar subindo (0 = mostra só o texto). */
  xpValue: number;
  lines: readonly string[];
  onDismiss: () => void;
  onUndo?: () => void;
  reduceMotion: boolean;
  /** Item que o monstro deixou (null = nada desta vez). */
  loot?: LootView | null;
}

export interface LootView {
  name: string;
  /** "Comum", "Raro", "Épico" (poção não tem). */
  rarityLabel?: string;
  /** Cor da raridade: a moldura e o rótulo. */
  rarityColor?: string;
  effect: string;
  art: ImageSourcePropType;
  chest: ImageSourcePropType;
}

/** Fim da luta: título salta, XP conta subindo, raios atrás na vitória. */
export function BattleResult({
  won,
  title,
  xpLine,
  xpValue,
  lines,
  onDismiss,
  onUndo,
  reduceMotion,
  loot,
}: BattleResultProps) {
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  const spin = useSharedValue(0);
  const shown = useCountUp(xpValue, reduceMotion ? 0 : 700, 260);

  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withSpring(1, { damping: 9, stiffness: 160 });
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
  }, [pop, reduceMotion, spin]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: 0.6 + pop.value * 0.4 }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value) * 0.9,
    transform: [{ rotate: `${spin.value * 360}deg` }, { scale: 0.7 + pop.value * 0.3 }],
  }));

  const xpText = xpValue > 0 && shown < xpValue ? xpLine.replace(`${xpValue}`, `${shown}`) : xpLine;

  return (
    <View style={styles.result}>
      <View style={styles.hero}>
        {won ? (
          <Animated.View pointerEvents="none" style={[styles.rays, raysStyle]}>
            <View style={styles.glow} />
            {Array.from({ length: 10 }, (_, index) => (
              <View
                key={index}
                style={[styles.ray, { transform: [{ rotate: `${index * 18}deg` }] }]}
              />
            ))}
          </Animated.View>
        ) : null}
        <Animated.Text style={[styles.title, !won && styles.titleLost, titleStyle]}>
          {title}
        </Animated.Text>
        <Text style={[styles.xp, xpValue <= 0 && styles.xpSentence]} accessibilityLabel={xpLine}>
          {xpText}
        </Text>
      </View>
      {loot ? <LootReveal loot={loot} reduceMotion={reduceMotion} /> : null}
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
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
  );
}

/**
 * Baú que treme e abre no item que caiu. A moldura tem a cor da raridade.
 * Reduzir movimento mostra o item direto.
 */
function LootReveal({ loot, reduceMotion }: { loot: LootView; reduceMotion: boolean }) {
  const open = useSharedValue(reduceMotion ? 1 : 0);
  const wobble = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    wobble.value = withDelay(
      500,
      withSequence(
        withTiming(-1, { duration: 70 }),
        withTiming(1, { duration: 70 }),
        withTiming(-1, { duration: 70 }),
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 60 }),
      ),
    );
    open.value = withDelay(860, withSpring(1, { damping: 10, stiffness: 170 }));
  }, [open, reduceMotion, wobble]);

  const chestStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, open.value * 1.6),
    transform: [{ rotate: `${wobble.value * 8}deg` }, { scale: 1 + open.value * 0.3 }],
  }));
  const itemStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, open.value * 1.4),
    transform: [{ scale: 0.4 + open.value * 0.6 }],
  }));
  const frame = loot.rarityColor ?? colors.amber;

  return (
    <View
      style={styles.loot}
      accessible
      accessibilityLabel={`Item novo: ${loot.name}${loot.rarityLabel ? `, ${loot.rarityLabel}` : ''}. ${loot.effect}`}
    >
      <View style={[styles.lootSocket, { borderColor: frame }]}>
        <Animated.View style={[styles.lootLayer, itemStyle]}>
          <Image source={loot.art} style={styles.lootArt} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[styles.lootLayer, chestStyle]}>
          <Image source={loot.chest} style={styles.lootArt} resizeMode="contain" />
        </Animated.View>
      </View>
      <View style={styles.lootCopy}>
        {loot.rarityLabel ? (
          <Text style={[styles.lootRarity, { color: frame }]}>{loot.rarityLabel}</Text>
        ) : null}
        <Text style={styles.lootName} numberOfLines={1}>
          {loot.name}
        </Text>
        <Text style={styles.lootEffect} numberOfLines={1}>
          {loot.effect}
        </Text>
      </View>
    </View>
  );
}

/** Conta de 0 até `target` em passos; termina sempre no valor certo. */
function useCountUp(target: number, duration: number, delay: number): number {
  const [value, setValue] = useState(duration <= 0 ? target : 0);
  useEffect(() => {
    if (duration <= 0 || target <= 0) return;
    const steps = 14;
    let step = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        step += 1;
        setValue(Math.round((target * step) / steps));
        if (step >= steps && interval) clearInterval(interval);
      }, duration / steps);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [delay, duration, target]);
  return duration <= 0 ? target : value;
}

// ---------------------------------------------------------------------------
// Confete da vitória
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ['#FBBF24', '#F472B6', '#60A5FA', '#4ADE80', '#F87171', '#C084FC'];

/** Chuva de confete por cima de tudo. Cai uma vez. */
export function Confetti({ width, height }: { width: number; height: number }) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withTiming(1, { duration: 2600, easing: Easing.linear });
  }, [fall]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 36 }, (_, index) => (
        <Piece key={index} index={index} fall={fall} width={width} height={height} />
      ))}
    </View>
  );
}

function Piece({
  index,
  fall,
  width,
  height,
}: {
  index: number;
  fall: SharedValue<number>;
  width: number;
  height: number;
}) {
  // Posições fixas por índice: o confete não depende de sorteio no render.
  const x0 = ((index * 73) % 100) / 100;
  const lag = ((index * 37) % 30) / 100;
  const sway = 18 + ((index * 11) % 24);
  const speed = 0.8 + ((index * 17) % 40) / 100;
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, (fall.value - lag) / (1 - lag));
    const y = -30 + t * (height + 60) * speed;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [
        { translateX: x0 * width + Math.sin(t * 10 + index) * sway },
        { translateY: y },
        { rotate: `${t * 720 + index * 40}deg` },
        { scaleX: Math.cos(t * 14 + index) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          width: index % 3 === 0 ? 6 : 9,
          height: index % 3 === 0 ? 12 : 6,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: '42%',
    paddingVertical: space.sm,
    backgroundColor: 'rgba(10, 14, 32, 0.88)',
    alignItems: 'center',
    gap: 6,
  },
  bannerEdge: { alignSelf: 'stretch', height: 2, backgroundColor: colors.amber },
  bannerText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5,
  },

  tutorial: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(10, 14, 32, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.55)',
    gap: space.sm,
  },
  tutorialTitle: { fontSize: 15, fontWeight: '900', color: colors.amberSoft },
  tutorialRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  tutorialNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.amber,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  tutorialText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  tutorialButton: {
    alignSelf: 'flex-end',
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialButtonText: { fontSize: 14, fontWeight: '800', color: colors.amberSoft },

  result: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
  loot: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  // Raio interno = externo − padding (regra 14).
  lootSocket: {
    width: 64,
    height: 64,
    borderRadius: radius.lg - space.sm,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  lootArt: { width: 50, height: 50 },
  lootCopy: { flex: 1, minWidth: 0 },
  lootRarity: { fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  lootName: { fontSize: 16, fontWeight: '900', color: colors.text },
  lootEffect: { fontSize: 13, color: colors.textMuted },
  hero: { alignItems: 'center', justifyContent: 'center', minHeight: 130, alignSelf: 'stretch' },
  rays: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 34,
    height: 360,
    borderRadius: 17,
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
  },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  titleLost: { color: colors.dangerText },
  xp: {
    marginTop: space.sm,
    fontSize: 26,
    fontWeight: '900',
    color: colors.amberSoft,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  xpSentence: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
  line: {
    fontSize: 14,
    lineHeight: 20,
    color: '#CBD5E1',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cta: {
    marginTop: space.md,
    minHeight: 54,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 17, fontWeight: '900', color: colors.bg },
  pressed: { opacity: 0.85 },
  undo: { minHeight: 44, minWidth: 180, alignItems: 'center', justifyContent: 'center' },
  undoText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  piece: { position: 'absolute', left: 0, top: 0, borderRadius: 1 },
});
