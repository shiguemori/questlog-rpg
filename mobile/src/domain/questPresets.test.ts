import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { XP_REWARDS } from './constants';
import { findPreset, presetXp, QUEST_PRESETS } from './questPresets';

describe('questPresets', () => {
  it('tem ids únicos e XP alinhado à dificuldade', () => {
    const ids = new Set(QUEST_PRESETS.map((p) => p.id));
    assert.equal(ids.size, QUEST_PRESETS.length);
    for (const preset of QUEST_PRESETS) {
      assert.equal(presetXp(preset), XP_REWARDS[preset.difficulty]);
      assert.ok(preset.title.trim().length > 0);
      assert.ok(preset.chip.trim().length > 0);
    }
  });

  it('coloca a vitória rápida no primeiro atalho', () => {
    assert.equal(QUEST_PRESETS[0].id, 'water');
    assert.equal(QUEST_PRESETS[0].chip, 'Rápida');
    assert.equal(QUEST_PRESETS[0].difficulty, 'EASY');
  });

  it('findPreset resolve e falha com id desconhecido', () => {
    assert.equal(findPreset('water')?.title, 'Beber água');
    assert.equal(findPreset('missing'), undefined);
  });
});
