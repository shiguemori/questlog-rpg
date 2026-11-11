import type { XpDenyReason } from './antiFarm';
import type { Category } from './types';

/** Vilão simbólico de cada categoria (placeholder — Blender congelado). */
export interface Villain {
  /** Nome curto exibido no vilão (cabe em 96px). */
  name: string;
  /** Título da cena de vitória, já com a concordância certa. */
  defeatedTitle: string;
}

export const VILLAIN_BY_CATEGORY: Record<Category, Villain> = {
  STUDY: { name: 'Distração', defeatedTitle: 'Distração derrotada!' },
  WORK: { name: 'Caos', defeatedTitle: 'Caos derrotado!' },
  HEALTH: { name: 'Preguiça', defeatedTitle: 'Preguiça derrotada!' },
  HOME: { name: 'Bagunça', defeatedTitle: 'Bagunça derrotada!' },
  OTHER: { name: 'Sombra', defeatedTitle: 'Sombra derrotada!' },
};

/** Resultado visual ao concluir quest — não altera anti-farm. */
export type QuestVictoryOutcome = 'VICTORY' | 'BLOCKED';

/** Contrato SDD — evento de micro-cena pós-conclusão. */
export interface QuestVictoryEvent {
  outcome: QuestVictoryOutcome;
  questTitle: string;
  xpAwarded: number;
  denyReason: XpDenyReason | null;
  leveledUp: boolean;
  newLevel: number | null;
  villain: Villain;
}

export function buildVictoryEvent(input: {
  questTitle: string;
  xpAwarded: number;
  denyReason: XpDenyReason | null;
  leveledUp: boolean;
  newLevel: number | null;
  /** Categoria da quest — escolhe o vilão. Padrão: OTHER (Sombra). */
  category?: Category;
}): QuestVictoryEvent {
  const outcome: QuestVictoryOutcome =
    input.xpAwarded > 0 && input.denyReason == null ? 'VICTORY' : 'BLOCKED';

  return {
    outcome,
    villain: VILLAIN_BY_CATEGORY[input.category ?? 'OTHER'],
    questTitle: input.questTitle,
    xpAwarded: input.xpAwarded,
    denyReason: input.denyReason,
    leveledUp: input.leveledUp,
    newLevel: input.newLevel,
  };
}
