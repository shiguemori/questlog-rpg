import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import {
  CLASS_OFFENSE,
  critChanceFor,
  defenseFor,
  dodgeChanceFor,
  heroMaxEnergy,
  heroMaxHp,
} from '../domain/battle';
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, CLASS_DEFAULTS } from '../domain/constants';
import { streakTitle } from '../domain/engagement';
import {
  ACHIEVEMENTS,
  heroRankForLevel,
  resetAttributePoints,
  spentAttributePoints,
} from '../domain/progression';
import { talentPointsLeft } from '../domain/talents';
import { canArmStreakShield } from '../domain/rewards';
import { localIsoDate } from '../domain/dates';
import type {
  Attributes,
  AppState,
  AttributeKey,
  CharacterClass,
  DailyGoalTarget,
  MusicVolume,
  PlayerSettings,
} from '../domain/types';
import { heroArtKey, heroLayers } from '../domain/loot';
import { useReducedMotion } from '../platform/feedback';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { CharacterArt } from './CharacterArt';
import { Backpack } from './hero/Backpack';
import { Bestiary } from './hero/Bestiary';
import { SkillLoadout } from './hero/SkillLoadout';
import { TalentTree } from './hero/TalentTree';
import { XpBar } from './XpBar';

type HeroTab =
  'ATTRIBUTES' | 'TALENTS' | 'SKILLS' | 'BACKPACK' | 'BESTIARY' | 'JOURNEY' | 'SETTINGS';

const TABS: readonly { id: HeroTab; label: string }[] = [
  { id: 'ATTRIBUTES', label: 'Atributos' },
  { id: 'TALENTS', label: 'Talentos' },
  { id: 'SKILLS', label: 'Golpes' },
  { id: 'BACKPACK', label: 'Mochila' },
  { id: 'BESTIARY', label: 'Bestiário' },
  { id: 'JOURNEY', label: 'Jornada' },
  { id: 'SETTINGS', label: 'Ajustes' },
];

const MUSIC_CHOICES: readonly { value: MusicVolume; label: string }[] = [
  { value: 0, label: 'Desligada' },
  { value: 0.3, label: 'Baixa' },
  { value: 0.6, label: 'Média' },
  { value: 1, label: 'Alta' },
];

export interface HeroSheetProps {
  visible: boolean;
  state: AppState;
  onClose: () => void;
  onSpendAttributePoint: (attribute: AttributeKey) => void;
  /** Talentos, loadout e reset de atributos (casos de uso que devolvem null quando não dá). */
  onHeroChange: (change: (current: AppState) => AppState | null) => void;
  onResetJourney: () => void;
  onRename: (name: string) => string | null;
  onChangeClass: (characterClass: CharacterClass) => void;
  onPatchSettings: (partial: Partial<PlayerSettings>) => void;
  onToggleShield: () => void;
  onShareWeek: () => void;
}

/**
 * Folha do herói: atributos (gasto de pontos do level up), estatísticas,
 * conquistas e reinício da jornada. Modal nativo — ocasional, sem motion próprio.
 */
/** O que o atributo faz na batalha, com o valor de agora. */
function attributeEffect(
  key: AttributeKey,
  attributes: Attributes,
  characterClass: CharacterClass,
): string {
  const main = CLASS_OFFENSE[characterClass] === key ? 'Ataque da sua classe. ' : '';
  switch (key) {
    case 'strength':
      return `${main}Dano dos golpes de Força.`;
    case 'intelligence':
      return `${main}Energia máxima ${heroMaxEnergy(attributes)}.`;
    case 'agility':
      return `${main}Crítico ${critChanceFor(attributes)}% · esquiva ${dodgeChanceFor(attributes)}%.`;
    default:
      return `Vida ${heroMaxHp(attributes)} · defesa ${defenseFor(attributes)}.`;
  }
}

export function HeroSheet({
  visible,
  state,
  onClose,
  onSpendAttributePoint,
  onHeroChange,
  onResetJourney,
  onRename,
  onChangeClass,
  onPatchSettings,
  onToggleShield,
  onShareWeek,
}: HeroSheetProps) {
  const [nameDraft, setNameDraft] = useState(state.character.name);
  const [formError, setFormError] = useState<string | null>(null);
  const today = localIsoDate(new Date());
  const shieldReady = canArmStreakShield(state.settings, today);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { character, stats } = state;
  const points = character.attributePoints;
  const classLabel = CLASS_DEFAULTS[character.characterClass].label;
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.isUnlocked(state)).length;
  const [tab, setTab] = useState<HeroTab>('ATTRIBUTES');
  const talentPoints = talentPointsLeft(character);
  const spent = spentAttributePoints(state);

  const confirmAttributeReset = () => {
    Alert.alert(
      'Devolver pontos?',
      'Os atributos voltam ao início da classe e os pontos voltam para você.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Devolver', onPress: () => onHeroChange(resetAttributePoints) },
      ],
    );
  };

  const confirmReset = () => {
    Alert.alert(
      'Reiniciar jornada?',
      'Seu herói, quests, XP e conquistas serão apagados deste aparelho. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar tudo', style: 'destructive', onPress: onResetJourney },
      ],
    );
  };

  const journey: { label: string; value: string }[] = [
    { label: 'XP total', value: String(stats.totalXpEarned) },
    { label: 'Quests concluídas', value: String(stats.totalQuestsCompleted) },
    { label: 'Streak atual', value: `${stats.streak}d` },
    ...(streakTitle(stats.streak)
      ? [{ label: 'Título do streak', value: streakTitle(stats.streak) as string }]
      : []),
    { label: 'Melhor streak', value: `${stats.bestStreak}d` },
  ];

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>Folha do herói</Text>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar folha do herói"
          >
            <Text style={styles.closeBtnText}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identity}>
            <View style={styles.portrait}>
              <CharacterArt
                assetKey={heroArtKey(character.characterClass, state.inventory)}
                layers={heroLayers(character.characterClass, state.inventory)}
                size={84}
                accessibilityLabel={`${classLabel} ${character.name}`}
              />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{character.name}</Text>
              <Text style={styles.rank}>
                {heroRankForLevel(character.level)} · {classLabel}
              </Text>
            </View>
          </View>
          <XpBar xp={character.xp} maxXp={character.maxXp} level={character.level} />

          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((entry) => {
              const selected = tab === entry.id;
              const count =
                entry.id === 'ATTRIBUTES' ? points : entry.id === 'TALENTS' ? talentPoints : 0;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setTab(entry.id)}
                  style={[styles.tab, selected && styles.tabOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    count > 0 ? `${entry.label}, ${count} para usar` : entry.label
                  }
                >
                  <Text style={[styles.tabText, selected && styles.tabTextOn]}>{entry.label}</Text>
                  {count > 0 ? <Text style={styles.tabCount}>{count}</Text> : null}
                </Pressable>
              );
            })}
          </View>

          {tab === 'ATTRIBUTES' ? (
            <View style={styles.panel}>
              <Text style={[styles.hint, points > 0 && styles.hintActive]}>
                {points > 0
                  ? `Você tem ${points} ${points === 1 ? 'ponto' : 'pontos'} para distribuir.`
                  : 'Suba de nível para ganhar pontos de atributo.'}
              </Text>
              <View style={styles.list}>
                {ATTRIBUTE_KEYS.map((key) => (
                  <View key={key} style={styles.attributeRow}>
                    <View style={styles.attributeCopy}>
                      <Text style={styles.attributeLabel}>{ATTRIBUTE_LABELS[key]}</Text>
                      <Text style={styles.attributeEffect}>
                        {attributeEffect(key, character.attributes, character.characterClass)}
                      </Text>
                    </View>
                    <Text style={styles.attributeValue} testID={`attribute-${key}`}>
                      {character.attributes[key]}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.plusBtn,
                        points <= 0 && styles.plusBtnDisabled,
                        pressed && styles.pressed,
                      ]}
                      disabled={points <= 0}
                      onPress={() => onSpendAttributePoint(key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Aumentar ${ATTRIBUTE_LABELS[key]}`}
                      accessibilityState={{ disabled: points <= 0 }}
                    >
                      <Text style={styles.plusBtnText}>+</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {spent > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                  onPress={confirmAttributeReset}
                  accessibilityRole="button"
                  accessibilityLabel="Devolver pontos de atributo"
                >
                  <Text style={styles.secondaryText}>
                    Devolver {spent} {spent === 1 ? 'ponto' : 'pontos'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {tab === 'TALENTS' ? (
            <View style={styles.panel}>
              <TalentTree state={state} onHeroChange={onHeroChange} />
            </View>
          ) : null}

          {tab === 'SKILLS' ? (
            <View style={styles.panel}>
              <SkillLoadout state={state} onHeroChange={onHeroChange} />
            </View>
          ) : null}

          {tab === 'BACKPACK' ? (
            <View style={styles.panel}>
              <Backpack state={state} onHeroChange={onHeroChange} />
            </View>
          ) : null}

          {tab === 'BESTIARY' ? (
            <View style={styles.panel}>
              <Bestiary state={state} />
            </View>
          ) : null}

          {tab === 'JOURNEY' ? (
            <View style={styles.panel}>
              <View style={styles.statGrid}>
                {journey.map((entry) => (
                  <View key={entry.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{entry.value}</Text>
                    <Text style={styles.statLabel}>{entry.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.section}>
                Conquistas {unlockedCount}/{ACHIEVEMENTS.length}
              </Text>
              <View style={styles.list}>
                {ACHIEVEMENTS.map((achievement) => {
                  const unlocked = achievement.isUnlocked(state);
                  return (
                    <View
                      key={achievement.id}
                      style={styles.achievementRow}
                      accessible
                      accessibilityLabel={`${achievement.title}. ${achievement.description} ${
                        unlocked ? 'Desbloqueada.' : 'Bloqueada.'
                      }`}
                    >
                      <View style={[styles.medal, unlocked && styles.medalUnlocked]} />
                      <View style={styles.achievementCopy}>
                        <Text style={[styles.achievementTitle, !unlocked && styles.locked]}>
                          {achievement.title}
                        </Text>
                        <Text style={styles.achievementDescription}>{achievement.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {tab === 'SETTINGS' ? (
            <View style={styles.panel}>
              <Text style={styles.sectionFirst}>Meta do dia</Text>
              <View style={styles.choiceRow}>
                {([1, 2, 3] as DailyGoalTarget[]).map((target) => {
                  const selected = state.settings.dailyGoalTarget === target;
                  return (
                    <Pressable
                      key={target}
                      onPress={() => onPatchSettings({ dailyGoalTarget: target })}
                      style={[styles.choice, selected && styles.choiceOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Meta de ${target} ${target === 1 ? 'quest' : 'quests'}`}
                    >
                      <Text style={styles.choiceText}>{target}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.section}>Lembrete</Text>
              <View style={styles.choiceRow}>
                {[7, 8, 12, 18, 21].map((hour) => {
                  const selected = state.settings.reminder?.hour === hour;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => onPatchSettings({ reminder: { hour, minute: 0 } })}
                      style={[styles.choice, selected && styles.choiceOn]}
                      accessibilityRole="button"
                      accessibilityLabel={`Lembrete às ${hour} horas`}
                    >
                      <Text style={styles.choiceText}>{hour}h</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => onPatchSettings({ reminder: null })}
                  style={[styles.choice, state.settings.reminder == null && styles.choiceOn]}
                  accessibilityRole="button"
                  accessibilityLabel="Desligar lembrete"
                >
                  <Text style={styles.choiceText}>Off</Text>
                </Pressable>
              </View>

              <Text style={styles.section}>Jogo</Text>
              <View style={styles.choiceRow}>
                <Pressable
                  onPress={() => onPatchSettings({ soundEnabled: !state.settings.soundEnabled })}
                  style={[styles.choice, state.settings.soundEnabled && styles.choiceOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: state.settings.soundEnabled }}
                >
                  <Text style={styles.choiceText}>
                    Som {state.settings.soundEnabled ? 'ligado' : 'desligado'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onToggleShield}
                  disabled={!shieldReady && !state.settings.streakShieldArmed}
                  style={[styles.choice, state.settings.streakShieldArmed && styles.choiceOn]}
                  accessibilityRole="button"
                >
                  <Text style={styles.choiceText}>
                    {state.settings.streakShieldArmed
                      ? 'Escudo armado'
                      : shieldReady
                        ? 'Armar escudo do mês'
                        : 'Escudo do mês usado'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.section}>Música da batalha</Text>
              <View style={styles.choiceRow}>
                {MUSIC_CHOICES.map((choice) => {
                  const selected = state.settings.musicVolume === choice.value;
                  return (
                    <Pressable
                      key={choice.label}
                      onPress={() => onPatchSettings({ musicVolume: choice.value })}
                      style={[styles.choice, selected && styles.choiceOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Música da batalha ${choice.label.toLowerCase()}`}
                    >
                      <Text style={styles.choiceText}>{choice.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.section}>Herói</Text>
              <View style={styles.inline}>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  style={[styles.input, styles.inputGrow]}
                  maxLength={24}
                  accessibilityLabel="Novo nome do herói"
                />
                <Pressable
                  style={styles.choice}
                  onPress={() => {
                    const message = onRename(nameDraft);
                    setFormError(message);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Salvar nome do herói"
                >
                  <Text style={styles.choiceText}>Salvar</Text>
                </Pressable>
              </View>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <View style={styles.choiceRow}>
                {(Object.keys(CLASS_DEFAULTS) as CharacterClass[]).map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => onChangeClass(key)}
                    style={[
                      styles.choice,
                      state.character.characterClass === key && styles.choiceOn,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: state.character.characterClass === key }}
                  >
                    <Text style={styles.choiceText}>{CLASS_DEFAULTS[key].label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.section}>Semana</Text>
              <View style={styles.choiceRow}>
                <Pressable style={styles.choice} onPress={onShareWeek} accessibilityRole="button">
                  <Text style={styles.choiceText}>Copiar resumo da semana</Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
                onPress={confirmReset}
                accessibilityRole="button"
                accessibilityLabel="Reiniciar jornada"
              >
                <Text style={styles.resetBtnText}>Reiniciar jornada</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.footer}>QuestLog v{appConfig.expo.version} · Shiguemori</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const TAB_PAD = 4;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingBottom: space.sm,
  },
  eyebrow: { fontSize: 13, fontWeight: '800', color: colors.amber },
  closeBtn: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  content: { paddingHorizontal: space.gutter, paddingTop: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  portrait: {
    width: 92,
    height: 92,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  identityCopy: { flex: 1 },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  rank: { marginTop: 2, fontSize: 14, fontWeight: '600', color: colors.amberSoft },

  // Grade 4 + 3: as 7 abas visíveis de uma vez (sem rolar e sem esconder "Ajustes").
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: TAB_PAD,
    marginVertical: space.lg,
    padding: TAB_PAD,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  tab: {
    flexBasis: '25%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 2,
    borderRadius: radius.md - TAB_PAD,
  },
  tabOn: { backgroundColor: colors.amber },
  tabText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  tabTextOn: { color: colors.bg },
  tabCount: {
    position: 'absolute',
    top: -6,
    right: -2,
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerBg,
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    overflow: 'hidden',
  },
  panel: { gap: space.md },

  section: { marginTop: space.lg, fontSize: 13, fontWeight: '800', color: colors.textMuted },
  sectionFirst: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  hint: { fontSize: 14, color: colors.textMuted },
  hintActive: { color: colors.amberSoft, fontWeight: '700' },
  list: { gap: space.xs },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
  },
  attributeCopy: { flex: 1, gap: 2, paddingVertical: space.sm },
  attributeLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  attributeEffect: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
  attributeValue: {
    minWidth: 32,
    textAlign: 'right',
    fontSize: 20,
    fontWeight: '800',
    color: colors.amberSoft,
    fontVariant: ['tabular-nums'],
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnDisabled: { backgroundColor: colors.bgElevated, opacity: 0.5 },
  plusBtnText: { fontSize: 22, lineHeight: 24, fontWeight: '800', color: colors.bg },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { marginTop: 2, fontSize: 12, fontWeight: '600', color: colors.textMuted },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  medal: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  medalUnlocked: { borderColor: colors.amber, backgroundColor: colors.amber },
  achievementCopy: { flex: 1 },
  achievementTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  achievementDescription: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  locked: { color: colors.textMuted },

  resetBtn: {
    marginTop: space.xl,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  footer: { marginTop: space.xl, textAlign: 'center', fontSize: 12, color: colors.textMuted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  choiceOn: { backgroundColor: colors.amberWash, borderWidth: 1, borderColor: colors.amber },
  choiceText: { fontSize: 14, fontWeight: '700', color: colors.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    color: colors.text,
    paddingHorizontal: space.md,
  },
  inputGrow: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
