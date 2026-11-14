import { useEffect, useRef } from 'react';
import type { MusicVolume } from '../domain/types';

/**
 * Trilha em loop da arena (gerada por `scripts/gen-music.py`).
 * Entra e sai com fade curto. Volume 0 = não carrega nada.
 * Falha em silêncio: aparelho mudo ou sem áudio segue a luta normal.
 */

const TRACKS: Record<string, number> = {
  'enemy.study': require('../../assets/music/study.mp3'),
  'enemy.work': require('../../assets/music/work.mp3'),
  'enemy.health': require('../../assets/music/health.mp3'),
  'enemy.home': require('../../assets/music/home.mp3'),
  'enemy.other': require('../../assets/music/other.mp3'),
  'enemy.boss': require('../../assets/music/boss.mp3'),
  'enemy.clutter': require('../../assets/music/boss-clutter.mp3'),
  'enemy.couch': require('../../assets/music/boss-couch.mp3'),
  'enemy.meeting': require('../../assets/music/boss-meeting.mp3'),
};

/** Teto da trilha: fica abaixo dos efeitos de golpe. */
const MUSIC_CEILING = 0.45;
const FADE_MS = 800;
const FADE_STEPS = 12;

interface Player {
  play: () => void;
  pause: () => void;
  remove: () => void;
  loop: boolean;
  volume: number;
}

export function trackFor(arenaKey: string): number | null {
  return TRACKS[arenaKey] ?? null;
}

/** Volume final no player para o ajuste escolhido. */
export function playerVolume(setting: MusicVolume): number {
  return Math.round(setting * MUSIC_CEILING * 100) / 100;
}

function readVolume(player: Player): number {
  try {
    return player.volume;
  } catch {
    return 0;
  }
}

/** Leva o volume até `to` em passos. Devolve quem cancela. */
function fade(player: Player, to: number, done?: () => void): () => void {
  const from = readVolume(player);
  let step = 0;
  const timer = setInterval(() => {
    step += 1;
    try {
      player.volume = from + ((to - from) * step) / FADE_STEPS;
    } catch {
      // Player já liberado.
    }
    if (step >= FADE_STEPS) {
      clearInterval(timer);
      done?.();
    }
  }, FADE_MS / FADE_STEPS);
  return () => clearInterval(timer);
}

/**
 * Toca a trilha da arena enquanto a luta durar. `ended` abaixa a música
 * (o resultado tem o próprio som de vitória).
 */
export function useBattleMusic(arenaKey: string, setting: MusicVolume, ended: boolean): void {
  const source = setting > 0 ? trackFor(arenaKey) : null;
  const target = ended ? 0 : playerVolume(setting);
  const playerRef = useRef<Player | null>(null);
  const fadeRef = useRef<(() => void) | null>(null);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // Carrega e solta a trilha. Só recomeça se a arena mudar.
  useEffect(() => {
    if (source == null) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { createAudioPlayer } = await import('expo-audio');
        if (cancelled) return;
        const player = createAudioPlayer(source) as unknown as Player;
        player.loop = true;
        player.volume = 0;
        player.play();
        playerRef.current = player;
        fadeRef.current = fade(player, targetRef.current);
      } catch {
        // Música é complemento.
      }
    })();
    return () => {
      cancelled = true;
      fadeRef.current?.();
      const player = playerRef.current;
      playerRef.current = null;
      if (!player) return;
      fade(player, 0, () => {
        try {
          player.pause();
          player.remove();
        } catch {
          // Já liberado.
        }
      });
    };
  }, [source]);

  // Volume acompanha o ajuste e o fim da luta.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    fadeRef.current?.();
    fadeRef.current = fade(player, target);
  }, [target]);
}
