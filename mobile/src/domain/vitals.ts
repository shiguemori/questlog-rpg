import { heroMaxHp } from './battle';
import { heroBonus } from './talents';
import type { Character, HeroVitals } from './types';

/**
 * Vida do herói entre as batalhas.
 *
 * A vida que sobra de uma luta é guardada no save. Ela volta sozinha com o tempo
 * (10% da vida máxima por hora) e enche no level up. Isso dá estratégia: perder vida
 * numa quest difícil pesa na próxima, então vale escudar e escolher a ordem das quests.
 */

export const REGEN_PERCENT_PER_HOUR = 10;
/** Nunca entra numa luta com menos que isto da vida máxima, para a luta ser jogável. */
export const MIN_START_HP_PERCENT = 20;

const HOUR_MS = 3_600_000;

export function heroMaxHpFor(character: Character): number {
  return heroMaxHp(character.attributes) + heroBonus(character).maxHp;
}

/** Vida atual, já com a recuperação desde a última luta. Sem registro = cheia. */
export function currentHeroHp(character: Character, now: Date): number {
  const maxHp = heroMaxHpFor(character);
  const vitals = character.vitals;
  if (!vitals) return maxHp;
  const since = Date.parse(vitals.updatedAt);
  const elapsed = Number.isNaN(since) ? 0 : Math.max(0, now.getTime() - since);
  const regen = Math.floor((maxHp * REGEN_PERCENT_PER_HOUR * elapsed) / (100 * HOUR_MS));
  return Math.max(0, Math.min(maxHp, vitals.hp + regen));
}

/** Vida com que o herói entra na próxima luta (com o piso mínimo). */
export function battleStartHp(character: Character, now: Date): number {
  const maxHp = heroMaxHpFor(character);
  const floor = Math.ceil((maxHp * MIN_START_HP_PERCENT) / 100);
  return Math.max(floor, currentHeroHp(character, now));
}

/** Minutos até a vida encher. 0 se já está cheia. */
export function minutesUntilFullHp(character: Character, now: Date): number {
  const maxHp = heroMaxHpFor(character);
  const missing = maxHp - currentHeroHp(character, now);
  if (missing <= 0) return 0;
  const perMinute = (maxHp * REGEN_PERCENT_PER_HOUR) / 100 / 60;
  return Math.ceil(missing / perMinute);
}

/**
 * Guarda a vida que sobrou da luta. Level up enche a vida.
 * Vida cheia limpa o registro, para não crescer o save à toa.
 */
export function settleHeroVitals(
  character: Character,
  hpLeft: number,
  now: Date,
  leveledUp: boolean,
): Character {
  const maxHp = heroMaxHpFor(character);
  const hp = leveledUp ? maxHp : Math.max(0, Math.min(maxHp, Math.floor(hpLeft)));
  if (hp >= maxHp) {
    const rest = { ...character };
    delete rest.vitals;
    return rest;
  }
  return { ...character, vitals: { hp, updatedAt: now.toISOString() } };
}

/** Lê o registro de vida de um save. Qualquer coisa estranha vira "vida cheia". */
export function sanitizeVitals(raw: unknown): HeroVitals | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const hp = record.hp;
  const updatedAt = record.updatedAt;
  if (typeof hp !== 'number' || !Number.isFinite(hp) || hp < 0) return undefined;
  if (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt))) return undefined;
  return { hp: Math.floor(hp), updatedAt };
}
