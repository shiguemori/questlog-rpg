import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CLASS_DEFAULTS } from '../domain/constants';
import type { CharacterClass } from '../domain/types';
import { colors } from '../theme/colors';
import { CharacterArt } from './CharacterArt';

export interface HeroAvatarProps {
  characterClass: CharacterClass;
  size?: number;
  /** Mantido por compatibilidade: o sprite da classe já identifica o herói. */
  initial?: string;
}

const CLASS_ACCENT: Record<CharacterClass, string> = {
  WARRIOR: colors.warrior,
  MAGE: colors.mage,
  ROGUE: colors.rogue,
};

const CLASS_SPRITE: Record<CharacterClass, string> = {
  WARRIOR: 'hero.warrior',
  MAGE: 'hero.mage',
  ROGUE: 'hero.rogue',
};

/** Retrato do herói: sprite da classe dentro de um anel na cor da classe. */
export function HeroAvatar({ characterClass, size = 72 }: HeroAvatarProps) {
  const accent = CLASS_ACCENT[characterClass];
  const label = CLASS_DEFAULTS[characterClass].label;
  const ring = Math.max(2, Math.round(size * 0.04));
  const inner = size - ring * 2;

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
      <View style={[styles.core, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <CharacterArt assetKey={CLASS_SPRITE[characterClass]} size={Math.round(inner * 1.05)} />
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
    backgroundColor: colors.bgElevated,
  },
});
