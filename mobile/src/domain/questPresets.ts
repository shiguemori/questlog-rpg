import type { Category, Difficulty } from './types';
import { XP_REWARDS } from './constants';

/** Contrato SDD — template de quest rápida (um toque). */
export interface QuestPreset {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  /** Rótulo curto no chip (sem emoji). */
  chip: string;
}

export const QUEST_PRESETS: readonly QuestPreset[] = [
  {
    id: 'study-25',
    title: 'Estudar 25min',
    category: 'STUDY',
    difficulty: 'MEDIUM',
    chip: 'Estudar',
  },
  {
    id: 'workout',
    title: 'Treino',
    category: 'HEALTH',
    difficulty: 'HARD',
    chip: 'Treino',
  },
  {
    id: 'water',
    title: 'Beber água',
    category: 'HEALTH',
    difficulty: 'EASY',
    chip: 'Água',
  },
  {
    id: 'walk',
    title: 'Caminhada 20min',
    category: 'HEALTH',
    difficulty: 'MEDIUM',
    chip: 'Caminhar',
  },
  {
    id: 'inbox',
    title: 'Limpar inbox',
    category: 'WORK',
    difficulty: 'EASY',
    chip: 'Inbox',
  },
  {
    id: 'home-tidy',
    title: 'Organizar a casa',
    category: 'HOME',
    difficulty: 'MEDIUM',
    chip: 'Casa',
  },
] as const;

export function presetXp(preset: QuestPreset): number {
  return XP_REWARDS[preset.difficulty];
}

export function findPreset(id: string): QuestPreset | undefined {
  return QUEST_PRESETS.find((p) => p.id === id);
}
