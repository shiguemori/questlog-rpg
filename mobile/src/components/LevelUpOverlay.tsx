import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface LevelUpOverlayProps {
  visible: boolean;
  level: number;
  heroName: string;
  onDismiss: () => void;
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
}: LevelUpOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        opacity.setValue(1);
        scale.setValue(1);
        return;
      }
      opacity.setValue(0);
      scale.setValue(0.95);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      cancelled = true;
    };
  }, [visible, opacity, scale]);

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
            {heroName}, você ficou mais forte. +2 pontos de atributo aguardam no perfil.
          </Text>
          <Pressable
            style={styles.cta}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Continuar após level up"
          >
            <Text style={styles.ctaText}>Continuar aventura</Text>
          </Pressable>
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
});
