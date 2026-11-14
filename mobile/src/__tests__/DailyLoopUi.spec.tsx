import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';
import { DailyChallengesCard } from '../components/DailyChallengesCard';
import { Backpack } from '../components/hero/Backpack';
import { Bestiary } from '../components/hero/Bestiary';
import { WeeklyRecap } from '../components/WeeklyRecap';
import { emptyBestiary } from '../domain/bestiary';
import { addLoot } from '../domain/loot';
import { startJourney } from '../domain/state';
import type { AppState } from '../domain/types';
import { emptyWeek } from '../domain/weekly';

const TODAY = '2026-11-13';

describe('desafios do dia', () => {
  it('mostra os três, o progresso e a recompensa dos três juntos', async () => {
    await render(
      <DailyChallengesCard
        today={TODAY}
        challenges={{
          date: TODAY,
          bonusClaimed: false,
          list: [
            {
              id: 'a',
              kind: 'COMPLETE_CATEGORY',
              category: 'HEALTH',
              target: 2,
              progress: 1,
              reward: 'potion.water',
            },
            { id: 'b', kind: 'WIN_NO_POTION', target: 1, progress: 1, reward: 'potion.coffee' },
            { id: 'c', kind: 'WIN_FAST', target: 1, progress: 0, reward: 'potion.water' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Desafios de hoje')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('Conclua 2 missões de Saúde')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText(/Os três juntos dão \+5 fragmentos/)).toBeTruthy();
  });

  it('desafios de outro dia não aparecem', async () => {
    await render(
      <DailyChallengesCard
        today={TODAY}
        challenges={{ date: '2026-11-12', bonusClaimed: false, list: [] }}
      />,
    );
    expect(screen.queryByTestId('daily-challenges')).toBeNull();
  });
});

describe('resumo da semana', () => {
  it('resume a semana e fecha', async () => {
    const onDismiss = jest.fn();
    const week = {
      ...emptyWeek('2026-11-09'),
      byCategory: { STUDY: 3, WORK: 0, HEALTH: 1, HOME: 0, OTHER: 0 },
      battlesWon: 4,
      bestStreak: 5,
      boss: { id: 'couch' as const, result: 'BEATEN' as const },
    };
    await render(<WeeklyRecap week={week} onDismiss={onDismiss} />);
    expect(screen.getByText('Sua semana · 9 a 15 de nov')).toBeTruthy();
    expect(screen.getByText('4 missões, mais em Estudo.')).toBeTruthy();
    expect(screen.getByText('Sedentarismo: vencida.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('weekly-recap-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

function BackpackHarness({ initial }: { initial: AppState }) {
  const [state, setState] = useState(initial);
  return (
    <Backpack
      state={state}
      onHeroChange={(change) => setState((current) => change(current) ?? current)}
    />
  );
}

describe('mochila', () => {
  it('escolhe a peça, aprimora com fragmentos e veste', async () => {
    const base = startJourney('Ana', 'MAGE');
    let inventory = addLoot(base.inventory, { type: 'GEAR', id: 'weapon.ember' });
    inventory = addLoot(inventory, { type: 'FRAGMENTS', amount: 6 });
    inventory = { ...inventory, equipped: { ...inventory.equipped, WEAPON: null } };
    await render(<BackpackHarness initial={{ ...base, inventory }} />);
    expect(screen.getByText('6 fragmentos')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('gear-weapon.ember'));
    expect(screen.getByText('Aprimorar para Raro · 5 fragmentos')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('gear-upgrade'));
    expect(screen.getByText('1 fragmentos')).toBeTruthy();
    expect(screen.getByText('Aprimorar para Épico · 10 fragmentos')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('gear-toggle'));
    expect(screen.getByText('Vestindo: +8% de dano.')).toBeTruthy();
  });
});

describe('bestiário', () => {
  it('mostra quem foi vencido e esconde o resto', async () => {
    const base = startJourney('Ana', 'ROGUE');
    const bestiary = {
      ...emptyBestiary(),
      defeats: { ...emptyBestiary().defeats, STUDY: 2 },
      traits: ['REFLECT' as const],
    };
    await render(<Bestiary state={{ ...base, bestiary }} />);
    expect(screen.getByText('1 de 9 vencidos')).toBeTruthy();
    expect(screen.getByText('Distração')).toBeTruthy();
    expect(screen.getByText('Resposta pronta: devolve parte do dano mágico')).toBeTruthy();
    expect(screen.getAllByText('???').length).toBe(8);
  });
});
