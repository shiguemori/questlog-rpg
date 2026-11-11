import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CLASS_DEFAULTS } from '../domain/constants';
import type { CharacterClass } from '../domain/types';
import { colors } from '../theme/colors';

export interface HeroAvatarProps {
  characterClass: CharacterClass;
  size?: number;
  /** Inicial do herói; se omitido, usa inicial da classe. */
  initial?: string;
}

const CLASS_ACCENT: Record<CharacterClass, string> = {
  WARRIOR: colors.warrior,
  MAGE: colors.mage,
  ROGUE: colors.rogue,
};

/**
 * Placeholder estilizado da classe (Blender congelado).
 * View geométrica — sem asset externo.
 */
export function HeroAvatar({ characterClass, size = 72, initial }: HeroAvatarProps) {
  const accent = CLASS_ACCENT[characterClass];
  const label = CLASS_DEFAULTS[characterClass].label;
  const letter = (initial?.trim() || label).charAt(0).toUpperCase();
  const ring = Math.max(2, Math.round(size * 0.04));
  const inner = size - ring * 4;

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: accent,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Avatar ${label}`}
    >
      <View
        style={[
          styles.core,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: colors.bgElevated,
          },
        ]}
      >
        <View style={[styles.crest, { backgroundColor: accent, opacity: 0.35 }]} />
        <Text style={[styles.letter, { fontSize: size * 0.34, color: accent }]}>{letter}</Text>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{label.slice(0, 1)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  crest: {
    position: 'absolute',
    top: '18%',
    width: '55%',
    height: '55%',
    borderRadius: 8,
    transform: [{ rotate: '45deg' }],
  },
  letter: {
    fontWeight: '900',
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.bg,
  },
});
