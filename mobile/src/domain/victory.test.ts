import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVictoryEvent, VILLAIN_BY_CATEGORY } from './victory';

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

  it('escolhe o vilão pela categoria da quest', () => {
    const event = buildVictoryEvent({
      questTitle: 'Estudar 25min',
      category: 'STUDY',
      xpAwarded: 25,
      denyReason: null,
      leveledUp: false,
      newLevel: null,
    });
    assert.equal(event.villain.name, 'Distração');
    assert.equal(event.villain.defeatedTitle, 'Distração derrotada!');
  });

  it('usa a Sombra quando a categoria não é informada', () => {
    const event = buildVictoryEvent({
      questTitle: 'Qualquer',
      xpAwarded: 10,
      denyReason: null,
      leveledUp: true,
      newLevel: 2,
    });
    assert.equal(event.villain.name, 'Sombra');
    assert.equal(event.leveledUp, true);
    assert.equal(event.newLevel, 2);
  });

  it('todo vilão tem nome curto o bastante para o placeholder', () => {
    for (const villain of Object.values(VILLAIN_BY_CATEGORY)) {
      assert.ok(villain.name.length <= 9, villain.name);
      assert.ok(villain.defeatedTitle.endsWith('!'));
    }
  });
});
