import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { XpBar } from '../components/XpBar';

/** Largura atual da faixa preenchida (ex.: "35%"). */
function fillWidth(): unknown {
  return StyleSheet.flatten(screen.getByTestId('xp-bar-fill').props.style).width;
}

async function finishAnimations() {
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
}

describe('XpBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('já nasce preenchida na proporção do XP, sem esperar medição ou animação', async () => {
    await render(<XpBar xp={10} maxXp={100} level={1} />);
    expect(fillWidth()).toBe('10%');
    expect(screen.getByText('10/100 XP')).toBeTruthy();
    expect(screen.getByText('Nv. 1')).toBeTruthy();
  });

  it('com 0 XP a faixa fica vazia', async () => {
    await render(<XpBar xp={0} maxXp={100} level={1} />);
    expect(fillWidth()).toBe('0%');
  });

  it('preenche ao ganhar XP (bug P0: barra não enchia ao completar quest)', async () => {
    const view = await render(<XpBar xp={0} maxXp={100} level={1} />);
    expect(fillWidth()).toBe('0%');

    await view.rerender(<XpBar xp={35} maxXp={100} level={1} />);
    expect(screen.getByText('35/100 XP')).toBeTruthy();
    await finishAnimations();
    expect(fillWidth()).toBe('35%');

    await view.rerender(<XpBar xp={85} maxXp={100} level={1} />);
    await finishAnimations();
    expect(fillWidth()).toBe('85%');
  });

  it('continua preenchida depois de re-renders sem mudança de XP', async () => {
    const view = await render(<XpBar xp={0} maxXp={100} level={1} />);
    await view.rerender(<XpBar xp={50} maxXp={100} level={1} />);
    await finishAnimations();
    await view.rerender(<XpBar xp={50} maxXp={100} level={1} />);
    await view.rerender(<XpBar xp={50} maxXp={100} level={1} />);
    await finishAnimations();
    expect(fillWidth()).toBe('50%');
  });

  it('no level up termina na fração do novo nível', async () => {
    const view = await render(<XpBar xp={80} maxXp={100} level={1} />);
    await view.rerender(<XpBar xp={30} maxXp={150} level={2} />);
    await finishAnimations();
    expect(fillWidth()).toBe('20%');
    expect(screen.getByText('Nv. 2')).toBeTruthy();
    expect(screen.getByText('30/150 XP')).toBeTruthy();
  });

  it('expõe o progresso para leitores de tela', async () => {
    await render(<XpBar xp={35} maxXp={100} level={2} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 35,
      text: 'Nível 2, 35 de 100 XP',
    });
  });

  it('nunca passa de 100% nem quebra com teto inválido', async () => {
    const view = await render(<XpBar xp={500} maxXp={100} level={1} />);
    expect(fillWidth()).toBe('100%');
    await view.rerender(<XpBar xp={10} maxXp={0} level={1} />);
    await finishAnimations();
    expect(fillWidth()).toBe('0%');
  });
});
