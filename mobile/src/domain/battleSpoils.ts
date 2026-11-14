import type { BattleState } from './battle';
import { recordBattleWin } from './boss';
import { addLoot, rollLoot, spendPotions, type LootDrop } from './loot';
import type { AppState, Difficulty } from './types';

/**
 * O que sobra de uma luta de quest, além do XP (que é do `completeQuest`):
 * - desconta as poções gastas (vencendo ou perdendo);
 * - na vitória, sorteia o loot e conta a vitória para o chefe da semana.
 *
 * A luta do chefe fecha em `settleBossBattle`.
 */
export function applyBattleSpoils(
  state: AppState,
  input: { battle: BattleState; won: boolean; seed: number; difficulty: Difficulty; now: Date },
): { state: AppState; drop: LootDrop | null } {
  let inventory = spendPotions(state.inventory, input.battle.potionsUsed);
  let weeklyBoss = state.weeklyBoss;
  let drop: LootDrop | null = null;
  if (input.won && input.battle.variant !== 'BOSS') {
    drop = rollLoot({
      seed: input.seed,
      source: input.battle.variant,
      difficulty: input.difficulty,
      owned: inventory.gear,
    });
    if (drop) inventory = addLoot(inventory, drop);
    weeklyBoss = recordBattleWin(weeklyBoss, input.now);
  }
  return { state: { ...state, inventory, weeklyBoss }, drop };
}
