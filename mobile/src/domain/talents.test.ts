import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HERO_SKILLS, startBattle, TALENT_SKILLS } from './battle';
import { resetAttributePoints, spendAttributePoint, spentAttributePoints } from './progression';
import { importSaveJson, startJourney } from './state';
import {
  battleSkillsFor,
  heroBonus,
  learnTalent,
  LOADOUT_SIZE,
  loadoutIds,
  resetTalents,
  sanitizeIdList,
  talentPointsLeft,
  talentPointsTotal,
  talentStatus,
  TALENT_TREES,
  toggleLoadoutSkill,
  unlockedSkills,
} from './talents';
import type { AppState, CharacterClass } from './types';
import { heroMaxHpFor } from './vitals';

function hero(cls: CharacterClass = 'MAGE', level = 6): AppState {
  const state = startJourney('Bia', cls);
  return { ...state, character: { ...state.character, level } };
}

function learnAll(state: AppState, ids: readonly string[]): AppState {
  return ids.reduce((current, id) => {
    const next = learnTalent(current, id);
    assert.ok(next, `deveria aprender ${id}`);
    return next;
  }, state);
}

describe('árvore de talentos', () => {
  it('cada classe tem 9 talentos e libera as 4 habilidades novas', () => {
    for (const cls of ['WARRIOR', 'MAGE', 'ROGUE'] as CharacterClass[]) {
      const tree = TALENT_TREES[cls];
      assert.equal(tree.length, 9);
      const unlocks = tree.flatMap((node) => (node.unlocksSkill ? [node.unlocksSkill] : []));
      assert.deepEqual(
        unlocks,
        TALENT_SKILLS[cls].map((entry) => entry.id),
      );
    }
  });

  it('1 ponto por nível depois do 1', () => {
    assert.equal(talentPointsTotal(1), 0);
    assert.equal(talentPointsTotal(4), 3);
    assert.equal(talentPointsLeft(hero('MAGE', 1).character), 0);
  });

  it('pede o talento anterior, o nível e um ponto livre', () => {
    const state = hero('MAGE', 3);
    const [first, second, third] = TALENT_TREES.MAGE;
    assert.equal(talentStatus(state.character, second), 'NEEDS_PREVIOUS');
    assert.equal(talentStatus(state.character, first), 'AVAILABLE');
    assert.equal(learnTalent(state, second.id), null);

    const learned = learnAll(state, [first.id, second.id]);
    assert.equal(talentPointsLeft(learned.character), 0);
    assert.equal(talentStatus(learned.character, third), 'NEEDS_LEVEL');
    assert.equal(talentStatus(learned.character, TALENT_TREES.MAGE[3]), 'NO_POINTS');
    assert.equal(talentStatus(learned.character, first), 'LEARNED');
    assert.equal(learnTalent(learned, first.id), null);
    assert.equal(learnTalent(learned, 'nao.existe'), null);
  });

  it('bônus passivos somam e entram na luta', () => {
    const tree = TALENT_TREES.WARRIOR;
    const ids = (branch: string) => tree.filter((n) => n.branch === branch).map((n) => n.id);
    const state = learnAll(hero('WARRIOR', 9), [...ids('ATTACK'), ...ids('GUARD')]);
    const bonus = heroBonus(state.character);
    assert.deepEqual(bonus, {
      damagePct: 10,
      maxHp: 8,
      critChance: 10,
      shieldPct: 30,
      maxEnergy: 0,
    });

    const plain = startBattle({
      character: hero('WARRIOR', 9).character,
      category: 'HOME',
      difficulty: 'EASY',
      heroName: 'Bia',
    });
    const boosted = startBattle({
      character: state.character,
      category: 'HOME',
      difficulty: 'EASY',
      heroName: 'Bia',
      bonus,
    });
    assert.equal(boosted.hero.maxHp, plain.hero.maxHp + 8);
    assert.equal(boosted.hero.critChance, plain.hero.critChance + 10);
    assert.equal(boosted.hero.damageBonus, 10);
    assert.equal(heroMaxHpFor(state.character), boosted.hero.maxHp);
  });

  it('reset devolve os pontos e tira do loadout o que saiu da árvore', () => {
    const tree = TALENT_TREES.ROGUE;
    let state = learnAll(hero('ROGUE', 4), [tree[0].id, tree[1].id]);
    const newSkill = TALENT_SKILLS.ROGUE[0].id;
    state = toggleLoadoutSkill(state, 'rogue.flurry') as AppState;
    state = toggleLoadoutSkill(state, newSkill) as AppState;
    assert.ok(loadoutIds(state.character).includes(newSkill));

    const reset = resetTalents(state) as AppState;
    assert.equal(talentPointsLeft(reset.character), 3);
    assert.ok(!loadoutIds(reset.character).includes(newSkill));
    assert.equal(resetTalents(reset), null);
  });
});

describe('loadout', () => {
  it('sem escolha leva as 5 iniciais + Respirar Fundo', () => {
    const state = hero('WARRIOR', 1);
    assert.deepEqual(
      battleSkillsFor(state.character).map((entry) => entry.id),
      HERO_SKILLS.WARRIOR.map((entry) => entry.id),
    );
  });

  it('troca habilidades, respeita o limite e não esvazia', () => {
    const tree = TALENT_TREES.MAGE;
    let state = learnAll(hero('MAGE', 3), [tree[0].id, tree[1].id]);
    assert.equal(unlockedSkills(state.character).length, 6);
    // Cheio: não entra a sexta.
    assert.equal(toggleLoadoutSkill(state, 'mage.highlighter'), null);
    state = toggleLoadoutSkill(state, 'mage.frost') as AppState;
    state = toggleLoadoutSkill(state, 'mage.highlighter') as AppState;
    const ids = loadoutIds(state.character);
    assert.equal(ids.length, LOADOUT_SIZE);
    assert.ok(ids.includes('mage.highlighter'));
    assert.ok(!ids.includes('mage.frost'));
    // Respirar Fundo fica sempre por último.
    assert.equal(battleSkillsFor(state.character).at(-1)?.id, 'mage.defend');
    // Bloqueada não entra.
    assert.equal(toggleLoadoutSkill(state, 'mage.allnighter'), null);

    let single = hero('MAGE', 1);
    for (const id of ['mage.spark', 'mage.fireball', 'mage.frost', 'mage.barrier']) {
      single = toggleLoadoutSkill(single, id) as AppState;
    }
    assert.deepEqual(loadoutIds(single.character), ['mage.meteor']);
    assert.equal(toggleLoadoutSkill(single, 'mage.meteor'), null);
  });

  it('a luta usa o loadout', () => {
    let state = hero('MAGE', 1);
    state = toggleLoadoutSkill(state, 'mage.frost') as AppState;
    const battle = startBattle({
      character: state.character,
      category: 'STUDY',
      difficulty: 'EASY',
      heroName: 'Bia',
      skills: battleSkillsFor(state.character),
    });
    assert.equal(battle.hero.skills.length, 5);
    assert.ok(!battle.hero.skills.some((entry) => entry.id === 'mage.frost'));
  });

  it('save guarda talentos e loadout, e descarta lixo', () => {
    const tree = TALENT_TREES.MAGE;
    const state = learnAll(hero('MAGE', 3), [tree[0].id]);
    const raw = JSON.stringify({
      ...state,
      character: { ...state.character, loadout: ['mage.spark', 7, 'mage.spark'] },
    });
    const result = importSaveJson(raw);
    assert.ok(result.ok);
    assert.deepEqual(result.state.character.talents, [tree[0].id]);
    assert.deepEqual(result.state.character.loadout, ['mage.spark']);
    assert.equal(sanitizeIdList('x', 3), undefined);
  });
});

describe('reset de atributos', () => {
  it('devolve os pontos gastos e volta aos valores da classe', () => {
    const base = hero('WARRIOR', 3);
    let state: AppState = { ...base, character: { ...base.character, attributePoints: 3 } };
    assert.equal(resetAttributePoints(state), null);
    state = spendAttributePoint(state, 'agility') as AppState;
    state = spendAttributePoint(state, 'vitality') as AppState;
    assert.equal(spentAttributePoints(state), 2);
    const reset = resetAttributePoints(state) as AppState;
    assert.equal(reset.character.attributePoints, 3);
    assert.deepEqual(reset.character.attributes, startJourney('X', 'WARRIOR').character.attributes);
    assert.equal(spentAttributePoints(reset), 0);
  });
});
