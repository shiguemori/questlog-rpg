import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Character } from '../domain/types';
import { currentHeroHp, heroMaxHpFor, minutesUntilFullHp } from '../domain/vitals';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

function waitLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest > 0 ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

/**
 * Vida do herói fora da luta. Ela volta 10% por hora; a barra se atualiza a cada minuto
 * só enquanto não está cheia.
 */
export function HeroVitalsBar({
  character,
  compact = false,
}: {
  character: Character;
  /** Meia largura (ao lado do XP): o "cheia em" vai para baixo da barra. */
  compact?: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const now = new Date(nowMs);
  const hp = currentHeroHp(character, now);
  const maxHp = heroMaxHpFor(character);
  const minutes = minutesUntilFullHp(character, now);
  const full = minutes <= 0;

  useEffect(() => {
    if (full) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [full]);

  const ratio = maxHp > 0 ? hp / maxHp : 0;
  const tint = ratio <= 0.25 ? colors.danger : colors.success;

  return (
    <View style={styles.wrap} testID="hero-vitals">
      <View style={styles.head}>
        <Text style={styles.label}>Vida</Text>
        <Text style={styles.value}>
          {hp}/{maxHp}
          {compact ? null : (
            <Text style={styles.hint}>{full ? '  cheia' : `  cheia em ${waitLabel(minutes)}`}</Text>
          )}
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={
          full ? 'Vida cheia' : `Vida ${hp} de ${maxHp}, enche em ${waitLabel(minutes)}`
        }
        accessibilityValue={{ min: 0, max: maxHp, now: hp }}
      >
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: tint }]} />
      </View>
      {compact && !full ? (
        <Text style={styles.compactHint}>cheia em {waitLabel(minutes)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  value: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  hint: { fontWeight: '600', color: colors.textMuted },
  compactHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
