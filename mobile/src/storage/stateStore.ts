import { createInitialState, sanitizeState } from '../domain/state';
import type { AppState } from '../domain/types';

export const STORAGE_KEY = 'QUESTLOG_RPG_MOBILE_V1';
const CORRUPT_BACKUP_SUFFIX = '_CORROMPIDO';
/** Cópia do save ilegível, para não destruir dados ao recomeçar. */
export const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}${CORRUPT_BACKUP_SUFFIX}`;

/** Porta de armazenamento chave-valor (AsyncStorage no aparelho, memória nos testes). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createMemoryStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const entries = new Map<string, string>(Object.entries(seed));
  return {
    async getItem(key) {
      return entries.has(key) ? (entries.get(key) as string) : null;
    },
    async setItem(key, value) {
      entries.set(key, value);
    },
    async removeItem(key) {
      entries.delete(key);
    },
  };
}

export interface SafeStorage extends KeyValueStorage {
  /** true quando o armazenamento do aparelho falhou e só a memória está valendo. */
  isDegraded(): boolean;
}

/**
 * Envolve o armazenamento do aparelho para que ele nunca derrube o app.
 * Se o módulo nativo não existir (primary = null) ou lançar erro, cai para
 * um espelho em memória: a sessão continua jogável, só não persiste.
 */
export function createSafeStorage(
  primary: KeyValueStorage | null,
  fallback: KeyValueStorage = createMemoryStorage(),
): SafeStorage {
  let degraded = primary === null;

  async function onPrimary<T>(
    operation: (storage: KeyValueStorage) => Promise<T>,
    whenUnavailable: () => Promise<T>,
  ): Promise<T> {
    if (primary) {
      try {
        const result = await operation(primary);
        degraded = false;
        return result;
      } catch {
        degraded = true;
      }
    }
    return whenUnavailable();
  }

  return {
    isDegraded: () => degraded,
    getItem: (key) =>
      onPrimary(
        (storage) => storage.getItem(key),
        () => fallback.getItem(key),
      ),
    async setItem(key, value) {
      await fallback.setItem(key, value);
      await onPrimary(
        (storage) => storage.setItem(key, value),
        async () => undefined,
      );
    },
    async removeItem(key) {
      await fallback.removeItem(key);
      await onPrimary(
        (storage) => storage.removeItem(key),
        async () => undefined,
      );
    },
  };
}

/**
 * EMPTY: primeiro uso. RESTORED: save lido (e migrado, se antigo).
 * CORRUPTED: save ilegível — recomeça limpo e guarda backup.
 * UNAVAILABLE: armazenamento do aparelho fora do ar — sessão só em memória.
 */
export type LoadStatus = 'EMPTY' | 'RESTORED' | 'CORRUPTED' | 'UNAVAILABLE';

export interface LoadResult {
  state: AppState;
  status: LoadStatus;
}

export interface SaveResult {
  /** false = não chegou ao disco (o progresso está só em memória). */
  ok: boolean;
}

export interface StateStore {
  /** Nunca rejeita: sempre devolve um estado jogável. */
  load(): Promise<LoadResult>;
  /** Nunca rejeita. Gravações são enfileiradas; a mais recente vence. */
  save(state: AppState): Promise<SaveResult>;
  clear(): Promise<void>;
}

export function createStateStore(
  storage: KeyValueStorage | SafeStorage,
  key: string = STORAGE_KEY,
): StateStore {
  const isDegraded = (): boolean => 'isDegraded' in storage && storage.isDegraded();

  let lastWritten: string | null = null;
  let queued: string | null = null;
  let draining: Promise<SaveResult> | null = null;

  async function drain(): Promise<SaveResult> {
    let ok = true;
    while (queued !== null) {
      const payload = queued;
      queued = null;
      try {
        await storage.setItem(key, payload);
        lastWritten = payload;
        ok = !isDegraded();
      } catch {
        ok = false;
      }
    }
    draining = null;
    return { ok };
  }

  return {
    async load() {
      let raw: string | null;
      try {
        raw = await storage.getItem(key);
      } catch {
        return { state: createInitialState(), status: 'UNAVAILABLE' };
      }

      if (raw == null) {
        return {
          state: createInitialState(),
          status: isDegraded() ? 'UNAVAILABLE' : 'EMPTY',
        };
      }

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      const state = sanitizeState(parsed);
      if (!state) {
        try {
          await storage.setItem(`${key}${CORRUPT_BACKUP_SUFFIX}`, raw);
        } catch {
          // Backup é melhor esforço; o jogo segue mesmo sem ele.
        }
        return { state: createInitialState(), status: 'CORRUPTED' };
      }

      lastWritten = raw;
      return { state, status: 'RESTORED' };
    },

    save(state) {
      let payload: string;
      try {
        payload = JSON.stringify(state);
      } catch {
        return Promise.resolve({ ok: false });
      }
      // Nada mudou desde a última gravação e não há escrita em andamento: pula.
      if (!draining && payload === lastWritten) {
        return Promise.resolve({ ok: !isDegraded() });
      }
      queued = payload;
      if (!draining) draining = drain();
      return draining;
    },

    async clear() {
      queued = null;
      lastWritten = null;
      try {
        await storage.removeItem(key);
      } catch {
        // Sem armazenamento não há o que limpar.
      }
    },
  };
}
