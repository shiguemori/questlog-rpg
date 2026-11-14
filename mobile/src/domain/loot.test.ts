import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addLoot,
  emptyInventory,
  equipGear,
  GEAR,
  GEAR_IDS,
  gearBonus,
  heroArtKey,
  heroLook,
  lootLabel,
  mergeBonus,
  POTION_CAP,
  rollLoot,
  sanitizeInventory,
  spendPotions,
  unequipSlot,
  type LootDrop,
} from './loot';

function rollMany(source: 'NORMAL' | 'ELITE' | 'BOSS', difficulty: 'EASY' | 'MEDIUM' | 'HARD') {
  const drops: (LootDrop | null)[] = [];
  for (let seed = 1; seed <= 2000; seed += 1) {
    drops.push(rollLoot({ seed: seed * 7919, source, difficulty, owned: [] }));
  }
  return drops;
}

describe('rollLoot — o que o monstro deixa', () => {
  it('a mesma semente deixa sempre o mesmo item', () => {
    const input = { seed: 1234, source: 'ELITE' as const, difficulty: 'HARD' as const, owned: [] };
    assert.deepEqual(rollLoot(input), rollLoot(input));
  });

  it('luta comum às vezes não deixa nada; difícil deixa mais que fácil', () => {
    const easy = rollMany('NORMAL', 'EASY').filter(Boolean).length / 2000;
    const hard = rollMany('NORMAL', 'HARD').filter(Boolean).length / 2000;
    assert.ok(easy > 0.2 && easy < 0.4, `fácil ${easy}`);
    assert.ok(hard > 0.5 && hard < 0.7, `difícil ${hard}`);
  });

  it('elite e chefe sempre deixam algo; o chefe só deixa equipamento raro ou épico', () => {
    assert.ok(rollMany('ELITE', 'MEDIUM').every((drop) => drop != null));
    const boss = rollMany('BOSS', 'HARD');
    for (const drop of boss) {
      assert.ok(drop && drop.type === 'GEAR');
      assert.notEqual(GEAR[drop.id].rarity, 'COMMON');
    }
  });

  it('não repete equipamento: com a coleção completa, vira poção', () => {
    const drop = rollLoot({ seed: 99, source: 'BOSS', difficulty: 'HARD', owned: GEAR_IDS });
    assert.equal(drop?.type, 'POTION');
    const almost = GEAR_IDS.filter((id) => id !== 'hat.crown');
    const last = rollLoot({ seed: 7, source: 'BOSS', difficulty: 'HARD', owned: almost });
    assert.deepEqual(last, { type: 'GEAR', id: 'hat.crown' });
  });
});

describe('mochila', () => {
  it('a primeira peça de cada espaço já vai para o corpo', () => {
    let inventory = addLoot(emptyInventory(), { type: 'GEAR', id: 'hat.cap' });
    assert.equal(inventory.equipped.HEAD, 'hat.cap');
    inventory = addLoot(inventory, { type: 'GEAR', id: 'hat.crown' });
    assert.equal(inventory.equipped.HEAD, 'hat.cap', 'a segunda não troca sozinha');
    assert.deepEqual(inventory.gear, ['hat.cap', 'hat.crown']);
  });

  it('peça repetida não duplica', () => {
    const once = addLoot(emptyInventory(), { type: 'GEAR', id: 'charm.star' });
    assert.equal(addLoot(once, { type: 'GEAR', id: 'charm.star' }), once);
  });

  it('poção respeita o teto e o gasto não fica negativo', () => {
    let inventory = emptyInventory();
    for (let i = 0; i < 20; i += 1) {
      inventory = addLoot(inventory, { type: 'POTION', id: 'potion.coffee', amount: 2 });
    }
    assert.equal(inventory.potions['potion.coffee'], POTION_CAP);
    const spent = spendPotions(inventory, { 'potion.coffee': 3, 'potion.water': 5 });
    assert.equal(spent.potions['potion.coffee'], POTION_CAP - 3);
    assert.equal(spent.potions['potion.water'], 0);
  });

  it('veste, troca e tira; não veste o que não tem', () => {
    let inventory = addLoot(emptyInventory(), { type: 'GEAR', id: 'hat.cap' });
    inventory = addLoot(inventory, { type: 'GEAR', id: 'hat.crown' });
    assert.equal(equipGear(inventory, 'charm.star'), null);
    inventory = equipGear(inventory, 'hat.crown') ?? inventory;
    assert.equal(inventory.equipped.HEAD, 'hat.crown');
    assert.equal(heroLook(inventory), 'crown');
    assert.equal(heroArtKey('MAGE', inventory), 'hero.mage+crown');
    inventory = unequipSlot(inventory, 'HEAD');
    assert.equal(heroLook(inventory), null);
    assert.equal(heroArtKey('ROGUE', inventory), 'hero.rogue');
  });

  it('bônus do que está vestido somam com os talentos', () => {
    let inventory = addLoot(emptyInventory(), { type: 'GEAR', id: 'hat.crown' });
    inventory = addLoot(inventory, { type: 'GEAR', id: 'charm.clover' });
    const worn = gearBonus(inventory);
    assert.equal(worn.damagePct, 8);
    assert.equal(worn.critChance, 8);
    const total = mergeBonus(worn, { maxHp: 10, critChance: 2 });
    assert.equal(total.critChance, 10);
    assert.equal(total.maxHp, 10);
  });

  it('rótulo do item que caiu', () => {
    assert.equal(lootLabel({ type: 'GEAR', id: 'hat.beanie' }), 'Gorro de Lã');
    assert.equal(lootLabel({ type: 'POTION', id: 'potion.coffee', amount: 2 }), '2× Café Forte');
  });
});

describe('sanitizeInventory', () => {
  it('save antigo começa com uma garrafa de água', () => {
    const inventory = sanitizeInventory(undefined);
    assert.deepEqual(inventory.gear, []);
    assert.equal(inventory.potions['potion.water'], 1);
  });

  it('descarta item inventado, repetido, vestido sem ter ou no espaço errado', () => {
    const inventory = sanitizeInventory({
      gear: ['hat.cap', 'hat.cap', 'sword.excalibur', 'charm.star'],
      equipped: { HEAD: 'charm.star', CHARM: 'hat.crown' },
      potions: { 'potion.water': 999, 'potion.coffee': -3 },
    });
    assert.deepEqual(inventory.gear, ['hat.cap', 'charm.star']);
    assert.deepEqual(inventory.equipped, { HEAD: null, CHARM: null });
    assert.equal(inventory.potions['potion.water'], POTION_CAP);
    assert.equal(inventory.potions['potion.coffee'], 0);
  });
});
