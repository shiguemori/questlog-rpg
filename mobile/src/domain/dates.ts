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

/** Dia anterior a um YYYY-MM-DD (aritmética de calendário, sem fuso). */
export function previousIsoDate(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}
