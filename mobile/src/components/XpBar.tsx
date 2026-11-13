import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useAnimatedValue } from '../motion/useAnimatedValue';
import {
  planXpBarAnimation,
  xpBarAccessibilityValue,
  xpProgressRatio,
  type XpBarSnapshot,
} from '../domain/xpBar';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';

export interface XpBarProps {
  xp: number;
  maxXp: number;
  level: number;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const FILL_MS = 240;

/**
 * Barra de XP — indicação de estado (ocasional).
 *
 * O preenchimento é a LARGURA da faixa (0%–100%), dirigida pelo driver JS.
 * A versão anterior deslizava a faixa com translateX no driver nativo e só
 * aparecia depois de medir a trilha (onLayout) e de uma Promise do sistema;
 * era a suspeita do bug "barra não preenche". Aqui não há medição nem espera:
 * o valor JS é a única fonte, então mesmo com a animação interrompida a barra
 * termina no valor certo. Largura em elemento absoluto e sem irmãos é a
 * exceção barata de layout.
 *
 * Level up: enche até 100% e recomeça do zero (ver planXpBarAnimation).
 * Reduzir movimento: salta direto para o valor final.
 */
export function XpBar({ xp, maxXp, level }: XpBarProps) {
  const ratio = xpProgressRatio(xp, maxXp);
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(reduceMotion);

  const progress = useAnimatedValue(ratio);
  const glow = useAnimatedValue(0);
  const shown = useRef<XpBarSnapshot>({ level, ratio });

  // Antes do efeito da animação: mudar a preferência não reinicia a barra.
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    const previous = shown.current;
    const next: XpBarSnapshot = { level, ratio };
    shown.current = next;
    if (previous.level === next.level && previous.ratio === next.ratio) return;

    progress.stopAnimation();

    if (reduceMotionRef.current) {
      progress.setValue(ratio);
      return;
    }

    const steps: Animated.CompositeAnimation[] = [];
    planXpBarAnimation(previous, next).forEach((segment, index) => {
      if (index > 0) {
        steps.push(
          Animated.timing(progress, {
            toValue: segment.from,
            duration: 0,
            useNativeDriver: false,
          }),
        );
      }
      steps.push(
        Animated.timing(progress, {
          toValue: segment.to,
          duration: FILL_MS,
          easing: EASE_OUT,
          useNativeDriver: false,
        }),
      );
    });

    Animated.sequence(steps).start(({ finished }) => {
      if (finished) progress.setValue(ratio);
    });

    const gained = next.level > previous.level || next.ratio > previous.ratio;
    if (gained) {
      glow.setValue(0);
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 140,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 220,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [level, ratio, progress, glow]);

  useEffect(
    () => () => {
      progress.stopAnimation();
      glow.stopAnimation();
    },
    [progress, glow],
  );

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Experiência do herói"
      accessibilityValue={xpBarAccessibilityValue(xp, maxXp, level)}
    >
      <View style={styles.metaRow}>
        <Text style={styles.level}>Nv. {level}</Text>
        <Text style={styles.values} testID="xp-bar-values">
          {xp}/{maxXp} XP
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          testID="xp-bar-fill"
          style={[styles.fill, ratio > 0 && styles.fillVisible, { width: fillWidth }]}
        >
          <Animated.View
            style={[
              styles.glow,
              {
                opacity: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.55],
                }),
              },
            ]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  level: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.amberSoft,
  },
  values: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.amber,
    overflow: 'hidden',
  },
  // Qualquer XP acima de zero deixa pelo menos um filete visível.
  fillVisible: { minWidth: 6 },
  glow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.amberSoft,
  },
});
