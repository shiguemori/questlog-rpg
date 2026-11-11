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
import { useReducedMotion } from '../platform/feedback';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface LevelUpOverlayProps {
  visible: boolean;
  level: number;
  heroName: string;
  onDismiss: () => void;
  onUndo?: () => void;
}

/**
 * Celebração rara (level up). Gate animate-expo: delight tier.
 * Sem Reanimated no projeto — Animated nativo só em opacity/scale.
 */
export function LevelUpOverlay({
  visible,
  level,
  heroName,
  onDismiss,
  onUndo,
}: LevelUpOverlayProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useAnimatedValue(0);
  const scale = useAnimatedValue(0.95);

  // Entrada síncrona: o card nunca fica invisível esperando resposta do sistema.
  // Reduzir movimento mantém só o fade (sem escala).
  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(reduceMotion ? 1 : 0.95);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 220,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reduceMotion, opacity, scale]);

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
          <Text style={styles.eyebrow}>Nível alcançado</Text>
          <Text style={styles.title}>Level up!</Text>
          <Text style={styles.level}>Nv. {level}</Text>
          <Text style={styles.body}>
            {heroName}, você ficou mais forte. Toque no seu herói para distribuir os novos pontos de
            atributo.
          </Text>
          <Pressable
            style={styles.cta}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Continuar após level up"
          >
            <Text style={styles.ctaText}>Continuar aventura</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#1E293B',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#F59E0B',
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  level: {
    marginTop: 8,
    fontSize: 48,
    fontWeight: '900',
    color: '#FBBF24',
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#94A3B8',
    textAlign: 'center',
  },
  cta: {
    marginTop: 24,
    minHeight: 48,
    minWidth: 200,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  undo: {
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  undoText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
});
