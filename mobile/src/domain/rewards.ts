import { CLASS_DEFAULTS } from './constants';
import { shiftIsoDate } from './dates';
import type {
  AttributeKey,
  Category,
  Character,
  DailyGoalTarget,
  PlayerSettings,
  UserStats,
} from './types';
import { nextStreak } from './xp';

/** Atributo que pode dar um bônus pequeno na categoria. */
export const CATEGORY_ATTRIBUTE: Record<Category, AttributeKey> = {
  STUDY: 'intelligence',
  WORK: 'strength',
  HEALTH: 'vitality',
  HOME: 'agility',
  OTHER: 'agility',
};

export const ATTRIBUTE_BONUS_CAP = 10;
export const STREAK_BONUS_CAP = 15;

/**
 * +1 XP por ponto gasto acima do padrão da classe, teto 10.
 * Herói novo (sem ponto gasto) ganha 0 — não infla o XP de quem só começou.
 */
export function attributeBonusXp(character: Character, category: Category): number {
  const key = CATEGORY_ATTRIBUTE[category];
  const baseline = CLASS_DEFAULTS[character.characterClass].attributes[key];
  const invested = Math.max(0, character.attributes[key] - baseline);
  return Math.min(ATTRIBUTE_BONUS_CAP, invested);
}

/** A partir de 3 dias. Teto 15. Não cria uma 11ª quest com XP. */
export function streakBonusXp(streakAfter: number): number {
  if (streakAfter >= 14) return STREAK_BONUS_CAP;
  if (streakAfter >= 7) return 10;
  if (streakAfter >= 3) return 5;
  return 0;
}

export function clampDailyGoalTarget(value: unknown): DailyGoalTarget {
  if (value === 2 || value === 3) return value;
  return 1;
}

export interface StreakResolution {
  streak: number;
  shieldConsumed: boolean;
  settings: PlayerSettings;
}

/**
 * Escudo manual cobre exatamente um dia perdido, uma vez por mês.
 * Não dá XP. Buraco maior que um dia continua zerando o streak.
 */
export function resolveStreak(
  stats: UserStats,
  todayIsoDate: string,
  settings: PlayerSettings,
): StreakResolution {
  const natural = nextStreak(stats, todayIsoDate);
  const oneDayGap =
    stats.lastCompletedDate != null && stats.lastCompletedDate === shiftIsoDate(todayIsoDate, -2);
  const usedMonth = settings.streakShieldUsedOn?.slice(0, 7) ?? null;
  const available = settings.streakShieldArmed && usedMonth !== todayIsoDate.slice(0, 7);

  if (oneDayGap && natural === 1 && stats.streak > 0 && available) {
    return {
      streak: stats.streak + 1,
      shieldConsumed: true,
      settings: {
        ...settings,
        streakShieldArmed: false,
        streakShieldUsedOn: todayIsoDate,
      },
    };
  }

  return { streak: natural, shieldConsumed: false, settings };
}

export function canArmStreakShield(settings: PlayerSettings, todayIsoDate: string): boolean {
  const usedMonth = settings.streakShieldUsedOn?.slice(0, 7) ?? null;
  return usedMonth !== todayIsoDate.slice(0, 7);
}
