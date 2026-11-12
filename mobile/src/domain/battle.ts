import { CLASS_DEFAULTS, DIFFICULTY_LABELS } from './constants';
import type { Category, Character, CharacterClass, Difficulty } from './types';
import { VILLAIN_BY_CATEGORY } from './victory';

/**
 * Contrato da batalha por turnos (estilo Game Boy).
 * Estado local e puro: a UI chama `startBattle`, `applyPlayerMove` e `applyEnemyMove`.
 * Arte final entra pelos `assetKey` — enquanto isso a tela desenha placeholder.
 */

export type BattleSide = 'PLAYER' | 'ENEMY';
export type BattleMoveEffect = 'DAMAGE' | 'HEAL' | 'GUARD';
export type BattlePhase = 'PLAYER_TURN' | 'ENEMY_TURN' | 'VICTORY' | 'DEFEAT';

export interface BattleMove {
  id: string;
  name: string;
  blurb: string;
  effect: BattleMoveEffect;
  /** Dano, cura ou percentual de guarda (0–100) do próximo golpe recebido. */
  power: number;
  /** Hook de arte. Ex.: `move.mage.burst`. */
  assetKey: string;
}

export interface BattleActor {
  id: string;
  name: string;
  /** Herói: classe. Monstro: dificuldade da quest. */
  subtitle: string;
  side: BattleSide;
  hp: number;
  maxHp: number;
  /** Percentual que reduz o próximo golpe. Zera depois de absorver um hit. */
  guard: number;
  attack: number;
  defense: number;
  moves: readonly BattleMove[];
  /** Hook de arte. Ex.: `hero.mage`, `enemy.study`. */
  assetKey: string;
}

export interface BattleLogEntry {
  id: string;
  text: string;
}

export interface BattleState {
  phase: BattlePhase;
  /** Golpes do herói já resolvidos. Começa em 0. */
  turn: number;
  hero: BattleActor;
  enemy: BattleActor;
  log: readonly BattleLogEntry[];
  lastPlayerMoveId: string | null;
  lastEnemyMoveId: string | null;
  /** Golpes do monstro já resolvidos. O próximo move sai daqui — sem aleatoriedade. */
  enemyTurns: number;
  /** Título da vitória, com a concordância do vilão. */
  victoryTitle: string;
}

export interface StartBattleInput {
  character: Character;
  category: Category;
  difficulty: Difficulty;
  heroName: string;
}

/** Atributo que vira ataque, por classe. Vitalidade vira HP e defesa. */
export const CLASS_OFFENSE: Record<CharacterClass, 'strength' | 'intelligence' | 'agility'> = {
  WARRIOR: 'strength',
  MAGE: 'intelligence',
  ROGUE: 'agility',
};

/** HP e ataque do monstro. A quest difícil dói mais; a fácil cabe num hábito. */
export const ENEMY_SCALE: Record<Difficulty, { hp: number; attack: number }> = {
  EASY: { hp: 30, attack: 2 },
  MEDIUM: { hp: 44, attack: 5 },
  HARD: { hp: 60, attack: 8 },
};

/** Depois deste número de golpes do herói, se o monstro segue de pé, a luta acaba. */
export const MAX_BATTLE_TURNS = 8;

const HERO_ASSET: Record<CharacterClass, string> = {
  WARRIOR: 'hero.warrior',
  MAGE: 'hero.mage',
  ROGUE: 'hero.rogue',
};

const ENEMY_ASSET: Record<Category, string> = {
  STUDY: 'enemy.study',
  WORK: 'enemy.work',
  HEALTH: 'enemy.health',
  HOME: 'enemy.home',
  OTHER: 'enemy.other',
};

function move(
  id: string,
  name: string,
  effect: BattleMoveEffect,
  power: number,
  blurb: string,
): BattleMove {
  return { id, name, effect, power, blurb, assetKey: `move.${id}` };
}

export const HERO_MOVES: Record<CharacterClass, readonly BattleMove[]> = {
  WARRIOR: [
    move('warrior.slash', 'Corte', 'DAMAGE', 8, 'Um corte firme.'),
    move('warrior.guard', 'Postura', 'GUARD', 50, 'Segura o próximo golpe.'),
    move('warrior.charge', 'Investida', 'DAMAGE', 14, 'Avança com tudo.'),
    move('warrior.breath', 'Fôlego', 'HEAL', 10, 'Recupera um pouco de HP.'),
  ],
  MAGE: [
    move('mage.spark', 'Faísca', 'DAMAGE', 7, 'Uma faísca rápida.'),
    move('mage.barrier', 'Barreira', 'GUARD', 55, 'Reduz o próximo golpe.'),
    move('mage.burst', 'Rajada', 'DAMAGE', 15, 'Magia em cheio.'),
    move('mage.heal', 'Cura', 'HEAL', 9, 'Recupera um pouco de HP.'),
  ],
  ROGUE: [
    move('rogue.stab', 'Punhalada', 'DAMAGE', 9, 'Golpe curto.'),
    move('rogue.dodge', 'Esquiva', 'GUARD', 45, 'Desvia o próximo golpe.'),
    move('rogue.low', 'Golpe baixo', 'DAMAGE', 13, 'Atinge em cheio.'),
    move('rogue.sip', 'Trago', 'HEAL', 7, 'Recupera um pouco de HP.'),
  ],
};

export const ENEMY_MOVES: Record<Category, readonly BattleMove[]> = {
  STUDY: [
    move('study.ping', 'Notificação', 'DAMAGE', 6, 'Puxa a atenção.'),
    move('study.tab', 'Aba nova', 'DAMAGE', 10, 'Abre mais uma distração.'),
    move('study.scroll', 'Rolagem', 'GUARD', 30, 'Escorrega do golpe.'),
    move('study.nap', 'Cochilo', 'HEAL', 6, 'Descansa um segundo.'),
  ],
  WORK: [
    move('work.rush', 'Urgência', 'DAMAGE', 7, 'Aperta o prazo.'),
    move('work.meeting', 'Reunião', 'DAMAGE', 11, 'Toma a hora inteira.'),
    move('work.protocol', 'Protocolo', 'GUARD', 35, 'Se esconde na regra.'),
    move('work.coffee', 'Café', 'HEAL', 6, 'Ganha um fôlego.'),
  ],
  HEALTH: [
    move('health.delay', 'Adiar', 'DAMAGE', 5, 'Empurra para depois.'),
    move('health.couch', 'Sofá', 'DAMAGE', 10, 'Puxa de volta.'),
    move('health.excuse', 'Desculpa', 'GUARD', 40, 'Arruma uma razão.'),
    move('health.snooze', 'Soneca', 'HEAL', 8, 'Fecha o olho.'),
  ],
  HOME: [
    move('home.pile', 'Pilha', 'DAMAGE', 6, 'Cresce no canto.'),
    move('home.clutter', 'Entulho', 'DAMAGE', 11, 'Ocupa a passagem.'),
    move('home.shove', 'Empurrar', 'GUARD', 30, 'Joga para debaixo.'),
    move('home.tidy', 'Recolher', 'HEAL', 5, 'Some um pouco.'),
  ],
  OTHER: [
    move('other.whisper', 'Sussurro', 'DAMAGE', 6, 'Fala baixo.'),
    move('other.claw', 'Garra', 'DAMAGE', 11, 'Arranha fundo.'),
    move('other.mist', 'Névoa', 'GUARD', 35, 'Some na frente.'),
    move('other.reform', 'Reforma', 'HEAL', 6, 'Se refaz.'),
  ],
};

export function heroBattleStats(character: Character): {
  maxHp: number;
  attack: number;
  defense: number;
} {
  const vitality = character.attributes.vitality;
  return {
    maxHp: 24 + vitality * 6,
    attack: character.attributes[CLASS_OFFENSE[character.characterClass]],
    defense: Math.floor(vitality / 2),
  };
}

/** Todo golpe causa pelo menos 1. Guarda reduz antes da defesa. */
export function battleDamage(
  power: number,
  attack: number,
  guardPercent: number,
  defense: number,
): number {
  const raw = power + attack;
  const guarded = guardPercent > 0 ? Math.floor((raw * (100 - guardPercent)) / 100) : raw;
  return Math.max(1, guarded - defense);
}

export function chooseEnemyMove(enemy: BattleActor, enemyTurns: number): BattleMove {
  const count = enemy.moves.length;
  for (let offset = 0; offset < count; offset += 1) {
    const candidate = enemy.moves[(enemyTurns + offset) % count];
    if (candidate.effect === 'HEAL' && enemy.hp >= enemy.maxHp) continue;
    if (candidate.effect === 'GUARD' && enemy.guard > 0) continue;
    return candidate;
  }
  return enemy.moves[0];
}

function copyMoves(moves: readonly BattleMove[]): BattleMove[] {
  return moves.map((entry) => ({ ...entry }));
}

function logEntries(key: string, texts: readonly string[]): BattleLogEntry[] {
  return texts.map((text, index) => ({ id: `${key}:${index}`, text }));
}

interface ResolvedMove {
  user: BattleActor;
  other: BattleActor;
  lines: string[];
}

function resolveMove(user: BattleActor, other: BattleActor, action: BattleMove): ResolvedMove {
  const lines = [`${user.name} usou ${action.name}.`];

  if (action.effect === 'DAMAGE') {
    const amount = battleDamage(action.power, user.attack, other.guard, other.defense);
    return {
      user,
      other: { ...other, hp: Math.max(0, other.hp - amount), guard: 0 },
      lines: [...lines, `${other.name} perde ${amount} de HP.`],
    };
  }

  if (action.effect === 'HEAL') {
    const amount = action.power + user.defense;
    const hp = Math.min(user.maxHp, user.hp + amount);
    const gained = hp - user.hp;
    return {
      user: { ...user, hp },
      other,
      lines: [
        ...lines,
        gained > 0
          ? `${user.name} recupera ${gained} de HP.`
          : `${user.name} já está com HP cheio.`,
      ],
    };
  }

  return {
    user: { ...user, guard: action.power },
    other,
    lines: [...lines, 'O próximo golpe vai doer menos.'],
  };
}

export function startBattle(input: StartBattleInput): BattleState {
  const stats = heroBattleStats(input.character);
  const scale = ENEMY_SCALE[input.difficulty];
  const villain = VILLAIN_BY_CATEGORY[input.category];
  const trimmed = input.heroName.trim();
  const heroName = trimmed.length > 0 ? trimmed : 'Herói';
  const hero: BattleActor = {
    id: 'hero',
    name: heroName,
    subtitle: CLASS_DEFAULTS[input.character.characterClass].label,
    side: 'PLAYER',
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    guard: 0,
    attack: stats.attack,
    defense: stats.defense,
    moves: copyMoves(HERO_MOVES[input.character.characterClass]),
    assetKey: HERO_ASSET[input.character.characterClass],
  };
  const enemy: BattleActor = {
    id: 'enemy',
    name: villain.name,
    subtitle: DIFFICULTY_LABELS[input.difficulty],
    side: 'ENEMY',
    hp: scale.hp,
    maxHp: scale.hp,
    guard: 0,
    attack: scale.attack,
    defense: 0,
    moves: copyMoves(ENEMY_MOVES[input.category]),
    assetKey: ENEMY_ASSET[input.category],
  };

  return {
    phase: 'PLAYER_TURN',
    turn: 0,
    hero,
    enemy,
    log: logEntries('open', [`${enemy.name} apareceu!`]),
    lastPlayerMoveId: null,
    lastEnemyMoveId: null,
    enemyTurns: 0,
    victoryTitle: villain.defeatedTitle,
  };
}

export function applyPlayerMove(state: BattleState, moveId: string): BattleState {
  if (state.phase !== 'PLAYER_TURN') return state;
  const action = state.hero.moves.find((entry) => entry.id === moveId);
  if (!action) return state;

  const resolved = resolveMove(state.hero, state.enemy, action);
  const turn = state.turn + 1;
  const lines = [...resolved.lines];
  let phase: BattlePhase = 'ENEMY_TURN';
  if (resolved.other.hp <= 0) {
    lines.push(state.victoryTitle);
    phase = 'VICTORY';
  }

  return {
    ...state,
    phase,
    turn,
    hero: resolved.user,
    enemy: resolved.other,
    log: [...state.log, ...logEntries(`p${turn}:${action.id}`, lines)],
    lastPlayerMoveId: action.id,
  };
}

export function applyEnemyMove(state: BattleState): BattleState {
  if (state.phase !== 'ENEMY_TURN') return state;

  const action = chooseEnemyMove(state.enemy, state.enemyTurns);
  const resolved = resolveMove(state.enemy, state.hero, action);
  const enemyTurns = state.enemyTurns + 1;
  const lines = [...resolved.lines];
  let phase: BattlePhase = 'PLAYER_TURN';
  if (resolved.other.hp <= 0) {
    lines.push(`${state.hero.name} caiu.`);
    phase = 'DEFEAT';
  } else if (state.turn >= MAX_BATTLE_TURNS) {
    lines.push(`${state.hero.name} não aguenta mais.`);
    phase = 'DEFEAT';
  }

  return {
    ...state,
    phase,
    hero: resolved.other,
    enemy: resolved.user,
    log: [...state.log, ...logEntries(`e${enemyTurns}:${action.id}`, lines)],
    lastEnemyMoveId: action.id,
    enemyTurns,
  };
}
