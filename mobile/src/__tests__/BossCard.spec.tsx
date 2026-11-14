import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { BossCard } from '../components/BossCard';
import { playerVolume, trackFor } from '../platform/battleMusic';

const FRIDAY = new Date(2026, 10, 13, 12);

describe('cartão do chefe da semana', () => {
  it('mostra o progresso enquanto faltam vitórias, sem botão', async () => {
    await render(
      <BossCard
        boss={{ weekKey: '2026-11-09', wins: 2, beatenWeek: null, triedOn: null }}
        level={4}
        now={FRIDAY}
        onStart={jest.fn()}
      />,
    );
    expect(screen.getByText('Vença 3 lutas esta semana para enfrentar')).toBeTruthy();
    expect(screen.getByLabelText('2 de 5 vitórias esta semana')).toBeTruthy();
    expect(screen.queryByText('Enfrentar')).toBeNull();
  });

  it('libera o botão com as vitórias da semana', async () => {
    const onStart = jest.fn();
    await render(
      <BossCard
        boss={{ weekKey: '2026-11-09', wins: 5, beatenWeek: null, triedOn: null }}
        level={4}
        now={FRIDAY}
        onStart={onStart}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Enfrentar Procrastinação, chefe da semana'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('antes do nível mínimo avisa quando aparece', async () => {
    await render(
      <BossCard
        boss={{ weekKey: null, wins: 0, beatenWeek: null, triedOn: null }}
        level={1}
        now={FRIDAY}
        onStart={jest.fn()}
      />,
    );
    expect(screen.getByText('Aparece a partir do nível 3')).toBeTruthy();
  });
});

describe('trilha da batalha', () => {
  it('cada arena e o chefe têm trilha', () => {
    const keys = [
      'enemy.study',
      'enemy.work',
      'enemy.health',
      'enemy.home',
      'enemy.other',
      'enemy.boss',
    ];
    for (const key of keys) expect(trackFor(key)).not.toBeNull();
    expect(trackFor('enemy.unknown')).toBeNull();
  });

  it('volume desligado é zero e o alto fica abaixo dos efeitos', () => {
    expect(playerVolume(0)).toBe(0);
    expect(playerVolume(1)).toBeLessThan(0.5);
    expect(playerVolume(0.3)).toBeLessThan(playerVolume(0.6));
  });
});
