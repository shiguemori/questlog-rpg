import type { ImageSourcePropType } from 'react-native';

/**
 * Hooks de arte da batalha. A chave é o `assetKey` do ator (`hero.mage`, `enemy.study`).
 * Troque `null` por `require('../../assets/battle/hero-mage.png')` quando o arquivo existir.
 * Golpes usam `move.<id>` (ex.: `move.mage.burst`) e hoje aparecem só como texto.
 */
export const BATTLE_SPRITE_SOURCES: Record<string, ImageSourcePropType | null> = {
  'hero.warrior': null,
  'hero.mage': null,
  'hero.rogue': null,
  'enemy.study': null,
  'enemy.work': null,
  'enemy.health': null,
  'enemy.home': null,
  'enemy.other': null,
};

export const BATTLE_SPRITE_EMOJI: Record<string, string> = {
  'hero.warrior': '⚔️',
  'hero.mage': '🔮',
  'hero.rogue': '🗡️',
  'enemy.study': '📱',
  'enemy.work': '🌀',
  'enemy.health': '😴',
  'enemy.home': '🧹',
  'enemy.other': '🌑',
};
