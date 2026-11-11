import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroAvatar } from '../components/HeroAvatar';
import { CLASS_DEFAULTS } from '../domain/constants';
import { HERO_NAME_MAX_LENGTH } from '../domain/state';
import type { CharacterClass } from '../domain/types';
import { colors } from '../theme/colors';

interface OnboardingScreenProps {
  onComplete: (name: string, characterClass: CharacterClass) => void;
}

const CLASSES = Object.keys(CLASS_DEFAULTS) as CharacterClass[];
const HERO_NAME_MIN_LENGTH = 2;

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [characterClass, setCharacterClass] = useState<CharacterClass>('WARRIOR');
  const [nameError, setNameError] = useState<string | null>(null);

  const trimmedName = name.trim();

  const changeName = (value: string) => {
    setName(value);
    if (nameError) setNameError(null);
  };

  const submit = () => {
    if (trimmedName.length < HERO_NAME_MIN_LENGTH) {
      setNameError(`Dê um nome com pelo menos ${HERO_NAME_MIN_LENGTH} letras para o seu herói.`);
      return;
    }
    onComplete(trimmedName, characterClass);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.atmosphere} pointerEvents="none">
        <View style={styles.glowOrb} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>QuestLog</Text>
        <Text style={styles.title}>Crie seu herói</Text>
        <Text style={styles.subtitle}>
          Um nome, uma classe — depois registre sua primeira quest.
        </Text>
        <View style={styles.promise}>
          <Text style={styles.promiseTitle}>O hábito cabe num minuto</Text>
          <Text style={styles.promiseBody}>
            Abra, feche 1 quest e veja a meta. Amanhã o streak pede só isso. Sem alerta insistente.
          </Text>
        </View>

        <View style={styles.preview}>
          <HeroAvatar
            characterClass={characterClass}
            initial={trimmedName || undefined}
            size={96}
          />
          <Text style={styles.previewClass}>{CLASS_DEFAULTS[characterClass].label}</Text>
        </View>

        <Text style={styles.label}>Nome do herói</Text>
        <TextInput
          style={[styles.input, nameError != null && styles.inputError]}
          value={name}
          onChangeText={changeName}
          placeholder="ex: Lucas"
          placeholderTextColor={colors.textDim}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={HERO_NAME_MAX_LENGTH}
          accessibilityLabel="Nome do herói"
        />
        {nameError ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {nameError}
          </Text>
        ) : null}

        <Text style={styles.label}>Classe</Text>
        <View style={styles.classRow} accessibilityRole="radiogroup">
          {CLASSES.map((cls) => {
            const meta = CLASS_DEFAULTS[cls];
            const selected = characterClass === cls;
            return (
              <Pressable
                key={cls}
                onPress={() => setCharacterClass(cls)}
                style={[styles.classCard, selected && styles.classCardSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={`${meta.label}. ${meta.blurb}`}
              >
                <HeroAvatar characterClass={cls} size={40} />
                <View style={styles.classCopy}>
                  <Text style={[styles.classLabel, selected && styles.classLabelSelected]}>
                    {meta.label}
                  </Text>
                  <Text style={styles.classBlurb}>{meta.blurb}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={submit}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Começar jornada</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          onPress={() => onComplete('', characterClass)}
          accessibilityRole="button"
          accessibilityLabel="Pular e usar o herói padrão"
        >
          <Text style={styles.skipText}>Pular</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  atmosphere: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  glowOrb: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 4,
    lineHeight: 22,
  },
  promise: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  promiseTitle: { fontSize: 14, fontWeight: '800', color: colors.amberSoft },
  promiseBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  preview: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  previewClass: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.amberSoft,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger },
  classRow: { gap: 10 },
  classCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    padding: 12,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classCardSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.amberWash,
  },
  classCopy: { flex: 1 },
  classLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  classLabelSelected: { color: colors.amberSoft },
  classBlurb: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  cta: {
    marginTop: 'auto',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: colors.bg },
  skip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
