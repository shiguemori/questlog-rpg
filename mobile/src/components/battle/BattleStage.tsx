import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { overshoot } from '../../motion/easing';
import {
  HARMFUL_STATUSES,
  STATUS_LABELS,
  type BattleActor,
  type BattleEvent,
  type BattleSide,
  type FxKind,
} from '../../domain/battle';
import { CharacterArt, type ActorPose } from '../CharacterArt';
import { FloatingText, FxBurst } from './BattleFx';

import { EVENT_STEP_MS, WINDUP_MS } from './timing';

export { EVENT_STEP_MS, WINDUP_MS };

interface StageEffect {
  key: string;
  type: 'fx' | 'text';
  fx?: FxKind;
  text?: string;
  label?: string;
  color?: string;
  big?: boolean;
  delay: number;
  offset: number;
}

type TextSpec = Pick<StageEffect, 'text' | 'color' | 'big' | 'label'>;

export interface ActorStageProps {
  actor: BattleActor;
  events: readonly BattleEvent[];
  size: number;
  reduceMotion: boolean;
  /** Nocaute: o sprite cai e apaga. */
  knockedOut: boolean;
  /** Venceu a luta: fica na pose de vitória. */
  celebrating?: boolean;
}

/** Quanto cada pose fica na tela antes de voltar a ficar parado. */
const ATTACK_HOLD_MS = 380;
const HURT_HOLD_MS = 420;
const CHEER_HOLD_MS = 520;

function textFor(event: BattleEvent, side: BattleSide): TextSpec | null {
  switch (event.kind) {
    case 'DAMAGE':
      return event.crit
        ? { text: `${event.amount}`, color: '#FDE047', big: true, label: 'CRÍTICO' }
        : { text: `${event.amount}`, color: side === 'PLAYER' ? '#FCA5A5' : '#FFFFFF' };
    case 'TICK':
      return { text: `${event.amount}`, color: event.status === 'BURN' ? '#FDBA74' : '#BEF264' };
    case 'HEAL':
      return { text: `+${event.amount}`, color: '#86EFAC' };
    case 'ENERGY':
      return { text: `+${event.amount}`, color: '#FDE68A', label: 'ENERGIA' };
    case 'SHIELD':
      return { text: `+${event.amount}`, color: '#93C5FD', label: 'ESCUDO' };
    case 'MISS':
      return { text: 'Errou', color: '#E2E8F0' };
    case 'SKIP':
      return { text: 'Travado', color: '#FDE047' };
    case 'TRAIT':
      return { text: event.skillName ?? '', color: '#FCD34D', label: 'JEITO DO MONSTRO' };
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
    return event.fx ?? (event.kind === 'DAMAGE' ? 'IMPACT' : null);
  }
  if (event.kind === 'TRAIT') return event.fx ?? 'BUFF';
  if (event.kind === 'HEAL') return 'HEAL';
  if (event.kind === 'ENERGY') return 'BUFF';
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
    const delay = WINDUP_MS + index * EVENT_STEP_MS;
    const fx = fxFor(event);
    if (fx) {
      effects.push({
        key: `fx-${event.seq}`,
        type: 'fx',
        fx,
        big: event.crit,
        delay: delay + 70,
        offset: 0,
      });
    }
    const text = textFor(event, side);
    if (text) {
      effects.push({
        key: `tx-${event.seq}`,
        type: 'text',
        ...text,
        delay: delay + 90,
        offset: ((textCount % 3) - 1) * 30,
      });
      textCount += 1;
    }
  });
  return effects;
}

/**
 * Um lutador na arena: respira parado, prepara e avança ao atacar, pisca branco e
 * recua ao apanhar, desvia, cai no nocaute. Escudo vira uma bolha enquanto durar.
 * Partículas e números saem dos eventos do motor.
 */
export function ActorStage({
  actor,
  events,
  size,
  reduceMotion,
  knockedOut,
  celebrating = false,
}: ActorStageProps) {
  const side = actor.side;
  const direction = side === 'PLAYER' ? 1 : -1;
  const breathe = useSharedValue(0);
  const lunge = useSharedValue(0);
  const hop = useSharedValue(0);
  const squash = useSharedValue(0);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  const glow = useSharedValue(0);
  const ko = useSharedValue(0);
  const shieldOn = useSharedValue(actor.shield > 0 ? 1 : 0);
  const shieldPulse = useSharedValue(0);
  const lastSeq = useRef(0);
  const [pose, setPose] = useState<ActorPose>('idle');
  const poseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stunned = actor.statuses.some((effect) => effect.id === 'STUN');

  // Partículas e números saem direto dos eventos da última ação.
  // Cada um anima uma vez ao montar; a próxima ação troca a lista.
  const effects = useMemo(() => effectsFor(events, side), [events, side]);

  useEffect(() => {
    if (reduceMotion || knockedOut) {
      cancelAnimation(breathe);
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1, {
        duration: side === 'PLAYER' ? 1400 : 1700,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    shieldPulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breathe, knockedOut, reduceMotion, shieldPulse, side]);

  useEffect(() => {
    ko.value = withTiming(knockedOut ? 1 : 0, { duration: reduceMotion ? 0 : 640 });
  }, [knockedOut, ko, reduceMotion]);

  // A bolha entra com o escudo e estoura quando ele acaba.
  useEffect(() => {
    shieldOn.value = withTiming(actor.shield > 0 ? 1 : 0, {
      duration: reduceMotion ? 0 : actor.shield > 0 ? 320 : 220,
    });
  }, [actor.shield, reduceMotion, shieldOn]);

  // Poses do quadro: trocam no mesmo tempo das animações abaixo.
  useEffect(() => {
    const fresh = events.filter((event) => event.seq > lastSeq.current);
    if (fresh.length === 0) return undefined;
    poseTimers.current.forEach(clearTimeout);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, next: ActorPose) => {
      timers.push(setTimeout(() => setPose(next), Math.max(0, ms)));
    };
    fresh.forEach((event, index) => {
      const delay = index * EVENT_STEP_MS;
      if (event.kind === 'CAST' && event.source === side) {
        if (event.target !== side) {
          at(delay, 'windup');
          at(delay + WINDUP_MS, 'attack');
          at(delay + WINDUP_MS + ATTACK_HOLD_MS, 'idle');
        } else {
          at(delay, 'victory');
          at(delay + CHEER_HOLD_MS, 'idle');
        }
      }
      if (event.target === side && (event.kind === 'DAMAGE' || event.kind === 'TICK')) {
        const hit = WINDUP_MS + delay + 70;
        at(hit, 'hurt');
        at(hit + HURT_HOLD_MS, 'idle');
      }
    });
    poseTimers.current = timers;
    return undefined;
  }, [events, side]);

  useEffect(() => () => poseTimers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const fresh = events.filter((event) => event.seq > lastSeq.current);
    if (fresh.length === 0) return;
    lastSeq.current = fresh[fresh.length - 1].seq;

    fresh.forEach((event, index) => {
      const delay = index * EVENT_STEP_MS;
      const casting = event.kind === 'CAST' && event.source === side;

      if (casting && !reduceMotion) {
        const offensive = event.target !== side;
        if (offensive) {
          // Recua e encolhe (preparo), estica no avanço, volta.
          lunge.value = withDelay(
            delay,
            withSequence(
              withTiming(-direction * 14, {
                duration: WINDUP_MS,
                easing: Easing.out(Easing.quad),
              }),
              withTiming(direction * 44, { duration: 110, easing: Easing.in(Easing.quad) }),
              withTiming(0, { duration: 260, easing: overshoot(1.6) }),
            ),
          );
          squash.value = withDelay(
            delay,
            withSequence(
              withTiming(1, { duration: WINDUP_MS }),
              withTiming(-1, { duration: 110 }),
              withTiming(0, { duration: 240 }),
            ),
          );
        } else {
          // Habilidade em si mesmo: pulinho e brilho.
          hop.value = withDelay(
            delay,
            withSequence(
              withTiming(-22, { duration: 160, easing: Easing.out(Easing.quad) }),
              withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
            ),
          );
          glow.value = withDelay(
            delay,
            withSequence(withTiming(0.6, { duration: 160 }), withTiming(0, { duration: 420 })),
          );
        }
      }

      if (event.target !== side) return;
      const at = WINDUP_MS + delay + 70;

      if (event.kind === 'DAMAGE' || event.kind === 'TICK') {
        flash.value = withDelay(
          at,
          withSequence(
            withTiming(1, { duration: 40 }),
            withTiming(0.2, { duration: 90 }),
            withTiming(event.crit ? 0.9 : 0.6, { duration: 50 }),
            withTiming(0, { duration: 180 }),
          ),
        );
        if (!reduceMotion) {
          const amp = event.crit ? 14 : event.kind === 'TICK' ? 4 : 8;
          shake.value = withDelay(
            at,
            withSequence(
              withTiming(-amp, { duration: 40 }),
              withTiming(amp, { duration: 40 }),
              withTiming(-amp / 2, { duration: 40 }),
              withTiming(amp / 3, { duration: 40 }),
              withTiming(0, { duration: 50 }),
            ),
          );
          if (event.kind === 'DAMAGE') {
            lunge.value = withDelay(
              at,
              withSequence(
                withTiming(-direction * (event.crit ? 30 : 18), {
                  duration: 90,
                  easing: Easing.out(Easing.quad),
                }),
                withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }),
              ),
            );
            squash.value = withDelay(
              at,
              withSequence(withTiming(1.4, { duration: 70 }), withTiming(0, { duration: 260 })),
            );
          }
        }
      }
      if ((event.kind === 'HEAL' || event.kind === 'SHIELD') && !reduceMotion) {
        glow.value = withDelay(
          at,
          withSequence(withTiming(0.55, { duration: 140 }), withTiming(0, { duration: 500 })),
        );
      }
      if (event.kind === 'MISS' && !reduceMotion) {
        lunge.value = withDelay(
          at - 70,
          withSequence(
            withTiming(-direction * 34, { duration: 120, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 300 }),
          ),
        );
        hop.value = withDelay(
          at - 70,
          withSequence(withTiming(-14, { duration: 120 }), withTiming(0, { duration: 300 })),
        );
      }
    });
  }, [direction, events, flash, glow, hop, lunge, reduceMotion, shake, side, squash]);

  const spriteStyle = useAnimatedStyle(() => {
    const b = breathe.value;
    const sq = squash.value;
    // Respiração: estica um pouco no alto; o monstro flutua.
    const breathY = side === 'PLAYER' ? 1 + b * 0.025 : 1;
    const float = side === 'PLAYER' ? 0 : -6 * b;
    const sx = 1 + sq * 0.08;
    const sy = (1 - sq * 0.08) * breathY;
    return {
      opacity: 1 - ko.value * 0.65,
      transform: [
        { translateX: lunge.value + shake.value },
        { translateY: hop.value + float + ko.value * size * 0.12 },
        // Escala a partir dos pés: compensa o meio da imagem.
        { translateY: (size * (1 - sy)) / 2 },
        { rotate: `${ko.value * direction * -78}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const shadowStyle = useAnimatedStyle(() => {
    const lift = (-hop.value + (side === 'PLAYER' ? 0 : 6 * breathe.value)) / 40;
    return {
      opacity: (0.55 - lift * 0.25) * (1 - ko.value * 0.4),
      transform: [
        { translateX: lunge.value * 0.6 },
        // Círculo achatado = elipse de sombra no chão.
        { scaleY: 0.16 },
        { scaleX: 1 - lift * 0.25 + ko.value * 0.3 },
      ],
    };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const on = shieldOn.value;
    return {
      opacity: on * (0.85 + shieldPulse.value * 0.15),
      transform: [
        { translateX: lunge.value * 0.8 + shake.value },
        { scale: (on < 1 && on > 0 ? 1.25 - on * 0.25 : 1) * (1 + shieldPulse.value * 0.03) },
      ],
    };
  });

  const stage = { width: size * 1.25, height: size * 1.12 };
  // Fim da luta manda na pose: nocaute ou vitória ficam até a tela fechar.
  const shownPose: ActorPose = knockedOut ? 'ko' : celebrating ? 'victory' : pose;
  const bubble = size * 1.02;

  return (
    <View style={[styles.stage, stage]} pointerEvents="none">
      <Animated.View
        style={[
          styles.shadow,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
            left: (stage.width - size * 0.72) / 2,
            bottom: -size * 0.3,
          },
          shadowStyle,
        ]}
      />
      <Animated.View style={[styles.sprite, spriteStyle]}>
        <CharacterArt
          assetKey={actor.assetKey}
          size={size}
          accessibilityLabel={actor.name}
          mode="stage"
          pose={shownPose}
        />
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <CharacterArt
            assetKey={actor.assetKey}
            size={size}
            tint="#BBF7D0"
            mode="stage"
            pose={shownPose}
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, flashStyle]}>
          <CharacterArt
            assetKey={actor.assetKey}
            size={size}
            tint="#FFFFFF"
            mode="stage"
            pose={shownPose}
          />
        </Animated.View>
        {stunned && !knockedOut ? <StunStars size={size} reduceMotion={reduceMotion} /> : null}
      </Animated.View>
      <Animated.View
        style={[
          styles.bubble,
          {
            width: bubble,
            height: bubble,
            borderRadius: bubble / 2,
            bottom: size * 0.04,
            left: (stage.width - bubble) / 2,
          },
          bubbleStyle,
        ]}
      >
        <View style={[styles.bubbleShine, { width: bubble * 0.28, height: bubble * 0.14 }]} />
      </Animated.View>
      {effects.map((entry) =>
        entry.type === 'fx' && entry.fx ? (
          <FxBurst
            key={entry.key}
            kind={entry.fx}
            delay={entry.delay}
            reduceMotion={reduceMotion}
            size={size}
            big={entry.big}
          />
        ) : (
          <FloatingText
            key={entry.key}
            text={entry.text ?? ''}
            label={entry.label}
            color={entry.color ?? '#FFFFFF'}
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

/** Estrelinhas girando na cabeça de quem está travado. */
function StunStars({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1);
  }, [reduceMotion, spin]);
  return (
    <View style={[styles.stars, { top: size * 0.06, width: size * 0.5 }]}>
      {[0, 1, 2].map((index) => (
        <Star key={index} index={index} spin={spin} radius={size * 0.2} />
      ))}
    </View>
  );
}

function Star({
  index,
  spin,
  radius,
}: {
  index: number;
  spin: SharedValue<number>;
  radius: number;
}) {
  const style = useAnimatedStyle(() => {
    const a = (spin.value + index / 3) * Math.PI * 2;
    return {
      opacity: 0.6 + 0.4 * Math.sin(a),
      transform: [
        { translateX: Math.cos(a) * radius },
        { translateY: Math.sin(a) * radius * 0.3 },
        { rotate: `${spin.value * 360}deg` },
        { scale: 0.85 + 0.25 * Math.sin(a) },
      ],
    };
  });
  return <Animated.Text style={[styles.star, style]}>✦</Animated.Text>;
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'flex-end' },
  sprite: { alignItems: 'center' },
  shadow: {
    position: 'absolute',
    backgroundColor: 'rgba(8, 10, 24, 0.5)',
  },
  bubble: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(147, 197, 253, 0.9)',
    backgroundColor: 'rgba(96, 165, 250, 0.16)',
  },
  bubbleShine: {
    position: 'absolute',
    top: '14%',
    left: '20%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ rotate: '-30deg' }],
  },
  stars: {
    position: 'absolute',
    alignSelf: 'center',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    fontSize: 18,
    color: '#FDE047',
    textShadowColor: '#0B1020',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
