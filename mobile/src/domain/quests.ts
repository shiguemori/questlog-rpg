import { XP_REWARDS } from './constants';
import type { AppState, Category, Difficulty, Quest } from './types';

export const QUEST_TITLE_MIN_LENGTH = 2;
export const QUEST_TITLE_MAX_LENGTH = 60;
/** Teto de quests abertas — evita lista infinita e criação em massa. */
export const MAX_OPEN_QUESTS = 50;

export type QuestTitleError = 'EMPTY' | 'TOO_SHORT' | 'TOO_LONG';

export const QUEST_TITLE_ERROR_COPY: Record<QuestTitleError, string> = {
  EMPTY: 'Dê um nome para a quest.',
  TOO_SHORT: `O nome precisa de pelo menos ${QUEST_TITLE_MIN_LENGTH} letras.`,
  TOO_LONG: `O nome pode ter no máximo ${QUEST_TITLE_MAX_LENGTH} caracteres.`,
};

export type QuestTitleValidation =
  | { ok: true; title: string }
  | { ok: false; error: QuestTitleError; message: string };

/** Remove espaços das pontas e colapsa espaços repetidos. */
export function normalizeQuestTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function validateQuestTitle(raw: string): QuestTitleValidation {
  const title = normalizeQuestTitle(raw);
  const fail = (error: QuestTitleError): QuestTitleValidation => ({
    ok: false,
    error,
    message: QUEST_TITLE_ERROR_COPY[error],
  });
  if (title.length === 0) return fail('EMPTY');
  if (title.length < QUEST_TITLE_MIN_LENGTH) return fail('TOO_SHORT');
  if (title.length > QUEST_TITLE_MAX_LENGTH) return fail('TOO_LONG');
  return { ok: true, title };
}

export interface NewQuestInput {
  title: string;
  difficulty: Difficulty;
  category: Category;
}

export type AddQuestError = QuestTitleError | 'TOO_MANY_OPEN';

export type AddQuestResult =
  | { ok: true; state: AppState; quest: Quest }
  | { ok: false; error: AddQuestError; message: string };

function defaultIdSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Caso de uso: registrar uma quest nova no topo da lista.
 * O XP vem sempre da tabela oficial; `createdAt` alimenta o anti-farm.
 */
export function addQuest(
  state: AppState,
  input: NewQuestInput,
  now: Date = new Date(),
  idSuffix: () => string = defaultIdSuffix,
): AddQuestResult {
  const validation = validateQuestTitle(input.title);
  if (!validation.ok) return validation;

  const openCount = state.quests.filter((q) => !q.completed).length;
  if (openCount >= MAX_OPEN_QUESTS) {
    return {
      ok: false,
      error: 'TOO_MANY_OPEN',
      message: `Você já tem ${MAX_OPEN_QUESTS} quests abertas. Conclua ou exclua alguma antes.`,
    };
  }

  const taken = new Set(state.quests.map((q) => q.id));
  const stamp = now.getTime().toString(36);
  let id = `${stamp}-${idSuffix()}`;
  for (let attempt = 1; taken.has(id); attempt += 1) {
    id = `${stamp}-${idSuffix()}-${attempt}`;
  }

  const quest: Quest = {
    id,
    title: validation.title,
    category: input.category,
    difficulty: input.difficulty,
    xp: XP_REWARDS[input.difficulty],
    completed: false,
    createdAt: now.toISOString(),
  };

  return { ok: true, quest, state: { ...state, quests: [quest, ...state.quests] } };
}

/**
 * Remove uma quest (aberta ou concluída). XP, streak e contagem diária
 * já conquistados não mudam — excluir não devolve nem "reabre" recompensa.
 */
export function deleteQuest(state: AppState, questId: string): AppState {
  if (!state.quests.some((q) => q.id === questId)) return state;
  return { ...state, quests: state.quests.filter((q) => q.id !== questId) };
}

/** Limpa o histórico de concluídas. Estatísticas permanecem. */
export function clearCompletedQuests(state: AppState): AppState {
  if (!state.quests.some((q) => q.completed)) return state;
  return { ...state, quests: state.quests.filter((q) => !q.completed) };
}

export type CategoryFilter = Category | 'ALL';

export interface QuestSections {
  open: Quest[];
  /** Concluídas, da mais recente para a mais antiga. */
  done: Quest[];
}

export function splitQuests(quests: readonly Quest[], filter: CategoryFilter): QuestSections {
  const visible = filter === 'ALL' ? quests : quests.filter((q) => q.category === filter);
  const open = visible.filter((q) => !q.completed);
  const done = visible
    .filter((q) => q.completed)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return { open, done };
}
