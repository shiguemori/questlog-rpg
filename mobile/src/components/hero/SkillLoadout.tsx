import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { defendSkillFor, HERO_SKILLS, TALENT_SKILLS, type BattleSkill } from '../../domain/battle';
import {
  LOADOUT_SIZE,
  loadoutIds,
  TALENT_BRANCH_LABELS,
  TALENT_TREES,
  toggleLoadoutSkill,
  unlockedSkills,
} from '../../domain/talents';
import type { AppState } from '../../domain/types';
import { colors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { SkillIcon } from '../battle/SkillCast';

export interface SkillLoadoutProps {
  state: AppState;
  onHeroChange: (change: (current: AppState) => AppState | null) => void;
}

function costLine(skill: BattleSkill): string {
  const cost = skill.cost > 0 ? `Custa ${skill.cost}` : 'Grátis';
  return skill.cooldown > 0 ? `${cost} · recarga ${skill.cooldown}t` : cost;
}

/**
 * Escolha dos golpes da luta: até 5, mais Respirar Fundo, que vai sempre.
 * Os golpes da árvore aparecem bloqueados até o talento ser aprendido.
 */
export function SkillLoadout({ state, onHeroChange }: SkillLoadoutProps) {
  const { character } = state;
  const cls = character.characterClass;
  const chosen = loadoutIds(character);
  const unlocked = new Set(unlockedSkills(character).map((entry) => entry.id));
  const defend = defendSkillFor(cls);
  const all = [
    ...HERO_SKILLS[cls].filter((entry) => entry.id !== defend.id),
    ...TALENT_SKILLS[cls],
  ];
  const full = chosen.length >= LOADOUT_SIZE;

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>
        Na luta: {chosen.length} de {LOADOUT_SIZE}.{' '}
        {full ? 'Tire um golpe para pôr outro.' : 'Toque num golpe para levar.'}
      </Text>

      {all.map((skill) => {
        const open = unlocked.has(skill.id);
        const taking = chosen.includes(skill.id);
        const node = TALENT_TREES[cls].find((entry) => entry.unlocksSkill === skill.id);
        const blocked = !open || (!taking && full) || (taking && chosen.length <= 1);
        return (
          <Pressable
            key={skill.id}
            onPress={() => onHeroChange((current) => toggleLoadoutSkill(current, skill.id))}
            disabled={blocked}
            style={({ pressed }) => [
              styles.row,
              taking && styles.rowOn,
              !open && styles.rowLocked,
              pressed && styles.pressed,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: taking, disabled: blocked }}
            accessibilityLabel={`${skill.name}. ${skill.blurb}`}
          >
            <SkillIcon skillId={skill.id} size={48} />
            <View style={styles.copy}>
              <View style={styles.head}>
                <Text style={styles.name}>{skill.name}</Text>
                <Text style={[styles.state, taking && styles.stateOn]}>
                  {!open ? 'Bloqueado' : taking ? 'Levando' : 'Fora'}
                </Text>
              </View>
              <Text style={styles.blurb}>{skill.blurb}</Text>
              <Text style={styles.meta}>
                {open || !node
                  ? costLine(skill)
                  : `Libere na árvore: ${TALENT_BRANCH_LABELS[node.branch]}, nível ${node.minLevel}`}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <View style={[styles.row, styles.rowFixed]}>
        <SkillIcon skillId={defend.id} size={48} />
        <View style={styles.copy}>
          <View style={styles.head}>
            <Text style={styles.name}>{defend.name}</Text>
            <Text style={styles.state}>Sempre vai</Text>
          </View>
          <Text style={styles.blurb}>{defend.blurb}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  summary: { marginBottom: space.xs, fontSize: 14, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
  rowOn: { borderColor: colors.amber, backgroundColor: colors.amberWash },
  rowLocked: { opacity: 0.5 },
  rowFixed: { borderStyle: 'dashed' },
  copy: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  state: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stateOn: { color: colors.amberSoft },
  blurb: { fontSize: 13, lineHeight: 18, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.85 },
});
