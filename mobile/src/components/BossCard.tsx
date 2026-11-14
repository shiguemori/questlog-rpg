import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOSS_NAME } from '../domain/battle';
import { BOSS_MIN_LEVEL, bossStatus, bossXpFor } from '../domain/boss';
import type { WeeklyBoss } from '../domain/types';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { CharacterArt } from './CharacterArt';

const COPY = {
  TOO_EARLY: () => `Aparece a partir do nível ${BOSS_MIN_LEVEL}`,
  LOCKED: (wins: number, needed: number) =>
    `Vença ${needed - wins} ${needed - wins === 1 ? 'luta' : 'lutas'} esta semana para enfrentar`,
  READY: () => 'Está esperando por você',
  TRIED_TODAY: () => 'Você caiu hoje. Tente de novo amanhã',
  BEATEN: () => 'Vencido nesta semana. Volta na segunda',
} as const;

/**
 * Chefe da semana na tela principal: progresso das vitórias e, quando liberado,
 * o botão para lutar. Nos outros estados não há ação.
 */
export function BossCard({
  boss,
  level,
  now,
  onStart,
}: {
  boss: WeeklyBoss;
  level: number;
  now: Date;
  onStart: () => void;
}) {
  const status = bossStatus(boss, now, level);
  const ready = status.availability === 'READY';
  const line =
    status.availability === 'LOCKED'
      ? COPY.LOCKED(status.wins, status.needed)
      : COPY[status.availability]();

  return (
    <View style={[styles.card, ready && styles.cardReady]} testID="boss-card">
      <View style={[styles.portrait, status.availability === 'BEATEN' && styles.portraitDone]}>
        <CharacterArt assetKey="enemy.boss" size={46} accessibilityLabel={BOSS_NAME} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {BOSS_NAME}
        </Text>
        <Text style={styles.kicker}>Chefe da semana</Text>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
        {status.availability === 'LOCKED' ? (
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${status.wins} de ${status.needed} vitórias esta semana`}
          >
            {Array.from({ length: status.needed }, (_, index) => (
              <View key={index} style={[styles.pip, index < status.wins && styles.pipOn]} />
            ))}
          </View>
        ) : null}
      </View>
      {ready ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={`Enfrentar ${BOSS_NAME}, chefe da semana`}
          accessibilityHint={`Vale ${bossXpFor(level)} de XP e um equipamento raro ou épico.`}
        >
          <Text style={styles.ctaText}>Enfrentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const PAD = space.sm;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: PAD,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardReady: { borderColor: 'rgba(192, 132, 252, 0.7)' },
  // Raio interno = externo − padding (regra 14).
  portrait: {
    width: 52,
    height: 52,
    borderRadius: radius.lg - PAD,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitDone: { opacity: 0.5 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, fontWeight: '900', color: colors.text },
  kicker: { fontSize: 12, fontWeight: '800', color: '#D8B4FE' },
  line: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  track: { flexDirection: 'row', gap: 4, marginTop: 4 },
  pip: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
  },
  pipOn: { backgroundColor: '#C084FC' },
  cta: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '900', color: colors.bg },
  pressed: { opacity: 0.85 },
});
