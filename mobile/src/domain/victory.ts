import type { XpDenyReason } from './antiFarm';

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
}

export function buildVictoryEvent(input: {
  questTitle: string;
  xpAwarded: number;
  denyReason: XpDenyReason | null;
  leveledUp: boolean;
  newLevel: number | null;
}): QuestVictoryEvent {
  const outcome: QuestVictoryOutcome =
    input.xpAwarded > 0 && input.denyReason == null ? 'VICTORY' : 'BLOCKED';

  return {
    outcome,
    questTitle: input.questTitle,
    xpAwarded: input.xpAwarded,
    denyReason: input.denyReason,
    leveledUp: input.leveledUp,
    newLevel: input.newLevel,
  };
}
