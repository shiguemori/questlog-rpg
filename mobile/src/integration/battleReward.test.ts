import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_XP_QUESTS_PER_DAY } from '../domain/antiFarm';
import { applyEnemyMove, applyPlayerMove, startBattle, type BattleState } from '../domain/battle';
import { completeQuest, planQuestCompletion } from '../domain/completeQuest';
import { localIsoDate } from '../domain/dates';
import { addQuest } from '../domain/quests';
import { startJourney } from '../domain/state';
import type { AppState, Category, Difficulty } from '../domain/types';

const MINUTE = 60_000;

function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, day, hour, minute, 0, 0);
}

function fight(state: BattleState, moveId: string): BattleState {
  let current = state;
  for (
    let step = 0;
    step < 20 && (current.phase === 'PLAYER_TURN' || current.phase === 'ENEMY_TURN');
    step += 1
  ) {
    current =
      current.phase === 'PLAYER_TURN' ? applyPlayerMove(current, moveId) : applyEnemyMove(current);
  }
  return current;
}

function withQuest(
  state: AppState,
  title: string,
  difficulty: Difficulty,
  category: Category,
  createdAt: Date,
) {
  const added = addQuest(state, { title, difficulty, category }, createdAt);
  assert.ok(added.ok, 'quest deveria ser registrada');
  return added;
}

describe('completeQuest → batalha → recompensa', () => {
  it('vitória no motor liquida o mesmo XP de uma conclusão integral', () => {
    const created = at(11, 9);
    const now = new Date(created.getTime() + 2 * MINUTE);
    const added = withQuest(startJourney('Ana', 'MAGE'), 'Estudar', 'MEDIUM', 'STUDY', created);
    assert.equal(planQuestCompletion(added.state, added.quest.id, now), 'BATTLE');

    const battle = fight(
      startBattle({
        character: added.state.character,
        category: 'STUDY',
        difficulty: 'MEDIUM',
        heroName: added.state.character.name,
      }),
      'mage.burst',
    );
    assert.equal(battle.phase, 'VICTORY');

    const settled = completeQuest(added.state, added.quest.id, now, { rewardTier: 'FULL' });
    const direct = completeQuest(added.state, added.quest.id, now);
    assert.ok(settled);
    assert.ok(direct);
    assert.equal(settled.xpAwarded, direct.xpAwarded);
    assert.equal(settled.xpAwarded, 25);
    assert.equal(settled.state.quests[0]?.completed, true);
    assert.equal(settled.state.stats.streak, 1);
    assert.equal(settled.state.stats.dailyXpCompletions, 1);
    assert.equal(
      JSON.stringify(added.state.character),
      JSON.stringify(startJourney('Ana', 'MAGE').character),
    );
  });

  it('derrota conclui a quest, sobe o streak e paga metade sem bônus', () => {
    const created = at(11, 9);
    const now = new Date(created.getTime() + 2 * MINUTE);
    const base = startJourney('Ana', 'MAGE');
    const prepared: AppState = {
      ...base,
      character: {
        ...base.character,
        attributes: { ...base.character.attributes, intelligence: 8 },
      },
      stats: { ...base.stats, streak: 2, bestStreak: 2, lastCompletedDate: '2026-11-10' },
    };
    const added = withQuest(prepared, 'Estudar', 'MEDIUM', 'STUDY', created);
    const battle = fight(
      startBattle({
        character: added.state.character,
        category: 'STUDY',
        difficulty: 'MEDIUM',
        heroName: 'Ana',
      }),
      'mage.heal',
    );
    assert.equal(battle.phase, 'DEFEAT');

    const full = completeQuest(added.state, added.quest.id, now);
    const lost = completeQuest(added.state, added.quest.id, now, { rewardTier: 'REDUCED' });
    assert.ok(full);
    assert.ok(lost);
    assert.ok(lost.xpAwarded < full.xpAwarded);
    assert.equal(lost.xpAwarded, 12);
    assert.equal(lost.bonusXp, 0);
    assert.equal(full.bonusXp, 8);
    assert.equal(lost.state.quests[0]?.completed, true);
    assert.equal(lost.state.stats.streak, 3);
    assert.equal(lost.state.stats.dailyXpCompletions, 1);
    assert.equal(lost.state.stats.totalQuestsCompleted, 1);
  });

  it('bloqueio do anti-farm não abre batalha, nem com recompensa reduzida', () => {
    const created = at(11, 9);
    const now = new Date(created.getTime() + 30_000);
    const added = withQuest(startJourney('Ana', 'MAGE'), 'Rápida', 'HARD', 'WORK', created);
    assert.equal(planQuestCompletion(added.state, added.quest.id, now), 'BLOCKED');
    const blocked = completeQuest(added.state, added.quest.id, now, { rewardTier: 'REDUCED' });
    assert.ok(blocked);
    assert.equal(blocked.xpAwarded, 0);
    assert.equal(blocked.denyReason, 'TOO_FAST');
    assert.equal(blocked.state.stats.dailyXpCompletions, 0);

    const later = new Date(created.getTime() + 2 * MINUTE);
    const limited = {
      ...added.state,
      stats: {
        ...added.state.stats,
        dailyXpCompletions: MAX_XP_QUESTS_PER_DAY,
        dailyXpCompletionsDate: localIsoDate(later),
      },
    };
    assert.equal(planQuestCompletion(limited, added.quest.id, later), 'BLOCKED');
    const capped = completeQuest(limited, added.quest.id, later, { rewardTier: 'REDUCED' });
    assert.ok(capped);
    assert.equal(capped.xpAwarded, 0);
    assert.equal(capped.denyReason, 'DAILY_LIMIT');
    assert.equal(capped.state.stats.dailyXpCompletions, MAX_XP_QUESTS_PER_DAY);
  });
});
