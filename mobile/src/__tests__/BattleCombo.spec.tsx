/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('react-native-reanimated', () => {
  const { Text, View } = require('react-native');
  const easing = () => (value: number) => value;
  return {
    __esModule: true,
    default: { View, Text },
    Easing: {
      in: easing,
      out: easing,
      inOut: easing,
      quad: easing(),
      cubic: easing(),
      sin: easing(),
      linear: easing(),
    },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (value: unknown) => value,
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withRepeat: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    cancelAnimation: () => undefined,
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SkillDetail, SkillGrid } from '../components/battle/BattleHud';
import { skillArtFor, skillMotionFor } from '../components/battle/SkillCast';
import { DailyChallengesCard } from '../components/DailyChallengesCard';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HERO_SKILLS, startBattle, TALENT_SKILLS, type BattleActor } from '../domain/battle';
import { CLASS_DEFAULTS } from '../domain/constants';

function rogueBattle() {
  return startBattle({
    character: {
      name: 'Ana',
      characterClass: 'ROGUE',
      level: 3,
      xp: 0,
      maxXp: 100,
      attributes: { ...CLASS_DEFAULTS.ROGUE.attributes },
      attributePoints: 0,
    },
    category: 'WORK',
    difficulty: 'MEDIUM',
    heroName: 'Ana',
    seed: 7,
  });
}

describe('combo de habilidades', () => {
  it('destaca a Pegadinha quando o monstro está incomodado', async () => {
    const battle = rogueBattle();
    const props = { hero: battle.hero, disabled: false, onSkill: jest.fn(), onInspect: jest.fn() };
    const view = await render(<SkillGrid {...props} enemy={battle.enemy} />);
    expect(screen.queryByText(/^Combo /)).toBeNull();

    const poisoned: BattleActor = {
      ...battle.enemy,
      statuses: [{ id: 'POISON', turns: 2, potency: 3, stacks: 1 }],
    };
    await view.rerender(<SkillGrid {...props} enemy={poisoned} />);
    expect(screen.getAllByText(/^Combo /)).toHaveLength(1);
    expect(screen.getByLabelText('Usar Pegadinha').props.accessibilityHint).toMatch(
      /^Combo pronto/,
    );
  });

  it('a descrição diz com quem o golpe combina', async () => {
    const battle = rogueBattle();
    const venom = battle.hero.skills.find((entry) => entry.id === 'rogue.venom');
    if (!venom) throw new Error('sem Lembrete Chato');
    await render(
      <SkillDetail skill={venom} hero={battle.hero} enemy={battle.enemy} onClose={jest.fn()} />,
    );
    expect(screen.getByText('Combina com')).toBeTruthy();
    expect(screen.getByText('Pegadinha')).toBeTruthy();
  });
});

describe('arte das habilidades', () => {
  it('todo golpe das 7 classes tem ícone e movimento', () => {
    const all = [...Object.values(HERO_SKILLS).flat(), ...Object.values(TALENT_SKILLS).flat()];
    expect(Object.keys(HERO_SKILLS)).toHaveLength(7);
    for (const entry of all) {
      expect([entry.id, skillArtFor(entry.id) != null]).toEqual([entry.id, true]);
      expect([entry.id, skillMotionFor(entry.id) != null]).toEqual([entry.id, true]);
    }
  });
});

describe('desafios recolhíveis', () => {
  it('a seta recolhe e abre a lista', async () => {
    const onToggle = jest.fn();
    const challenges = {
      date: '2026-11-14',
      bonusClaimed: false,
      list: [
        {
          id: 'a',
          kind: 'WIN_FAST' as const,
          target: 1,
          progress: 0,
          reward: 'potion.water' as const,
        },
      ],
    };
    const view = await render(
      <DailyChallengesCard challenges={challenges} today="2026-11-14" onToggle={onToggle} />,
    );
    expect(screen.getByText(/Os três juntos/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('daily-challenges-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await view.rerender(
      <DailyChallengesCard
        challenges={challenges}
        today="2026-11-14"
        onToggle={onToggle}
        collapsed
      />,
    );
    expect(screen.getByText('Desafios de hoje')).toBeTruthy();
    expect(screen.queryByText(/Os três juntos/)).toBeNull();
  });
});

describe('escolha de classe', () => {
  it('mostra as 7 classes e o detalhe da escolhida', async () => {
    const onComplete = jest.fn();
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <OnboardingScreen onComplete={onComplete} />
      </SafeAreaProvider>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    await fireEvent.press(screen.getByLabelText('Bardo. Música que anima você e cansa o monstro.'));
    expect(screen.getByText('Música Chiclete')).toBeTruthy();
    expect(screen.getByText(/energia: Ritmo/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nome do herói'), 'Lia');
    await fireEvent.press(screen.getByText('Começar jornada'));
    expect(onComplete).toHaveBeenCalledWith('Lia', 'BARD');
  });
});
