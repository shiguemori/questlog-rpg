import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planXpBarAnimation,
  xpBarAccessibilityValue,
  xpProgressPercent,
  xpProgressRatio,
} from './xpBar';

describe('xpProgressRatio', () => {
  it('devolve a fração preenchida', () => {
    assert.equal(xpProgressRatio(0, 100), 0);
    assert.equal(xpProgressRatio(10, 100), 0.1);
    assert.equal(xpProgressRatio(75, 150), 0.5);
  });

  it('fica entre 0 e 1 mesmo com valores fora da faixa', () => {
    assert.equal(xpProgressRatio(250, 100), 1);
    assert.equal(xpProgressRatio(-5, 100), 0);
  });

  it('devolve 0 para teto inválido (sem divisão por zero)', () => {
    assert.equal(xpProgressRatio(10, 0), 0);
    assert.equal(xpProgressRatio(10, -100), 0);
    assert.equal(xpProgressRatio(Number.NaN, 100), 0);
    assert.equal(xpProgressRatio(10, Number.NaN), 0);
  });
});

describe('xpProgressPercent', () => {
  it('arredonda para inteiro', () => {
    assert.equal(xpProgressPercent(1, 3), 33);
    assert.equal(xpProgressPercent(150, 150), 100);
  });
});

describe('planXpBarAnimation', () => {
  it('mesmo nível: um trecho direto até a nova fração', () => {
    assert.deepEqual(planXpBarAnimation({ level: 1, ratio: 0.1 }, { level: 1, ratio: 0.35 }), [
      { from: 0.1, to: 0.35 },
    ]);
  });

  it('level up: enche até 100% e recomeça do zero', () => {
    assert.deepEqual(planXpBarAnimation({ level: 1, ratio: 0.8 }, { level: 2, ratio: 0.2 }), [
      { from: 0.8, to: 1 },
      { from: 0, to: 0.2 },
    ]);
  });

  it('level up nunca termina abaixo do zero do novo nível', () => {
    const segments = planXpBarAnimation({ level: 1, ratio: 0.9 }, { level: 2, ratio: 0 });
    assert.equal(segments.at(-1)?.to, 0);
    assert.equal(segments[0].to, 1);
  });

  it('nível menor (jornada reiniciada): salto direto', () => {
    assert.deepEqual(planXpBarAnimation({ level: 4, ratio: 0.6 }, { level: 1, ratio: 0 }), [
      { from: 0, to: 0 },
    ]);
  });
});

describe('xpBarAccessibilityValue', () => {
  it('descreve nível e XP em português', () => {
    assert.deepEqual(xpBarAccessibilityValue(35, 100, 2), {
      min: 0,
      max: 100,
      now: 35,
      text: 'Nível 2, 35 de 100 XP',
    });
  });

  it('limita o valor atual ao teto', () => {
    assert.equal(xpBarAccessibilityValue(500, 100, 1).now, 100);
    assert.equal(xpBarAccessibilityValue(-3, 100, 1).now, 0);
  });
});
