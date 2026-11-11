import { previousIsoDate, shiftIsoDate, weekdayIndex } from './dates';
import { QUEST_PRESETS, type QuestPreset } from './questPresets';
import type { Category, Difficulty, PlayerSettings, Quest, UserStats } from './types';

/**
 * Contrato do loop diário. Não altera XP nem o anti-farm:
 * a meta conta conclusão; o XP continua em `antiFarm`.
 */

/** Uma vitória por dia basta para o hábito. */
export const DAILY_GOAL_TARGET = 1;

/** Quanto tempo a conclusão acidental pode ser desfeita. */
export const UNDO_COMPLETION_MS = 5_000;

/** Histórico de dias com conclusão. Cabe folgado no save local. */
export const COMPLETION_DAY_CAP = 120;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

const MILESTONE_COPY: Record<
  (typeof STREAK_MILESTONES)[number],
  { title: string; message: string }
> = {
  3: { title: 'Chama', message: 'Três dias seguidos. O hábito começou a pegar.' },
  7: { title: 'Semana', message: 'Uma semana inteira. Isso já é identidade.' },
  14: { title: 'Quinzena', message: 'Duas semanas. Você voltou por conta própria.' },
  30: { title: 'Mês firme', message: 'Um mês. Uma quest por dia virou rotina.' },
  60: { title: 'Constância', message: 'Dois meses de retorno. Constância rara.' },
  100: { title: 'Lenda do hábito', message: 'Cem dias. O streak é parte de quem você é.' },
};

const WEEKDAY_LABEL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

export interface DailyGoal {
  target: number;
  done: number;
  met: boolean;
}

export interface StreakMilestone {
  days: number;
  title: string;
  message: string;
}

export type HabitCueKind =
  'FIRST_STEP' | 'IN_PROGRESS' | 'DONE_TODAY' | 'STREAK_WAITING' | 'FRESH_START';

export interface HabitCue {
  kind: HabitCueKind;
  message: string;
}

export interface WeekCell {
  iso: string;
  label: string;
  done: boolean;
  isToday: boolean;
}

export interface WeekPace {
  thisWeek: number;
  lastWeek: number;
  message: string;
}

export interface QuestDraft {
  title: string;
  category: Category;
  difficulty: Difficulty;
}

export function dailyCompletionsOn(stats: UserStats, todayIsoDate: string): number {
  if (stats.dailyCompletionsDate === todayIsoDate) return stats.dailyCompletions;
  // Save antigo: a última conclusão é hoje, mas o contador novo ainda não existia.
  if (
    stats.dailyCompletionsDate == null &&
    stats.lastCompletedDate === todayIsoDate &&
    stats.totalQuestsCompleted > 0
  ) {
    return DAILY_GOAL_TARGET;
  }
  return 0;
}

export function buildDailyGoal(
  stats: UserStats,
  todayIsoDate: string,
  target: 1 | 2 | 3 = DAILY_GOAL_TARGET,
): DailyGoal {
  const safeTarget = target === 2 || target === 3 ? target : DAILY_GOAL_TARGET;
  const done = Math.min(safeTarget, Math.max(0, dailyCompletionsOn(stats, todayIsoDate)));
  return {
    target: safeTarget,
    done,
    met: done >= safeTarget,
  };
}

export function nextDailyCompletionCount(
  stats: UserStats,
  todayIsoDate: string,
): Pick<UserStats, 'dailyCompletions' | 'dailyCompletionsDate'> {
  const current = stats.dailyCompletionsDate === todayIsoDate ? stats.dailyCompletions : 0;
  return {
    dailyCompletionsDate: todayIsoDate,
    dailyCompletions: current + 1,
  };
}

export function nextCompletionDays(
  days: readonly string[] | undefined,
  todayIsoDate: string,
): string[] {
  const unique = new Set<string>();
  for (const day of days ?? []) {
    if (ISO_DAY.test(day)) unique.add(day);
  }
  if (ISO_DAY.test(todayIsoDate)) unique.add(todayIsoDate);
  return [...unique].sort().slice(-COMPLETION_DAY_CAP);
}

/** Reconstrói os dias do streak atual quando o save ainda não tinha o log. */
export function backfillCompletionDays(lastCompletedDate: string | null, streak: number): string[] {
  if (!lastCompletedDate || !ISO_DAY.test(lastCompletedDate) || streak < 1) return [];
  const length = Math.min(Math.floor(streak), COMPLETION_DAY_CAP);
  const days: string[] = [];
  for (let ago = length - 1; ago >= 0; ago -= 1) {
    const day = shiftIsoDate(lastCompletedDate, -ago);
    if (day) days.push(day);
  }
  return days;
}

/** Título de identidade do streak. Não dá XP. */
export function streakTitle(streak: number): string | null {
  if (streak >= 100) return MILESTONE_COPY[100].title;
  if (streak >= 60) return MILESTONE_COPY[60].title;
  if (streak >= 30) return MILESTONE_COPY[30].title;
  if (streak >= 14) return MILESTONE_COPY[14].title;
  if (streak >= 7) return MILESTONE_COPY[7].title;
  if (streak >= 3) return MILESTONE_COPY[3].title;
  if (streak >= 1) return 'Faísca';
  return null;
}

/** Marco cruzado nesta conclusão. Mesmo dia (streak estável) não celebra de novo. */
export function streakMilestoneCrossed(before: number, after: number): StreakMilestone | null {
  if (after <= before) return null;
  const crossed = STREAK_MILESTONES.filter((days) => before < days && after >= days);
  const days = crossed.at(-1);
  if (days == null) return null;
  const copy = MILESTONE_COPY[days];
  return { days, title: copy.title, message: copy.message };
}

/**
 * Uma linha na cena de vitória. Prioridade: marco, depois a meta do dia.
 * Sem linha, a cena fica como já era — sem banner extra.
 */
export function celebrationLine(input: {
  dailyGoalJustMet: boolean;
  milestone: StreakMilestone | null;
}): string | null {
  if (input.milestone) return input.milestone.message;
  if (input.dailyGoalJustMet) return 'Meta do dia cumprida. Amanhã basta uma quest.';
  return null;
}

/** Frase de abertura. Quatro portas: primeiro dia, streak vivo, recomeço, já venceu hoje. */
export function buildHabitCue(stats: UserStats, todayIsoDate: string): HabitCue {
  const goal = buildDailyGoal(stats, todayIsoDate);
  if (goal.met || stats.lastCompletedDate === todayIsoDate) {
    return {
      kind: 'DONE_TODAY',
      message: 'Vitória de hoje registrada. Amanhã basta uma quest.',
    };
  }
  const done = dailyCompletionsOn(stats, todayIsoDate);
  if (done > 0 && done < goal.target) {
    const left = goal.target - done;
    return {
      kind: 'IN_PROGRESS',
      message:
        left === 1
          ? 'Falta 1 quest para a meta de hoje.'
          : `Faltam ${left} quests para a meta de hoje.`,
    };
  }
  if (stats.lastCompletedDate == null) {
    return { kind: 'FIRST_STEP', message: 'Uma quest hoje abre sua jornada. Isso basta.' };
  }
  if (stats.lastCompletedDate === previousIsoDate(todayIsoDate)) {
    const days = Math.max(1, stats.streak);
    const unit = days === 1 ? 'dia' : 'dias';
    return {
      kind: 'STREAK_WAITING',
      message: `Streak de ${days} ${unit} vivo. Uma quest mantém a chama.`,
    };
  }
  return { kind: 'FRESH_START', message: 'Recomeço leve. Uma quest hoje abre um streak novo.' };
}

export function buildWeekStrip(days: readonly string[], todayIsoDate: string): WeekCell[] {
  const done = new Set(days);
  const cells: WeekCell[] = [];
  for (let ago = 6; ago >= 0; ago -= 1) {
    const iso = shiftIsoDate(todayIsoDate, -ago);
    if (!iso) continue;
    const weekday = weekdayIndex(iso);
    cells.push({
      iso,
      label: weekday == null ? '' : WEEKDAY_LABEL[weekday],
      done: done.has(iso),
      isToday: iso === todayIsoDate,
    });
  }
  return cells;
}

function countDays(days: ReadonlySet<string>, endIso: string, length: number): number {
  let total = 0;
  for (let ago = 0; ago < length; ago += 1) {
    const iso = shiftIsoDate(endIso, -ago);
    if (iso && days.has(iso)) total += 1;
  }
  return total;
}

/** Compara com a própria semana anterior. Sem ranking e sem culpa. */
export function buildWeekPace(days: readonly string[], todayIsoDate: string): WeekPace {
  const set = new Set(days);
  const thisWeek = countDays(set, todayIsoDate, 7);
  const lastWeekEnd = shiftIsoDate(todayIsoDate, -7);
  const lastWeek = lastWeekEnd ? countDays(set, lastWeekEnd, 7) : 0;

  let message: string;
  if (thisWeek === 0) {
    message = 'A semana começa com a quest de hoje.';
  } else if (lastWeek === 0) {
    message = thisWeek === 1 ? '1 dia nesta semana.' : `${thisWeek} dias nesta semana.`;
  } else if (thisWeek > lastWeek) {
    message = `Esta semana: ${thisWeek} dias. A anterior: ${lastWeek}.`;
  } else if (thisWeek === lastWeek) {
    message = `${thisWeek} dias, no mesmo ritmo da semana anterior.`;
  } else {
    message = `Esta semana: ${thisWeek} dias. Sem pressa para alcançar os ${lastWeek} da anterior.`;
  }
  return { thisWeek, lastWeek, message };
}

/** Uma frase só no domingo, com o app aberto nesse dia. */
export function sundayReview(days: readonly string[], todayIsoDate: string): string | null {
  if (weekdayIndex(todayIsoDate) !== 0) return null;
  const pace = buildWeekPace(days, todayIsoDate);
  if (pace.thisWeek === 0) return 'Domingo tranquilo. Uma quest ainda conta nesta semana.';
  const unit = pace.thisWeek === 1 ? 'dia' : 'dias';
  return `Fechamento da semana: ${pace.thisWeek} ${unit} com quest.`;
}

/** Sugestão estável no dia civil. A mesma data sempre devolve o mesmo atalho. */
export function suggestionForDay(todayIsoDate: string): QuestPreset {
  let hash = 0;
  for (const char of todayIsoDate) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return QUEST_PRESETS[hash % QUEST_PRESETS.length] ?? QUEST_PRESETS[0];
}

export function daysBetween(earlier: string, later: string): number | null {
  const start = shiftIsoDate(earlier, 0);
  if (!start) return null;
  let cursor = start;
  let days = 0;
  while (cursor < later && days < 4000) {
    const next = shiftIsoDate(cursor, 1);
    if (!next) return null;
    cursor = next;
    days += 1;
  }
  return cursor === later ? days : null;
}

/** Tela de retorno depois de 7+ dias sem concluir. Dispensável, não zera nada. */
export function shouldOfferReturn(
  stats: UserStats,
  settings: PlayerSettings,
  todayIsoDate: string,
): boolean {
  if (!stats.lastCompletedDate) return false;
  if (settings.dismissedReturnGap === stats.lastCompletedDate) return false;
  const gap = daysBetween(stats.lastCompletedDate, todayIsoDate);
  return gap != null && gap >= 7;
}

/** Dias distintos da semana calendário (segunda a domingo) que contém `today`. */
export function daysInCalendarWeek(days: readonly string[], todayIsoDate: string): number {
  const weekday = weekdayIndex(todayIsoDate);
  if (weekday == null) return 0;
  const mondayOffset = (weekday + 6) % 7;
  const start = shiftIsoDate(todayIsoDate, -mondayOffset);
  const end = start ? shiftIsoDate(start, 6) : null;
  if (!start || !end) return 0;
  const unique = new Set(days.filter((day) => day >= start && day <= end));
  return unique.size;
}

export function weekShareText(days: readonly string[], todayIsoDate: string): string {
  const pace = buildWeekPace(days, todayIsoDate);
  const unit = pace.thisWeek === 1 ? 'dia' : 'dias';
  return `QuestLog: ${pace.thisWeek} de 7 ${unit} com quest nesta semana.`;
}

/** Rascunho da quest mais recente, para repetir sem redigitar. */
export function latestQuestDraft(quests: readonly Quest[]): QuestDraft | null {
  let best: Quest | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const quest of quests) {
    const ms = Date.parse(quest.createdAt);
    if (Number.isNaN(ms) || ms < bestMs) continue;
    best = quest;
    bestMs = ms;
  }
  if (!best) return null;
  return { title: best.title, category: best.category, difficulty: best.difficulty };
}
