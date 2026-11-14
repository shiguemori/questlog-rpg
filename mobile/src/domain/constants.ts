import type { AttributeKey, Attributes, Category, CharacterClass, Difficulty } from './types';

export const ATTRIBUTE_KEYS: AttributeKey[] = ['strength', 'intelligence', 'agility', 'vitality'];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  strength: 'Força',
  intelligence: 'Inteligência',
  agility: 'Agilidade',
  vitality: 'Vitalidade',
};

export const XP_REWARDS: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 25,
  HARD: 50,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  STUDY: 'Estudo',
  WORK: 'Trabalho',
  HEALTH: 'Saúde',
  HOME: 'Casa',
  OTHER: 'Outro',
};

export const CATEGORIES: Category[] = ['STUDY', 'WORK', 'HEALTH', 'HOME', 'OTHER'];

export const INITIAL_MAX_XP = 100;
export const XP_GROWTH_FACTOR = 1.5;
export const ATTRIBUTE_POINTS_PER_LEVEL = 2;

export const CLASS_DEFAULTS: Record<
  CharacterClass,
  { attributes: Attributes; label: string; blurb: string }
> = {
  WARRIOR: {
    attributes: { strength: 5, intelligence: 1, agility: 2, vitality: 4 },
    label: 'Guerreiro',
    blurb: 'Força e resistência para quests físicas.',
  },
  MAGE: {
    attributes: { strength: 1, intelligence: 5, agility: 2, vitality: 2 },
    label: 'Mago',
    blurb: 'Inteligência alta para estudo e foco.',
  },
  ROGUE: {
    attributes: { strength: 2, intelligence: 2, agility: 5, vitality: 2 },
    label: 'Ladino',
    blurb: 'Agilidade para rotinas rápidas e consistentes.',
  },
  ARCHER: {
    attributes: { strength: 2, intelligence: 2, agility: 5, vitality: 3 },
    label: 'Arqueiro',
    blurb: 'Mira certeira e críticos para metas bem definidas.',
  },
  DRUID: {
    attributes: { strength: 1, intelligence: 5, agility: 1, vitality: 4 },
    label: 'Druida',
    blurb: 'Cura e paciência para cuidar de si e da casa.',
  },
  BARD: {
    attributes: { strength: 1, intelligence: 5, agility: 3, vitality: 2 },
    label: 'Bardo',
    blurb: 'Música que anima você e cansa o monstro.',
  },
  MONK: {
    attributes: { strength: 2, intelligence: 2, agility: 2, vitality: 5 },
    label: 'Monge',
    blurb: 'Força interior: resiste, se cura e bate com calma.',
  },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
};
