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
import { CharacterArt } from '../components/CharacterArt';
import { CLASS_ENERGY_LABEL, CLASS_OFFENSE, HERO_SKILLS } from '../domain/battle';
import { ATTRIBUTE_LABELS, CLASS_DEFAULTS } from '../domain/constants';
import { HERO_NAME_MAX_LENGTH } from '../domain/state';
import type { CharacterClass } from '../domain/types';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

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
        <View style={styles.classGrid} accessibilityRole="radiogroup">
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
                <CharacterArt assetKey={`hero.${cls.toLowerCase()}`} size={88} />
                <Text style={[styles.classLabel, selected && styles.classLabelSelected]}>
                  {meta.label}
                </Text>
                <Text style={styles.classEnergy}>{CLASS_ENERGY_LABEL[cls]}</Text>
              </Pressable>
            );
          })}
        </View>
        <ClassDetail characterClass={characterClass} />

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

/** O que a classe escolhida faz: frase, ataque, energia e os golpes que já vêm com ela. */
function ClassDetail({ characterClass }: { characterClass: CharacterClass }) {
  const meta = CLASS_DEFAULTS[characterClass];
  const skills = HERO_SKILLS[characterClass].slice(0, 5);
  return (
    <View style={styles.detail} testID="class-detail" accessibilityLiveRegion="polite">
      <Text style={styles.detailTitle}>{meta.label}</Text>
      <Text style={styles.detailBlurb}>{meta.blurb}</Text>
      <Text style={styles.detailMeta}>
        Ataque com {ATTRIBUTE_LABELS[CLASS_OFFENSE[characterClass]]} · energia:{' '}
        {CLASS_ENERGY_LABEL[characterClass]}
      </Text>
      <View style={styles.skillChips}>
        {skills.map((entry) => (
          <Text key={entry.id} style={styles.skillChip}>
            {entry.name}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  // Duas colunas do mesmo tamanho; a sétima classe fica sozinha à esquerda.
  classCard: {
    width: '48.5%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: 2,
  },
  classCardSelected: { borderColor: colors.amber, backgroundColor: colors.amberWash },
  classLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  classLabelSelected: { color: colors.amberSoft },
  classEnergy: { fontSize: 12, color: colors.textMuted },
  detail: {
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.lg,
    gap: space.xs,
  },
  detailTitle: { fontSize: 18, fontWeight: '800', color: colors.amberSoft },
  detailBlurb: { fontSize: 15, lineHeight: 21, color: colors.text },
  detailMeta: { fontSize: 13, color: colors.textMuted },
  skillChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  skillChip: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
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
