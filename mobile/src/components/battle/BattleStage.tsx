import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  HARMFUL_STATUSES,
  STATUS_LABELS,
  type BattleActor,
  type BattleEvent,
  type BattleSide,
  type FxKind,
} from '../../domain/battle';
import { CharacterArt } from '../CharacterArt';
import { FX_COLORS, FloatingText, FxBurst } from './BattleFx';

/** Intervalo entre eventos da mesma ação, para cada um ser lido. */
export const EVENT_STEP_MS = 240;

interface StageEffect {
  key: string;
  type: 'fx' | 'text';
  fx?: FxKind;
  text?: string;
  color?: string;
  big?: boolean;
  delay: number;
  offset: number;
}

type TextSpec = Pick<StageEffect, 'text' | 'color' | 'big'>;

export interface ActorStageProps {
  actor: BattleActor;
  events: readonly BattleEvent[];
  size: number;
  reduceMotion: boolean;
  /** Nocaute: o sprite cai e apaga. */
  knockedOut: boolean;
}

function textFor(event: BattleEvent, side: BattleSide): TextSpec | null {
  switch (event.kind) {
    case 'DAMAGE':
      return event.crit
        ? { text: `${event.amount}!`, color: '#FDE047', big: true }
        : { text: `${event.amount}`, color: side === 'PLAYER' ? '#FCA5A5' : '#F8FAFC' };
    case 'TICK':
      return { text: `${event.amount}`, color: event.status === 'BURN' ? '#FDBA74' : '#BEF264' };
    case 'HEAL':
      return { text: `+${event.amount}`, color: '#86EFAC' };
    case 'SHIELD':
      return { text: `+${event.amount} escudo`, color: '#93C5FD' };
    case 'MISS':
      return { text: 'Errou', color: '#CBD5E1' };
    case 'SKIP':
      return { text: 'Atordoado', color: '#FDE047' };
    case 'STATUS':
      if (!event.status) return null;
      return {
        text: STATUS_LABELS[event.status],
        color: HARMFUL_STATUSES.includes(event.status) ? '#FCA5A5' : '#FCD34D',
      };
    default:
      return null;
  }
}

function fxFor(event: BattleEvent): FxKind | null {
  if (event.kind === 'DAMAGE' || event.kind === 'TICK' || event.kind === 'STATUS') {
    return event.fx ?? null;
  }
  if (event.kind === 'HEAL') return 'HEAL';
  if (event.kind === 'SHIELD') return 'SHIELD';
  if (event.kind === 'MISS') return 'SMOKE';
  return null;
}

/** Efeitos visuais (partículas e números) dos eventos que atingem este lado. */
function effectsFor(events: readonly BattleEvent[], side: BattleSide): StageEffect[] {
  const effects: StageEffect[] = [];
  let textCount = 0;
  events.forEach((event, index) => {
    if (event.target !== side) return;
    const delay = index * EVENT_STEP_MS;
    const fx = fxFor(event);
    if (fx) effects.push({ key: `fx-${event.seq}`, type: 'fx', fx, delay: delay + 80, offset: 0 });
    const text = textFor(event, side);
    if (text) {
      effects.push({
        key: `tx-${event.seq}`,
        type: 'text',
        ...text,
        delay: delay + 100,
        offset: ((textCount % 3) - 1) * 26,
      });
      textCount += 1;
    }
  });
  return effects;
}

/**
 * Um lutador na arena: respira parado, avança ao atacar, treme e pisca ao apanhar,
 * desvia, cai no nocaute. Partículas e números saem dos eventos do motor.
 */
export function ActorStage({ actor, events, size, reduceMotion, knockedOut }: ActorStageProps) {
  const side = actor.side;
  const direction = side === 'PLAYER' ? 1 : -1;
  const bob = useSharedValue(0);
  const lunge = useSharedValue(0);
  const shake = useSharedValue(0);
  const blink = useSharedValue(1);
  const ko = useSharedValue(0);
  const lastSeq = useRef(0);

  // Partículas e números saem direto dos eventos da última ação.
  // Cada um anima uma vez ao montar; a próxima ação troca a lista.
  const effects = useMemo(() => effectsFor(events, side), [events, side]);

  useEffect(() => {
    if (reduceMotion || knockedOut) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [bob, knockedOut, reduceMotion]);

  useEffect(() => {
    ko.value = withTiming(knockedOut ? 1 : 0, { duration: reduceMotion ? 0 : 520 });
  }, [knockedOut, ko, reduceMotion]);

  useEffect(() => {
    const fresh = events.filter((event) => event.seq > lastSeq.current);
    if (fresh.length === 0) return;
    lastSeq.current = fresh[fresh.length - 1].seq;

    fresh.forEach((event, index) => {
      const delay = index * EVENT_STEP_MS;

      if (
        event.kind === 'CAST' &&
        event.source === side &&
        event.target !== side &&
        !reduceMotion
      ) {
        lunge.value = withDelay(
          delay,
          withSequence(
            withTiming(direction * 30, { duration: 130, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
          ),
        );
      }

      if (event.target !== side) return;

      if (event.kind === 'DAMAGE' || event.kind === 'TICK') {
        blink.value = withDelay(
          delay + 90,
          withSequence(
            withTiming(0.25, { duration: 60 }),
            withTiming(1, { duration: 60 }),
            withTiming(0.25, { duration: 60 }),
            withTiming(1, { duration: 120 }),
          ),
        );
        if (!reduceMotion) {
          const amp = event.crit ? 12 : 7;
          shake.value = withDelay(
            delay + 90,
            withSequence(
              withTiming(-amp, { duration: 45 }),
              withTiming(amp, { duration: 45 }),
              withTiming(-amp / 2, { duration: 45 }),
              withTiming(amp / 2, { duration: 45 }),
              withTiming(0, { duration: 45 }),
            ),
          );
        }
      }
      if (event.kind === 'MISS' && !reduceMotion) {
        lunge.value = withDelay(
          delay + 60,
          withSequence(
            withTiming(-direction * 22, { duration: 110 }),
            withTiming(0, { duration: 220 }),
          ),
        );
      }
    });
  }, [blink, direction, events, lunge, reduceMotion, shake, side]);

  const spriteStyle = useAnimatedStyle(() => ({
    opacity: blink.value * (1 - ko.value * 0.75),
    transform: [
      { translateX: lunge.value + shake.value },
      { translateY: bob.value + ko.value * 18 },
      { rotate: `${ko.value * direction * -18}deg` },
    ],
  }));

  return (
    <View style={[styles.stage, { width: size + 32, height: size + 28 }]}>
      <View style={[styles.shadow, { width: size * 0.8 }]} />
      <Animated.View style={spriteStyle}>
        <CharacterArt assetKey={actor.assetKey} size={size} accessibilityLabel={actor.name} />
      </Animated.View>
      {effects.map((entry) =>
        entry.type === 'fx' && entry.fx ? (
          <FxBurst
            key={entry.key}
            kind={entry.fx}
            delay={entry.delay}
            reduceMotion={reduceMotion}
          />
        ) : (
          <FloatingText
            key={entry.key}
            text={entry.text ?? ''}
            color={entry.color ?? FX_COLORS.SLASH[0]}
            big={entry.big}
            delay={entry.delay}
            offset={entry.offset}
            reduceMotion={reduceMotion}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shadow: {
    position: 'absolute',
    bottom: 6,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 16, 32, 0.45)',
  },
});
