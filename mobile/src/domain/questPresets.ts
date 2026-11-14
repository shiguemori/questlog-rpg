import type { Category, Difficulty } from './types';
import { XP_REWARDS } from './constants';

/** Contrato SDD — template de quest rápida (um toque). Pelo menos duas por categoria. */
export interface QuestPreset {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  /** Rótulo curto no chip (sem emoji). */
  chip: string;
}

export const QUEST_PRESETS: readonly QuestPreset[] = [
  { id: 'water', title: 'Beber água', category: 'HEALTH', difficulty: 'EASY', chip: 'Rápida' },
  {
    id: 'study-25',
    title: 'Estudar 25min',
    category: 'STUDY',
    difficulty: 'MEDIUM',
    chip: 'Estudar',
  },
  { id: 'workout', title: 'Treino', category: 'HEALTH', difficulty: 'HARD', chip: 'Treino' },
  {
    id: 'walk',
    title: 'Caminhada 20min',
    category: 'HEALTH',
    difficulty: 'MEDIUM',
    chip: 'Caminhar',
  },
  { id: 'inbox', title: 'Limpar inbox', category: 'WORK', difficulty: 'EASY', chip: 'Inbox' },
  {
    id: 'home-tidy',
    title: 'Organizar a casa',
    category: 'HOME',
    difficulty: 'MEDIUM',
    chip: 'Casa',
  },
  { id: 'read-10', title: 'Ler 10 páginas', category: 'STUDY', difficulty: 'EASY', chip: 'Ler' },
  {
    id: 'plan-day',
    title: 'Planejar o dia',
    category: 'WORK',
    difficulty: 'EASY',
    chip: 'Planejar',
  },
  { id: 'dishes', title: 'Lavar a louça', category: 'HOME', difficulty: 'EASY', chip: 'Louça' },
  { id: 'meditate', title: 'Meditar 5min', category: 'OTHER', difficulty: 'EASY', chip: 'Meditar' },
  {
    id: 'deep-work',
    title: 'Bloco de trabalho 50min',
    category: 'WORK',
    difficulty: 'HARD',
    chip: 'Foco',
  },
  {
    id: 'stretch',
    title: 'Alongar 10min',
    category: 'HEALTH',
    difficulty: 'EASY',
    chip: 'Alongar',
  },
  {
    id: 'review-notes',
    title: 'Revisar anotações',
    category: 'STUDY',
    difficulty: 'MEDIUM',
    chip: 'Revisar',
  },
  { id: 'laundry', title: 'Lavar roupa', category: 'HOME', difficulty: 'MEDIUM', chip: 'Roupa' },
  {
    id: 'call-someone',
    title: 'Ligar para alguém querido',
    category: 'OTHER',
    difficulty: 'EASY',
    chip: 'Ligar',
  },
  {
    id: 'offline-1h',
    title: '1h sem celular',
    category: 'OTHER',
    difficulty: 'MEDIUM',
    chip: 'Offline',
  },
] as const;

export function presetXp(preset: QuestPreset): number {
  return XP_REWARDS[preset.difficulty];
}

export function findPreset(id: string): QuestPreset | undefined {
  return QUEST_PRESETS.find((p) => p.id === id);
}
