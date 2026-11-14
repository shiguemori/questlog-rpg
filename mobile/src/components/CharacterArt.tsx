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
 * `enemy.boss`, `enemy.clutter+phase2`… Chave com chapéu sem arte cai na arte sem chapéu.
 *
 * Camadas (`layers`): capa por baixo e arma por cima, renderizadas com a mesma câmera
 * dos quadros do herói (`layer.mage+cape-red`). Com camada, o retrato usa o quadro parado.
 */

const POSES: readonly ActorPose[] = ['idle', 'windup', 'attack', 'hurt', 'victory', 'ko'];
const IDLE_ONLY: readonly ActorPose[] = ['idle'];

const BOSS_ART = ['enemy.boss', 'enemy.clutter', 'enemy.couch', 'enemy.meeting'];

/**
 * O quadro da arena tem folga em volta (para braços erguidos e chapéus).
 * O zoom compensa, e o personagem ocupa o mesmo espaço do retrato antigo.
 */
function stageZoom(assetKey: string): number {
  if (BOSS_ART.includes(assetKey.split('+')[0])) return 1.2;
  return assetKey.startsWith('hero.') ? 1.39 : 1.3;
}

/** Retrato montado a partir do quadro parado (quando há capa ou arma). */
const LAYERED_PORTRAIT_ZOOM = 1.75;

function resolveKey(assetKey: string, table: Record<string, unknown>): string | null {
  if (assetKey in table) return assetKey;
  const base = assetKey.split('+')[0];
  return base in table ? base : null;
}

export interface ArtLayers {
  under: readonly string[];
  over: readonly string[];
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
  /** Capa (por baixo) e arma (por cima) do herói. */
  layers?: ArtLayers;
}

export const CharacterArt = memo(function CharacterArt({
  assetKey,
  size,
  accessibilityLabel,
  tint,
  mode = 'portrait',
  pose = 'idle',
  layers,
}: CharacterArtProps) {
  const a11y = {
    accessibilityRole: tint ? undefined : ('image' as const),
    accessibilityLabel: tint ? undefined : accessibilityLabel,
    accessibilityIgnoresInvertColors: true,
  };
  const under = (layers?.under ?? []).filter((entry) => entry in ACTOR_POSES);
  const over = (layers?.over ?? []).filter((entry) => entry in ACTOR_POSES);
  const layered = under.length + over.length > 0;

  if (mode === 'portrait' && !layered) {
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
  const zoom = mode === 'portrait' ? LAYERED_PORTRAIT_ZOOM : stageZoom(key);
  const drawn = size * zoom;
  const inset = -(drawn - size) / 2;
  // Retrato montado: o personagem fica um pouco acima do centro do quadro.
  const frameStyle = {
    width: drawn,
    height: drawn,
    left: inset,
    top: mode === 'portrait' ? inset + size * 0.08 : inset,
  };
  const shownPose: ActorPose = mode === 'portrait' ? 'idle' : pose;

  // Clarão e brilho só precisam da pose atual (o quadro já foi decodificado embaixo).
  if (tint) {
    return (
      <View style={{ width: size, height: size }} pointerEvents="none">
        <Image
          source={frames[shownPose]}
          style={[styles.frame, frameStyle, { tintColor: tint }]}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    );
  }

  const poses = mode === 'portrait' ? IDLE_ONLY : POSES;
  const stack = (layerKey: string, table: (typeof ACTOR_POSES)[string]) =>
    poses.map((entry) => (
      <Image
        key={`${layerKey}:${entry}`}
        source={table[entry]}
        style={[styles.frame, frameStyle, { opacity: entry === shownPose ? 1 : 0 }]}
        resizeMode="contain"
        fadeDuration={0}
      />
    ));

  return (
    <View
      style={[{ width: size, height: size }, mode === 'portrait' ? styles.clip : null]}
      pointerEvents="none"
      {...a11y}
    >
      {under.map((layerKey) => stack(layerKey, ACTOR_POSES[layerKey]))}
      {stack(key, frames)}
      {over.map((layerKey) => stack(layerKey, ACTOR_POSES[layerKey]))}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { position: 'absolute' },
  clip: { overflow: 'hidden' },
});
