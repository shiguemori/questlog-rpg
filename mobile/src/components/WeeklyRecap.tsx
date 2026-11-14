import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOSSES } from '../domain/battle';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/constants';
import { weekRangeLabel, weekTotal, type WeekRecord } from '../domain/weekly';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

/**
 * Resumo da semana: aparece no domingo (semana atual) e na segunda e terça (semana anterior).
 * Compara só com a própria pessoa, sem ranking. "Fechar" esconde até a próxima semana.
 */
export function WeeklyRecap({ week, onDismiss }: { week: WeekRecord; onDismiss: () => void }) {
  const total = weekTotal(week);
  const categories = CATEGORIES.filter((category) => week.byCategory[category] > 0).sort(
    (a, b) => week.byCategory[b] - week.byCategory[a],
  );
  const top = categories[0];
  const bossLine = week.boss
    ? week.boss.result === 'BEATEN'
      ? `${BOSSES[week.boss.id].name}: vencida.`
      : `${BOSSES[week.boss.id].name}: ficou para a próxima.`
    : null;
  const headline =
    total === 0
      ? 'Semana de lutas, sem missão concluída.'
      : top
        ? `${total} ${total === 1 ? 'missão' : 'missões'}, mais em ${CATEGORY_LABELS[top]}.`
        : `${total} missões.`;

  return (
    <View style={styles.card} testID="weekly-recap">
      <Text style={styles.kicker}>Sua semana · {weekRangeLabel(week.weekKey)}</Text>
      <Text style={styles.headline}>{headline}</Text>

      <View style={styles.stats}>
        <Stat value={week.battlesWon} label={week.battlesWon === 1 ? 'vitória' : 'vitórias'} />
        <Stat value={week.bestStreak} label="maior streak" />
        <Stat value={week.itemsFound} label={week.itemsFound === 1 ? 'item' : 'itens'} />
        <Stat value={week.challengesDone} label="desafios" />
      </View>

      {categories.length > 1 ? (
        <View style={styles.bars}>
          {categories.map((category) => (
            <View key={category} style={styles.barRow}>
              <Text style={styles.barLabel}>{CATEGORY_LABELS[category]}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(week.byCategory[category] / Math.max(1, total)) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{week.byCategory[category]}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {bossLine ? <Text style={styles.line}>{bossLine}</Text> : null}

      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Fechar o resumo da semana"
        testID="weekly-recap-close"
      >
        <Text style={styles.closeText}>Fechar</Text>
      </Pressable>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.gutter,
    marginBottom: space.lg,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.amberDeep,
  },
  kicker: { fontSize: 12, fontWeight: '800', color: colors.amberSoft },
  headline: { fontSize: 18, fontWeight: '900', color: colors.text },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, gap: 2 },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontSize: 12, color: colors.textMuted },
  bars: { gap: space.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barLabel: { width: 72, fontSize: 13, color: colors.textMuted },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgSoft,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.amber },
  barValue: {
    width: 24,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  line: { fontSize: 14, color: colors.text },
  close: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { fontSize: 14, fontWeight: '800', color: colors.text },
  pressed: { opacity: 0.8 },
});
