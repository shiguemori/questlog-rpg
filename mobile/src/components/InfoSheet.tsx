import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

/**
 * Folha que sobe do rodapé com um painel que não precisa ficar sempre na tela
 * (semana, chefe). Tocar fora, "Fechar" ou o voltar do Android fecham.
 */
export function InfoSheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Fechar ${title}`}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          accessibilityViewIsModal
          testID={testID}
        >
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.lg + space.sm,
    borderTopRightRadius: radius.lg + space.sm,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  closeText: { fontSize: 14, fontWeight: '700', color: colors.amberSoft },
  body: { paddingTop: space.md, gap: space.md },
  pressed: { opacity: 0.7 },
});
