import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildWeekPace, buildWeekStrip, sundayReview } from '../domain/engagement';
import { colors } from '../theme/colors';

interface WeekStripProps {
  days: readonly string[];
  today: string;
}

/** Sete dias e o ritmo contra a própria semana anterior. */
function WeekStripBase({ days, today }: WeekStripProps) {
  const cells = useMemo(() => buildWeekStrip(days, today), [days, today]);
  const pace = useMemo(() => buildWeekPace(days, today), [days, today]);
  const review = useMemo(() => sundayReview(days, today), [days, today]);
  const doneCount = cells.filter((cell) => cell.done).length;

  return (
    <View style={styles.block}>
      <View
        testID="week-strip"
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Semana, ${doneCount} de 7 dias com quest`}
        style={styles.row}
      >
        {cells.map((cell) => (
          <View
            key={cell.iso}
            style={[styles.cell, cell.done && styles.cellDone, cell.isToday && styles.cellToday]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Text style={[styles.label, cell.done && styles.labelDone]}>{cell.label}</Text>
            <View style={[styles.dot, cell.done && styles.dotDone]} />
          </View>
        ))}
      </View>
      <Text style={styles.pace} testID="week-pace">
        {pace.message}
      </Text>
      {review ? (
        <Text style={styles.pace} testID="sunday-review">
          {review}
        </Text>
      ) : null}
    </View>
  );
}

export const WeekStrip = memo(WeekStripBase);

const styles = StyleSheet.create({
  block: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cellDone: { backgroundColor: 'rgba(245, 158, 11, 0.16)', borderColor: colors.amberDeep },
  cellToday: { borderColor: colors.amberSoft, borderWidth: 2 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  labelDone: { color: colors.amberSoft },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  dotDone: { backgroundColor: colors.amber, borderColor: colors.amber },
  pace: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
