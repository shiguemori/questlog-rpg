
import { Difficulty, CharacterClass, Category } from './types';

export const XP_REWARDS = {
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 25,
  [Difficulty.HARD]: 50,
};

export const INITIAL_MAX_XP = 100;
export const XP_GROWTH_FACTOR = 1.5;

export const CATEGORY_COLORS = {
  [Category.STUDY]: 'bg-blue-500',
  [Category.WORK]: 'bg-purple-500',
  [Category.HEALTH]: 'bg-green-500',
  [Category.HOME]: 'bg-orange-500',
  [Category.OTHER]: 'bg-gray-500',
};

export const CLASS_DEFAULTS = {
  [CharacterClass.WARRIOR]: {
    attributes: { strength: 5, intelligence: 1, agility: 2, vitality: 4 },
    icon: '⚔️',
    description: 'A powerful fighter with high physical strength and endurance.'
  },
  [CharacterClass.MAGE]: {
    attributes: { strength: 1, intelligence: 5, agility: 2, vitality: 2 },
    icon: '🪄',
    description: 'A master of the arcane with brilliant intelligence but fragile health.'
  },
  [CharacterClass.ROGUE]: {
    attributes: { strength: 2, intelligence: 2, agility: 5, vitality: 2 },
    icon: '🗡️',
    description: 'Quick and nimble, excels in tasks requiring speed and precision.'
  }
};
