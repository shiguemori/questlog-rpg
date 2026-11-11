import React, { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Última barreira: um erro de renderização vira uma tela amigável com
 * "Tentar de novo", em vez de tela vermelha ou app fechado.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.screen} accessibilityRole="alert">
        <Text style={styles.eyebrow}>QuestLog</Text>
        <Text style={styles.title}>Algo deu errado por aqui</Text>
        <Text style={styles.body}>
          Seu progresso salvo continua no aparelho. Toque abaixo para voltar à aventura.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={this.retry}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  title: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cta: {
    marginTop: 24,
    minHeight: 48,
    minWidth: 200,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.bg },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
