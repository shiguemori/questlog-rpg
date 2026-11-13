/**
 * Ritmo das animações da batalha. Fica fora dos componentes para o App e o som
 * usarem os mesmos números sem carregar o Reanimated.
 */

/** Intervalo entre eventos da mesma ação, para cada um ser lido. */
export const EVENT_STEP_MS = 260;
/** Preparo do golpe (recuo) antes do avanço. */
export const WINDUP_MS = 150;
