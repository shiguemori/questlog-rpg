import React, { useEffect } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';
import { XP_DENY_COPY } from '../domain/antiFarm';
import type { QuestVictoryEvent } from '../domain/victory';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';

export interface VillainDefeatOverlayProps {
  event: QuestVictoryEvent | null;
  onDismiss: () => void;
  /** Desfaz a conclusão enquanto a janela de 5s estiver aberta. */
  onUndo?: () => void;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Micro-cena rara (delight): vilão aparece e cai ao ganhar XP.
 * BLOCKED: feedback sem vitória completa.
 * Caller: App.tsx após completeQuest.
 * Pedido: "Vilão derrotado ao completar task — se anti-farm bloquear XP, feedback diferente".
 */
export function VillainDefeatOverlay({
  event,
  onDismiss,
  onUndo,
}: VillainDefeatOverlayProps) {
  const visible = event != null;
  const reduceMotion = useReducedMotion();
  const opacity = useAnimatedValue(0);
  const villainOpacity = useAnimatedValue(0);
  const villainY = useAnimatedValue(12);
  const slash = useAnimatedValue(0);

  // Entrada síncrona: o card nunca fica invisível esperando resposta do sistema.
  useEffect(() => {
    if (!event) return undefined;
    const isVictory = event.outcome === 'VICTORY';

    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();

    // Reduzir movimento: só o fade do card; vilão já aparece no estado final.
    if (reduceMotion) {
      villainOpacity.setValue(isVictory ? 0.35 : 0.7);
      villainY.setValue(0);
      slash.setValue(isVictory ? 1 : 0);
      return undefined;
    }

    let cancelled = false;
    villainOpacity.setValue(0);
    villainY.setValue(12);
    slash.setValue(0);

    Animated.parallel([
      Animated.timing(villainOpacity, {
        toValue: 1,
        duration: 200,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(villainY, {
        toValue: 0,
        duration: 200,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (cancelled || !isVictory) return;
      Animated.parallel([
        Animated.timing(slash, {
          toValue: 1,
          duration: 160,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(villainOpacity, {
          toValue: 0.25,
          duration: 280,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(villainY, {
          toValue: 18,
          duration: 280,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      cancelled = true;
    };
  }, [event, reduceMotion, opacity, villainOpacity, villainY, slash]);

  if (!event) return null;

  const isVictory = event.outcome === 'VICTORY';
  const denyCopy =
    event.denyReason != null ? XP_DENY_COPY[event.denyReason] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Animated.View style={[styles.card, { opacity }]}>
          <Text style={styles.eyebrow}>
            {isVictory ? 'Combate' : 'Sem recompensa'}
          </Text>
          <Text style={styles.title}>
            {isVictory ? event.villain.defeatedTitle : 'Quest marcada'}
          </Text>

          <View style={styles.arena}>
            <Animated.View
              style={[
                styles.villain,
                !isVictory && styles.villainBlocked,
                {
                  opacity: villainOpacity,
                  transform: [{ translateY: villainY }],
                },
              ]}
            >
              <View style={styles.villainHornL} />
              <View style={styles.villainHornR} />
              <View style={styles.villainEyeL} />
              <View style={styles.villainEyeR} />
              <Text style={styles.villainLabel}>
                {isVictory ? event.villain.name.toUpperCase() : 'ESCAPOU'}
              </Text>
            </Animated.View>
            {isVictory ? (
              <Animated.View
                style={[
                  styles.slash,
                  {
                    opacity: slash,
                    transform: [
                      {
                        scaleX: slash.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                      { rotate: '-28deg' },
                    ],
                  },
                ]}
              />
            ) : null}
          </View>

          <Text style={styles.quest}>{event.questTitle}</Text>
          {isVictory ? (
            <Text style={styles.xp}>+{event.xpAwarded} XP</Text>
          ) : (
            <Text style={styles.blocked}>
              {denyCopy ?? 'Concluída sem XP desta vez.'}
            </Text>
          )}
          {event.habitLine ? <Text style={styles.habit}>{event.habitLine}</Text> : null}

          <Pressable
            style={styles.cta}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Fechar cena de vitória"
          >
            <Text style={styles.ctaText}>
              {isVictory ? 'Continuar' : 'Entendi'}
            </Text>
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  arena: {
    marginTop: 20,
    width: 140,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  villain: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: '#1A1020',
    borderWidth: 2,
    borderColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  villainBlocked: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSoft,
  },
  villainHornL: {
    position: 'absolute',
    top: -10,
    left: 14,
    width: 14,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#991B1B',
    transform: [{ rotate: '-18deg' }],
  },
  villainHornR: {
    position: 'absolute',
    top: -10,
    right: 14,
    width: 14,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#991B1B',
    transform: [{ rotate: '18deg' }],
  },
  villainEyeL: {
    position: 'absolute',
    top: 36,
    left: 26,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.amberSoft,
  },
  villainEyeR: {
    position: 'absolute',
    top: 36,
    right: 26,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.amberSoft,
  },
  villainLabel: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.danger,
  },
  slash: {
    position: 'absolute',
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.amberSoft,
  },
  quest: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  xp: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '900',
    color: colors.amberSoft,
  },
  blocked: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
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
    marginTop: 22,
    minHeight: 48,
    minWidth: 180,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.bg,
  },
  undo: {
    marginTop: 8,
    minHeight: 44,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
