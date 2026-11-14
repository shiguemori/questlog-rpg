import { Asset } from 'expo-asset';
import { ACTOR_POSES } from '../components/actorArt';

/**
 * Baixa e guarda as poses antes da luta.
 *
 * No Expo Go (e no web) cada quadro vem do servidor na primeira vez que aparece: sem isto,
 * a primeira troca de pose pisca. No app instalado o arquivo já está no pacote e isto é rápido.
 * Falha em silêncio: a luta funciona igual, só pode piscar na primeira vez.
 */

const done = new Set<string>();

export function preloadActorArt(keys: readonly string[]): void {
  const modules: number[] = [];
  for (const key of keys) {
    if (done.has(key)) continue;
    const frames = ACTOR_POSES[key] ?? ACTOR_POSES[key.split('+')[0]];
    if (!frames) continue;
    done.add(key);
    for (const source of Object.values(frames)) {
      if (typeof source === 'number') modules.push(source);
    }
  }
  if (modules.length === 0) return;
  Asset.loadAsync(modules).catch(() => undefined);
}
