import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ACTOR_PORTRAITS, ACTOR_POSES, type ActorPose } from './actorArt';

export type { ActorPose };

/**
 * Arte dos personagens, renderizada no Blender (`assets/blender/sources/battle-characters.blend`).
 *
 * - `portrait` (padrão): retrato recortado, para avatar, lista e telas fora da luta.
 * - `stage`: quadro da arena com pose (parado, prepara, golpe, apanha, vitória, nocaute).
 *   Todas as poses ficam montadas e só a atual aparece: a troca é instantânea, sem piscar.
 *
 * Chaves: `hero.mage`, `hero.mage+crown` (com chapéu), `enemy.study`, `enemy.study+elite`,
 * `enemy.boss`, `enemy.boss+phase2`. Chave com chapéu sem arte cai na arte sem chapéu.
 */

const POSES: readonly ActorPose[] = ['idle', 'windup', 'attack', 'hurt', 'victory', 'ko'];

/**
 * O quadro da arena tem folga em volta (para braços erguidos e chapéus).
 * O zoom compensa, e o personagem ocupa o mesmo espaço do retrato antigo.
 */
function stageZoom(assetKey: string): number {
  if (assetKey.startsWith('enemy.boss')) return 1.2;
  return assetKey.startsWith('hero.') ? 1.39 : 1.3;
}

function resolveKey(assetKey: string, table: Record<string, unknown>): string | null {
  if (assetKey in table) return assetKey;
  const base = assetKey.split('+')[0];
  return base in table ? base : null;
}

export interface CharacterArtProps {
  /** `hero.mage`, `enemy.study+elite`… (o `assetKey` do motor). */
  assetKey: string;
  size: number;
  accessibilityLabel?: string;
  /** Pinta a silhueta numa cor só (clarão de dano). */
  tint?: string;
  /** Quadro da arena em vez do retrato. */
  mode?: 'portrait' | 'stage';
  pose?: ActorPose;
}

export const CharacterArt = memo(function CharacterArt({
  assetKey,
  size,
  accessibilityLabel,
  tint,
  mode = 'portrait',
  pose = 'idle',
}: CharacterArtProps) {
  const a11y = {
    accessibilityRole: tint ? undefined : ('image' as const),
    accessibilityLabel: tint ? undefined : accessibilityLabel,
    accessibilityIgnoresInvertColors: true,
  };

  if (mode === 'portrait') {
    const key = resolveKey(assetKey, ACTOR_PORTRAITS);
    if (!key) return null;
    return (
      <Image
        source={ACTOR_PORTRAITS[key]}
        style={[{ width: size, height: size }, tint ? { tintColor: tint } : null]}
        resizeMode="contain"
        {...a11y}
      />
    );
  }

  const key = resolveKey(assetKey, ACTOR_POSES);
  if (!key) return null;
  const frames = ACTOR_POSES[key];
  const drawn = size * stageZoom(key);
  const inset = -(drawn - size) / 2;
  const frameStyle = { width: drawn, height: drawn, left: inset, top: inset };

  // Clarão e brilho só precisam da pose atual (o quadro já foi decodificado embaixo).
  if (tint) {
    return (
      <View style={{ width: size, height: size }} pointerEvents="none">
        <Image
          source={frames[pose]}
          style={[styles.frame, frameStyle, { tintColor: tint }]}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }} pointerEvents="none" {...a11y}>
      {POSES.map((entry) => (
        <Image
          key={entry}
          source={frames[entry]}
          style={[styles.frame, frameStyle, { opacity: entry === pose ? 1 : 0 }]}
          resizeMode="contain"
          fadeDuration={0}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { position: 'absolute' },
});
