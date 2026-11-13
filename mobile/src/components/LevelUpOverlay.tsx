import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAnimatedValue } from '../motion/useAnimatedValue';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { Confetti } from './battle/BattleMoments';
import { CharacterArt } from './CharacterArt';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export interface LevelUpReward {
  /** "+2" */
  value: string;
  /** "pontos de atributo" */
  label: string;
}

interface LevelUpOverlayProps {
  visible: boolean;
  level: number;
  heroName: string;
  /** `hero.mage`… para o retrato. */
  assetKey?: string;
  rewards?: readonly LevelUpReward[];
  /** Frase do que abriu neste nível (camada nova da árvore). */
  unlockLine?: string | null;
  onDismiss: () => void;
  /** Abre a folha do herói para gastar os pontos. */
  onOpenHero?: () => void;
  onUndo?: () => void;
}

/**
 * Celebração rara (level up): retrato do herói, o nível em destaque e o que ele ganhou.
 * A ação principal leva direto para gastar os pontos.
 */
export function LevelUpOverlay({
  visible,
  level,
  heroName,
  assetKey,
  rewards = [],
  unlockLine,
  onDismiss,
  onOpenHero,
  onUndo,
}: LevelUpOverlayProps) {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const opacity = useAnimatedValue(0);
  const scale = useAnimatedValue(0.92);
  const lift = useAnimatedValue(0);

  // Entrada síncrona: o card nunca fica invisível esperando resposta do sistema.
  // Reduzir movimento mantém só o fade (sem escala nem pulo).
  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(reduceMotion ? 1 : 0.92);
    lift.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
    if (!reduceMotion) {
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(lift, {
          toValue: 1,
          duration: 220,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: 260,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, reduceMotion, opacity, scale, lift]);

  const heroY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.28)', 'rgba(245, 158, 11, 0)']}
            style={styles.cardGlow}
            pointerEvents="none"
          />
          {assetKey ? (
            <Animated.View style={[styles.portrait, { transform: [{ translateY: heroY }] }]}>
              <View style={styles.halo} />
              <CharacterArt assetKey={assetKey} size={150} accessibilityLabel={heroName} />
            </Animated.View>
          ) : null}
          <Text style={styles.title}>Level up!</Text>
          <Text style={styles.level} accessibilityLabel={`Nível ${level}`}>
            Nível {level}
          </Text>
          <Text style={styles.body}>{heroName}, você ficou mais forte.</Text>

          {rewards.length > 0 ? (
            <View style={styles.rewards}>
              {rewards.map((reward) => (
                <View key={reward.label} style={styles.reward}>
                  <Text style={styles.rewardValue}>{reward.value}</Text>
                  <Text style={styles.rewardLabel}>{reward.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {unlockLine ? <Text style={styles.unlock}>{unlockLine}</Text> : null}

          {onOpenHero ? (
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={onOpenHero}
              accessibilityRole="button"
              accessibilityLabel="Usar os pontos agora"
            >
              <Text style={styles.ctaText}>Usar os pontos</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={onOpenHero ? styles.secondary : [styles.cta, styles.ctaSolo]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Continuar após level up"
          >
            <Text style={onOpenHero ? styles.secondaryText : styles.ctaText}>
              {onOpenHero ? 'Depois' : 'Continuar aventura'}
            </Text>
          </Pressable>
          {onUndo ? (
            <Pressable
              style={styles.secondary}
              onPress={onUndo}
              accessibilityRole="button"
              accessibilityLabel="Desfazer esta conclusão"
            >
              <Text style={styles.secondaryText}>Desfazer</Text>
            </Pressable>
          ) : null}
        </Animated.View>
        {visible && !reduceMotion ? <Confetti width={width} height={height} /> : null}
      </View>
    </Modal>
  );
}

const CARD_RADIUS = radius.lg + 4;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: space.xl,
    paddingTop: 96,
    paddingBottom: space.lg,
    alignItems: 'center',
    marginTop: 80,
  },
  cardGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 160,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
  portrait: {
    position: 'absolute',
    top: -84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  level: {
    marginTop: space.xs,
    fontSize: 44,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  body: {
    marginTop: space.xs,
    fontSize: 15,
    lineHeight: 22,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  rewards: { marginTop: space.lg, alignSelf: 'stretch', gap: space.sm },
  reward: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  rewardValue: {
    minWidth: 36,
    fontSize: 20,
    fontWeight: '900',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  rewardLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  unlock: {
    marginTop: space.md,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#93C5FD',
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
  ctaSolo: { marginBottom: space.xs },
  ctaText: { fontSize: 16, fontWeight: '900', color: colors.bg },
  pressed: { opacity: 0.85 },
  secondary: {
    marginTop: space.xs,
    minHeight: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
});
