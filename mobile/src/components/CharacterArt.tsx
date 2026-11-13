import React, { memo } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';

/**
 * Retratos renderizados no Blender (1024×1024, fundo transparente).
 * Fonte: `assets/blender/sources/battle-characters.blend`. Heróis olham para a direita,
 * monstros para a esquerda. Para trocar a arte, renderize de novo com o mesmo nome.
 */
const CHARACTER_ART: Record<string, ImageSourcePropType> = {
  'hero.warrior': require('../../assets/battle/hero-warrior.png'),
  'hero.mage': require('../../assets/battle/hero-mage.png'),
  'hero.rogue': require('../../assets/battle/hero-rogue.png'),
  'enemy.study': require('../../assets/battle/enemy-study.png'),
  'enemy.work': require('../../assets/battle/enemy-work.png'),
  'enemy.health': require('../../assets/battle/enemy-health.png'),
  'enemy.home': require('../../assets/battle/enemy-home.png'),
  'enemy.other': require('../../assets/battle/enemy-other.png'),
};

export interface CharacterArtProps {
  /** `hero.mage`, `enemy.study`… (o `assetKey` do motor). */
  assetKey: string;
  size: number;
  accessibilityLabel?: string;
  /** Pinta a silhueta numa cor só (clarão de dano). */
  tint?: string;
}

export const CharacterArt = memo(function CharacterArt({
  assetKey,
  size,
  accessibilityLabel,
  tint,
}: CharacterArtProps) {
  const source = CHARACTER_ART[assetKey];
  if (!source) return null;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, tint ? { tintColor: tint } : null]}
      resizeMode="contain"
      accessibilityRole={tint ? undefined : 'image'}
      accessibilityLabel={tint ? undefined : accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
});
