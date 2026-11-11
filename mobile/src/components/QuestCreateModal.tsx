import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  XP_REWARDS,
} from '../domain/constants';
import type { Category, Difficulty } from '../domain/types';
import { colors } from '../theme/colors';

export interface QuestCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, difficulty: Difficulty, category: Category) => void;
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Modal de criação — occasional / spatial consistency.
 * Enter: opacity + scale 0.95→1 em 220ms ease-out.
 * Caller: QuestLogScreen (FAB / botão "Personalizar").
 * Pedido: "Criar task em MODAL — o formulário atual ocupa demais a tela".
 */
export function QuestCreateModal({
  visible,
  onClose,
  onSubmit,
}: QuestCreateModalProps) {
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [category, setCategory] = useState<Category>('OTHER');
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
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      cancelled = true;
    };
  }, [visible, opacity, scale]);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setDifficulty('MEDIUM');
      setCategory('OTHER');
    }
  }, [visible]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed, difficulty, category);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar modal"
        />
        <Animated.View style={[styles.sheet, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.eyebrow}>Nova quest</Text>
          <Text style={styles.title}>Registrar missão</Text>

          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="ex: Beber 2L de água"
            placeholderTextColor={colors.textDim}
            onSubmitEditing={submit}
            returnKeyType="done"
            autoFocus
          />

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const selected = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {CATEGORY_LABELS[c]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Dificuldade</Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {DIFFICULTY_LABELS[d]} (+{XP_REWARDS[d]})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.secondary}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, !title.trim() && styles.ctaDisabled]}
              disabled={!title.trim()}
              onPress={submit}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Registrar</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.amberWash,
  },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  chipTextSelected: { color: colors.amberSoft },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  cta: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.bg },
});
