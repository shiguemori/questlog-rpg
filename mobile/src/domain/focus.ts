import type { AppState, FocusSession } from './types';

/**
 * Modo foco: o jogador escolhe quanto tempo vai ficar numa quest e o app mostra só o
 * cronômetro até acabar. O relógio é derivado de `startedAt` + `minutes`, então fechar
 * o app não perde o tempo. Foco não dá XP extra: no fim, a quest é concluída pelo
 * caminho normal (batalha ou conclusão direta), com o mesmo anti-farm.
 */

/** Durações oferecidas, em minutos. */
export const FOCUS_MINUTES = [15, 25, 45, 60, 90, 120, 180, 240] as const;
export const FOCUS_MIN_MINUTES = FOCUS_MINUTES[0];
export const FOCUS_MAX_MINUTES = FOCUS_MINUTES[FOCUS_MINUTES.length - 1];

export type FocusStartResult = { ok: true; state: AppState } | { ok: false; message: string };

export function startFocus(
  state: AppState,
  questId: string,
  minutes: number,
  now: Date = new Date(),
): FocusStartResult {
  if (state.focus) return { ok: false, message: 'Já tem um foco rodando.' };
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest) return { ok: false, message: 'Essa quest não existe mais.' };
  if (quest.completed) return { ok: false, message: 'Essa quest já foi concluída.' };
  if (!Number.isInteger(minutes) || minutes < FOCUS_MIN_MINUTES || minutes > FOCUS_MAX_MINUTES) {
    return {
      ok: false,
      message: `Escolha entre ${focusDurationLabel(FOCUS_MIN_MINUTES)} e ${focusDurationLabel(FOCUS_MAX_MINUTES)}.`,
    };
  }
  return {
    ok: true,
    state: { ...state, focus: { questId, startedAt: now.toISOString(), minutes } },
  };
}

/** Encerra o foco (desistiu, concluiu ou a quest sumiu). A quest continua como estava. */
export function stopFocus(state: AppState): AppState {
  return state.focus ? { ...state, focus: null } : state;
}

export function focusEndsAtMs(focus: FocusSession): number {
  return Date.parse(focus.startedAt) + focus.minutes * 60_000;
}

export function focusRemainingMs(focus: FocusSession, nowMs: number): number {
  return Math.max(0, focusEndsAtMs(focus) - nowMs);
}

/** 0 a 1: quanto do tempo já passou. */
export function focusProgress(focus: FocusSession, nowMs: number): number {
  const total = focus.minutes * 60_000;
  return Math.min(1, Math.max(0, 1 - focusRemainingMs(focus, nowMs) / total));
}

/** "1:05:09" com hora, "24:59" sem. */
export function focusClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "25 min", "1h", "1h30". */
export function focusDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest > 0 ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

/** Save antigo ou corrompido: sem foco. Foco de quest que não está aberta também cai. */
export function sanitizeFocus(
  raw: unknown,
  openQuestIds: ReadonlySet<string>,
): FocusSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const { questId, startedAt, minutes } = raw as Record<string, unknown>;
  if (typeof questId !== 'string' || !openQuestIds.has(questId)) return null;
  if (typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt))) return null;
  if (
    typeof minutes !== 'number' ||
    !Number.isInteger(minutes) ||
    minutes < FOCUS_MIN_MINUTES ||
    minutes > FOCUS_MAX_MINUTES
  ) {
    return null;
  }
  return { questId, startedAt, minutes };
}
