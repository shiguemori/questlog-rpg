import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_LABELS } from '../domain/constants';
import {
  FOCUS_MINUTES,
  focusClock,
  focusDurationLabel,
  focusEndsAtMs,
  focusProgress,
  focusRemainingMs,
} from '../domain/focus';
import type { FocusSession, Quest } from '../domain/types';
import { keepScreenOn } from '../platform/focusAlarm';
import { announce, playHaptic } from '../platform/feedback';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { CharacterArt } from './CharacterArt';
import { ConfirmDialog } from './ConfirmDialog';

/** Escolha do tempo de foco (folha que sobe do rodapé). */
export function FocusPicker({
  quest,
  onStart,
  onClose,
}: {
  quest: Quest | null;
  /** Devolve a mensagem de erro ou null se o foco começou. */
  onStart: (questId: string, minutes: number) => string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [minutes, setMinutes] = useState(25);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      visible={quest != null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {quest ? (
        <View style={[styles.pickerBackdrop, { paddingBottom: insets.bottom + space.lg }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar sem começar o foco"
          />
          <View style={styles.pickerSheet} accessibilityViewIsModal>
            <Text style={styles.kicker}>Modo foco</Text>
            <Text style={styles.pickerTitle} numberOfLines={2}>
              {quest.title}
            </Text>
            <Text style={styles.pickerHint}>
              Por quanto tempo? Até acabar, o app mostra só o cronômetro.
            </Text>
            <View style={styles.durations} accessibilityRole="radiogroup">
              {FOCUS_MINUTES.map((option) => {
                const selected = option === minutes;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setMinutes(option);
                      setError(null);
                    }}
                    style={[styles.duration, selected && styles.durationOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    testID={`focus-minutes-${option}`}
                  >
                    <Text style={[styles.durationText, selected && styles.durationTextOn]}>
                      {focusDurationLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.pickerActions}>
              <Pressable
                style={({ pressed }) => [styles.ghost, styles.grow, pressed && styles.pressed]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.cta, styles.growMore, pressed && styles.pressed]}
                onPress={() => {
                  const message = onStart(quest.id, minutes);
                  if (message) setError(message);
                }}
                accessibilityRole="button"
                testID="focus-start"
              >
                <Text style={styles.ctaText}>Começar {focusDurationLabel(minutes)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

/**
 * Tela cheia do foco. Cobre o app inteiro (o voltar do Android não sai dela) e mantém a
 * tela acesa. O tempo vem do relógio, não de contagem: fechar o app não atrasa.
 */
export function FocusTimer({
  focus,
  quest,
  onGiveUp,
  onFinish,
}: {
  focus: FocusSession | null;
  quest: Quest | null;
  onGiveUp: () => void;
  /** Tempo cumprido: conclui a quest pelo caminho normal. */
  onFinish: () => void;
}) {
  const visible = focus != null && quest != null;
  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
    >
      {focus && quest ? (
        <SafeAreaProvider>
          <TimerBody focus={focus} quest={quest} onGiveUp={onGiveUp} onFinish={onFinish} />
        </SafeAreaProvider>
      ) : null}
    </Modal>
  );
}

function endsAtLabel(focus: FocusSession): string {
  const end = new Date(focusEndsAtMs(focus));
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
}

function TimerBody({
  focus,
  quest,
  onGiveUp,
  onFinish,
}: {
  focus: FocusSession;
  quest: Quest;
  onGiveUp: () => void;
  onFinish: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [asking, setAsking] = useState(false);
  const remaining = focusRemainingMs(focus, nowMs);
  const done = remaining <= 0;
  const progress = focusProgress(focus, nowMs);
  const cheered = useRef(done);

  useEffect(() => {
    void keepScreenOn(true);
    return () => {
      void keepScreenOn(false);
    };
  }, []);

  useEffect(() => {
    if (done) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [done]);

  useEffect(() => {
    if (!done || cheered.current) return;
    cheered.current = true;
    playHaptic('SUCCESS');
    announce(`Foco concluído: ${quest.title}.`);
  }, [done, quest.title]);

  return (
    <View
      style={[
        styles.timerScreen,
        {
          paddingTop: insets.top + space.xl,
          paddingBottom: Math.max(insets.bottom, 24) + space.lg,
        },
      ]}
      testID="focus-timer"
    >
      <Text style={styles.kicker}>{done ? 'Tempo cumprido' : 'Modo foco'}</Text>
      <View style={styles.timerCenter}>
        <View style={styles.monster}>
          <CharacterArt assetKey={`enemy.${quest.category.toLowerCase()}`} size={112} />
        </View>
        <Text style={styles.timerQuest}>{quest.title}</Text>
        <Text style={styles.timerMeta}>
          {CATEGORY_LABELS[quest.category]} · {focusDurationLabel(focus.minutes)}
        </Text>
        <Text
          style={[styles.clock, done && styles.clockDone]}
          accessibilityRole="timer"
          accessibilityLabel={done ? 'Tempo cumprido' : `Faltam ${focusClock(remaining)}`}
          testID="focus-clock"
        >
          {focusClock(remaining)}
        </Text>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.timerHint}>
          {done
            ? 'Marque a quest como feita para enfrentar o monstro e levar o XP.'
            : `Termina às ${endsAtLabel(focus)}. Pode bloquear o celular: o tempo continua.`}
        </Text>
      </View>

      {done ? (
        <View style={styles.timerActions}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={onFinish}
            accessibilityRole="button"
            testID="focus-finish"
          >
            <Text style={styles.ctaText}>Concluir quest</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            onPress={onGiveUp}
            accessibilityRole="button"
          >
            <Text style={styles.ghostText}>Fechar sem concluir</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.timerActions}>
          <Pressable
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            onPress={() => setAsking(true)}
            accessibilityRole="button"
            testID="focus-give-up"
          >
            <Text style={styles.ghostText}>Desistir</Text>
          </Pressable>
        </View>
      )}

      <ConfirmDialog
        visible={asking}
        title="Desistir do foco?"
        message={`Faltam ${focusClock(remaining)}. A quest continua aberta e dá para focar de novo depois.`}
        confirmLabel="Desistir"
        cancelLabel="Continuar"
        destructive
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onGiveUp();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
    paddingHorizontal: space.lg,
  },
  pickerSheet: {
    padding: space.xl,
    borderRadius: radius.lg + space.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amber,
    textAlign: 'center',
  },
  pickerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  pickerHint: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  duration: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationOn: { borderColor: colors.amber, backgroundColor: colors.amberWash },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  durationTextOn: { color: colors.amberSoft },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger, textAlign: 'center' },
  pickerActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  grow: { flex: 1 },
  growMore: { flex: 2 },

  timerScreen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.gutter },
  timerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  monster: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerQuest: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  timerMeta: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  clock: {
    marginTop: space.md,
    fontSize: 72,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  clockDone: { color: colors.amberSoft },
  track: {
    width: '100%',
    maxWidth: 320,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.amber },
  timerHint: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  timerActions: { gap: space.sm },

  cta: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: colors.bg },
  ghost: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  ghostText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
