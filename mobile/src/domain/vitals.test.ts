import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importSaveJson, startJourney } from './state';
import type { Character } from './types';
import {
  battleStartHp,
  currentHeroHp,
  heroMaxHpFor,
  minutesUntilFullHp,
  sanitizeVitals,
  settleHeroVitals,
} from './vitals';

const END = new Date(2026, 10, 12, 20, 0, 0);
const HOUR = 3_600_000;

function warrior(): Character {
  return startJourney('Ana', 'WARRIOR').character;
}

describe('vida entre as batalhas', () => {
  it('sem registro, a vida está cheia', () => {
    const hero = warrior();
    assert.equal(currentHeroHp(hero, END), heroMaxHpFor(hero));
    assert.equal(minutesUntilFullHp(hero, END), 0);
  });

  it('guarda a vida que sobrou e recupera 10% por hora', () => {
    const hero = settleHeroVitals(warrior(), 10, END, false);
    assert.equal(hero.vitals?.hp, 10);
    assert.equal(currentHeroHp(hero, END), 10);
    // 48 de vida máxima: 10% por hora = 4,8 → 4 depois de 1 hora.
    assert.equal(currentHeroHp(hero, new Date(END.getTime() + HOUR)), 14);
    assert.equal(currentHeroHp(hero, new Date(END.getTime() + 24 * HOUR)), 48);
    assert.ok(minutesUntilFullHp(hero, END) > 0);
  });

  it('level up enche a vida e limpa o registro', () => {
    const hero = settleHeroVitals(warrior(), 3, END, true);
    assert.equal(hero.vitals, undefined);
    assert.equal(currentHeroHp(hero, END), heroMaxHpFor(hero));
  });

  it('derrota guarda zero, mas a próxima luta começa com o piso de 20%', () => {
    const hero = settleHeroVitals(warrior(), 0, END, false);
    assert.equal(currentHeroHp(hero, END), 0);
    assert.equal(battleStartHp(hero, END), Math.ceil(48 * 0.2));
  });

  it('a vida guardada sobrevive a exportar e importar o save', () => {
    const base = startJourney('Ana', 'WARRIOR');
    const state = { ...base, character: settleHeroVitals(base.character, 21, END, false) };
    const back = importSaveJson(JSON.stringify(state));
    assert.ok(back.ok);
    assert.deepEqual(back.state.character.vitals, { hp: 21, updatedAt: END.toISOString() });
  });

  it('registro estranho no save vira vida cheia', () => {
    assert.equal(sanitizeVitals({ hp: -3, updatedAt: END.toISOString() }), undefined);
    assert.equal(sanitizeVitals({ hp: 5, updatedAt: 'ontem' }), undefined);
    assert.equal(sanitizeVitals('cheia'), undefined);
  });
});
