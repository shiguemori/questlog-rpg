import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localIsoDate, previousIsoDate } from './dates';

describe('localIsoDate', () => {
  it('usa o dia do relógio local, não UTC', () => {
    // 23h30 locais: em UTC-3 isso já seria o dia seguinte em UTC.
    assert.equal(localIsoDate(new Date(2026, 10, 11, 23, 30)), '2026-11-11');
    assert.equal(localIsoDate(new Date(2026, 10, 12, 0, 5)), '2026-11-12');
  });

  it('preenche mês e dia com zero', () => {
    assert.equal(localIsoDate(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
  });
});

describe('previousIsoDate', () => {
  it('volta um dia', () => {
    assert.equal(previousIsoDate('2026-11-11'), '2026-11-10');
  });

  it('atravessa mês, ano e ano bissexto', () => {
    assert.equal(previousIsoDate('2026-11-01'), '2026-10-31');
    assert.equal(previousIsoDate('2027-01-01'), '2026-12-31');
    assert.equal(previousIsoDate('2028-03-01'), '2028-02-29');
  });

  it('devolve null para formato inválido', () => {
    assert.equal(previousIsoDate('11/11/2026'), null);
    assert.equal(previousIsoDate(''), null);
  });
});
