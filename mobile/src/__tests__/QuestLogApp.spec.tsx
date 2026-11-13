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
    },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (value: unknown) => value,
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withRepeat: (value: unknown) => value,
    cancelAnimation: () => undefined,
  };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import App, { QuestLogApp } from '../../App';
import { startJourney } from '../domain/state';
import type { AppState } from '../domain/types';
import {
  createMemoryStorage,
  createStateStore,
  STORAGE_KEY,
  type KeyValueStorage,
} from '../storage/stateStore';

// Reproduz o bug P0 do Expo Go: o pacote lança já no import quando o módulo nativo é nulo.
jest.mock('@react-native-async-storage/async-storage', () => {
  throw new Error('AsyncStorageError: Native module is null, cannot access legacy storage');
});

jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const START = new Date(2026, 10, 11, 9, 0, 0);

/**
 * Só o relógio do app é falso (setTimeout, setInterval, Date, animação).
 * setImmediate/nextTick/queueMicrotask ficam reais: com eles falsos, todo teste
 * depois do primeiro travava até o timeout no Node 22 (o do CI), embora passasse
 * no Node 24. Causa provável: o `act` do React guarda `timers.setImmediate` no
 * primeiro uso e fica preso ao relógio falso do teste anterior.
 */
function useAppFakeTimers() {
  jest.useFakeTimers({
    doNotFake: ['setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask'],
  });
  jest.setSystemTime(START);
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Luta até a tela de resultado usando o primeiro golpe liberado da lista
 * (energia e recarga). O monstro age no timer de 1 s.
 */
async function fightWith(...labels: string[]) {
  for (let step = 0; step < 16; step += 1) {
    if (screen.queryByLabelText('Fechar batalha')) return;
    const ready = labels.find(
      (label) => screen.getByLabelText(label).props.accessibilityState?.disabled !== true,
    );
    await fireEvent.press(screen.getByLabelText(ready ?? labels[labels.length - 1]));
    await advance(1200);
  }
  expect(screen.getByLabelText('Fechar batalha')).toBeTruthy();
}

const MAGE_PLAN = ['Usar Lista Riscada', 'Usar Café Fervendo', 'Usar Post-it'];
const WARRIOR_PLAN = ['Usar Faxina Final', 'Usar Playlist Animada', 'Usar Vassourada'];

/** Percentual preenchido da barra de XP do cabeçalho (0–100). */
function xpFillPercent(): number {
  const { width } = StyleSheet.flatten(screen.getAllByTestId('xp-bar-fill')[0].props.style);
  return Number.parseFloat(String(width));
}

async function readSave(storage: KeyValueStorage): Promise<AppState> {
  const raw = await storage.getItem(STORAGE_KEY);
  if (raw == null) throw new Error('nenhum save gravado');
  return JSON.parse(raw) as AppState;
}

/** Aperta o botão do Alert nativo pelo texto (ex.: "Concluir sem XP"). */
function pressAlertButton(alertSpy: jest.SpyInstance, text: string) {
  const call = alertSpy.mock.calls.at(-1);
  if (!call) throw new Error('nenhum Alert aberto');
  const buttons = (call[2] ?? []) as { text?: string; onPress?: () => void }[];
  const button = buttons.find((entry) => entry.text === text);
  if (!button) throw new Error(`botão "${text}" não encontrado no Alert`);
  button.onPress?.();
}

async function completeOnboarding(name: string) {
  await screen.findByText('Crie seu herói');
  await fireEvent.changeText(screen.getByLabelText('Nome do herói'), name);
  await fireEvent.press(screen.getByLabelText('Mago. Inteligência alta para estudo e foco.'));
  await fireEvent.press(screen.getByText('Começar jornada'));
}

describe('QuestLogApp — fluxo no aparelho', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    useAppFakeTimers();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('onboarding → quest → espera 1 min → conclui → XP sobe e a barra preenche → salva', async () => {
    const storage = createMemoryStorage();
    await render(<QuestLogApp store={createStateStore(storage)} />);

    // Validação do nome: erro explica onde e por quê.
    await screen.findByText('Crie seu herói');
    await fireEvent.press(screen.getByText('Começar jornada'));
    expect(screen.getByText('Dê um nome com pelo menos 2 letras para o seu herói.')).toBeTruthy();

    await completeOnboarding('Lucas');
    expect(screen.getByText('Lucas')).toBeTruthy();
    expect(screen.getByText('Aprendiz · Mago')).toBeTruthy();
    expect(screen.getByText('0/100 XP')).toBeTruthy();
    expect(xpFillPercent()).toBe(0);

    // Quest por atalho: aparece com o contador do anti-farm.
    await fireEvent.press(screen.getByLabelText('Adicionar quest Estudar 25min, mais 25 de XP'));
    expect(screen.getByText('Estudar 25min')).toBeTruthy();
    expect(screen.getByText('XP libera em 60s')).toBeTruthy();

    await advance(61_000);
    expect(screen.queryByText(/XP libera em/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Concluir quest Estudar 25min'));
    expect(alertSpy).not.toHaveBeenCalled();
    await fightWith(...MAGE_PLAN);
    expect(screen.getByText('Distração derrotada!')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Fechar batalha'));
    await advance(1000);

    expect(screen.getByText('25/100 XP')).toBeTruthy();
    expect(xpFillPercent()).toBeCloseTo(25, 5);
    expect(screen.getByText('XP hoje 1/10')).toBeTruthy();
    expect(screen.getByText('Streak 1d')).toBeTruthy();
    expect(screen.getByText('Conquista desbloqueada: Primeira vitória')).toBeTruthy();

    const saved = await readSave(storage);
    expect(saved.character.xp).toBe(25);
    expect(saved.quests[0].completed).toBe(true);
    expect(saved.stats.totalXpEarned).toBe(25);
  });

  it('concluir antes de 1 min pede confirmação e não dá XP (anti-farm preservado)', async () => {
    const storage = createMemoryStorage();
    await render(<QuestLogApp store={createStateStore(storage)} />);
    await completeOnboarding('Lucas');

    await fireEvent.press(screen.getByLabelText('Adicionar quest Treino, mais 50 de XP'));
    await advance(10_000);
    expect(screen.getByText('XP libera em 50s')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Concluir quest Treino'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Concluir sem XP?');
    // Enquanto o jogador não confirma, nada muda.
    expect(screen.queryByText('Quest marcada')).toBeNull();
    expect(screen.queryByLabelText('Usar Rajada')).toBeNull();

    await act(async () => {
      pressAlertButton(alertSpy, 'Concluir sem XP');
    });

    expect(screen.getByText('Quest marcada')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar cena de vitória'));
    await advance(1000);

    expect(screen.getByText('0/100 XP')).toBeTruthy();
    expect(xpFillPercent()).toBe(0);
    expect(screen.getByText('XP hoje 0/10')).toBeTruthy();
    expect(screen.getByText('Meta 1/1')).toBeTruthy();
    expect((await readSave(storage)).stats.totalXpEarned).toBe(0);
  });

  it('restaura o save, sobe de nível, mostra o level up e deixa gastar o ponto de atributo', async () => {
    const base = startJourney('Lucas', 'MAGE');
    const saved: AppState = {
      ...base,
      character: { ...base.character, xp: 90 },
      quests: [
        {
          id: 'q1',
          title: 'Maratona',
          category: 'HEALTH',
          difficulty: 'HARD',
          xp: 50,
          completed: false,
          createdAt: new Date(2026, 10, 10, 8, 0, 0).toISOString(),
          recurring: false,
        },
      ],
    };
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) });
    await render(<QuestLogApp store={createStateStore(storage)} />);

    await screen.findByText('Maratona');
    expect(screen.getByText('90/100 XP')).toBeTruthy();
    expect(xpFillPercent()).toBeCloseTo(90, 5);

    await fireEvent.press(screen.getByLabelText('Concluir quest Maratona'));
    // O próximo golpe do monstro não aparece; segurar um golpe mostra o texto inteiro.
    expect(screen.queryByText('Próximo golpe')).toBeNull();
    await fireEvent(screen.getByLabelText('Usar Post-it'), 'longPress');
    expect(screen.getByText('Toque para fechar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar detalhes da habilidade'));
    expect(screen.queryByText('Toque para fechar')).toBeNull();
    await fightWith(...MAGE_PLAN);
    expect(screen.getByText('Preguiça derrotada!')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar batalha'));

    expect(screen.getByText('Level up!')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continuar após level up'));
    await advance(1000);

    // 90 + 50 = 140 → nível 2 com 40/150: a barra recomeça, não fica estourada.
    expect(screen.getByText('40/150 XP')).toBeTruthy();
    expect(screen.getAllByText('Nv. 2').length).toBeGreaterThan(0);
    expect(xpFillPercent()).toBeCloseTo((40 / 150) * 100, 3);
    expect(screen.getByText('+2 pontos')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Abrir folha do herói Lucas'));
    expect(screen.getByText('Folha do herói')).toBeTruthy();
    expect(screen.getByText('Você tem 2 pontos para distribuir.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Aumentar Inteligência'));
    expect(screen.getByTestId('attribute-intelligence').props.children).toBe(6);
    expect(screen.getByText('Você tem 1 ponto para distribuir.')).toBeTruthy();

    await advance(10);
    const persisted = await readSave(storage);
    expect(persisted.character.level).toBe(2);
    expect(persisted.character.attributes.intelligence).toBe(6);
    expect(persisted.character.attributePoints).toBe(1);

    // Reset devolve o ponto gasto.
    await fireEvent.press(screen.getByLabelText('Devolver pontos de atributo'));
    await act(async () => pressAlertButton(alertSpy, 'Devolver'));
    expect(screen.getByTestId('attribute-intelligence').props.children).toBe(5);
    expect(screen.getByText('Você tem 2 pontos para distribuir.')).toBeTruthy();

    // Nível 2 dá 1 ponto de talento.
    await fireEvent.press(screen.getByLabelText('Talentos, 1 para usar'));
    expect(screen.getByText('1 ponto de talento para usar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Aprender Mão Firme'));
    expect(screen.getByText('Sem pontos agora. Cada nível dá mais um.')).toBeTruthy();

    // Loadout: tirar um golpe deixa a luta com 4 + Respirar Fundo.
    await fireEvent.press(screen.getByLabelText('Golpes'));
    expect(screen.getByText(/Na luta: 5 de 5/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Modo Avião\./));
    expect(screen.getByText(/Na luta: 4 de 5/)).toBeTruthy();

    await advance(10);
    const tuned = await readSave(storage);
    expect(tuned.character.talents).toEqual(['mage.attack.1']);
    expect(tuned.character.loadout).not.toContain('mage.frost');
  });

  it('excluir quest pede confirmação e remove da lista', async () => {
    const storage = createMemoryStorage();
    await render(<QuestLogApp store={createStateStore(storage)} />);
    await completeOnboarding('Lucas');
    await fireEvent.press(screen.getByLabelText('Adicionar quest Beber água, mais 10 de XP'));
    expect(screen.getByText('Beber água')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Excluir quest Beber água'));
    expect(alertSpy.mock.calls.at(-1)?.[0]).toBe('Excluir quest?');
    await act(async () => {
      pressAlertButton(alertSpy, 'Excluir');
    });

    expect(screen.queryByText('Beber água')).toBeNull();
    await advance(10);
    expect((await readSave(storage)).quests).toHaveLength(0);
  });

  it('quest personalizada: título vazio mostra o erro embaixo do campo', async () => {
    await render(<QuestLogApp store={createStateStore(createMemoryStorage())} />);
    await completeOnboarding('Lucas');

    await fireEvent.press(screen.getByLabelText('Criar quest personalizada'));
    await fireEvent.press(screen.getByLabelText('Registrar quest'));
    expect(screen.getByText('Dê um nome para a quest.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Título da quest'), 'Ler 10 páginas');
    await fireEvent.press(screen.getByLabelText('Registrar quest'));
    expect(screen.getByText('Ler 10 páginas')).toBeTruthy();
    expect(screen.queryByText('Registrar missão')).toBeNull();
  });

  it('pula o onboarding, fecha a meta do dia e desfaz a conclusão', async () => {
    const storage = createMemoryStorage();
    await render(<QuestLogApp store={createStateStore(storage)} />);

    await screen.findByText('O hábito cabe num minuto');
    await fireEvent.press(screen.getByLabelText('Pular e usar o herói padrão'));

    expect(screen.getByText('Herói')).toBeTruthy();
    expect(screen.getByText('Meta 0/1')).toBeTruthy();
    expect(screen.getByText('Uma quest hoje abre sua jornada. Isso basta.')).toBeTruthy();
    expect(screen.getByTestId('week-strip')).toBeTruthy();
    expect(screen.getByText('A semana começa com a quest de hoje.')).toBeTruthy();
    expect(screen.getByText('Mais 2 níveis para Aventureiro.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Adicionar quest Beber água, mais 10 de XP'));
    expect(screen.getByLabelText('Repetir a última quest Beber água')).toBeTruthy();

    await advance(61_000);
    await fireEvent.press(screen.getByLabelText('Concluir quest Beber água'));
    await fightWith(...WARRIOR_PLAN);
    expect(screen.getByText('Meta do dia cumprida. Amanhã basta uma quest.')).toBeTruthy();
    expect(screen.getByText('Preguiça derrotada!')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Desfazer esta conclusão'));
    expect(screen.queryByText('Preguiça derrotada!')).toBeNull();
    expect(screen.getByText('Meta 0/1')).toBeTruthy();
    expect(screen.getByText('0/100 XP')).toBeTruthy();
    expect(screen.getByText('Conclusão desfeita. XP e streak voltaram.')).toBeTruthy();

    await advance(10);
    const saved = await readSave(storage);
    expect(saved.character.name).toBe('Herói');
    expect(saved.quests[0].completed).toBe(false);
    expect(saved.stats.totalXpEarned).toBe(0);
    expect(saved.stats.streak).toBe(0);
  });
});

describe('App — armazenamento nativo ausente (bug P0 do Expo Go)', () => {
  beforeEach(() => {
    useAppFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('abre, joga e avisa que não está salvando — sem crash', async () => {
    await render(<App />);
    await completeOnboarding('Lucas');

    expect(screen.getByText('Lucas')).toBeTruthy();
    await advance(10);
    expect(screen.getByText(/O armazenamento do aparelho não respondeu/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Adicionar quest Treino, mais 50 de XP'));
    await advance(61_000);
    await fireEvent.press(screen.getByLabelText('Concluir quest Treino'));
    await fightWith(...MAGE_PLAN);
    await fireEvent.press(screen.getByLabelText('Fechar batalha'));
    await advance(1000);
    expect(screen.getByText('50/100 XP')).toBeTruthy();
  });
});
