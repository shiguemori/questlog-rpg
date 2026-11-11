/**
 * Dia civil do jogador. O "dia" do QuestLog é o dia do relógio do aparelho
 * (Brasil: America/Sao_Paulo), nunca UTC — senão o streak e o limite diário
 * virariam às 21h no horário de Brasília.
 */

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** YYYY-MM-DD no fuso do aparelho. */
export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Soma dias civis a um YYYY-MM-DD. `deltaDays` pode ser negativo.
 * Aritmética de calendário (UTC), sem o fuso do aparelho.
 */
export function shiftIsoDate(isoDate: string, deltaDays: number): string | null {
  const match = ISO_DAY.exec(isoDate);
  if (!match || !Number.isInteger(deltaDays)) return null;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado. Null se a data for inválida. */
export function weekdayIndex(isoDate: string): number | null {
  const match = ISO_DAY.exec(isoDate);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

/** Dia anterior a um YYYY-MM-DD (aritmética de calendário, sem fuso). */
export function previousIsoDate(isoDate: string): string | null {
  return shiftIsoDate(isoDate, -1);
}
