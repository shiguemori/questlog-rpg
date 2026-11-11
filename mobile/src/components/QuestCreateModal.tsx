import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useAnimatedValue,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTY_LABELS, XP_REWARDS } from '../domain/constants';
import { QUEST_TITLE_MAX_LENGTH, validateQuestTitle, type NewQuestInput } from '../domain/quests';
import type { Category, Difficulty } from '../domain/types';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';

export interface QuestCreateModalProps {
  visible: boolean;
  onClose: () => void;
  /** Devolve a mensagem de erro (ex.: limite de quests abertas) ou null se registrou. */
  onSubmit: (input: NewQuestInput) => string | null;
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Modal de criação — ocasional / consistência espacial.
 * Entrada: opacity + scale 0.95→1 em 220ms ease-out (só opacity com "reduzir movimento").
 * O formulário sobe junto com o teclado e o erro aparece embaixo do campo.
 */
export function QuestCreateModal({ visible, onClose, onSubmit }: QuestCreateModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <QuestCreateSheet onClose={onClose} onSubmit={onSubmit} />
    </Modal>
  );
}

/**
 * Conteúdo do modal. Só existe enquanto o modal está aberto, então o
 * formulário sempre começa limpo e a entrada roda uma vez, na montagem.
 */
function QuestCreateSheet({ onClose, onSubmit }: Omit<QuestCreateModalProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [category, setCategory] = useState<Category>('OTHER');
  const [error, setError] = useState<string | null>(null);
  const opacity = useAnimatedValue(0);
  const scale = useAnimatedValue(0.95);

  useEffect(() => {
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
  }, [reduceMotion, opacity, scale]);

  const changeTitle = (value: string) => {
    setTitle(value);
    if (error) setError(null);
  };

  const submit = () => {
    const validation = validateQuestTitle(title);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    const submitError = onSubmit({ title: validation.title, difficulty, category });
    if (submitError) {
      setError(submitError);
      return;
    }
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.backdrop, { paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar sem registrar"
      />
      <Animated.View
        style={[styles.sheet, { opacity, transform: [{ scale }] }]}
        accessibilityViewIsModal
      >
        <Text style={styles.eyebrow}>Nova quest</Text>
        <Text style={styles.title}>Registrar missão</Text>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Título</Text>
          <Text style={styles.counter}>
            {title.length}/{QUEST_TITLE_MAX_LENGTH}
          </Text>
        </View>
        <TextInput
          style={[styles.input, error != null && styles.inputError]}
          value={title}
          onChangeText={changeTitle}
          placeholder="ex: Beber 2L de água"
          placeholderTextColor={colors.textDim}
          onSubmitEditing={submit}
          returnKeyType="done"
          maxLength={QUEST_TITLE_MAX_LENGTH}
          autoFocus
          accessibilityLabel="Título da quest"
        />
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {CATEGORIES.map((c) => {
            const selected = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Dificuldade</Text>
        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {DIFFICULTIES.map((d) => {
            const selected = difficulty === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={`${DIFFICULTY_LABELS[d]}, mais ${XP_REWARDS[d]} de XP`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {DIFFICULTY_LABELS[d]} (+{XP_REWARDS[d]})
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>O XP libera 1 minuto depois de registrar.</Text>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="Registrar quest"
          >
            <Text style={styles.ctaText}>Registrar</Text>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  counter: { fontSize: 12, color: colors.textDim },
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
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger },
  note: { fontSize: 12, color: colors.textDim },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 44,
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
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.bg },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
