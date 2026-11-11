/**
 * Contrato SDD da barra de XP — matemática pura, sem React Native.
 * A UI (`components/XpBar.tsx`) só desenha o que este módulo decide.
 */

/** Fração preenchida da barra, sempre entre 0 e 1. */
export function xpProgressRatio(xp: number, maxXp: number): number {
  if (!Number.isFinite(xp) || !Number.isFinite(maxXp) || maxXp <= 0) return 0;
  return Math.min(1, Math.max(0, xp / maxXp));
}

/** Percentual inteiro (0–100) para leitores de tela e texto. */
export function xpProgressPercent(xp: number, maxXp: number): number {
  return Math.round(xpProgressRatio(xp, maxXp) * 100);
}

export interface XpBarSnapshot {
  level: number;
  ratio: number;
}

/** Um trecho de animação da barra: de `from` até `to` (frações 0–1). */
export interface XpBarSegment {
  from: number;
  to: number;
}

/**
 * Planeja como a barra vai de um estado a outro.
 * - Mesmo nível: um trecho direto.
 * - Subiu de nível: enche até 100% e recomeça do zero até a nova fração
 *   (a barra nunca "anda para trás" ao ganhar XP).
 * - Nível menor (reinício da jornada): salto direto, sem animação intermediária.
 */
export function planXpBarAnimation(previous: XpBarSnapshot, next: XpBarSnapshot): XpBarSegment[] {
  if (next.level > previous.level) {
    return [
      { from: previous.ratio, to: 1 },
      { from: 0, to: next.ratio },
    ];
  }
  if (next.level < previous.level) {
    return [{ from: next.ratio, to: next.ratio }];
  }
  return [{ from: previous.ratio, to: next.ratio }];
}

/** Valor acessível da barra (role progressbar). */
export function xpBarAccessibilityValue(
  xp: number,
  maxXp: number,
  level: number,
): { min: number; max: number; now: number; text: string } {
  const safeMax = Number.isFinite(maxXp) && maxXp > 0 ? maxXp : 0;
  const safeXp = Number.isFinite(xp) ? Math.min(safeMax, Math.max(0, xp)) : 0;
  return {
    min: 0,
    max: safeMax,
    now: safeXp,
    text: `Nível ${level}, ${safeXp} de ${safeMax} XP`,
  };
}
