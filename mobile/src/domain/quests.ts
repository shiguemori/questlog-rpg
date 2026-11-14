import { CATEGORIES, XP_REWARDS } from './constants';
import { localIsoDate } from './dates';
import { isDueAgain, REPEAT_RULES } from './schedule';
import type { AppState, Category, Difficulty, Quest, RepeatRule } from './types';

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
  { ok: true; title: string } | { ok: false; error: QuestTitleError; message: string };

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
  /** Atalho antigo: true = todo dia. */
  recurring?: boolean;
  repeat?: RepeatRule;
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
    recurring: false,
  };
  const repeat =
    input.repeat && REPEAT_RULES.includes(input.repeat)
      ? input.repeat
      : input.recurring === true
        ? 'DAILY'
        : undefined;
  if (repeat) {
    quest.repeat = repeat;
    quest.recurring = true;
  }

  return { ok: true, quest, state: { ...state, quests: [quest, ...state.quests] } };
}

/**
 * Remove uma quest (aberta ou concluída). XP, streak e contagem diária
 * já conquistados não mudam — excluir não devolve nem "reabre" recompensa.
 */
export function deleteQuest(state: AppState, questId: string): AppState {
  if (!state.quests.some((q) => q.id === questId)) return state;
  return {
    ...state,
    quests: state.quests.filter((q) => q.id !== questId),
    // Foco numa quest excluída acaba junto.
    focus: state.focus?.questId === questId ? null : state.focus,
  };
}

export type EditQuestResult = { ok: true; state: AppState } | { ok: false; message: string };

/**
 * Troca título e categoria. Dificuldade e `createdAt` ficam — senão dava para
 * reescrever o XP ou zerar o anti-farm.
 */
export function editQuest(
  state: AppState,
  questId: string,
  input: { title: string; category: Category },
): EditQuestResult {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest) return { ok: false, message: 'Não encontramos essa quest.' };
  if (quest.completed) return { ok: false, message: 'Quest concluída não se edita.' };
  const validation = validateQuestTitle(input.title);
  if (!validation.ok) return { ok: false, message: validation.message };
  if (!CATEGORIES.includes(input.category)) {
    return { ok: false, message: 'Escolha uma categoria.' };
  }
  return {
    ok: true,
    state: {
      ...state,
      quests: state.quests.map((item) =>
        item.id === questId
          ? {
              ...item,
              title: validation.title,
              category: input.category,
              xp: XP_REWARDS[item.difficulty],
            }
          : item,
      ),
    },
  };
}

/** Troca a repetição da missão. undefined = não repete (a sequência some). */
export function setQuestRepeat(
  state: AppState,
  questId: string,
  repeat: RepeatRule | undefined,
): AppState {
  if (!state.quests.some((item) => item.id === questId)) return state;
  return {
    ...state,
    quests: state.quests.map((item) => {
      if (item.id !== questId) return item;
      if (!repeat) {
        const next: Quest = { ...item, recurring: false };
        delete next.repeat;
        delete next.streak;
        delete next.lastDoneOn;
        return next;
      }
      return { ...item, repeat, recurring: true };
    }),
  };
}

/** Compatibilidade: liga (todo dia) ou desliga a repetição. */
export function setQuestRecurring(state: AppState, questId: string, recurring: boolean): AppState {
  return setQuestRepeat(state, questId, recurring ? 'DAILY' : undefined);
}

/**
 * Missão que repete volta a ficar aberta quando chega a próxima vez dela
 * (ver schedule.ts). createdAt vira agora: o minuto do anti-farm conta de novo.
 */
export function reopenDueRecurring(state: AppState, now: Date = new Date()): AppState {
  const today = localIsoDate(now);
  let changed = false;
  const quests = state.quests.map((quest) => {
    if (!quest.completed || !quest.completedAt) return quest;
    const rule = quest.repeat ?? (quest.recurring ? 'DAILY' : undefined);
    if (!rule) return quest;
    const doneOn = localIsoDate(new Date(quest.completedAt));
    if (!isDueAgain(rule, doneOn, today)) return quest;
    changed = true;
    const reopened: Quest = {
      ...quest,
      completed: false,
      createdAt: now.toISOString(),
      recurring: true,
      repeat: rule,
    };
    delete reopened.completedAt;
    return reopened;
  });
  return changed ? { ...state, quests } : state;
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
