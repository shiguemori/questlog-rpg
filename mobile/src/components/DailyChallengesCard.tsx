import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  CHALLENGE_BONUS_FRAGMENTS,
  challengeText,
  isChallengeDone,
  type DailyChallenges,
} from '../domain/challenges';
import { POTIONS } from '../domain/loot';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { ITEM_ART } from './actorArt';

/**
 * Três desafios do dia, com o progresso e a recompensa de cada um.
 * Os desafios mudam à meia-noite. Sem desafios ainda (primeiro boot), não mostra nada.
 */
export function DailyChallengesCard({
  challenges,
  today,
}: {
  challenges: DailyChallenges;
  today: string;
}) {
  if (challenges.date !== today || challenges.list.length === 0) return null;
  const done = challenges.list.filter(isChallengeDone).length;
  const all = done === challenges.list.length;

  return (
    <View style={styles.card} testID="daily-challenges">
      <View style={styles.head}>
        <Text style={styles.title}>Desafios de hoje</Text>
        <Text
          style={styles.count}
          accessibilityLabel={`${done} de ${challenges.list.length} feitos`}
        >
          {done}/{challenges.list.length}
        </Text>
      </View>
      {challenges.list.map((challenge) => {
        const finished = isChallengeDone(challenge);
        const potion = POTIONS[challenge.reward];
        return (
          <View
            key={challenge.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${challengeText(challenge)}. ${
              finished ? 'Feito.' : `${challenge.progress} de ${challenge.target}.`
            } Recompensa: ${potion.name}.`}
          >
            <View style={[styles.box, finished && styles.boxDone]}>
              {finished ? <Text style={styles.tick}>✓</Text> : null}
            </View>
            <Text style={[styles.text, finished && styles.textDone]} numberOfLines={2}>
              {challengeText(challenge)}
            </Text>
            {challenge.target > 1 && !finished ? (
              <Text style={styles.progress}>
                {challenge.progress}/{challenge.target}
              </Text>
            ) : null}
            <Image
              source={ITEM_ART[potion.art]}
              style={[styles.reward, finished && styles.rewardDone]}
              resizeMode="contain"
            />
          </View>
        );
      })}
      <Text style={styles.footer}>
        {all
          ? challenges.bonusClaimed
            ? `Os três feitos: +${CHALLENGE_BONUS_FRAGMENTS} fragmentos na mochila.`
            : 'Os três feitos.'
          : `Os três juntos dão +${CHALLENGE_BONUS_FRAGMENTS} fragmentos. Só missão com XP conta.`}
      </Text>
    </View>
  );
}

const PAD = space.md;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.gutter,
    marginBottom: space.lg,
    padding: PAD,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 15, fontWeight: '900', color: colors.text },
  count: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.success, borderColor: colors.success },
  tick: { fontSize: 13, fontWeight: '900', color: colors.bg, lineHeight: 16 },
  text: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text },
  textDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  progress: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  reward: { width: 26, height: 26 },
  rewardDone: { opacity: 0.4 },
  footer: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
