import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import type { BattleEvent } from '../domain/battle';
import { EVENT_STEP_MS, WINDUP_MS } from '../components/battle/timing';

/**
 * Som e vibração de cada golpe, no mesmo tempo da animação.
 * Vibração sempre (é discreta); som só com Ajustes → Som ligado.
 * Tudo falha em silêncio: aparelho mudo ou sem motor segue normal.
 */

type Cue = 'hit' | 'crit' | 'heal' | 'shield' | 'whoosh' | 'windup' | 'ko' | 'trait' | 'chest';

const SOURCES: Record<Cue, number> = {
  hit: require('../../assets/sfx/hit.wav'),
  crit: require('../../assets/sfx/crit.wav'),
  heal: require('../../assets/sfx/heal.wav'),
  shield: require('../../assets/sfx/shield.wav'),
  whoosh: require('../../assets/sfx/whoosh.wav'),
  windup: require('../../assets/sfx/windup.wav'),
  ko: require('../../assets/sfx/ko.wav'),
  trait: require('../../assets/sfx/trait.wav'),
  chest: require('../../assets/sfx/chest.wav'),
};

interface Player {
  play: () => void;
  seekTo: (seconds: number) => unknown;
}

const players: Partial<Record<Cue, Player>> = {};

async function playCue(cue: Cue): Promise<void> {
  try {
    let player = players[cue];
    if (!player) {
      const { createAudioPlayer } = await import('expo-audio');
      player = createAudioPlayer(SOURCES[cue]) as Player;
      players[cue] = player;
    }
    await player.seekTo(0);
    player.play();
  } catch {
    // Som é complemento.
  }
}

function vibrate(style: Haptics.ImpactFeedbackStyle): void {
  try {
    Haptics.impactAsync(style).catch(() => undefined);
  } catch {
    // Vibração é complemento.
  }
}

/** O que tocar e vibrar para um evento, e quando (ms depois da ação). */
export function cueFor(
  event: BattleEvent,
  index: number,
): { at: number; cue: Cue | null; haptic: Haptics.ImpactFeedbackStyle | null } | null {
  const at = WINDUP_MS + index * EVENT_STEP_MS + 70;
  switch (event.kind) {
    case 'CAST':
      // Golpe no outro: o impulso da pose "prepara" já soa (o whoosh sai em `windupCue`).
      return event.target !== event.source
        ? { at: index * EVENT_STEP_MS + WINDUP_MS - 40, cue: 'whoosh', haptic: null }
        : null;
    case 'KO':
      return { at, cue: 'ko', haptic: Haptics.ImpactFeedbackStyle.Heavy };
    case 'TRAIT':
      return { at, cue: 'trait', haptic: Haptics.ImpactFeedbackStyle.Medium };
    case 'ENERGY':
      return (event.amount ?? 0) < 0
        ? { at, cue: null, haptic: Haptics.ImpactFeedbackStyle.Light }
        : null;
    case 'DAMAGE':
      if (event.crit) return { at, cue: 'crit', haptic: Haptics.ImpactFeedbackStyle.Heavy };
      return {
        at,
        cue: 'hit',
        haptic:
          event.target === 'PLAYER'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
      };
    case 'TICK':
      return { at, cue: 'hit', haptic: null };
    case 'HEAL':
      return { at, cue: 'heal', haptic: Haptics.ImpactFeedbackStyle.Soft };
    case 'SHIELD':
      return { at, cue: 'shield', haptic: Haptics.ImpactFeedbackStyle.Soft };
    case 'MISS':
      return { at, cue: 'whoosh', haptic: null };
    default:
      return null;
  }
}

/** Agenda som e vibração dos eventos novos. Cancela se a tela fechar antes. */
export function useBattleCues(
  events: readonly BattleEvent[],
  soundEnabled: boolean,
  reduceMotion: boolean,
): void {
  const lastSeq = useRef(0);
  useEffect(() => {
    const fresh = events.filter((event) => event.seq > lastSeq.current);
    if (fresh.length === 0) return undefined;
    lastSeq.current = fresh[fresh.length - 1].seq;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Pose "prepara": um zumbido curto no começo do golpe contra o outro lado.
    const opener = fresh.find((event) => event.kind === 'CAST' && event.target !== event.source);
    if (opener && soundEnabled && !reduceMotion) {
      timers.push(setTimeout(() => void playCue('windup'), fresh.indexOf(opener) * EVENT_STEP_MS));
    }
    fresh.forEach((event, index) => {
      const plan = cueFor(event, index);
      if (!plan) return;
      timers.push(
        setTimeout(
          () => {
            if (plan.haptic != null) vibrate(plan.haptic);
            if (soundEnabled && plan.cue) void playCue(plan.cue);
          },
          reduceMotion ? 0 : plan.at,
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [events, reduceMotion, soundEnabled]);
}

/** Baú abrindo no resultado: vibração de sucesso e, com som ligado, o brilho. */
export function playChestCue(soundEnabled: boolean): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  } catch {
    // Vibração é complemento.
  }
  if (soundEnabled) void playCue('chest');
}

/** Cria os tocadores antes da luta: o primeiro golpe não espera o arquivo carregar. */
export function warmBattleSounds(): void {
  for (const cue of Object.keys(SOURCES) as Cue[]) {
    if (players[cue]) continue;
    void import('expo-audio')
      .then(({ createAudioPlayer }) => {
        players[cue] = players[cue] ?? (createAudioPlayer(SOURCES[cue]) as Player);
      })
      .catch(() => undefined);
  }
}
