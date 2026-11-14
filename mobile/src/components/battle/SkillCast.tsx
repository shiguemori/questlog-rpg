import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { BattleEvent } from '../../domain/battle';
import { EVENT_STEP_MS, WINDUP_MS } from './BattleStage';

/**
 * Objeto de cada habilidade do herói, renderizado no Blender (384×384, fundo transparente).
 * Fonte: `assets/blender/sources/battle-characters.blend` (raízes `prop_*`).
 */
const SKILL_ART: Record<string, ImageSourcePropType> = {
  'warrior.strike': require('../../../assets/battle/skills/warrior-strike.png'),
  'warrior.bash': require('../../../assets/battle/skills/warrior-bash.png'),
  'warrior.warcry': require('../../../assets/battle/skills/warrior-warcry.png'),
  'warrior.wall': require('../../../assets/battle/skills/warrior-wall.png'),
  'warrior.execute': require('../../../assets/battle/skills/warrior-execute.png'),
  'warrior.mop': require('../../../assets/battle/skills/warrior-mop.png'),
  'warrior.lunchbox': require('../../../assets/battle/skills/warrior-lunchbox.png'),
  'warrior.alarm': require('../../../assets/battle/skills/warrior-alarm.png'),
  'warrior.vacuum': require('../../../assets/battle/skills/warrior-vacuum.png'),
  'mage.spark': require('../../../assets/battle/skills/mage-spark.png'),
  'mage.fireball': require('../../../assets/battle/skills/mage-fireball.png'),
  'mage.frost': require('../../../assets/battle/skills/mage-frost.png'),
  'mage.barrier': require('../../../assets/battle/skills/mage-barrier.png'),
  'mage.meteor': require('../../../assets/battle/skills/mage-meteor.png'),
  'mage.highlighter': require('../../../assets/battle/skills/mage-highlighter.png'),
  'mage.tea': require('../../../assets/battle/skills/mage-tea.png'),
  'mage.pomodoro': require('../../../assets/battle/skills/mage-pomodoro.png'),
  'mage.allnighter': require('../../../assets/battle/skills/mage-allnighter.png'),
  'rogue.stab': require('../../../assets/battle/skills/rogue-stab.png'),
  'rogue.venom': require('../../../assets/battle/skills/rogue-venom.png'),
  'rogue.smoke': require('../../../assets/battle/skills/rogue-smoke.png'),
  'rogue.backstab': require('../../../assets/battle/skills/rogue-backstab.png'),
  'rogue.flurry': require('../../../assets/battle/skills/rogue-flurry.png'),
  'rogue.coupon': require('../../../assets/battle/skills/rogue-coupon.png'),
  'rogue.umbrella': require('../../../assets/battle/skills/rogue-umbrella.png'),
  'rogue.energy': require('../../../assets/battle/skills/rogue-energy.png'),
  'rogue.delivery': require('../../../assets/battle/skills/rogue-delivery.png'),
  'archer.shot': require('../../../assets/battle/skills/archer-shot.png'),
  'archer.pin': require('../../../assets/battle/skills/archer-pin.png'),
  'archer.volley': require('../../../assets/battle/skills/archer-volley.png'),
  'archer.aim': require('../../../assets/battle/skills/archer-aim.png'),
  'archer.snipe': require('../../../assets/battle/skills/archer-snipe.png'),
  'archer.plane': require('../../../assets/battle/skills/archer-plane.png'),
  'archer.cover': require('../../../assets/battle/skills/archer-cover.png'),
  'archer.bottle': require('../../../assets/battle/skills/archer-bottle.png'),
  'archer.rain': require('../../../assets/battle/skills/archer-rain.png'),
  'druid.thorn': require('../../../assets/battle/skills/druid-thorn.png'),
  'druid.compost': require('../../../assets/battle/skills/druid-compost.png'),
  'druid.vine': require('../../../assets/battle/skills/druid-vine.png'),
  'druid.bloom': require('../../../assets/battle/skills/druid-bloom.png'),
  'druid.bark': require('../../../assets/battle/skills/druid-bark.png'),
  'druid.pollen': require('../../../assets/battle/skills/druid-pollen.png'),
  'druid.sunlight': require('../../../assets/battle/skills/druid-sunlight.png'),
  'druid.herbal': require('../../../assets/battle/skills/druid-herbal.png'),
  'druid.forest': require('../../../assets/battle/skills/druid-forest.png'),
  'bard.riff': require('../../../assets/battle/skills/bard-riff.png'),
  'bard.earworm': require('../../../assets/battle/skills/bard-earworm.png'),
  'bard.offkey': require('../../../assets/battle/skills/bard-offkey.png'),
  'bard.anthem': require('../../../assets/battle/skills/bard-anthem.png'),
  'bard.encore': require('../../../assets/battle/skills/bard-encore.png'),
  'bard.lullaby': require('../../../assets/battle/skills/bard-lullaby.png'),
  'bard.headphones': require('../../../assets/battle/skills/bard-headphones.png'),
  'bard.honey': require('../../../assets/battle/skills/bard-honey.png'),
  'bard.show': require('../../../assets/battle/skills/bard-show.png'),
  'monk.palm': require('../../../assets/battle/skills/monk-palm.png'),
  'monk.flurry': require('../../../assets/battle/skills/monk-flurry.png'),
  'monk.meditate': require('../../../assets/battle/skills/monk-meditate.png'),
  'monk.stance': require('../../../assets/battle/skills/monk-stance.png'),
  'monk.finisher': require('../../../assets/battle/skills/monk-finisher.png'),
  'monk.pressure': require('../../../assets/battle/skills/monk-pressure.png'),
  'monk.water': require('../../../assets/battle/skills/monk-water.png'),
  'monk.silence': require('../../../assets/battle/skills/monk-silence.png'),
  'monk.dragon': require('../../../assets/battle/skills/monk-dragon.png'),
  defend: require('../../../assets/battle/skills/defend.png'),
};

/**
 * Como o objeto se move. Cada habilidade combina objeto + movimento + partículas,
 * então nenhuma anima igual à outra.
 */
type CastMotion =
  | 'SWING' // aparece ao lado do monstro e golpeia girando
  | 'THROW' // arremesso em arco, girando
  | 'DASH' // reto e rápido
  | 'SPIN' // reto girando muito
  | 'STICK' // voa e gruda no monstro, balançando
  | 'DROP' // cai do alto em cima do monstro
  | 'SLAM' // surge gigante sobre o monstro e esmaga
  | 'RAIN' // vários caem em sequência
  | 'RISE' // sobe do herói (buffs e cura)
  | 'GUARD'; // para na frente do herói (escudos e esquiva)

const SKILL_MOTION: Record<string, CastMotion> = {
  'warrior.strike': 'SWING',
  'warrior.bash': 'THROW',
  'warrior.warcry': 'RISE',
  'warrior.wall': 'GUARD',
  'warrior.execute': 'DASH',
  'warrior.mop': 'SPIN',
  'warrior.lunchbox': 'RISE',
  'warrior.alarm': 'DROP',
  'warrior.vacuum': 'SLAM',
  'mage.spark': 'STICK',
  'mage.fireball': 'THROW',
  'mage.frost': 'DASH',
  'mage.barrier': 'GUARD',
  'mage.meteor': 'SLAM',
  'mage.highlighter': 'SWING',
  'mage.tea': 'RISE',
  'mage.pomodoro': 'RISE',
  'mage.allnighter': 'SLAM',
  'rogue.stab': 'DASH',
  'rogue.venom': 'DROP',
  'rogue.smoke': 'GUARD',
  'rogue.backstab': 'STICK',
  'rogue.flurry': 'RAIN',
  'rogue.coupon': 'THROW',
  'rogue.umbrella': 'GUARD',
  'rogue.energy': 'RISE',
  'rogue.delivery': 'RAIN',
  'archer.shot': 'DASH',
  'archer.pin': 'STICK',
  'archer.volley': 'RAIN',
  'archer.aim': 'RISE',
  'archer.snipe': 'DASH',
  'archer.plane': 'THROW',
  'archer.cover': 'GUARD',
  'archer.bottle': 'RISE',
  'archer.rain': 'RAIN',
  'druid.thorn': 'THROW',
  'druid.compost': 'DROP',
  'druid.vine': 'STICK',
  'druid.bloom': 'RISE',
  'druid.bark': 'GUARD',
  'druid.pollen': 'THROW',
  'druid.sunlight': 'RISE',
  'druid.herbal': 'RISE',
  'druid.forest': 'SLAM',
  'bard.riff': 'SWING',
  'bard.earworm': 'STICK',
  'bard.offkey': 'THROW',
  'bard.anthem': 'RISE',
  'bard.encore': 'SLAM',
  'bard.lullaby': 'DROP',
  'bard.headphones': 'GUARD',
  'bard.honey': 'RISE',
  'bard.show': 'RAIN',
  'monk.palm': 'DASH',
  'monk.flurry': 'SPIN',
  'monk.meditate': 'RISE',
  'monk.stance': 'GUARD',
  'monk.finisher': 'SLAM',
  'monk.pressure': 'DASH',
  'monk.water': 'RISE',
  'monk.silence': 'RISE',
  'monk.dragon': 'SLAM',
  defend: 'RISE',
};

function artKey(skillId: string): string {
  return skillId.endsWith('.defend') ? 'defend' : skillId;
}

/** Para os testes: o movimento que a habilidade usa ao ser lançada. */
export function skillMotionFor(skillId: string): CastMotion | undefined {
  return SKILL_MOTION[artKey(skillId)];
}

export function skillArtFor(skillId: string): ImageSourcePropType | undefined {
  return SKILL_ART[artKey(skillId)];
}

/** Ícone da habilidade (botões, detalhe, loadout e talentos). */
export const SkillIcon = memo(function SkillIcon({
  skillId,
  size,
}: {
  skillId: string;
  size: number;
}) {
  const source = skillArtFor(skillId);
  if (!source) return <View style={{ width: size, height: size }} />;
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
});

const CAST_MS = 560;

interface Point {
  x: number;
  y: number;
}

interface PropShotProps {
  source: ImageSourcePropType;
  motion: CastMotion;
  from: Point;
  to: Point;
  size: number;
  delay: number;
  /** Cópia atrasada (rastro): quanto atrás do original e quão transparente. */
  lag?: number;
  alpha?: number;
}

/** Movimentos que deixam rastro: o objeto voa rápido. */
const TRAILED: readonly CastMotion[] = ['THROW', 'DASH', 'SPIN', 'STICK', 'DROP'];

/** Um objeto voando. Monta, anima uma vez e some. */
function PropShot({ source, motion, from, to, size, delay, lag = 0, alpha = 1 }: PropShotProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Reanimated: shared value mutável de propósito.
    progress.value = withDelay(delay, withTiming(1, { duration: CAST_MS, easing: Easing.linear }));
  }, [delay, progress]);

  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  const style = useAnimatedStyle(() => {
    const p = progress.value - lag;
    if (p <= 0) return { opacity: 0 };
    // O rastro só aparece enquanto o objeto viaja.
    if (lag > 0 && p > 0.5) return { opacity: 0 };
    const fade = p > 0.82 ? (1 - p) / 0.18 : 1;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let x = to.x;
    let y = to.y;
    let rotate = 0;
    let scale = 1;
    let opacity = fade;

    switch (motion) {
      case 'THROW': {
        const t = Math.min(1, p / 0.6);
        x = lerp(from.x, to.x, t);
        y = lerp(from.y, to.y, t) - 90 * 4 * t * (1 - t);
        rotate = t * 540;
        break;
      }
      case 'DASH': {
        const t = Math.min(1, p / 0.45);
        const eased = t * t;
        x = lerp(from.x, to.x, eased);
        y = lerp(from.y, to.y, eased);
        rotate = angle;
        scale = 1 + 0.25 * t;
        break;
      }
      case 'SPIN': {
        const t = Math.min(1, p / 0.55);
        x = lerp(from.x, to.x, t);
        y = lerp(from.y, to.y, t);
        rotate = p * 1080;
        break;
      }
      case 'STICK': {
        const t = Math.min(1, p / 0.45);
        x = lerp(from.x, to.x, t);
        y = lerp(from.y, to.y, t);
        rotate = t < 1 ? t * 360 : Math.sin((p - 0.45) * 40) * 12 * (1 - p);
        scale = t < 1 ? 0.8 : 1.1;
        break;
      }
      case 'SWING': {
        x = to.x - size * 0.55;
        y = to.y - size * 0.2;
        const t = Math.min(1, p / 0.5);
        rotate = lerp(-110, 50, 1 - (1 - t) * (1 - t));
        scale = t < 0.2 ? t / 0.2 : 1.1;
        break;
      }
      case 'DROP': {
        const t = Math.min(1, p / 0.5);
        x = to.x;
        y =
          t < 1
            ? lerp(to.y - 220, to.y, t * t)
            : to.y - Math.abs(Math.sin((p - 0.5) * 14)) * 18 * (1 - p);
        rotate = (1 - t) * -25;
        break;
      }
      case 'SLAM': {
        const t = Math.min(1, p / 0.35);
        x = to.x;
        y = to.y - 20 * (1 - t);
        scale = lerp(2.6, 1.2, t * t);
        opacity = Math.min(fade, t * 2.5);
        break;
      }
      case 'RISE': {
        x = from.x;
        y = from.y - 30 - 70 * p;
        scale = p < 0.25 ? lerp(0.3, 1.25, p / 0.25) : lerp(1.25, 1, Math.min(1, (p - 0.25) / 0.2));
        rotate = Math.sin(p * 12) * 8;
        break;
      }
      case 'GUARD': {
        x = from.x + size * 0.7;
        y = from.y - 10;
        scale = p < 0.25 ? lerp(0, 1.2, p / 0.25) : lerp(1.2, 1, Math.min(1, (p - 0.25) / 0.2));
        break;
      }
      default:
        break;
    }
    return {
      opacity: opacity * alpha,
      transform: [
        { translateX: x - size / 2 },
        { translateY: y - size / 2 },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.shot, { width: size, height: size }, style]}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

export interface SkillCastLayerProps {
  events: readonly BattleEvent[];
  /** Centro do herói e do monstro, em coordenadas da arena. */
  hero: Point;
  enemy: Point;
  /** Tamanho base do objeto. */
  size: number;
  reduceMotion: boolean;
}

/**
 * Camada por cima da arena: cada habilidade do herói lança o seu objeto com o seu
 * movimento. "Reduzir movimento" desliga a camada (números e textos continuam).
 */
export function SkillCastLayer({ events, hero, enemy, size, reduceMotion }: SkillCastLayerProps) {
  if (reduceMotion) return null;
  const shots: React.ReactElement[] = [];
  events.forEach((event, index) => {
    if (event.kind !== 'CAST' || event.source !== 'PLAYER' || !event.skillId) return;
    const key = artKey(event.skillId);
    const source = SKILL_ART[key];
    const motion = SKILL_MOTION[key];
    if (!source || !motion) return;
    // O objeto sai no fim do preparo do herói.
    const delay = index * EVENT_STEP_MS + WINDUP_MS - 40;
    if (motion === 'RAIN') {
      [-1, 0, 1].forEach((offset, copy) => {
        shots.push(
          <PropShot
            key={`${event.seq}-${copy}`}
            source={source}
            motion="DROP"
            from={hero}
            to={{ x: enemy.x + offset * size * 0.55, y: enemy.y + Math.abs(offset) * 10 }}
            size={size * 0.8}
            delay={delay + copy * 140}
          />,
        );
      });
      return;
    }
    const trail = TRAILED.includes(motion)
      ? [
          { lag: 0.1, alpha: 0.18 },
          { lag: 0.05, alpha: 0.38 },
        ]
      : [];
    [...trail, { lag: 0, alpha: 1 }].forEach((ghost) => {
      shots.push(
        <PropShot
          key={`${event.seq}-${ghost.lag}`}
          source={source}
          motion={motion}
          from={hero}
          to={enemy}
          size={motion === 'SLAM' ? size * 1.3 : size}
          delay={delay}
          lag={ghost.lag}
          alpha={ghost.alpha}
        />,
      );
    });
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {shots}
    </View>
  );
}

const styles = StyleSheet.create({
  shot: { position: 'absolute', left: 0, top: 0 },
});
