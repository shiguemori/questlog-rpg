import { daysInCalendarWeek } from './engagement';
import { localIsoDate } from './dates';
import type { AppState, AttributeKey } from './types';

const HERO_RANKS: readonly { level: number; title: string }[] = [
  { level: 1, title: 'Aprendiz' },
  { level: 3, title: 'Aventureiro' },
  { level: 6, title: 'Veterano' },
  { level: 10, title: 'Campeão' },
  { level: 15, title: 'Lenda' },
];

/** Título do herói conforme o nível — recompensa de identidade, sem asset. */
export function heroRankForLevel(level: number): string {
  const safe = Number.isFinite(level) ? Math.floor(level) : 1;
  let title = HERO_RANKS[0].title;
  for (const rank of HERO_RANKS) {
    if (safe >= rank.level) title = rank.title;
  }
  return title;
}

/** Quantos níveis faltam para o próximo título. No topo, a frase fecha a jornada. */
export function nextRankHint(level: number): string {
  const safe = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const next = HERO_RANKS.find((rank) => rank.level > safe);
  if (!next) return 'Você é Lenda. O hábito é a recompensa.';
  const left = next.level - safe;
  return left === 1
    ? `Mais 1 nível para ${next.title}.`
    : `Mais ${left} níveis para ${next.title}.`;
}

/**
 * Caso de uso: gastar 1 ponto de atributo (ganho no level up).
 * Retorna null se não houver ponto disponível.
 */
export function spendAttributePoint(state: AppState, attribute: AttributeKey): AppState | null {
  const { character } = state;
  if (character.attributePoints <= 0) return null;
  return {
    ...state,
    character: {
      ...character,
      attributePoints: character.attributePoints - 1,
      attributes: {
        ...character.attributes,
        [attribute]: character.attributes[attribute] + 1,
      },
    },
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  isUnlocked: (state: AppState) => boolean;
}

/**
 * Conquistas derivadas do estado — nada extra é salvo.
 * Todas dependem de XP real, nível ou dias distintos, então o anti-farm
 * (1 min + 10/dia) também limita a velocidade de desbloqueio.
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'FIRST_XP',
    title: 'Primeira vitória',
    description: 'Ganhe XP com uma quest.',
    isUnlocked: (s) => s.stats.totalXpEarned > 0,
  },
  {
    id: 'XP_100',
    title: 'Cem de experiência',
    description: 'Acumule 100 XP no total.',
    isUnlocked: (s) => s.stats.totalXpEarned >= 100,
  },
  {
    id: 'XP_500',
    title: 'Meio milhar',
    description: 'Acumule 500 XP no total.',
    isUnlocked: (s) => s.stats.totalXpEarned >= 500,
  },
  {
    id: 'XP_1000',
    title: 'Mil e contando',
    description: 'Acumule 1000 XP no total.',
    isUnlocked: (s) => s.stats.totalXpEarned >= 1000,
  },
  {
    id: 'STREAK_3',
    title: 'Três dias seguidos',
    description: 'Conclua quests por 3 dias consecutivos.',
    isUnlocked: (s) => s.stats.bestStreak >= 3,
  },
  {
    id: 'STREAK_7',
    title: 'Semana de ferro',
    description: 'Conclua quests por 7 dias consecutivos.',
    isUnlocked: (s) => s.stats.bestStreak >= 7,
  },
  {
    id: 'LEVEL_3',
    title: 'Aventureiro',
    description: 'Chegue ao nível 3.',
    isUnlocked: (s) => s.character.level >= 3,
  },
  {
    id: 'LEVEL_5',
    title: 'Herói de verdade',
    description: 'Chegue ao nível 5.',
    isUnlocked: (s) => s.character.level >= 5,
  },
  {
    id: 'WEEK_4',
    title: 'Quatro dias na semana',
    description: 'Conclua quests em 4 dias diferentes desta semana.',
    isUnlocked: (s) => daysInCalendarWeek(s.stats.completionDays, localIsoDate(new Date())) >= 4,
  },
];

export function unlockedAchievementIds(state: AppState): string[] {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked(state)).map((a) => a.id);
}

/** Conquistas que passaram a valer entre dois estados (para avisar o jogador). */
export function newlyUnlockedAchievements(before: AppState, after: AppState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !a.isUnlocked(before) && a.isUnlocked(after));
}
