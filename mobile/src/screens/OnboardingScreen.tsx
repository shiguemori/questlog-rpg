import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HeroAvatar } from '../components/HeroAvatar';
import { CLASS_DEFAULTS } from '../domain/constants';
import type { CharacterClass } from '../domain/types';
import { colors } from '../theme/colors';

interface OnboardingScreenProps {
  onComplete: (name: string, characterClass: CharacterClass) => void;
}

const CLASSES = Object.keys(CLASS_DEFAULTS) as CharacterClass[];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [name, setName] = useState('');
  const [characterClass, setCharacterClass] = useState<CharacterClass>('WARRIOR');

  const canContinue = name.trim().length >= 2;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.atmosphere} pointerEvents="none">
        <View style={styles.glowOrb} />
      </View>
      <View style={styles.container}>
        <Text style={styles.brand}>QuestLog</Text>
        <Text style={styles.title}>Crie seu herói</Text>
        <Text style={styles.subtitle}>
          Um nome, uma classe — depois registre sua primeira quest.
        </Text>

        <View style={styles.preview}>
          <HeroAvatar
            characterClass={characterClass}
            initial={name.trim() || undefined}
            size={96}
          />
          <Text style={styles.previewClass}>
            {CLASS_DEFAULTS[characterClass].label}
          </Text>
        </View>

        <Text style={styles.label}>Nome do herói</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="ex: Lucas"
          placeholderTextColor={colors.textDim}
          autoCapitalize="words"
          maxLength={24}
        />

        <Text style={styles.label}>Classe</Text>
        <View style={styles.classRow}>
          {CLASSES.map((cls) => {
            const meta = CLASS_DEFAULTS[cls];
            const selected = characterClass === cls;
            return (
              <Pressable
                key={cls}
                onPress={() => setCharacterClass(cls)}
                style={[styles.classCard, selected && styles.classCardSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
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
          style={[styles.cta, !canContinue && styles.ctaDisabled]}
          disabled={!canContinue}
          onPress={() => onComplete(name.trim(), characterClass)}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Começar jornada</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 12 },
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
    marginBottom: 16,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontWeight: '800', color: colors.bg },
});
