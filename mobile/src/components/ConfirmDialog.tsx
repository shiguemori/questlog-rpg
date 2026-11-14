import React, { useEffect } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimatedValue } from '../motion/useAnimatedValue';
import { playHaptic, useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Ação que apaga ou perde algo: botão vermelho. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Pergunta de confirmação com a cara do app (no lugar do Alert do sistema).
 * Tocar fora ou o voltar do Android cancelam. Entrada: fade + leve escala, 180 ms.
 */
export function ConfirmDialog({ visible, ...props }: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={props.onCancel}
    >
      {visible ? <DialogCard {...props} /> : null}
    </Modal>
  );
}

function DialogCard({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, 'visible'>) {
  const reduceMotion = useReducedMotion();
  const opacity = useAnimatedValue(0);
  const scale = useAnimatedValue(reduceMotion ? 1 : 0.94);

  useEffect(() => {
    if (destructive) playHaptic('WARNING');
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 180,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start();
  }, [destructive, opacity, scale, reduceMotion]);

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      />
      <Animated.View
        style={[styles.card, { transform: [{ scale }] }]}
        accessibilityViewIsModal
        accessibilityRole="alert"
        testID="confirm-dialog"
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            onPress={onCancel}
            accessibilityRole="button"
            testID="confirm-cancel"
          >
            <Text style={styles.secondaryText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              destructive ? styles.danger : styles.primary,
              pressed && styles.pressed,
            ]}
            onPress={onConfirm}
            accessibilityRole="button"
            testID="confirm-ok"
          >
            <Text style={destructive ? styles.dangerText : styles.primaryText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: space.xl,
    borderRadius: radius.lg + space.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  message: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  secondary: { borderWidth: 1, borderColor: colors.border },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.text },
  primary: { backgroundColor: colors.amber },
  primaryText: { fontSize: 15, fontWeight: '800', color: colors.bg },
  danger: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  dangerText: { fontSize: 15, fontWeight: '800', color: colors.dangerText },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
