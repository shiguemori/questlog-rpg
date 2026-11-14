import { BOSSES, type BattleState } from './battle';
import { recordBestiary } from './bestiary';
import { progressChallenges, type Challenge } from './challenges';
import type { LootDrop } from './loot';
import type { AppState, Category, Difficulty } from './types';
import { noteWeek } from './weekly';

/**
 * Registro comum a toda luta (de quest ou do chefe): bestiário, desafios do dia
 * e resumo da semana. Não mexe em XP nem em loot.
 */
export function recordBattle(
  state: AppState,
  input: {
    battle: BattleState;
    won: boolean;
    now: Date;
    difficulty: Difficulty;
    category?: Category;
    drop: LootDrop | null;
  },
): { state: AppState; finished: Challenge[]; bonus: LootDrop | null } {
  const { battle, won, now } = input;
  const boss = battle.variant === 'BOSS' ? BOSSES[battle.enemy.bossId ?? 'procrastination'] : null;
  const category = boss ? boss.home : (input.category ?? 'OTHER');
  const potionsUsed = battle.potionsUsed['potion.water'] + battle.potionsUsed['potion.coffee'];

  const withBestiary: AppState = {
    ...state,
    bestiary: recordBestiary(state.bestiary, battle, category, won),
  };
  const progress = progressChallenges(
    withBestiary,
    {
      type: 'BATTLE',
      won,
      difficulty: input.difficulty,
      boss: boss != null,
      potionsUsed,
      turns: battle.turn,
      hpPct: battle.hero.maxHp > 0 ? battle.hero.hp / battle.hero.maxHp : 0,
    },
    now,
  );
  const items = (input.drop ? 1 : 0) + (progress.bonus ? 1 : 0);
  const next = noteWeek(progress.state, now, {
    battle: { won },
    items,
    challenges: progress.finished.length,
    boss: boss ? { id: boss.id, won } : undefined,
  });
  return { state: next, finished: progress.finished, bonus: progress.bonus };
}
