import {
  createSafeStorage,
  createStateStore,
  type KeyValueStorage,
  type SafeStorage,
  type StateStore,
} from './stateStore';

/**
 * Ligação com o AsyncStorage do aparelho.
 *
 * O `require` é tardio e protegido de propósito: quando o binário (ex.: Expo Go)
 * não traz o módulo nativo na versão esperada, o pacote lança
 * "Native module is null" já no import. Com import estático o app morreria
 * antes da primeira tela; aqui ele só perde a persistência daquela sessão.
 */
function resolveDeviceStorage(): KeyValueStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tardio proposital (ver comentário acima)
    const loaded = require('@react-native-async-storage/async-storage');
    const candidate = loaded?.default ?? loaded;
    const usable =
      candidate != null &&
      typeof candidate.getItem === 'function' &&
      typeof candidate.setItem === 'function' &&
      typeof candidate.removeItem === 'function';
    return usable ? (candidate as KeyValueStorage) : null;
  } catch {
    return null;
  }
}

export const deviceStorage: SafeStorage = createSafeStorage(resolveDeviceStorage());

/** Único ponto de leitura/gravação do save do jogador. */
export const stateStore: StateStore = createStateStore(deviceStorage);
