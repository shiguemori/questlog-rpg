/** Tokens de marca — docs/04-brand.md (Slate / Amber). */
export const colors = {
  bg: '#0F172A',
  bgElevated: '#1E293B',
  bgSoft: '#162032',
  border: '#334155',
  borderStrong: '#475569',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textDim: '#8090A6',
  amber: '#F59E0B',
  amberSoft: '#FBBF24',
  amberDeep: '#B45309',
  amberWash: '#292524',
  success: '#22C55E',
  danger: '#F87171',
  dangerBg: '#7F1D1D',
  dangerText: '#FECACA',
  overlay: 'rgba(15, 23, 42, 0.88)',
  warrior: '#F87171',
  mage: '#38BDF8',
  rogue: '#A3E635',
  archer: '#FB923C',
  druid: '#4ADE80',
  bard: '#F472B6',
  monk: '#FACC15',
} as const;

/**
 * Tokens da batalha. Pares [topo, base] viram degradê nas barras e cartões:
 * no jogo o volume ajuda a ler o que é botão e o que é cenário.
 */
export const battle = {
  hpHero: ['#4ADE80', '#16A34A'],
  hpEnemy: ['#FBBF24', '#EA580C'],
  hpLow: ['#F87171', '#B91C1C'],
  energy: ['#7DD3FC', '#2563EB'],
  card: ['#26324A', '#162033'],
  cardOff: ['#1C2436', '#141B2B'],
  panel: '#0B1222',
  scrimTop: ['rgba(5, 8, 20, 0.75)', 'rgba(5, 8, 20, 0)'],
  scrimBottom: ['rgba(11, 18, 34, 0)', 'rgba(11, 18, 34, 0.85)', '#0B1222'],
} as const;
