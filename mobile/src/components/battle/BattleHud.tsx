import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  enemyTraitOf,
  HARMFUL_STATUSES,
  STATUS_LABELS,
  previewDamage,
  previewShield,
  skillBlock,
  type BattleActor,
  type BattleSkill,
  type StatusEffect,
} from '../../domain/battle';
import { PressScale } from '../../motion/PressScale';
import { playHaptic } from '../../platform/feedback';
import { battle as tone, colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { FX_COLORS } from './BattleFx';
import { SkillIcon } from './SkillCast';

// ---------------------------------------------------------------------------
// Barras
// ---------------------------------------------------------------------------

function Meter({
  value,
  max,
  tint,
  height,
  label,
  reduceMotion,
  ticks = 0,
}: {
  value: number;
  max: number;
  tint: readonly [string, string];
  height: number;
  label: string;
  reduceMotion: boolean;
  /** Marcas a cada N pontos, para ler a barra de relance. */
  ticks?: number;
}) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const fill = useSharedValue(ratio);
  const ghost = useSharedValue(ratio);
  const pulse = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: reduceMotion ? 0 : 280 });
    // O rastro claro mostra quanto acabou de sair e encolhe depois.
    if (ratio < ghost.value) {
      ghost.value = withDelay(
        reduceMotion ? 0 : 450,
        withTiming(ratio, { duration: reduceMotion ? 0 : 420 }),
      );
      if (!reduceMotion) {
        pulse.value = withSequence(
          withTiming(1, { duration: 60 }),
          withTiming(0, { duration: 300 }),
        );
      }
    } else {
      ghost.value = ratio;
    }
  }, [fill, ghost, pulse, ratio, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const ghostStyle = useAnimatedStyle(() => ({ width: `${ghost.value * 100}%` }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value * 0.7 }));
  const marks = ticks > 0 && max > ticks ? Math.floor((max - 1) / ticks) : 0;

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <Animated.View style={[styles.meterFill, styles.ghost, ghostStyle]} />
      <Animated.View style={[styles.meterFill, fillStyle]}>
        <LinearGradient
          colors={tint}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.meterShine, { height: height * 0.35 }]} />
      </Animated.View>
      {Array.from({ length: marks }, (_, index) => (
        <View
          key={index}
          style={[styles.tick, { left: `${(((index + 1) * ticks) / max) * 100}%` }]}
        />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, styles.hitPulse, pulseStyle]} />
    </View>
  );
}

function hpTint(actor: BattleActor): readonly [string, string] {
  const ratio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
  if (ratio <= 0.25) return tone.hpLow;
  return actor.side === 'PLAYER' ? tone.hpHero : tone.hpEnemy;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function statusText(effect: StatusEffect): string {
  const base = STATUS_LABELS[effect.id];
  const stacks = effect.id === 'POISON' && effect.stacks > 1 ? ` ×${effect.stacks}` : '';
  return `${base}${stacks} · ${effect.turns}t`;
}

export function StatusChips({ statuses }: { statuses: readonly StatusEffect[] }) {
  if (statuses.length === 0) return null;
  return (
    <View style={styles.chips}>
      {statuses.map((effect) => {
        const harmful = HARMFUL_STATUSES.includes(effect.id);
        return (
          <View key={effect.id} style={[styles.chip, harmful ? styles.chipBad : styles.chipGood]}>
            <Text style={[styles.chipText, harmful ? styles.chipTextBad : styles.chipTextGood]}>
              {statusText(effect)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Placa do monstro (em cima da arena)
// ---------------------------------------------------------------------------

export function EnemyPlate({ actor, reduceMotion }: { actor: BattleActor; reduceMotion: boolean }) {
  const trait = enemyTraitOf(actor);
  return (
    <View
      style={styles.plate}
      accessible
      accessibilityLabel={`${actor.name}, ${actor.subtitle}. Vida ${actor.hp} de ${actor.maxHp}.${
        trait ? ` ${trait.name}: ${trait.blurb}` : ''
      }`}
    >
      <View style={styles.plateHead}>
        <Text style={styles.plateName} numberOfLines={1}>
          {actor.name}
        </Text>
        <Text style={styles.plateHp}>
          {actor.hp}
          <Text style={styles.plateHpMax}>/{actor.maxHp}</Text>
        </Text>
      </View>
      <Meter
        value={actor.hp}
        max={actor.maxHp}
        tint={hpTint(actor)}
        height={12}
        ticks={10}
        label={`Vida de ${actor.name}`}
        reduceMotion={reduceMotion}
      />
      <View style={styles.plateFoot}>
        <Text style={styles.plateSub} numberOfLines={1}>
          {actor.subtitle}
        </Text>
        {actor.shield > 0 ? <Text style={styles.shieldValue}>+{actor.shield} escudo</Text> : null}
      </View>
      {trait ? (
        <Text style={styles.trait} numberOfLines={1}>
          <Text style={styles.traitName}>{trait.name}</Text>
          {` · ${trait.hint}`}
        </Text>
      ) : null}
      <StatusChips statuses={actor.statuses} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Barra do herói (em cima dos golpes)
// ---------------------------------------------------------------------------

export function HeroBar({ actor, reduceMotion }: { actor: BattleActor; reduceMotion: boolean }) {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroBar}>
        <View style={styles.heroCol}>
          <View style={styles.heroHead}>
            <Text style={styles.heroName} numberOfLines={1}>
              {actor.name}
            </Text>
            <Text style={styles.heroValue}>
              {actor.hp}/{actor.maxHp}
              {actor.shield > 0 ? (
                <Text style={styles.shieldValue}>{`  +${actor.shield}`}</Text>
              ) : null}
            </Text>
          </View>
          <Meter
            value={actor.hp}
            max={actor.maxHp}
            tint={hpTint(actor)}
            height={12}
            ticks={10}
            label={`Vida de ${actor.name}`}
            reduceMotion={reduceMotion}
          />
        </View>
        {actor.maxEnergy > 0 ? (
          <View style={styles.energyCol}>
            <View style={styles.heroHead}>
              <Text style={styles.energyLabel} numberOfLines={1}>
                {actor.energyLabel}
              </Text>
              <Text style={[styles.heroValue, styles.energyValue]}>
                {actor.energy}/{actor.maxEnergy}
              </Text>
            </View>
            <Meter
              value={actor.energy}
              max={actor.maxEnergy}
              tint={tone.energy}
              height={12}
              ticks={5}
              label={`${actor.energyLabel} de ${actor.name}`}
              reduceMotion={reduceMotion}
            />
          </View>
        ) : null}
      </View>
      <StatusChips statuses={actor.statuses} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Turno
// ---------------------------------------------------------------------------

export function TurnPill({
  label,
  turn,
  mine,
  reduceMotion,
}: {
  label: string;
  turn: string;
  mine: boolean;
  reduceMotion: boolean;
}) {
  const beat = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !mine) {
      beat.value = 0;
      return;
    }
    beat.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [beat, mine, reduceMotion]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + beat.value * 0.5,
    transform: [{ scale: 0.8 + beat.value * 0.4 }],
  }));
  return (
    <View style={styles.turnWrap}>
      <View style={[styles.turnPill, mine ? styles.turnMine : styles.turnTheirs]}>
        <Animated.View
          style={[styles.turnDot, mine ? styles.dotMine : styles.dotTheirs, dotStyle]}
        />
        <Text style={[styles.turnText, mine && styles.turnTextMine]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.turnCount}>{turn}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Habilidades
// ---------------------------------------------------------------------------

function skillPreview(hero: BattleActor, enemy: BattleActor, entry: BattleSkill): string {
  const damage = previewDamage(hero, enemy, entry);
  if (damage > 0) return entry.hits && entry.hits > 1 ? `~${damage} dano total` : `~${damage} dano`;
  const shield = previewShield(hero, entry);
  if (shield > 0) return `Escudo ${shield}`;
  return 'Suporte';
}

export function SkillGrid({
  hero,
  enemy,
  disabled,
  onSkill,
  onInspect,
}: {
  hero: BattleActor;
  enemy: BattleActor;
  disabled: boolean;
  onSkill: (skillId: string) => void;
  /** Segurar o botão mostra tudo o que a habilidade faz (funciona mesmo bloqueada). */
  onInspect: (skill: BattleSkill) => void;
}) {
  return (
    <View style={styles.grid}>
      {hero.skills.map((entry) => {
        const block = skillBlock(hero, entry);
        const off = disabled || block != null;
        const cooldown = hero.cooldowns[entry.id] ?? 0;
        const status =
          block === 'COOLDOWN'
            ? `Volta em ${cooldown}t`
            : block === 'ENERGY'
              ? `Falta ${hero.energyLabel.toLowerCase()}`
              : skillPreview(hero, enemy, entry);
        const costHint = entry.cost > 0 ? ` Custa ${entry.cost} de ${hero.energyLabel}.` : '';
        const accent = FX_COLORS[entry.fx];
        return (
          <View key={entry.id} style={styles.cell}>
            <PressScale
              style={[styles.skill, off && styles.skillOff]}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${entry.name}`}
              accessibilityHint={`${entry.blurb}${costHint} Segure para ver detalhes.`}
              accessibilityState={{ disabled: off }}
              accessibilityActions={[{ name: 'longpress', label: 'Ver detalhes' }]}
              onAccessibilityAction={() => onInspect(entry)}
              delayLongPress={320}
              onLongPress={() => {
                playHaptic('TAP');
                onInspect(entry);
              }}
              onPress={() => {
                // Sem `disabled`: o botão bloqueado ainda precisa aceitar o segurar.
                if (off) return;
                playHaptic('TAP');
                onSkill(entry.id);
              }}
            >
              <LinearGradient
                colors={block != null ? tone.cardOff : tone.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.skillBg]}
              />
              <View style={[styles.socket, { backgroundColor: `${accent[2]}55` }]}>
                <View style={block != null ? styles.dim : undefined}>
                  <SkillIcon skillId={entry.id} size={38} />
                </View>
                {block === 'COOLDOWN' ? (
                  <View style={styles.cooldown}>
                    <Text style={styles.cooldownText}>{cooldown}</Text>
                  </View>
                ) : null}
                {entry.cost > 0 ? (
                  <View style={[styles.cost, block === 'ENERGY' && styles.costShort]}>
                    <Text style={styles.costText}>{entry.cost}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.skillCopy}>
                <Text style={styles.skillName} numberOfLines={2}>
                  {entry.name}
                </Text>
                <Text
                  style={[styles.skillStatus, block != null && styles.skillStatusBlocked]}
                  numberOfLines={1}
                >
                  {status}
                </Text>
              </View>
            </PressScale>
          </View>
        );
      })}
    </View>
  );
}

/** O que a habilidade faz, sem texto cortado. Abre ao segurar o botão. */
export function SkillDetail({
  skill,
  hero,
  enemy,
  onClose,
}: {
  skill: BattleSkill;
  hero: BattleActor;
  enemy: BattleActor;
  onClose: () => void;
}) {
  const block = skillBlock(hero, skill);
  const cooldownLeft = hero.cooldowns[skill.id] ?? 0;
  const rows: { label: string; value: string }[] = [
    {
      label: 'Custo',
      value: skill.cost > 0 ? `${skill.cost} de ${hero.energyLabel}` : 'Grátis',
    },
    { label: 'Recarga', value: skill.cooldown > 0 ? `${skill.cooldown} turnos` : 'Nenhuma' },
    { label: 'Agora', value: skillPreview(hero, enemy, skill) },
  ];
  if (block === 'COOLDOWN') rows.push({ label: 'Pronta em', value: `${cooldownLeft} turno(s)` });
  if (block === 'ENERGY') {
    rows.push({ label: 'Falta', value: `${skill.cost - hero.energy} de ${hero.energyLabel}` });
  }
  const accent = FX_COLORS[skill.fx];
  return (
    <Pressable
      style={styles.detailBackdrop}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Fechar detalhes da habilidade"
    >
      <View style={styles.detail} accessible accessibilityLabel={`${skill.name}. ${skill.blurb}`}>
        <View style={styles.detailHead}>
          <View style={[styles.detailSocket, { backgroundColor: `${accent[2]}55` }]}>
            <SkillIcon skillId={skill.id} size={60} />
          </View>
          <View style={styles.detailTitle}>
            <Text style={styles.detailName}>{skill.name}</Text>
            <Text style={styles.detailTag}>{skill.tag}</Text>
          </View>
        </View>
        <Text style={styles.detailBlurb}>{skill.blurb}</Text>
        <View style={styles.detailRows}>
          {rows.map((row) => (
            <View key={row.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.detailClose}>Toque para fechar</Text>
      </View>
    </Pressable>
  );
}

const SKILL_RADIUS = radius.md + 2;
const SOCKET = 48;
const SKILL_PAD = space.sm;

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: 'rgba(5, 8, 20, 0.75)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  meterShine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  ghost: { backgroundColor: 'rgba(255, 241, 214, 0.75)' },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(5, 8, 20, 0.45)',
  },
  hitPulse: { backgroundColor: '#FFFFFF' },

  plate: {
    flex: 1,
    maxWidth: 240,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(10, 14, 32, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 5,
  },
  plateHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  plateName: { flex: 1, fontSize: 17, fontWeight: '900', color: colors.text },
  plateHp: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  plateHpMax: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  plateFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  plateSub: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#CBD5E1' },
  shieldValue: { fontSize: 12, fontWeight: '800', color: '#93C5FD' },
  trait: { fontSize: 12, color: '#E2E8F0' },
  traitName: { fontWeight: '800', color: colors.amberSoft },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  chipBad: { backgroundColor: 'rgba(127, 29, 29, 0.9)' },
  chipGood: { backgroundColor: 'rgba(120, 53, 15, 0.9)' },
  chipText: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chipTextBad: { color: colors.dangerText },
  chipTextGood: { color: '#FDE68A' },

  heroWrap: { gap: space.xs + 2 },
  heroBar: { flexDirection: 'row', gap: space.md, alignItems: 'flex-end' },
  heroCol: { flex: 3, gap: 5 },
  energyCol: { flex: 2, gap: 5 },
  heroHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroName: { flex: 1, fontSize: 15, fontWeight: '900', color: colors.text },
  heroValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  energyLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#93C5FD' },
  energyValue: { color: '#BFDBFE' },

  turnWrap: { alignItems: 'flex-end', gap: 4 },
  turnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  turnMine: { backgroundColor: colors.amber },
  turnTheirs: { backgroundColor: 'rgba(127, 29, 29, 0.92)' },
  turnDot: { width: 8, height: 8, borderRadius: 4 },
  dotMine: { backgroundColor: colors.bg },
  dotTheirs: { backgroundColor: '#FCA5A5' },
  turnText: { fontSize: 13, fontWeight: '900', color: colors.text },
  turnTextMine: { color: colors.bg },
  turnCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2E8F0',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  cell: { width: '48.9%' },
  skill: {
    minHeight: 66,
    padding: SKILL_PAD,
    paddingRight: space.sm,
    borderRadius: SKILL_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    overflow: 'hidden',
  },
  skillBg: { borderRadius: SKILL_RADIUS },
  skillOff: { opacity: 0.55 },
  // Raio interno = externo − padding (regra 14).
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: SKILL_RADIUS - SKILL_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.45 },
  cooldown: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cooldownText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  skillCopy: { flex: 1, minWidth: 0, gap: 2 },
  skillName: { fontSize: 14, lineHeight: 17, fontWeight: '800', color: colors.text },
  skillStatus: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  skillStatusBlocked: { color: colors.textMuted },
  cost: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderWidth: 2,
    borderColor: '#162033',
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  costShort: { backgroundColor: '#7F1D1D' },
  costText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },

  detailBackdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: space.lg,
    backgroundColor: 'rgba(5, 8, 20, 0.65)',
  },
  detail: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: space.md,
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  detailSocket: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: { flex: 1, gap: 2 },
  detailName: { fontSize: 20, fontWeight: '900', color: colors.text },
  detailTag: { fontSize: 13, fontWeight: '700', color: colors.amberSoft },
  detailBlurb: { fontSize: 15, lineHeight: 22, color: colors.text },
  detailRows: { gap: space.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  detailClose: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
