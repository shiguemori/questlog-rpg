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
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDone: { backgroundColor: colors.amberWash, borderColor: colors.amber },
  cellToday: { borderColor: colors.amberSoft },
  label: { fontSize: 10, fontWeight: '700', color: colors.textDim },
  labelDone: { color: colors.amberSoft },
  pace: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
