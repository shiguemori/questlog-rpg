import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVictoryEvent } from './victory';

describe('buildVictoryEvent', () => {
  it('marca VICTORY quando há XP', () => {
    const event = buildVictoryEvent({
      questTitle: 'Treino',
      xpAwarded: 50,
      denyReason: null,
      leveledUp: false,
      newLevel: null,
    });
    assert.equal(event.outcome, 'VICTORY');
  });

  it('marca BLOCKED quando anti-farm nega XP', () => {
    const event = buildVictoryEvent({
      questTitle: 'Rápida',
      xpAwarded: 0,
      denyReason: 'TOO_FAST',
      leveledUp: false,
      newLevel: null,
    });
    assert.equal(event.outcome, 'BLOCKED');
    assert.equal(event.denyReason, 'TOO_FAST');
  });
});
