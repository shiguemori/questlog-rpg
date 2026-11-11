import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Preferência "Reduzir movimento" do sistema, reativa.
 * Começa em false e atualiza assim que o sistema responde — nenhuma tela
 * depende dessa resposta para mostrar o valor final.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export type HapticKind = 'SUCCESS' | 'WARNING' | 'TAP';

/**
 * Um háptico por ação do jogador, sempre junto de um feedback visual.
 * Falha em silêncio: aparelhos sem motor ou com háptico desligado seguem normais.
 */
export function playHaptic(kind: HapticKind): void {
  try {
    const pending =
      kind === 'SUCCESS'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'WARNING'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pending.catch(() => undefined);
  } catch {
    // Háptico é complemento; nunca pode quebrar a ação.
  }
}

/** Anuncia uma mensagem para leitores de tela (TalkBack / VoiceOver). */
export function announce(message: string): void {
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // Sem leitor de tela ativo não há o que anunciar.
  }
}
