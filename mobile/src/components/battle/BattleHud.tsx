import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
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
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
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
}: {
  value: number;
  max: number;
  tint: string;
  height: number;
  label: string;
  reduceMotion: boolean;
}) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const fill = useSharedValue(ratio);
  const ghost = useSharedValue(ratio);

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: reduceMotion ? 0 : 260 });
    // O rastro claro mostra quanto acabou de sair e encolhe depois.
    ghost.value =
      ratio < ghost.value
        ? withDelay(reduceMotion ? 0 : 420, withTiming(ratio, { duration: reduceMotion ? 0 : 380 }))
        : ratio;
  }, [fill, ghost, ratio, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const ghostStyle = useAnimatedStyle(() => ({ width: `${ghost.value * 100}%` }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <Animated.View style={[styles.meterFill, styles.ghost, ghostStyle]} />
      <Animated.View style={[styles.meterFill, { backgroundColor: tint }, fillStyle]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cartão do lutador
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

export function ActorCard({ actor, reduceMotion }: { actor: BattleActor; reduceMotion: boolean }) {
  const player = actor.side === 'PLAYER';
  const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
  const hpTint = hpRatio <= 0.25 ? colors.danger : player ? colors.success : colors.amber;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.name} numberOfLines={1}>
          {actor.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {actor.subtitle}
        </Text>
      </View>

      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>Vida</Text>
        <Text style={styles.meterValue}>
          {actor.hp}/{actor.maxHp}
          {actor.shield > 0 ? (
            <Text style={styles.shieldValue}>{`  +${actor.shield} escudo`}</Text>
          ) : null}
        </Text>
      </View>
      <Meter
        value={actor.hp}
        max={actor.maxHp}
        tint={hpTint}
        height={10}
        label={`Vida de ${actor.name}`}
        reduceMotion={reduceMotion}
      />

      {player && actor.maxEnergy > 0 ? (
        <>
          <View style={[styles.meterRow, styles.meterGap]}>
            <Text style={styles.meterLabel}>{actor.energyLabel}</Text>
            <Text style={styles.meterValue}>
              {actor.energy}/{actor.maxEnergy}
            </Text>
          </View>
          <Meter
            value={actor.energy}
            max={actor.maxEnergy}
            tint={colors.mage}
            height={6}
            label={`${actor.energyLabel} de ${actor.name}`}
            reduceMotion={reduceMotion}
          />
        </>
      ) : null}

      <StatusChips statuses={actor.statuses} />
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
            ? `Recarga ${cooldown}t`
            : block === 'ENERGY'
              ? `Falta ${hero.energyLabel.toLowerCase()}`
              : skillPreview(hero, enemy, entry);
        const costHint = entry.cost > 0 ? ` Custa ${entry.cost} de ${hero.energyLabel}.` : '';
        return (
          <View key={entry.id} style={styles.cell}>
            <PressScale
              style={[
                styles.skill,
                block != null && styles.skillBlocked,
                disabled && block == null && styles.skillWaiting,
              ]}
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
              <View style={styles.skillHead}>
                <SkillIcon skillId={entry.id} size={30} />
                <Text style={styles.skillName} numberOfLines={1}>
                  {entry.name}
                </Text>
                {entry.cost > 0 ? (
                  <Text style={styles.cost}>{entry.cost}</Text>
                ) : (
                  <Text style={styles.free}>grátis</Text>
                )}
              </View>
              <Text style={styles.skillTag} numberOfLines={1}>
                {entry.tag}
              </Text>
              <Text
                style={[styles.skillStatus, block != null && styles.skillStatusBlocked]}
                numberOfLines={1}
              >
                {status}
              </Text>
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
  return (
    <Pressable
      style={styles.detailBackdrop}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Fechar detalhes da habilidade"
    >
      <View style={styles.detail} accessible accessibilityLabel={`${skill.name}. ${skill.blurb}`}>
        <View style={styles.detailHead}>
          <SkillIcon skillId={skill.id} size={64} />
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

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: 'rgba(11, 16, 32, 0.7)',
    overflow: 'hidden',
  },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  ghost: { backgroundColor: 'rgba(248, 250, 252, 0.55)' },

  card: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
  },
  cardHead: { marginBottom: space.xs + 2 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.xs,
  },
  meterGap: { marginTop: space.xs + 2 },
  meterLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  meterValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  shieldValue: { color: '#93C5FD' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs + 2 },
  chip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  chipBad: { backgroundColor: 'rgba(127, 29, 29, 0.85)' },
  chipGood: { backgroundColor: 'rgba(120, 53, 15, 0.85)' },
  chipText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chipTextBad: { color: colors.dangerText },
  chipTextGood: { color: '#FDE68A' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  cell: { width: '48.8%' },
  skill: {
    minHeight: 72,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
  },
  skillBlocked: { opacity: 0.45 },
  skillWaiting: { opacity: 0.6 },
  skillHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  skillName: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  cost: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: '#1E3A8A',
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    overflow: 'hidden',
  },
  free: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  skillTag: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  skillStatus: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  skillStatusBlocked: { color: colors.textMuted },

  detailBackdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: space.lg,
    backgroundColor: 'rgba(11, 16, 32, 0.6)',
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
  detailTitle: { flex: 1, gap: 2 },
  detailName: { fontSize: 20, fontWeight: '800', color: colors.text },
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
