import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CLASS_DEFAULTS } from '../domain/constants';
import type { CharacterClass } from '../domain/types';

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
      <View style={styles.container}>
        <Text style={styles.brand}>QuestLog</Text>
        <Text style={styles.title}>Crie seu herói</Text>
        <Text style={styles.subtitle}>
          Um nome, uma classe — depois registre sua primeira quest.
        </Text>

        <Text style={styles.label}>Nome do herói</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="ex: Lucas"
          placeholderTextColor="#64748B"
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
                <Text style={[styles.classLabel, selected && styles.classLabelSelected]}>
                  {meta.label}
                </Text>
                <Text style={styles.classBlurb}>{meta.blurb}</Text>
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
  safe: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  brand: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#F59E0B',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { fontSize: 15, color: '#94A3B8', marginBottom: 8, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', color: '#CBD5E1', marginTop: 8 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 16,
  },
  classRow: { gap: 10 },
  classCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    padding: 14,
    minHeight: 64,
  },
  classCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#292524',
  },
  classLabel: { fontSize: 16, fontWeight: '700', color: '#E2E8F0' },
  classLabelSelected: { color: '#FBBF24' },
  classBlurb: { marginTop: 4, fontSize: 13, color: '#94A3B8' },
  cta: {
    marginTop: 'auto',
    marginBottom: 16,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
});
