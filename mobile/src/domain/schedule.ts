import { localIsoDate, shiftIsoDate, weekdayIndex } from './dates';
import type { Quest, RepeatRule } from './types';

/**
 * Missões que repetem: todo dia, de segunda a sexta ou uma vez por semana.
 *
 * - A missão concluída reabre quando chega a próxima vez dela.
 * - Cada missão tem a própria sequência: concluir na vez certa soma 1; pular uma vez zera.
 * - Reabrir zera o relógio do anti-farm (`createdAt` = agora), como antes.
 */

export const REPEAT_RULES: readonly RepeatRule[] = ['DAILY', 'WEEKDAYS', 'WEEKLY'];

export const REPEAT_LABELS: Record<RepeatRule, string> = {
  DAILY: 'Todo dia',
  WEEKDAYS: 'Seg a sex',
  WEEKLY: 'Toda semana',
};

/** Sequência em texto curto ("3 seguidas", "2 semanas seguidas"). */
export function questStreakLabel(rule: RepeatRule, count: number): string {
  if (rule === 'WEEKLY') return count === 1 ? '1 semana' : `${count} semanas seguidas`;
  return count === 1 ? '1 vez' : `${count} seguidas`;
}

/** Próxima regra no botão da linha: sem → todo dia → seg a sex → semanal → sem. */
export function nextRepeatRule(current: RepeatRule | undefined): RepeatRule | undefined {
  if (current == null) return 'DAILY';
  const index = REPEAT_RULES.indexOf(current);
  return index >= REPEAT_RULES.length - 1 ? undefined : REPEAT_RULES[index + 1];
}

function isWeekday(isoDate: string): boolean {
  const day = weekdayIndex(isoDate);
  return day != null && day >= 1 && day <= 5;
}

/** Segunda-feira da semana do dia. */
export function mondayOf(isoDate: string): string {
  const weekday = weekdayIndex(isoDate) ?? 1;
  return shiftIsoDate(isoDate, -((weekday + 6) % 7)) ?? isoDate;
}

/** A missão concluída em `doneOn` já pode ser feita de novo em `today`? */
export function isDueAgain(rule: RepeatRule, doneOn: string, today: string): boolean {
  if (doneOn >= today) return false;
  if (rule === 'DAILY') return true;
  if (rule === 'WEEKDAYS') return isWeekday(today);
  return mondayOf(today) > mondayOf(doneOn);
}

/** A vez anterior à de `today` (o dia ou a semana que mantém a sequência). */
export function previousSlot(rule: RepeatRule, today: string): string | null {
  if (rule === 'DAILY') return shiftIsoDate(today, -1);
  if (rule === 'WEEKLY') return shiftIsoDate(mondayOf(today), -7);
  let cursor = shiftIsoDate(today, -1);
  for (let guard = 0; cursor && guard < 7 && !isWeekday(cursor); guard += 1) {
    cursor = shiftIsoDate(cursor, -1);
  }
  return cursor;
}

function slotOf(rule: RepeatRule, isoDate: string): string {
  return rule === 'WEEKLY' ? mondayOf(isoDate) : isoDate;
}

/**
 * Sequência da missão depois de concluir hoje. Missão sem repetição não tem sequência.
 * Concluir fora da agenda (ex.: seg a sex no sábado) mantém a sequência sem somar.
 */
export function nextQuestStreak(quest: Quest, today: string): number | undefined {
  const rule = quest.repeat;
  if (!rule) return undefined;
  if (rule === 'WEEKDAYS' && !isWeekday(today)) return quest.streak ?? 0;
  const last = quest.lastDoneOn;
  if (last && slotOf(rule, last) === slotOf(rule, today)) return quest.streak ?? 1;
  const previous = previousSlot(rule, today);
  const continues = last != null && previous != null && slotOf(rule, last) === previous;
  return continues ? (quest.streak ?? 0) + 1 : 1;
}

/**
 * Sequência mostrada na linha: some quando a vez anterior passou sem conclusão.
 * (O valor guardado só zera na próxima conclusão.)
 */
export function liveQuestStreak(quest: Quest, now: Date): number {
  const rule = quest.repeat;
  const last = quest.lastDoneOn;
  if (!rule || !last || !quest.streak) return 0;
  const today = localIsoDate(now);
  if (slotOf(rule, last) === slotOf(rule, today)) return quest.streak;
  const previous = previousSlot(rule, today);
  return previous != null && slotOf(rule, last) === previous ? quest.streak : 0;
}
