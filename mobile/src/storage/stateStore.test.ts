import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startJourney } from '../domain/state';
import {
  CORRUPT_BACKUP_KEY,
  createMemoryStorage,
  createSafeStorage,
  createStateStore,
  STORAGE_KEY,
  type KeyValueStorage,
} from './stateStore';

/** Simula o AsyncStorage sem módulo nativo: toda chamada lança erro. */
function brokenStorage(): KeyValueStorage {
  const fail = async (): Promise<never> => {
    throw new Error('AsyncStorageError: Native module is null, cannot access legacy storage');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

/** Armazenamento em memória que conta gravações e pode atrasar/falhar. */
function spyStorage(seed: Record<string, string> = {}) {
  const inner = createMemoryStorage(seed);
  const writes: string[] = [];
  let failWrites = false;
  const storage: KeyValueStorage = {
    getItem: (key) => inner.getItem(key),
    async setItem(key, value) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (failWrites) throw new Error('disco cheio');
      writes.push(value);
      await inner.setItem(key, value);
    },
    removeItem: (key) => inner.removeItem(key),
  };
  return {
    storage,
    writes,
    setFailWrites(value: boolean) {
      failWrites = value;
    },
  };
}

describe('createMemoryStorage', () => {
  it('grava, lê e remove', async () => {
    const storage = createMemoryStorage({ a: '1' });
    assert.equal(await storage.getItem('a'), '1');
    assert.equal(await storage.getItem('b'), null);
    await storage.setItem('b', '2');
    assert.equal(await storage.getItem('b'), '2');
    await storage.removeItem('a');
    assert.equal(await storage.getItem('a'), null);
  });
});

describe('createSafeStorage', () => {
  it('sem módulo nativo (null): funciona em memória e sinaliza degradado', async () => {
    const safe = createSafeStorage(null);
    assert.equal(safe.isDegraded(), true);
    await safe.setItem('k', 'v');
    assert.equal(await safe.getItem('k'), 'v');
    await safe.removeItem('k');
    assert.equal(await safe.getItem('k'), null);
  });

  it('módulo nativo que lança erro nunca derruba a chamada', async () => {
    const safe = createSafeStorage(brokenStorage());
    await assert.doesNotReject(safe.setItem('k', 'v'));
    assert.equal(await safe.getItem('k'), 'v');
    await assert.doesNotReject(safe.removeItem('k'));
    assert.equal(safe.isDegraded(), true);
  });

  it('usa o armazenamento do aparelho quando ele funciona', async () => {
    const device = createMemoryStorage();
    const safe = createSafeStorage(device);
    await safe.setItem('k', 'v');
    assert.equal(await device.getItem('k'), 'v');
    assert.equal(safe.isDegraded(), false);
  });

  it('volta ao normal quando o aparelho se recupera', async () => {
    const spy = spyStorage();
    const safe = createSafeStorage(spy.storage);
    spy.setFailWrites(true);
    await safe.setItem('k', 'v1');
    assert.equal(safe.isDegraded(), true);
    spy.setFailWrites(false);
    await safe.setItem('k', 'v2');
    assert.equal(safe.isDegraded(), false);
    assert.equal(await safe.getItem('k'), 'v2');
  });
});

describe('createStateStore — load', () => {
  it('EMPTY no primeiro uso', async () => {
    const result = await createStateStore(createMemoryStorage()).load();
    assert.equal(result.status, 'EMPTY');
    assert.equal(result.state.onboardingDone, false);
  });

  it('RESTORED devolve o save gravado', async () => {
    const saved = startJourney('Lucas', 'MAGE');
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) });
    const result = await createStateStore(storage).load();
    assert.equal(result.status, 'RESTORED');
    assert.deepEqual(result.state, saved);
  });

  it('CORRUPTED recomeça limpo e guarda backup do conteúdo ilegível', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{nao é json' });
    const result = await createStateStore(storage).load();
    assert.equal(result.status, 'CORRUPTED');
    assert.equal(result.state.onboardingDone, false);
    assert.equal(await storage.getItem(CORRUPT_BACKUP_KEY), '{nao é json');
  });

  it('CORRUPTED também para JSON válido que não é um save', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '"só texto"' });
    assert.equal((await createStateStore(storage).load()).status, 'CORRUPTED');
  });

  it('UNAVAILABLE quando o armazenamento do aparelho não existe', async () => {
    const result = await createStateStore(createSafeStorage(null)).load();
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.state.onboardingDone, false);
  });

  it('UNAVAILABLE (sem rejeitar) quando a leitura lança erro direto', async () => {
    const result = await createStateStore(brokenStorage()).load();
    assert.equal(result.status, 'UNAVAILABLE');
  });
});

describe('createStateStore — save', () => {
  it('grava o estado como JSON na chave do app', async () => {
    const storage = createMemoryStorage();
    const state = startJourney('Lucas', 'MAGE');
    assert.deepEqual(await createStateStore(storage).save(state), { ok: true });
    assert.equal(await storage.getItem(STORAGE_KEY), JSON.stringify(state));
  });

  it('não regrava estado idêntico ao último salvo ou carregado', async () => {
    const state = startJourney('Lucas', 'MAGE');
    const spy = spyStorage({ [STORAGE_KEY]: JSON.stringify(state) });
    const store = createStateStore(spy.storage);
    await store.load();
    await store.save(state);
    assert.equal(spy.writes.length, 0);
    const changed = { ...state, onboardingDone: true, quests: [] };
    await store.save({ ...changed, character: { ...changed.character, xp: 5 } });
    await store.save({ ...changed, character: { ...changed.character, xp: 5 } });
    assert.equal(spy.writes.length, 1);
  });

  it('gravações em rajada: a mais recente vence e nada se perde', async () => {
    const spy = spyStorage();
    const store = createStateStore(spy.storage);
    const base = startJourney('Lucas', 'MAGE');
    const withXp = (xp: number) => ({ ...base, character: { ...base.character, xp } });
    const results = await Promise.all([
      store.save(withXp(10)),
      store.save(withXp(20)),
      store.save(withXp(30)),
    ]);
    assert.ok(results.every((r) => r.ok));
    assert.ok(spy.writes.length <= 2, `gravou ${spy.writes.length} vezes`);
    const persisted = JSON.parse((await spy.storage.getItem(STORAGE_KEY)) as string);
    assert.equal(persisted.character.xp, 30);
  });

  it('falha de escrita vira ok=false, nunca exceção', async () => {
    const spy = spyStorage();
    spy.setFailWrites(true);
    const store = createStateStore(spy.storage);
    const result = await store.save(startJourney('Lucas', 'MAGE'));
    assert.deepEqual(result, { ok: false });
  });

  it('com armazenamento degradado avisa que não persistiu, mas mantém a sessão', async () => {
    const safe = createSafeStorage(brokenStorage());
    const store = createStateStore(safe);
    const state = startJourney('Lucas', 'MAGE');
    assert.deepEqual(await store.save(state), { ok: false });
    assert.deepEqual((await store.load()).state, state);
  });

  it('clear apaga o save e permite gravar de novo', async () => {
    const storage = createMemoryStorage();
    const store = createStateStore(storage);
    const state = startJourney('Lucas', 'MAGE');
    await store.save(state);
    await store.clear();
    assert.equal(await storage.getItem(STORAGE_KEY), null);
    await store.save(state);
    assert.equal(await storage.getItem(STORAGE_KEY), JSON.stringify(state));
  });
});
