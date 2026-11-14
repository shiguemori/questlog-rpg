import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const ROTATION = { down: '45deg', up: '-135deg', right: '-45deg' } as const;

/**
 * Seta de abrir/fechar (único ícone de interface do app, sem biblioteca de ícones).
 * Desenhada com duas bordas para manter o mesmo traço em qualquer tela.
 */
export function Chevron({
  direction,
  color = colors.textMuted,
}: {
  direction: keyof typeof ROTATION;
  color?: string;
}) {
  return (
    <View style={styles.box} importantForAccessibility="no" accessibilityElementsHidden>
      <View
        style={[
          styles.mark,
          { borderColor: color, transform: [{ rotate: ROTATION[direction] }] },
          // Compensação óptica: a ponta fica no centro visual, não no da caixa.
          direction === 'down' ? styles.nudgeUp : direction === 'up' ? styles.nudgeDown : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2 },
  nudgeUp: { marginTop: -3 },
  nudgeDown: { marginTop: 3 },
});
