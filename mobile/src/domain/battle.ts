import { CLASS_DEFAULTS, DIFFICULTY_LABELS } from './constants';
import type {
  AttributeKey,
  Attributes,
  Category,
  Character,
  CharacterClass,
  Difficulty,
} from './types';
import { MAX_POTIONS_PER_BATTLE, POTIONS, type PotionId, type PotionStock } from './loot';
import { VILLAIN_BY_CATEGORY } from './victory';

/**
 * Motor da batalha por turnos. Puro: a tela chama `startBattle`, `applyPlayerMove` e `applyEnemyMove`.
 *
 * O que faz a luta ter estratégia:
 * - cada classe tem habilidades próprias, que escalam com o atributo da classe;
 * - habilidades custam energia e têm recarga;
 * - status (queimadura, veneno, atordoar, fraqueza, fúria, esquiva, regeneração, guarda);
 * - o monstro mostra o próximo golpe (intenção) antes de agir;
 * - a vida do herói entra e sai da luta (ver `vitals.ts`).
 *
 * A sorte (crítico e esquiva) vem de um gerador com semente guardado no estado,
 * então a mesma semente sempre produz a mesma luta.
 */

export type BattleSide = 'PLAYER' | 'ENEMY';
export type BattlePhase = 'PLAYER_TURN' | 'ENEMY_TURN' | 'VICTORY' | 'DEFEAT';
export type SkillKind = 'PHYSICAL' | 'MAGIC' | 'SUPPORT';
export type StatusId =
  'BURN' | 'POISON' | 'STUN' | 'WEAKEN' | 'EMPOWER' | 'EVADE' | 'REGEN' | 'GUARD';
export type FxKind =
  | 'SLASH'
  | 'IMPACT'
  | 'FIRE'
  | 'ICE'
  | 'POISON'
  | 'ARCANE'
  | 'SHADOW'
  | 'SHIELD'
  | 'HEAL'
  | 'BUFF'
  | 'DEBUFF'
  | 'SMOKE';
export type SkillCondition = 'TARGET_LOW_HP' | 'TARGET_POISONED' | 'TARGET_BURNING';

export interface StatusEffect {
  id: StatusId;
  /** Turnos restantes do dono. Diminui no fim de cada turno dele. */
  turns: number;
  /** Dano/cura por turno ou percentual (guarda, fúria, fraqueza). */
  potency: number;
  /** Só o veneno acumula (máx. 3). */
  stacks: number;
}

export interface StatusApplication {
  status: StatusId;
  target: 'SELF' | 'TARGET';
  turns: number;
  /** Potência fixa + atributo × razão. */
  potency?: number;
  potencyRatio?: number;
}

export interface BattleSkill {
  id: string;
  name: string;
  /** Linha curta do botão. */
  tag: string;
  /** Descrição completa (leitor de tela e detalhe). */
  blurb: string;
  kind: SkillKind;
  /** Energia gasta. Monstros não têm energia. */
  cost: number;
  /** Turnos até poder usar de novo. 0 = sempre. */
  cooldown: number;
  /** Atributo que escala o golpe, o escudo, a cura e a potência dos status. */
  scaling: AttributeKey;
  /** Dano base (0 = habilidade sem dano). */
  power: number;
  ratio: number;
  hits?: number;
  heal?: { power: number; ratio: number };
  shield?: { power: number; ratio: number };
  applies?: readonly StatusApplication[];
  /** Fração do dano causado que volta como vida. */
  drain?: number;
  /** Bônus condicional (ex.: Execução contra alvo com pouca vida). */
  bonus?: { when: SkillCondition; multiplier: number; guaranteedCrit?: boolean };
  /** Pontos percentuais somados à chance de crítico. */
  critBonus?: number;
  /** Energia devolvida ao usar. */
  energyGain?: number;
  fx: FxKind;
  /** Hook de arte. Ex.: `skill.mage.fireball`. */
  assetKey: string;
}

export interface BattleActor {
  id: string;
  name: string;
  subtitle: string;
  side: BattleSide;
  hp: number;
  maxHp: number;
  shield: number;
  energy: number;
  maxEnergy: number;
  /** Nome da energia da classe (Disposição, Foco, Fôlego). */
  energyLabel: string;
  attributes: Attributes;
  defense: number;
  /** Chance de crítico em %. */
  critChance: number;
  /** Chance de esquivar golpe físico em %. */
  dodgeChance: number;
  /** Bônus de talento em % sobre todo dano causado. */
  damageBonus: number;
  /** Bônus de talento em % sobre os escudos. */
  shieldBonus: number;
  statuses: readonly StatusEffect[];
  cooldowns: Readonly<Record<string, number>>;
  skills: readonly BattleSkill[];
  /** Hook de arte. Ex.: `hero.mage`, `enemy.study`. */
  assetKey: string;
  /** Camadas da arte: por baixo (capa) e por cima (arma). */
  assetLayers?: { under: readonly string[]; over: readonly string[] };
  /** Só monstros: o jeito próprio de lutar (ver `ENEMY_TRAITS`). */
  trait?: EnemyTraitId;
  /** O traço que age uma vez por luta já agiu. */
  traitUsed?: boolean;
  /** Só chefes: qual deles (ver `BOSSES`). */
  bossId?: BossId;
  /** Vira duas tarefas: cada golpe sai em dois. */
  split?: boolean;
}

/**
 * Cada monstro tem um jeito próprio de lutar, que a placa mostra e o motor aplica
 * no começo do turno dele. Muda a melhor estratégia de cada luta.
 */
export type EnemyTraitId =
  | 'MORE_TABS'
  | 'PILE_UP'
  | 'LAZY_REGEN'
  | 'GROWS'
  | 'VANISH'
  /** Segundo jeito de cada cômodo (aparece a partir do nível 3). */
  | 'REFLECT'
  | 'SPLIT'
  | 'LATE_RAGE'
  | 'THORNS'
  | 'DISTRACT'
  /** Só o chefe: na metade da vida vira a fase 2 (golpes e arte novos). */
  | 'TWO_PHASES';

/** Monstro comum, de elite (mais forte, sempre deixa item) ou o chefe da semana. */
export type EnemyVariant = 'NORMAL' | 'ELITE' | 'BOSS';

export interface EnemyTrait {
  id: EnemyTraitId;
  name: string;
  /** Linha curta da placa. */
  hint: string;
  /** Explicação completa (leitor de tela e detalhe). */
  blurb: string;
}

export const ENEMY_TRAITS: Record<Category, EnemyTrait> = {
  STUDY: {
    id: 'MORE_TABS',
    name: 'Mais abas',
    hint: 'Fica mais forte na metade da vida',
    blurb: 'Com metade da vida, abre mais abas: +30% de dano por 2 turnos, uma vez por luta.',
  },
  WORK: {
    id: 'PILE_UP',
    name: 'Acumula',
    hint: '+10% de dano a cada turno',
    blurb: 'Cada turno que passa, o trabalho acumula: +10% de dano, até +40%. Termine rápido.',
  },
  HEALTH: {
    id: 'LAZY_REGEN',
    name: 'Espreguiça',
    hint: 'Se cura se você não atacar',
    blurb: 'Se o seu golpe não causar dano, a Preguiça recupera 8% da vida no turno dela.',
  },
  HOME: {
    id: 'GROWS',
    name: 'A pilha cresce',
    hint: 'Ganha escudo a cada 3 turnos',
    blurb: 'A cada 3 turnos, a pilha cresce e ganha escudo de 12% da vida máxima.',
  },
  OTHER: {
    id: 'VANISH',
    name: 'Some de vista',
    hint: 'Esquiva um golpe na metade da vida',
    blurb: 'Com metade da vida, some de vista e esquiva o próximo golpe, uma vez por luta.',
  },
};

/**
 * Segundo jeito de lutar de cada cômodo. A partir do nível 3, metade das lutas
 * vem com ele no lugar do primeiro (a semente decide).
 */
export const ENEMY_TRAITS_ALT: Record<Category, EnemyTrait> = {
  STUDY: {
    id: 'REFLECT',
    name: 'Resposta pronta',
    hint: 'Devolve parte do dano mágico',
    blurb:
      'Tem resposta para tudo: devolve 25% do dano mágico que recebe. Golpes físicos não voltam.',
  },
  WORK: {
    id: 'SPLIT',
    name: 'Vira duas tarefas',
    hint: 'Ataca 2 vezes na metade da vida',
    blurb: 'Com metade da vida, a tarefa se divide: cada golpe vira dois, de 60% do dano.',
  },
  HEALTH: {
    id: 'LATE_RAGE',
    name: 'Cansaço acumula',
    hint: 'Mais forte se a luta demorar',
    blurb: 'Depois do 5º turno dela, o cansaço pesa: +40% de dano até o fim da luta.',
  },
  HOME: {
    id: 'THORNS',
    name: 'Cacos no chão',
    hint: 'Devolve parte do dano físico',
    blurb: 'Bater na bagunça machuca: devolve 20% do dano físico que recebe. Magia não volta.',
  },
  OTHER: {
    id: 'DISTRACT',
    name: 'Puxa a atenção',
    hint: 'Rouba 2 de energia por turno',
    blurb: 'Toda vez que age, puxa sua atenção: você perde 2 de energia.',
  },
};

/** Segundo jeito só a partir deste nível. */
export const ALT_TRAIT_MIN_LEVEL = 3;
export const ALT_TRAIT_CHANCE = 0.5;
/** Quanto do dano volta em Resposta pronta (magia) e Cacos no chão (físico). */
export const REFLECT_PCT = 25;
export const THORNS_PCT = 20;
/** Vira duas tarefas: cada golpe vira dois, com este percentual do dano. */
export const SPLIT_DAMAGE_PCT = 60;
export const LATE_RAGE_TURN = 5;
export const LATE_RAGE_BONUS = 40;
export const DISTRACT_ENERGY = 2;

/** Chefes da semana, em rodízio (ver `boss.ts`). */
export type BossId = 'procrastination' | 'clutter' | 'couch' | 'meeting';

export interface BossDef {
  id: BossId;
  name: string;
  /** Cômodo do chefe: arena-base, música e categoria do bestiário. */
  home: Category;
  assetKey: string;
  skills: readonly BattleSkill[];
  phase2Skills: readonly BattleSkill[];
  trait: EnemyTrait;
  /** Linha do registro quando vira a fase 2. */
  phaseLine: string;
  /** Faixa grande da tela na fase 2. */
  phaseBanner: string;
  /** Uma frase para o bestiário. */
  lore: string;
}

export interface BattleLogEntry {
  id: string;
  text: string;
}

export type BattleEventKind =
  | 'CAST'
  | 'DAMAGE'
  | 'MISS'
  | 'HEAL'
  | 'SHIELD'
  | 'STATUS'
  | 'TICK'
  | 'SKIP'
  | 'KO'
  /** O jeito próprio do monstro agiu (ver `ENEMY_TRAITS`). `skillName` traz o nome. */
  | 'TRAIT'
  /** Energia recuperada (poção de café). */
  | 'ENERGY';

/** O que a tela anima depois de cada ação. `seq` cresce sempre. */
export interface BattleEvent {
  seq: number;
  kind: BattleEventKind;
  /** Quem sofre o efeito. */
  target: BattleSide;
  /** Quem causou. */
  source: BattleSide;
  amount?: number;
  crit?: boolean;
  status?: StatusId;
  fx?: FxKind;
  skillName?: string;
  /** Só no CAST: qual habilidade, para a tela escolher a animação dela. */
  skillId?: string;
}

export interface BattleState {
  phase: BattlePhase;
  /** Turnos do herói já resolvidos (inclui turno perdido por atordoamento). */
  turn: number;
  hero: BattleActor;
  enemy: BattleActor;
  log: readonly BattleLogEntry[];
  lastPlayerMoveId: string | null;
  lastEnemyMoveId: string | null;
  enemyTurns: number;
  /** Próximo golpe do monstro, mostrado ao herói. */
  enemyIntentId: string | null;
  /** Eventos da última ação, para animar. */
  events: readonly BattleEvent[];
  eventSeq: number;
  /** Estado do gerador aleatório (uint32). */
  rng: number;
  victoryTitle: string;
  variant: EnemyVariant;
  /** Poções na mochila no começo da luta (ver `loot.ts`). */
  potions: PotionStock;
  /** Poções gastas nesta luta. A tela desconta da mochila no fim. */
  potionsUsed: PotionStock;
}

export interface StartBattleInput {
  character: Character;
  category: Category;
  difficulty: Difficulty;
  heroName: string;
  /** Vida com que o herói entra. Padrão: cheia. */
  heroHp?: number;
  /** Semente da sorte. Padrão fixo, para testes. */
  seed?: number;
  /** Habilidades levadas para a luta (ver `talents.ts`). Padrão: `HERO_SKILLS`. */
  skills?: readonly BattleSkill[];
  /** Bônus passivos da árvore de talentos e do equipamento. */
  bonus?: Partial<HeroBonus>;
  /** Padrão: NORMAL. No chefe, `category` só escolhe a arena. */
  variant?: EnemyVariant;
  /** Poções disponíveis. Padrão: nenhuma. */
  potions?: Partial<PotionStock>;
  /** Chapéu vestido (`cap`, `crown`…). Muda só a arte do herói. */
  heroLook?: string | null;
  /** Capa e arma vestidas (camadas da arte). */
  heroLayers?: { under: readonly string[]; over: readonly string[] };
  /** Chefe desta semana. Padrão: Procrastinação. */
  bossId?: BossId;
  /** Jeito do monstro (ver `rollEnemyTrait`). Padrão: o primeiro do cômodo. */
  trait?: EnemyTraitId;
}

/** Bônus passivos que a árvore de talentos dá ao herói. */
export interface HeroBonus {
  damagePct: number;
  maxHp: number;
  critChance: number;
  shieldPct: number;
  maxEnergy: number;
}

export const NO_BONUS: HeroBonus = {
  damagePct: 0,
  maxHp: 0,
  critChance: 0,
  shieldPct: 0,
  maxEnergy: 0,
};

/** Limite de turnos do herói. Com a vida guardada, a luta pode durar mais que antes. */
export const MAX_BATTLE_TURNS = 12;
/** O chefe tem mais vida: a luta pode ir mais longe. */
export const BOSS_MAX_TURNS = 18;

export function turnLimitFor(state: Pick<BattleState, 'variant'>): number {
  return state.variant === 'BOSS' ? BOSS_MAX_TURNS : MAX_BATTLE_TURNS;
}
export const ENERGY_REGEN_PER_TURN = 3;
export const CRIT_MULTIPLIER = 1.5;
export const POISON_MAX_STACKS = 3;

export const STATUS_LABELS: Record<StatusId, string> = {
  BURN: 'Fervendo',
  POISON: 'Incomodado',
  STUN: 'Travado',
  WEAKEN: 'Cansado',
  EMPOWER: 'Animado',
  EVADE: 'Esquiva',
  REGEN: 'Descansando',
  GUARD: 'Guarda',
};

/** Status ruins para quem carrega. Os outros são bônus. */
export const HARMFUL_STATUSES: readonly StatusId[] = ['BURN', 'POISON', 'STUN', 'WEAKEN'];

/** Atributo que vira ataque, por classe. Vitalidade vira vida e defesa. */
export const CLASS_OFFENSE: Record<CharacterClass, AttributeKey> = {
  WARRIOR: 'strength',
  MAGE: 'intelligence',
  ROGUE: 'agility',
};

export const CLASS_ENERGY_LABEL: Record<CharacterClass, string> = {
  WARRIOR: 'Disposição',
  MAGE: 'Foco',
  ROGUE: 'Fôlego',
};

/** Vida base do monstro e atributos por dificuldade. Sobem com o nível do herói. */
export const ENEMY_SCALE: Record<Difficulty, { hp: number; attributes: Attributes }> = {
  EASY: { hp: 30, attributes: { strength: 2, intelligence: 2, agility: 2, vitality: 2 } },
  MEDIUM: { hp: 46, attributes: { strength: 4, intelligence: 4, agility: 3, vitality: 3 } },
  HARD: { hp: 50, attributes: { strength: 4, intelligence: 4, agility: 4, vitality: 4 } },
};
export const ENEMY_HP_PER_LEVEL = 7;
/**
 * A cada quantos níveis do herói o monstro ganha +1 em força, inteligência e vitalidade.
 * O difícil começa mais baixo e sobe mais rápido: dá para vencer no nível 1 e segue
 * exigindo estratégia depois (ver `scripts/simulate-battles.ts`).
 */
export const ENEMY_LEVEL_STEP: Record<Difficulty, number> = { EASY: 2, MEDIUM: 1.5, HARD: 1 };

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

type SkillSpec = Omit<BattleSkill, 'assetKey' | 'cost' | 'cooldown' | 'power' | 'ratio'> &
  Partial<Pick<BattleSkill, 'cost' | 'cooldown' | 'power' | 'ratio'>>;

function skill(spec: SkillSpec): BattleSkill {
  return {
    cost: 0,
    cooldown: 0,
    power: 0,
    ratio: 0,
    ...spec,
    assetKey: `skill.${spec.id}`,
  };
}

/** Monstro de elite: mais vida e atributos. Sempre deixa item (ver `loot.ts`). */
export const ELITE_HP_MULTIPLIER = 1.25;
export const ELITE_ATTRIBUTE_BONUS = 1;
/** Chance de um monstro médio ou difícil vir de elite, a partir do nível 2. */
export const ELITE_CHANCE = 0.12;
export const ELITE_MIN_LEVEL = 2;

/** Chefe da semana: luta mais longa, com duas fases. `BOSS_NAME` = o primeiro do rodízio. */
export const BOSS_NAME = 'Procrastinação';
export const BOSS_HP_MULTIPLIER = 2.1;
export const BOSS_PHASE2_HEAL_PCT = 10;
export const BOSS_PHASE2_DAMAGE_BONUS = 15;

/** Defender existe para todas as classes: segura o próximo golpe e recupera energia. */
function defendSkill(classKey: string): BattleSkill {
  return skill({
    id: `${classKey}.defend`,
    name: 'Respirar Fundo',
    tag: 'Guarda 50% · +3 energia',
    blurb: 'Respira fundo: o próximo golpe recebido dói metade e você recupera 3 de energia.',
    kind: 'SUPPORT',
    scaling: 'vitality',
    applies: [{ status: 'GUARD', target: 'SELF', turns: 1, potency: 50 }],
    energyGain: 3,
    fx: 'SHIELD',
  });
}

export const HERO_SKILLS: Record<CharacterClass, readonly BattleSkill[]> = {
  WARRIOR: [
    skill({
      id: 'warrior.strike',
      name: 'Vassourada',
      tag: 'Dano físico · grátis',
      blurb: 'Uma vassourada firme. Escala com Força.',
      kind: 'PHYSICAL',
      scaling: 'strength',
      power: 5,
      ratio: 1.3,
      fx: 'SLASH',
    }),
    skill({
      id: 'warrior.bash',
      name: 'Chinelada',
      tag: 'Trava 1 turno',
      blurb: 'Arremessa o chinelo e o monstro fica travado, perdendo a próxima ação.',
      kind: 'PHYSICAL',
      cost: 5,
      cooldown: 3,
      scaling: 'strength',
      power: 6,
      ratio: 0.9,
      applies: [{ status: 'STUN', target: 'TARGET', turns: 1 }],
      fx: 'IMPACT',
    }),
    skill({
      id: 'warrior.warcry',
      name: 'Playlist Animada',
      tag: 'Animado +40% dano · 3t',
      blurb: 'Bota a música favorita: +40% de dano nos próximos 3 turnos.',
      kind: 'SUPPORT',
      cost: 4,
      cooldown: 4,
      scaling: 'strength',
      applies: [{ status: 'EMPOWER', target: 'SELF', turns: 3, potency: 40 }],
      fx: 'BUFF',
    }),
    skill({
      id: 'warrior.wall',
      name: 'Tampa de Panela',
      tag: 'Escudo · escala Vitalidade',
      blurb: 'Usa a tampa da panela como escudo. Absorve dano igual a 6 + 2,5 × Vitalidade.',
      kind: 'SUPPORT',
      cost: 4,
      cooldown: 2,
      scaling: 'vitality',
      shield: { power: 6, ratio: 2.5 },
      fx: 'SHIELD',
    }),
    skill({
      id: 'warrior.execute',
      name: 'Faxina Final',
      tag: 'Dobro com vida ≤35%',
      blurb: 'Arremate da faxina. Causa o dobro de dano se o monstro tiver 35% de vida ou menos.',
      kind: 'PHYSICAL',
      cost: 7,
      cooldown: 2,
      scaling: 'strength',
      power: 8,
      ratio: 1.3,
      bonus: { when: 'TARGET_LOW_HP', multiplier: 2 },
      fx: 'SLASH',
    }),
    defendSkill('warrior'),
  ],
  MAGE: [
    skill({
      id: 'mage.spark',
      name: 'Post-it',
      tag: 'Dano mental · grátis',
      blurb: 'Cola um lembrete certeiro. Escala com Inteligência e ignora metade da defesa.',
      kind: 'MAGIC',
      scaling: 'intelligence',
      power: 4,
      ratio: 1.0,
      fx: 'ARCANE',
    }),
    skill({
      id: 'mage.fireball',
      name: 'Café Fervendo',
      tag: 'Fervendo por 3 turnos',
      blurb: 'Café quente demais: dano e fervura por 3 turnos. A fervura escala com Inteligência.',
      kind: 'MAGIC',
      cost: 6,
      cooldown: 2,
      scaling: 'intelligence',
      power: 5,
      ratio: 1.0,
      applies: [{ status: 'BURN', target: 'TARGET', turns: 3, potency: 2, potencyRatio: 0.4 }],
      fx: 'FIRE',
    }),
    skill({
      id: 'mage.frost',
      name: 'Modo Avião',
      tag: 'Trava 1 turno',
      blurb: 'Corta as notificações e o monstro fica travado, perdendo a próxima ação.',
      kind: 'MAGIC',
      cost: 6,
      cooldown: 3,
      scaling: 'intelligence',
      power: 3,
      ratio: 0.8,
      applies: [{ status: 'STUN', target: 'TARGET', turns: 1 }],
      fx: 'ICE',
    }),
    skill({
      id: 'mage.barrier',
      name: 'Agenda em Dia',
      tag: 'Escudo · escala Inteligência',
      blurb: 'Tudo planejado: escudo que absorve 3 + 1,6 × Inteligência de dano.',
      kind: 'SUPPORT',
      cost: 4,
      cooldown: 2,
      scaling: 'intelligence',
      shield: { power: 3, ratio: 1.6 },
      fx: 'SHIELD',
    }),
    skill({
      id: 'mage.meteor',
      name: 'Lista Riscada',
      tag: '+50% em alvo fervendo',
      blurb: 'Risca a lista inteira. Causa 50% a mais se o monstro estiver fervendo.',
      kind: 'MAGIC',
      cost: 9,
      cooldown: 3,
      scaling: 'intelligence',
      power: 7,
      ratio: 1.25,
      bonus: { when: 'TARGET_BURNING', multiplier: 1.5 },
      fx: 'ARCANE',
    }),
    defendSkill('mage'),
  ],
  ROGUE: [
    skill({
      id: 'rogue.stab',
      name: 'Atalho',
      tag: '+15% crítico · rouba vida',
      blurb:
        'Acha o caminho mais curto: 15 pontos a mais de chance de crítico e recupera 25% do dano como vida. Escala com Agilidade.',
      kind: 'PHYSICAL',
      scaling: 'agility',
      power: 6,
      ratio: 1.0,
      critBonus: 15,
      drain: 0.25,
      fx: 'SLASH',
    }),
    skill({
      id: 'rogue.venom',
      name: 'Lembrete Chato',
      tag: 'Incomoda · acumula até 3x',
      blurb: 'Lembrete que não para de tocar: incomoda por 3 turnos. Cada uso soma mais um, até 3.',
      kind: 'PHYSICAL',
      cost: 4,
      scaling: 'agility',
      power: 3,
      ratio: 0.6,
      applies: [{ status: 'POISON', target: 'TARGET', turns: 3, potency: 3, potencyRatio: 0.6 }],
      fx: 'POISON',
    }),
    skill({
      id: 'rogue.smoke',
      name: 'Sair de Fininho',
      tag: 'Esquiva o próximo golpe',
      blurb: 'Some sem ninguém ver. O próximo golpe do monstro erra.',
      kind: 'SUPPORT',
      cost: 5,
      cooldown: 3,
      scaling: 'agility',
      applies: [{ status: 'EVADE', target: 'SELF', turns: 1 }],
      fx: 'SMOKE',
    }),
    skill({
      id: 'rogue.backstab',
      name: 'Pegadinha',
      tag: 'Crítico certo se incomodado',
      blurb: 'Pega o monstro de surpresa. Sempre crítico se ele estiver incomodado.',
      kind: 'PHYSICAL',
      cost: 7,
      cooldown: 2,
      scaling: 'agility',
      power: 7,
      ratio: 1.6,
      bonus: { when: 'TARGET_POISONED', multiplier: 1, guaranteedCrit: true },
      fx: 'SHADOW',
    }),
    skill({
      id: 'rogue.flurry',
      name: 'Multitarefa',
      tag: '3 golpes · cada um pode critar',
      blurb: 'Três coisas ao mesmo tempo. Cada golpe rola crítico separado.',
      kind: 'PHYSICAL',
      cost: 6,
      cooldown: 3,
      scaling: 'agility',
      power: 2,
      ratio: 0.7,
      hits: 3,
      fx: 'SLASH',
    }),
    defendSkill('rogue'),
  ],
};

/**
 * Habilidades liberadas pela árvore de talentos (ver `talents.ts`).
 * Ficam fora de `HERO_SKILLS` porque o herói começa sem elas.
 */
export const TALENT_SKILLS: Record<CharacterClass, readonly BattleSkill[]> = {
  WARRIOR: [
    skill({
      id: 'warrior.mop',
      name: 'Esfregão Giratório',
      tag: '2 golpes',
      blurb: 'Gira o esfregão e acerta duas vezes. Cada golpe pode critar. Escala com Força.',
      kind: 'PHYSICAL',
      cost: 4,
      cooldown: 2,
      scaling: 'strength',
      power: 3,
      ratio: 0.8,
      hits: 2,
      fx: 'SLASH',
    }),
    skill({
      id: 'warrior.lunchbox',
      name: 'Marmita Caprichada',
      tag: 'Cura · escala Vitalidade',
      blurb: 'Pausa para comer bem: recupera 6 + 1,5 × Vitalidade de vida.',
      kind: 'SUPPORT',
      cost: 5,
      cooldown: 3,
      scaling: 'vitality',
      heal: { power: 6, ratio: 1.5 },
      fx: 'HEAL',
    }),
    skill({
      id: 'warrior.alarm',
      name: 'Despertador',
      tag: 'Deixa o monstro cansado',
      blurb: 'Toca o despertador na orelha do monstro: dano e −30% de dano dele por 2 turnos.',
      kind: 'PHYSICAL',
      cost: 4,
      cooldown: 3,
      scaling: 'strength',
      power: 4,
      ratio: 0.7,
      applies: [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 30 }],
      fx: 'IMPACT',
    }),
    skill({
      id: 'warrior.vacuum',
      name: 'Aspirador Turbo',
      tag: 'Golpe enorme · +50% com vida ≤35%',
      blurb:
        'Liga o aspirador no máximo: 12 + 1,8 × Força de dano, 50% a mais se o monstro tiver 35% de vida ou menos.',
      kind: 'PHYSICAL',
      cost: 10,
      cooldown: 4,
      scaling: 'strength',
      power: 12,
      ratio: 1.8,
      bonus: { when: 'TARGET_LOW_HP', multiplier: 1.5 },
      fx: 'IMPACT',
    }),
  ],
  MAGE: [
    skill({
      id: 'mage.highlighter',
      name: 'Marca-Texto',
      tag: 'Dano mental · +25% crítico',
      blurb:
        'Destaca o ponto fraco: 25 pontos a mais de chance de crítico. Escala com Inteligência.',
      kind: 'MAGIC',
      cost: 3,
      cooldown: 1,
      scaling: 'intelligence',
      power: 5,
      ratio: 1.1,
      critBonus: 25,
      fx: 'ARCANE',
    }),
    skill({
      id: 'mage.tea',
      name: 'Chá de Camomila',
      tag: 'Descansando 3 turnos',
      blurb:
        'Uma xícara calma: recupera 3 + 0,6 × Inteligência de vida a cada turno, por 3 turnos.',
      kind: 'SUPPORT',
      cost: 4,
      cooldown: 4,
      scaling: 'intelligence',
      applies: [{ status: 'REGEN', target: 'SELF', turns: 3, potency: 3, potencyRatio: 0.6 }],
      fx: 'HEAL',
    }),
    skill({
      id: 'mage.pomodoro',
      name: 'Pomodoro',
      tag: '+6 energia · Animado 2t',
      blurb: '25 minutos de foco: recupera 6 de energia e ganha +30% de dano por 2 turnos.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'intelligence',
      energyGain: 6,
      applies: [{ status: 'EMPOWER', target: 'SELF', turns: 2, potency: 30 }],
      fx: 'BUFF',
    }),
    skill({
      id: 'mage.allnighter',
      name: 'Virada de Estudo',
      tag: 'Golpe enorme · você cansa',
      blurb:
        'Estuda a noite toda: 10 + 2 × Inteligência de dano mental, mas você fica cansado (−30% de dano) por 1 turno.',
      kind: 'MAGIC',
      cost: 11,
      cooldown: 4,
      scaling: 'intelligence',
      power: 10,
      ratio: 2,
      applies: [{ status: 'WEAKEN', target: 'SELF', turns: 1, potency: 30 }],
      fx: 'ARCANE',
    }),
  ],
  ROGUE: [
    skill({
      id: 'rogue.coupon',
      name: 'Cupom Relâmpago',
      tag: 'Rouba vida',
      blurb:
        'Leva vantagem na hora certa: dano e metade dele volta como vida. Escala com Agilidade.',
      kind: 'PHYSICAL',
      cost: 4,
      cooldown: 2,
      scaling: 'agility',
      power: 5,
      ratio: 1.1,
      drain: 0.5,
      fx: 'SHADOW',
    }),
    skill({
      id: 'rogue.umbrella',
      name: 'Guarda-Chuva',
      tag: 'Escudo · escala Agilidade',
      blurb: 'Abre o guarda-chuva na hora: escudo que absorve 4 + 1,4 × Agilidade de dano.',
      kind: 'SUPPORT',
      cost: 4,
      cooldown: 2,
      scaling: 'agility',
      shield: { power: 4, ratio: 1.4 },
      fx: 'SHIELD',
    }),
    skill({
      id: 'rogue.energy',
      name: 'Energético',
      tag: '+5 energia · Animado 2t',
      blurb: 'Uma lata gelada: recupera 5 de energia e ganha +30% de dano por 2 turnos.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'agility',
      energyGain: 5,
      applies: [{ status: 'EMPOWER', target: 'SELF', turns: 2, potency: 30 }],
      fx: 'BUFF',
    }),
    skill({
      id: 'rogue.delivery',
      name: 'Entrega Expressa',
      tag: '4 golpes · incomoda',
      blurb:
        'Quatro entregas seguidas, cada uma pode critar, e o monstro fica incomodado por 3 turnos.',
      kind: 'PHYSICAL',
      cost: 10,
      cooldown: 4,
      scaling: 'agility',
      power: 3,
      ratio: 0.8,
      hits: 4,
      applies: [{ status: 'POISON', target: 'TARGET', turns: 3, potency: 3, potencyRatio: 0.4 }],
      fx: 'POISON',
    }),
  ],
};

/** Respirar Fundo da classe: fica sempre na luta, fora do loadout. */
export function defendSkillFor(characterClass: CharacterClass): BattleSkill {
  return HERO_SKILLS[characterClass][HERO_SKILLS[characterClass].length - 1];
}

export const ENEMY_SKILLS: Record<Category, readonly BattleSkill[]> = {
  STUDY: [
    skill({
      id: 'study.ping',
      name: 'Notificação',
      tag: 'Dano mágico',
      blurb: 'Puxa a atenção. Tem chance alta de crítico.',
      kind: 'MAGIC',
      scaling: 'intelligence',
      power: 5,
      ratio: 1,
      critBonus: 10,
      fx: 'ARCANE',
    }),
    skill({
      id: 'study.scroll',
      name: 'Rolagem Infinita',
      tag: 'Deixa você cansado',
      blurb: 'Você fica cansado por 2 turnos: −30% de dano.',
      kind: 'MAGIC',
      cooldown: 3,
      scaling: 'intelligence',
      power: 2,
      ratio: 0.5,
      applies: [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 30 }],
      fx: 'DEBUFF',
    }),
    skill({
      id: 'study.tabs',
      name: 'Abas Novas',
      tag: '2 golpes',
      blurb: 'Abre duas distrações seguidas.',
      kind: 'MAGIC',
      cooldown: 2,
      scaling: 'intelligence',
      power: 3,
      ratio: 0.6,
      hits: 2,
      fx: 'IMPACT',
    }),
    skill({
      id: 'study.nap',
      name: 'Modo Soneca',
      tag: 'Cura',
      blurb: 'Recupera vida.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'intelligence',
      heal: { power: 6, ratio: 1 },
      fx: 'HEAL',
    }),
  ],
  WORK: [
    skill({
      id: 'work.rush',
      name: 'Urgência',
      tag: 'Dano físico',
      blurb: 'Aperta o prazo.',
      kind: 'PHYSICAL',
      scaling: 'strength',
      power: 5,
      ratio: 1,
      fx: 'IMPACT',
    }),
    skill({
      id: 'work.meeting',
      name: 'Reunião Surpresa',
      tag: 'Trava você',
      blurb: 'Você perde a próxima ação.',
      kind: 'PHYSICAL',
      cooldown: 4,
      scaling: 'strength',
      power: 3,
      ratio: 0.6,
      applies: [{ status: 'STUN', target: 'TARGET', turns: 1 }],
      fx: 'IMPACT',
    }),
    skill({
      id: 'work.deadline',
      name: 'Prazo Apertado',
      tag: 'Estresse 3 turnos',
      blurb: 'O estresse ferve por 3 turnos.',
      kind: 'MAGIC',
      cooldown: 3,
      scaling: 'strength',
      power: 3,
      ratio: 0.5,
      applies: [{ status: 'BURN', target: 'TARGET', turns: 3, potency: 2, potencyRatio: 0.3 }],
      fx: 'FIRE',
    }),
    skill({
      id: 'work.overtime',
      name: 'Hora Extra',
      tag: 'Animado',
      blurb: 'O caos ganha +40% de dano por 2 turnos.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'strength',
      applies: [{ status: 'EMPOWER', target: 'SELF', turns: 2, potency: 40 }],
      fx: 'BUFF',
    }),
  ],
  HEALTH: [
    skill({
      id: 'health.couch',
      name: 'Sofá Macio',
      tag: 'Dano físico',
      blurb: 'Puxa você de volta.',
      kind: 'PHYSICAL',
      scaling: 'strength',
      power: 4,
      ratio: 1,
      fx: 'IMPACT',
    }),
    skill({
      id: 'health.snooze',
      name: 'Soneca',
      tag: 'Regenera 3 turnos',
      blurb: 'Recupera vida a cada turno por 3 turnos.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'vitality',
      applies: [{ status: 'REGEN', target: 'SELF', turns: 3, potency: 3, potencyRatio: 0.5 }],
      fx: 'HEAL',
    }),
    skill({
      id: 'health.excuse',
      name: 'Desculpa Pronta',
      tag: 'Escudo',
      blurb: 'Arruma uma razão e absorve dano.',
      kind: 'SUPPORT',
      cooldown: 3,
      scaling: 'vitality',
      shield: { power: 5, ratio: 1.5 },
      fx: 'SHIELD',
    }),
    skill({
      id: 'health.heavy',
      name: 'Peso nas Pernas',
      tag: 'Deixa você cansado',
      blurb: 'Você fica cansado por 2 turnos: −30% de dano.',
      kind: 'MAGIC',
      cooldown: 3,
      scaling: 'intelligence',
      power: 2,
      ratio: 0.4,
      applies: [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 30 }],
      fx: 'DEBUFF',
    }),
  ],
  HOME: [
    skill({
      id: 'home.pile',
      name: 'Pilha de Roupa',
      tag: 'Dano físico',
      blurb: 'Cresce no canto e cai em cima.',
      kind: 'PHYSICAL',
      scaling: 'strength',
      power: 5,
      ratio: 1,
      fx: 'IMPACT',
    }),
    skill({
      id: 'home.dust',
      name: 'Poeira',
      tag: 'Alergia 3 turnos',
      blurb: 'Poeira que dá alergia e incomoda por 3 turnos.',
      kind: 'MAGIC',
      cooldown: 2,
      scaling: 'intelligence',
      power: 2,
      ratio: 0.4,
      applies: [{ status: 'POISON', target: 'TARGET', turns: 3, potency: 2, potencyRatio: 0.3 }],
      fx: 'POISON',
    }),
    skill({
      id: 'home.avalanche',
      name: 'Avalanche',
      tag: 'Dano pesado',
      blurb: 'Tudo desaba de uma vez.',
      kind: 'PHYSICAL',
      cooldown: 3,
      scaling: 'strength',
      power: 7,
      ratio: 1.2,
      fx: 'IMPACT',
    }),
    skill({
      id: 'home.rug',
      name: 'Debaixo do Tapete',
      tag: 'Esquiva',
      blurb: 'Se esconde. Seu próximo golpe erra.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'agility',
      applies: [{ status: 'EVADE', target: 'SELF', turns: 1 }],
      fx: 'SMOKE',
    }),
  ],
  OTHER: [
    skill({
      id: 'other.claw',
      name: 'Garra Sombria',
      tag: 'Dano físico',
      blurb: 'Arranha fundo.',
      kind: 'PHYSICAL',
      scaling: 'strength',
      power: 5,
      ratio: 1,
      fx: 'SHADOW',
    }),
    skill({
      id: 'other.whisper',
      name: 'Sussurro',
      tag: 'Deixa você cansado',
      blurb: 'Você fica cansado por 2 turnos: −30% de dano.',
      kind: 'MAGIC',
      cooldown: 3,
      scaling: 'intelligence',
      power: 2,
      ratio: 0.4,
      applies: [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 30 }],
      fx: 'DEBUFF',
    }),
    skill({
      id: 'other.drain',
      name: 'Drenar',
      tag: 'Rouba vida',
      blurb: 'Causa dano e recupera metade como vida.',
      kind: 'MAGIC',
      cooldown: 2,
      scaling: 'intelligence',
      power: 4,
      ratio: 0.9,
      drain: 0.5,
      fx: 'SHADOW',
    }),
    skill({
      id: 'other.mist',
      name: 'Névoa',
      tag: 'Esquiva',
      blurb: 'Some na névoa. Seu próximo golpe erra.',
      kind: 'SUPPORT',
      cooldown: 4,
      scaling: 'agility',
      applies: [{ status: 'EVADE', target: 'SELF', turns: 1 }],
      fx: 'SMOKE',
    }),
  ],
};

/** Fase 1 do chefe: adia, cansa e se esconde atrás de desculpas. */
export const BOSS_SKILLS: readonly BattleSkill[] = [
  skill({
    id: 'boss.snooze',
    name: 'Soneca do Despertador',
    tag: 'Dano físico',
    blurb: 'Bate o despertador na sua cabeça.',
    kind: 'PHYSICAL',
    scaling: 'strength',
    power: 5,
    ratio: 0.9,
    fx: 'IMPACT',
  }),
  skill({
    id: 'boss.later',
    name: 'Depois Eu Faço',
    tag: 'Deixa você cansado',
    blurb: 'Você fica cansado por 2 turnos: −35% de dano.',
    kind: 'MAGIC',
    cooldown: 3,
    scaling: 'intelligence',
    power: 2,
    ratio: 0.4,
    applies: [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 35 }],
    fx: 'DEBUFF',
  }),
  skill({
    id: 'boss.video',
    name: 'Só Mais um Vídeo',
    tag: 'Trava você',
    blurb: 'Você perde a próxima ação.',
    kind: 'MAGIC',
    cooldown: 5,
    scaling: 'intelligence',
    power: 2,
    ratio: 0.5,
    applies: [{ status: 'STUN', target: 'TARGET', turns: 1 }],
    fx: 'ARCANE',
  }),
  skill({
    id: 'boss.excuse',
    name: 'Desculpa Perfeita',
    tag: 'Escudo',
    blurb: 'Arruma a desculpa perfeita e absorve dano.',
    kind: 'SUPPORT',
    cooldown: 4,
    scaling: 'vitality',
    shield: { power: 6, ratio: 1.6 },
    fx: 'SHIELD',
  }),
];

/** Fase 2: o alarme dispara e tudo fica para a última hora. */
export const BOSS_PHASE2_SKILLS: readonly BattleSkill[] = [
  skill({
    id: 'boss.alarm',
    name: 'Alarme Estridente',
    tag: '2 golpes',
    blurb: 'Toca duas vezes, sem parar.',
    kind: 'MAGIC',
    scaling: 'intelligence',
    power: 3,
    ratio: 0.55,
    hits: 2,
    fx: 'ARCANE',
  }),
  skill({
    id: 'boss.deadline',
    name: 'Prazo Estourado',
    tag: 'Estresse 3 turnos',
    blurb: 'O estresse ferve por 3 turnos.',
    kind: 'MAGIC',
    cooldown: 3,
    scaling: 'intelligence',
    power: 3,
    ratio: 0.5,
    applies: [{ status: 'BURN', target: 'TARGET', turns: 3, potency: 2, potencyRatio: 0.3 }],
    fx: 'FIRE',
  }),
  skill({
    id: 'boss.panic',
    name: 'Pânico da Última Hora',
    tag: 'Dano pesado',
    blurb: 'Tudo de uma vez, no último minuto.',
    kind: 'PHYSICAL',
    cooldown: 3,
    scaling: 'strength',
    power: 7,
    ratio: 1.15,
    fx: 'IMPACT',
  }),
  BOSS_SKILLS[0],
];

/** Molde dos chefes: mesmo ritmo da Procrastinação, golpes e status próprios. */
function bossKit(
  prefix: string,
  names: {
    basic: [string, string];
    stun: [string, string];
    debuff: [string, string, 'WEAKEN' | 'POISON'];
    guard: [string, string, 'SHIELD' | 'REGEN'];
    double: [string, string];
    dot: [string, string, 'BURN' | 'POISON' | 'WEAKEN'];
    heavy: [string, string];
  },
): { skills: BattleSkill[]; phase2: BattleSkill[] } {
  const basic = skill({
    id: `${prefix}.basic`,
    name: names.basic[0],
    tag: 'Dano físico',
    blurb: names.basic[1],
    kind: 'PHYSICAL',
    scaling: 'strength',
    power: 5,
    ratio: 0.9,
    fx: 'IMPACT',
  });
  const debuffStatus = names.debuff[2];
  const debuff = skill({
    id: `${prefix}.debuff`,
    name: names.debuff[0],
    tag: debuffStatus === 'WEAKEN' ? 'Deixa você cansado' : 'Incômodo 3 turnos',
    blurb: names.debuff[1],
    kind: 'MAGIC',
    cooldown: 3,
    scaling: 'intelligence',
    power: 2,
    ratio: 0.4,
    applies:
      debuffStatus === 'WEAKEN'
        ? [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 35 }]
        : [{ status: 'POISON', target: 'TARGET', turns: 3, potency: 2, potencyRatio: 0.25 }],
    fx: debuffStatus === 'WEAKEN' ? 'DEBUFF' : 'POISON',
  });
  const stun = skill({
    id: `${prefix}.stun`,
    name: names.stun[0],
    tag: 'Trava você',
    blurb: names.stun[1],
    kind: 'MAGIC',
    cooldown: 5,
    scaling: 'intelligence',
    power: 2,
    ratio: 0.5,
    applies: [{ status: 'STUN', target: 'TARGET', turns: 1 }],
    fx: 'ARCANE',
  });
  const guard =
    names.guard[2] === 'SHIELD'
      ? skill({
          id: `${prefix}.guard`,
          name: names.guard[0],
          tag: 'Escudo',
          blurb: names.guard[1],
          kind: 'SUPPORT',
          cooldown: 4,
          scaling: 'vitality',
          shield: { power: 6, ratio: 1.6 },
          fx: 'SHIELD',
        })
      : skill({
          id: `${prefix}.guard`,
          name: names.guard[0],
          tag: 'Se cura 3 turnos',
          blurb: names.guard[1],
          kind: 'SUPPORT',
          cooldown: 4,
          scaling: 'vitality',
          applies: [{ status: 'REGEN', target: 'SELF', turns: 3, potency: 3, potencyRatio: 0.5 }],
          fx: 'HEAL',
        });
  const double = skill({
    id: `${prefix}.double`,
    name: names.double[0],
    tag: '2 golpes',
    blurb: names.double[1],
    kind: 'MAGIC',
    scaling: 'intelligence',
    power: 3,
    ratio: 0.55,
    hits: 2,
    fx: 'ARCANE',
  });
  const dotStatus = names.dot[2];
  const dot = skill({
    id: `${prefix}.dot`,
    name: names.dot[0],
    tag:
      dotStatus === 'BURN'
        ? 'Estresse 3 turnos'
        : dotStatus === 'POISON'
          ? 'Incômodo 3 turnos'
          : 'Deixa você cansado',
    blurb: names.dot[1],
    kind: 'MAGIC',
    cooldown: 3,
    scaling: 'intelligence',
    power: 3,
    ratio: 0.5,
    applies:
      dotStatus === 'WEAKEN'
        ? [{ status: 'WEAKEN', target: 'TARGET', turns: 2, potency: 35 }]
        : [{ status: dotStatus, target: 'TARGET', turns: 3, potency: 2, potencyRatio: 0.3 }],
    fx: dotStatus === 'BURN' ? 'FIRE' : dotStatus === 'POISON' ? 'POISON' : 'DEBUFF',
  });
  const heavy = skill({
    id: `${prefix}.heavy`,
    name: names.heavy[0],
    tag: 'Dano pesado',
    blurb: names.heavy[1],
    kind: 'PHYSICAL',
    cooldown: 3,
    scaling: 'strength',
    power: 7,
    ratio: 1.15,
    fx: 'IMPACT',
  });
  return { skills: [basic, debuff, stun, guard], phase2: [double, dot, heavy, basic] };
}

const CLUTTER_KIT = bossKit('clutter', {
  basic: ['Pilha de Roupa', 'Joga a pilha de roupa em cima de você.'],
  debuff: ['Nuvem de Poeira', 'A poeira incomoda por 3 turnos.', 'POISON'],
  stun: ['Peça no Chão', 'Você pisa numa peça de montar e perde a próxima ação.'],
  guard: ['Muralha de Caixas', 'Se esconde atrás das caixas e absorve dano.', 'SHIELD'],
  double: ['Avalanche de Caixas', 'Caixas caem duas vezes, sem parar.'],
  dot: ['Cheiro de Mofo', 'O mofo deixa você cansado por 2 turnos: −35% de dano.', 'WEAKEN'],
  heavy: ['Tudo Desaba', 'O armário inteiro vem abaixo.'],
});

const COUCH_KIT = bossKit('couch', {
  basic: ['Almofadada', 'Uma almofada pesada na sua cabeça.'],
  debuff: ['Afundar no Sofá', 'Você fica cansado por 2 turnos: −35% de dano.', 'WEAKEN'],
  stun: ['Só Mais um Episódio', 'O próximo episódio começa sozinho. Você perde a próxima ação.'],
  guard: ['Lanchinho', 'Belisca alguma coisa e recupera vida por 3 turnos.', 'REGEN'],
  double: ['Zapear', 'Troca de canal duas vezes, rápido.'],
  dot: ['Farelo no Sofá', 'O farelo incomoda por 3 turnos.', 'POISON'],
  heavy: ['Abraço do Sofá', 'O sofá engole você de uma vez.'],
});

const MEETING_KIT = bossKit('meeting', {
  basic: ['Pauta Extra', 'Mais um item na pauta, direto em você.'],
  debuff: ['Vamos Alinhar', 'Você fica cansado por 2 turnos: −35% de dano.', 'WEAKEN'],
  stun: ['Pode Repetir?', 'Ninguém ouviu. Você perde a próxima ação explicando de novo.'],
  guard: ['Ata de 40 Páginas', 'Se protege atrás da ata e absorve dano.', 'SHIELD'],
  double: ['Responder a Todos', 'Dois e-mails em sequência.'],
  dot: ['Mais 30 Minutos', 'A reunião estoura: estresse por 3 turnos.', 'BURN'],
  heavy: ['Oitenta Slides', 'A apresentação inteira de uma vez.'],
});

export const BOSSES: Record<BossId, BossDef> = {
  procrastination: {
    id: 'procrastination',
    name: 'Procrastinação',
    home: 'OTHER',
    assetKey: 'enemy.boss',
    skills: BOSS_SKILLS,
    phase2Skills: BOSS_PHASE2_SKILLS,
    trait: {
      id: 'TWO_PHASES',
      name: 'Só mais 5 minutos',
      hint: 'Muda de fase na metade da vida',
      blurb:
        'Com metade da vida, o despertador dispara: recupera 10% da vida, ganha +15% de dano e golpes novos.',
    },
    phaseLine: 'O despertador disparou! Procrastinação entra na fase 2.',
    phaseBanner: 'Fase 2: o despertador disparou!',
    lore: 'Um despertador derretido que sempre pede mais cinco minutos.',
  },
  clutter: {
    id: 'clutter',
    name: 'Montanha de Tralha',
    home: 'HOME',
    assetKey: 'enemy.clutter',
    skills: CLUTTER_KIT.skills,
    phase2Skills: CLUTTER_KIT.phase2,
    trait: {
      id: 'TWO_PHASES',
      name: 'Tudo fora do lugar',
      hint: 'Muda de fase na metade da vida',
      blurb:
        'Com metade da vida, o armário abre: recupera 10% da vida, ganha +15% de dano e golpes novos.',
    },
    phaseLine: 'O armário abriu! Montanha de Tralha entra na fase 2.',
    phaseBanner: 'Fase 2: o armário abriu!',
    lore: 'Um cesto de roupa que cresceu até virar monstro. Cada caixa é um "depois eu guardo".',
  },
  couch: {
    id: 'couch',
    name: 'Sedentarismo',
    home: 'HEALTH',
    assetKey: 'enemy.couch',
    skills: COUCH_KIT.skills,
    phase2Skills: COUCH_KIT.phase2,
    trait: {
      id: 'TWO_PHASES',
      name: 'Afunda no sofá',
      hint: 'Muda de fase na metade da vida',
      blurb:
        'Com metade da vida, o sofá reclina: recupera 10% da vida, ganha +15% de dano e golpes novos.',
    },
    phaseLine: 'O sofá reclinou! Sedentarismo entra na fase 2.',
    phaseBanner: 'Fase 2: o sofá reclinou!',
    lore: 'Um sofá com controle remoto nas mãos. Quanto mais você senta, mais ele cresce.',
  },
  meeting: {
    id: 'meeting',
    name: 'Reunião Infinita',
    home: 'WORK',
    assetKey: 'enemy.meeting',
    skills: MEETING_KIT.skills,
    phase2Skills: MEETING_KIT.phase2,
    trait: {
      id: 'TWO_PHASES',
      name: 'Mais uma pauta',
      hint: 'Muda de fase na metade da vida',
      blurb:
        'Com metade da vida, a reunião estoura o horário: recupera 10% da vida, ganha +15% de dano e golpes novos.',
    },
    phaseLine: 'A reunião estourou o horário! Reunião Infinita entra na fase 2.',
    phaseBanner: 'Fase 2: estourou o horário!',
    lore: 'Um notebook com mil janelas de chamada. Termina sempre "daqui a pouco".',
  },
};

export const BOSS_IDS = Object.keys(BOSSES) as BossId[];
/** Compatibilidade: o traço do primeiro chefe. */
export const BOSS_TRAIT: EnemyTrait = BOSSES.procrastination.trait;

export function enemyTraitOf(actor: BattleActor): EnemyTrait | null {
  if (!actor.trait) return null;
  if (actor.trait === 'TWO_PHASES') return BOSSES[actor.bossId ?? 'procrastination'].trait;
  return (
    [...Object.values(ENEMY_TRAITS), ...Object.values(ENEMY_TRAITS_ALT)].find(
      (entry) => entry.id === actor.trait,
    ) ?? null
  );
}

/** Jeito de lutar do monstro desta luta. A semente decide entre os dois do cômodo. */
export function rollEnemyTrait(seed: number, category: Category, heroLevel: number): EnemyTraitId {
  if (heroLevel < ALT_TRAIT_MIN_LEVEL) return ENEMY_TRAITS[category].id;
  const [value] = nextRandom((seed ^ 0x7a17) >>> 0);
  return value < ALT_TRAIT_CHANCE ? ENEMY_TRAITS_ALT[category].id : ENEMY_TRAITS[category].id;
}

// ---------------------------------------------------------------------------
// Atributos → números da luta
// ---------------------------------------------------------------------------

export function heroMaxHp(attributes: Attributes): number {
  return 24 + attributes.vitality * 6;
}

export function heroMaxEnergy(attributes: Attributes): number {
  return 12 + attributes.intelligence * 2;
}

export function defenseFor(attributes: Attributes): number {
  return Math.floor(attributes.vitality / 2);
}

/** Agilidade dá crítico (5% + 3 por ponto, teto 50%). */
export function critChanceFor(attributes: Attributes): number {
  return Math.min(50, 5 + attributes.agility * 3);
}

/** Agilidade dá esquiva de golpe físico (2 por ponto, teto 25%). */
export function dodgeChanceFor(attributes: Attributes): number {
  return Math.min(25, attributes.agility * 2);
}

export function heroBattleStats(character: Character): {
  maxHp: number;
  maxEnergy: number;
  attack: number;
  defense: number;
  critChance: number;
  dodgeChance: number;
} {
  const attributes = character.attributes;
  return {
    maxHp: heroMaxHp(attributes),
    maxEnergy: heroMaxEnergy(attributes),
    attack: attributes[CLASS_OFFENSE[character.characterClass]],
    defense: defenseFor(attributes),
    critChance: critChanceFor(attributes),
    // Ladino: sabe sair de fininho (+10 de esquiva, teto 35%).
    dodgeChance:
      character.characterClass === 'ROGUE'
        ? Math.min(ROGUE_DODGE_CAP, dodgeChanceFor(attributes) + ROGUE_DODGE_BONUS)
        : dodgeChanceFor(attributes),
  };
}

/** Passiva do Ladino: esquiva extra de golpe físico. */
export const ROGUE_DODGE_BONUS = 10;
const ROGUE_DODGE_CAP = 35;

export function enemyAttributes(difficulty: Difficulty, heroLevel: number): Attributes {
  const base = ENEMY_SCALE[difficulty].attributes;
  const bump = Math.floor(Math.max(0, heroLevel - 1) / ENEMY_LEVEL_STEP[difficulty]);
  return {
    strength: base.strength + bump,
    intelligence: base.intelligence + bump,
    agility: base.agility,
    // Vitalidade sobe na metade do ritmo: defesa alta demais pune só os golpes físicos.
    vitality: base.vitality + Math.floor(bump / 2),
  };
}

export function enemyMaxHp(difficulty: Difficulty, heroLevel: number): number {
  return ENEMY_SCALE[difficulty].hp + ENEMY_HP_PER_LEVEL * Math.max(0, heroLevel - 1);
}

// ---------------------------------------------------------------------------
// Sorte com semente (mulberry32)
// ---------------------------------------------------------------------------

export function nextRandom(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function hasStatus(actor: BattleActor, status: StatusId): boolean {
  return actor.statuses.some((entry) => entry.id === status);
}

function statusOf(actor: BattleActor, status: StatusId): StatusEffect | undefined {
  return actor.statuses.find((entry) => entry.id === status);
}

export type SkillBlock = 'COOLDOWN' | 'ENERGY' | null;

/** Por que a habilidade não pode ser usada agora (ou null se pode). */
export function skillBlock(actor: BattleActor, skillEntry: BattleSkill): SkillBlock {
  if ((actor.cooldowns[skillEntry.id] ?? 0) > 0) return 'COOLDOWN';
  if (actor.side === 'PLAYER' && skillEntry.cost > actor.energy) return 'ENERGY';
  return null;
}

function scaled(actor: BattleActor, attribute: AttributeKey, power: number, ratio: number): number {
  return power + actor.attributes[attribute] * ratio;
}

function conditionMet(target: BattleActor, condition: SkillCondition): boolean {
  if (condition === 'TARGET_LOW_HP') return target.hp <= target.maxHp * 0.35;
  if (condition === 'TARGET_POISONED') return hasStatus(target, 'POISON');
  return hasStatus(target, 'BURN');
}

function damageMultiplier(user: BattleActor): number {
  let multiplier = 1 + user.damageBonus / 100;
  const empower = statusOf(user, 'EMPOWER');
  if (empower) multiplier *= 1 + empower.potency / 100;
  const weaken = statusOf(user, 'WEAKEN');
  if (weaken) multiplier *= 1 - weaken.potency / 100;
  return multiplier;
}

/**
 * Dano de um golpe antes da sorte (sem crítico, sem esquiva, sem guarda).
 * A tela mostra este número no botão; já inclui fúria, fraqueza e bônus condicional.
 */
export function previewDamage(user: BattleActor, target: BattleActor, entry: BattleSkill): number {
  if (entry.power <= 0) return 0;
  let raw = scaled(user, entry.scaling, entry.power, entry.ratio) * damageMultiplier(user);
  if (entry.bonus && conditionMet(target, entry.bonus.when)) {
    raw *= entry.bonus.multiplier;
    if (entry.bonus.guaranteedCrit) raw *= CRIT_MULTIPLIER;
  }
  const defense = entry.kind === 'MAGIC' ? Math.floor(target.defense / 2) : target.defense;
  return Math.max(1, Math.floor(raw) - defense) * (entry.hits ?? 1);
}

/** Escudo que a habilidade daria agora (0 se não dá escudo). */
export function previewShield(user: BattleActor, entry: BattleSkill): number {
  if (!entry.shield) return 0;
  const base = scaled(user, entry.scaling, entry.shield.power, entry.shield.ratio);
  return Math.floor(base * (1 + user.shieldBonus / 100));
}

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------

interface Draft {
  state: BattleState;
  lines: string[];
  events: BattleEvent[];
}

function actorOf(state: BattleState, side: BattleSide): BattleActor {
  return side === 'PLAYER' ? state.hero : state.enemy;
}

function withActor(state: BattleState, actor: BattleActor): BattleState {
  return actor.side === 'PLAYER' ? { ...state, hero: actor } : { ...state, enemy: actor };
}

function opposite(side: BattleSide): BattleSide {
  return side === 'PLAYER' ? 'ENEMY' : 'PLAYER';
}

function emit(draft: Draft, event: Omit<BattleEvent, 'seq'>): void {
  const seq = draft.state.eventSeq + 1;
  draft.state = { ...draft.state, eventSeq: seq };
  draft.events.push({ ...event, seq });
}

function roll(draft: Draft): number {
  const [value, next] = nextRandom(draft.state.rng);
  draft.state = { ...draft.state, rng: next };
  return value;
}

function addStatus(actor: BattleActor, effect: StatusEffect): BattleActor {
  const current = statusOf(actor, effect.id);
  if (!current) return { ...actor, statuses: [...actor.statuses, effect] };
  const merged: StatusEffect = {
    ...current,
    turns: Math.max(current.turns, effect.turns),
    potency: Math.max(current.potency, effect.potency),
    stacks:
      effect.id === 'POISON' ? Math.min(POISON_MAX_STACKS, current.stacks + 1) : current.stacks,
  };
  return {
    ...actor,
    statuses: actor.statuses.map((entry) => (entry.id === effect.id ? merged : entry)),
  };
}

function removeStatus(actor: BattleActor, status: StatusId): BattleActor {
  return { ...actor, statuses: actor.statuses.filter((entry) => entry.id !== status) };
}

/** Aplica dano já calculado, passando pelo escudo. */
function takeDamage(actor: BattleActor, amount: number): { actor: BattleActor; absorbed: number } {
  const absorbed = Math.min(actor.shield, amount);
  return {
    actor: {
      ...actor,
      shield: actor.shield - absorbed,
      hp: Math.max(0, actor.hp - (amount - absorbed)),
    },
    absorbed,
  };
}

function strike(draft: Draft, userSide: BattleSide, entry: BattleSkill): number {
  const targetSide = opposite(userSide);
  let dealt = 0;
  const splitting = actorOf(draft.state, userSide).split === true;
  const hits = (entry.hits ?? 1) * (splitting ? 2 : 1);
  for (let hit = 0; hit < hits; hit += 1) {
    const user = actorOf(draft.state, userSide);
    let target = actorOf(draft.state, targetSide);
    if (target.hp <= 0) break;

    if (hasStatus(target, 'EVADE')) {
      draft.state = withActor(draft.state, removeStatus(target, 'EVADE'));
      draft.lines.push(`${target.name} esquivou!`);
      emit(draft, { kind: 'MISS', target: targetSide, source: userSide, fx: entry.fx });
      continue;
    }
    if (entry.kind === 'PHYSICAL' && roll(draft) * 100 < target.dodgeChance) {
      draft.lines.push(`${target.name} desviou.`);
      emit(draft, { kind: 'MISS', target: targetSide, source: userSide, fx: entry.fx });
      continue;
    }

    let raw = scaled(user, entry.scaling, entry.power, entry.ratio) * damageMultiplier(user);
    if (splitting) raw = (raw * SPLIT_DAMAGE_PCT) / 100;
    let guaranteedCrit = false;
    if (entry.bonus && conditionMet(target, entry.bonus.when)) {
      raw *= entry.bonus.multiplier;
      guaranteedCrit = entry.bonus.guaranteedCrit === true;
    }
    const critChance = user.critChance + (entry.critBonus ?? 0);
    const crit = guaranteedCrit || roll(draft) * 100 < critChance;
    if (crit) raw *= CRIT_MULTIPLIER;

    const guard = statusOf(target, 'GUARD');
    if (guard) {
      raw = (raw * (100 - guard.potency)) / 100;
      target = removeStatus(target, 'GUARD');
    }
    const defense = entry.kind === 'MAGIC' ? Math.floor(target.defense / 2) : target.defense;
    const amount = Math.max(1, Math.floor(raw) - defense);
    const taken = takeDamage(target, amount);
    draft.state = withActor(draft.state, taken.actor);
    dealt += amount - taken.absorbed;

    const critText = crit ? ' Crítico!' : '';
    draft.lines.push(
      taken.absorbed > 0
        ? `${target.name} perde ${amount - taken.absorbed} de vida (escudo segurou ${taken.absorbed}).${critText}`
        : `${target.name} perde ${amount} de vida.${critText}`,
    );
    emit(draft, {
      kind: 'DAMAGE',
      target: targetSide,
      source: userSide,
      amount,
      crit,
      fx: entry.fx,
    });
    reflectDamage(draft, taken.actor, userSide, entry.kind, amount - taken.absorbed);
  }
  return dealt;
}

/**
 * Resposta pronta (magia) e Cacos no chão (físico): parte do dano volta para quem bateu.
 * Nunca derruba: o herói fica com pelo menos 1 de vida.
 */
function reflectDamage(
  draft: Draft,
  target: BattleActor,
  userSide: BattleSide,
  kind: SkillKind,
  dealt: number,
): void {
  if (dealt <= 0 || target.hp <= 0) return;
  const pct =
    target.trait === 'REFLECT' && kind === 'MAGIC'
      ? REFLECT_PCT
      : target.trait === 'THORNS' && kind === 'PHYSICAL'
        ? THORNS_PCT
        : 0;
  if (pct === 0) return;
  const user = actorOf(draft.state, userSide);
  const amount = Math.min(user.hp - 1, Math.max(1, Math.floor((dealt * pct) / 100)));
  if (amount <= 0) return;
  draft.state = withActor(draft.state, { ...user, hp: user.hp - amount });
  draft.lines.push(`${target.name} devolve ${amount} de dano.`);
  emit(draft, {
    kind: 'DAMAGE',
    target: userSide,
    source: target.side,
    amount,
    fx: kind === 'MAGIC' ? 'ARCANE' : 'SLASH',
  });
}

function heal(draft: Draft, side: BattleSide, amount: number): void {
  const actor = actorOf(draft.state, side);
  const hp = Math.min(actor.maxHp, actor.hp + Math.max(0, Math.floor(amount)));
  const gained = hp - actor.hp;
  draft.state = withActor(draft.state, { ...actor, hp });
  if (gained > 0) {
    draft.lines.push(`${actor.name} recupera ${gained} de vida.`);
    emit(draft, { kind: 'HEAL', target: side, source: side, amount: gained, fx: 'HEAL' });
  }
}

function castSkill(draft: Draft, userSide: BattleSide, entry: BattleSkill): void {
  const before = actorOf(draft.state, userSide);
  draft.state = withActor(draft.state, {
    ...before,
    energy: Math.min(before.maxEnergy, before.energy - entry.cost + (entry.energyGain ?? 0)),
    cooldowns:
      entry.cooldown > 0 ? { ...before.cooldowns, [entry.id]: entry.cooldown } : before.cooldowns,
  });
  draft.lines.push(`${before.name} usou ${entry.name}.`);
  emit(draft, {
    kind: 'CAST',
    target: entry.power > 0 ? opposite(userSide) : userSide,
    source: userSide,
    fx: entry.fx,
    skillName: entry.name,
    skillId: entry.id,
  });

  let dealt = 0;
  if (entry.power > 0) dealt = strike(draft, userSide, entry);

  if (entry.drain && dealt > 0) heal(draft, userSide, dealt * entry.drain);
  if (entry.heal)
    heal(draft, userSide, scaled(before, entry.scaling, entry.heal.power, entry.heal.ratio));

  if (entry.shield) {
    const amount = previewShield(before, entry);
    const current = actorOf(draft.state, userSide);
    draft.state = withActor(draft.state, { ...current, shield: current.shield + amount });
    draft.lines.push(`${current.name} ganha escudo de ${amount}.`);
    emit(draft, { kind: 'SHIELD', target: userSide, source: userSide, amount, fx: 'SHIELD' });
  }

  for (const application of entry.applies ?? []) {
    const targetSide = application.target === 'SELF' ? userSide : opposite(userSide);
    const target = actorOf(draft.state, targetSide);
    if (target.hp <= 0) continue;
    // Golpe que errou tudo não aplica efeito no alvo.
    if (application.target === 'TARGET' && entry.power > 0 && dealt === 0) continue;
    const potency = Math.floor(
      (application.potency ?? 0) +
        (application.potencyRatio ?? 0) * before.attributes[entry.scaling],
    );
    // Status no próprio turno ganha +1: ele já diminui no fim deste turno.
    const turns = application.turns + (targetSide === userSide ? 1 : 0);
    draft.state = withActor(
      draft.state,
      addStatus(target, { id: application.status, turns, potency, stacks: 1 }),
    );
    draft.lines.push(`${target.name}: ${STATUS_LABELS[application.status]}.`);
    emit(draft, {
      kind: 'STATUS',
      target: targetSide,
      source: userSide,
      status: application.status,
      fx: entry.fx,
    });
  }
}

/** Começo do turno: queimadura, veneno e regeneração agem. */
function startOfTurn(draft: Draft, side: BattleSide): void {
  const statuses = actorOf(draft.state, side).statuses;
  for (const effect of statuses) {
    const current = actorOf(draft.state, side);
    if (current.hp <= 0) return;
    if (effect.id === 'BURN' || effect.id === 'POISON') {
      const amount = Math.max(1, effect.potency * (effect.id === 'POISON' ? effect.stacks : 1));
      draft.state = withActor(draft.state, { ...current, hp: Math.max(0, current.hp - amount) });
      draft.lines.push(
        `${current.name} perde ${amount} de vida (${effect.id === 'BURN' ? 'fervura' : 'incômodo'}).`,
      );
      emit(draft, {
        kind: 'TICK',
        target: side,
        source: opposite(side),
        amount,
        status: effect.id,
        fx: effect.id === 'BURN' ? 'FIRE' : 'POISON',
      });
    }
    if (effect.id === 'REGEN') heal(draft, side, effect.potency);
  }
}

function traitEvent(draft: Draft, trait: EnemyTrait, fx: FxKind): void {
  emit(draft, { kind: 'TRAIT', target: 'ENEMY', source: 'ENEMY', fx, skillName: trait.name });
}

/**
 * Jeito próprio do monstro, no começo do turno dele.
 * `previous` são os eventos da ação do herói (para saber se ele causou dano).
 */
function applyEnemyTrait(draft: Draft, previous: readonly BattleEvent[], enemyTurns: number): void {
  const enemy = draft.state.enemy;
  const trait = enemyTraitOf(enemy);
  if (!trait || enemy.hp <= 0) return;
  const half = enemy.hp <= enemy.maxHp / 2;
  switch (trait.id) {
    case 'MORE_TABS': {
      if (enemy.traitUsed || !half) return;
      draft.state = withActor(draft.state, {
        ...addStatus(enemy, { id: 'EMPOWER', turns: 3, potency: 30, stacks: 1 }),
        traitUsed: true,
      });
      draft.lines.push(`${enemy.name} abriu mais abas: +30% de dano por 2 turnos.`);
      traitEvent(draft, trait, 'BUFF');
      return;
    }
    case 'PILE_UP': {
      if (enemy.damageBonus >= 40) return;
      draft.state = withActor(draft.state, {
        ...enemy,
        damageBonus: Math.min(40, enemy.damageBonus + 10),
      });
      draft.lines.push(
        `O trabalho acumula: ${enemy.name} causa +${enemy.damageBonus + 10}% de dano.`,
      );
      traitEvent(draft, trait, 'BUFF');
      return;
    }
    case 'LAZY_REGEN': {
      const hit = previous.some((event) => event.kind === 'DAMAGE' && event.target === 'ENEMY');
      if (hit || enemy.hp >= enemy.maxHp) return;
      traitEvent(draft, trait, 'HEAL');
      heal(draft, 'ENEMY', Math.max(1, Math.round(enemy.maxHp * 0.08)));
      return;
    }
    case 'GROWS': {
      if (enemyTurns % 3 !== 0) return;
      const amount = Math.max(1, Math.round(enemy.maxHp * 0.12));
      draft.state = withActor(draft.state, { ...enemy, shield: enemy.shield + amount });
      draft.lines.push(`A pilha cresceu: ${enemy.name} ganha escudo de ${amount}.`);
      traitEvent(draft, trait, 'SHIELD');
      emit(draft, { kind: 'SHIELD', target: 'ENEMY', source: 'ENEMY', amount, fx: 'SHIELD' });
      return;
    }
    case 'TWO_PHASES': {
      if (enemy.traitUsed || !half) return;
      const boss = BOSSES[enemy.bossId ?? 'procrastination'];
      draft.state = withActor(draft.state, {
        ...enemy,
        traitUsed: true,
        skills: boss.phase2Skills,
        cooldowns: {},
        damageBonus: enemy.damageBonus + BOSS_PHASE2_DAMAGE_BONUS,
        assetKey: `${boss.assetKey}+phase2`,
      });
      draft.lines.push(boss.phaseLine);
      traitEvent(draft, trait, 'BUFF');
      heal(draft, 'ENEMY', Math.round((enemy.maxHp * BOSS_PHASE2_HEAL_PCT) / 100));
      return;
    }
    case 'SPLIT': {
      if (enemy.traitUsed || !half) return;
      draft.state = withActor(draft.state, { ...enemy, traitUsed: true, split: true });
      draft.lines.push(`${enemy.name} virou duas tarefas: cada golpe sai em dois.`);
      traitEvent(draft, trait, 'BUFF');
      return;
    }
    case 'LATE_RAGE': {
      if (enemy.traitUsed || enemyTurns < LATE_RAGE_TURN) return;
      draft.state = withActor(draft.state, {
        ...enemy,
        traitUsed: true,
        damageBonus: enemy.damageBonus + LATE_RAGE_BONUS,
      });
      draft.lines.push(`O cansaço acumulou: ${enemy.name} causa +${LATE_RAGE_BONUS}% de dano.`);
      traitEvent(draft, trait, 'BUFF');
      return;
    }
    case 'DISTRACT': {
      const hero = draft.state.hero;
      const lost = Math.min(hero.energy, DISTRACT_ENERGY);
      if (lost <= 0) return;
      draft.state = { ...draft.state, hero: { ...hero, energy: hero.energy - lost } };
      draft.lines.push(
        `${enemy.name} distrai você: −${lost} de ${hero.energyLabel.toLowerCase()}.`,
      );
      traitEvent(draft, trait, 'DEBUFF');
      emit(draft, {
        kind: 'ENERGY',
        target: 'PLAYER',
        source: 'ENEMY',
        amount: -lost,
        fx: 'DEBUFF',
      });
      return;
    }
    case 'VANISH': {
      if (enemy.traitUsed || !half) return;
      draft.state = withActor(draft.state, {
        ...addStatus(enemy, { id: 'EVADE', turns: 2, potency: 0, stacks: 1 }),
        traitUsed: true,
      });
      draft.lines.push(`${enemy.name} some de vista: vai esquivar o próximo golpe.`);
      traitEvent(draft, trait, 'SHADOW');
      return;
    }
    default:
      return;
  }
}

/** Fim do turno: status e recargas andam um passo. */
function endOfTurn(draft: Draft, side: BattleSide): void {
  const actor = actorOf(draft.state, side);
  const statuses = actor.statuses
    .map((entry) => ({ ...entry, turns: entry.turns - 1 }))
    .filter((entry) => entry.turns > 0);
  const cooldowns: Record<string, number> = {};
  for (const [id, left] of Object.entries(actor.cooldowns)) {
    if (left - 1 > 0) cooldowns[id] = left - 1;
  }
  draft.state = withActor(draft.state, { ...actor, statuses, cooldowns });
}

/**
 * IA do monstro: com pouca vida, se cura ou se protege; em turnos alternados aplica
 * um status que você ainda não tem; no resto, usa o golpe mais forte disponível.
 */
export function chooseEnemySkill(state: BattleState): BattleSkill {
  const { enemy, hero } = state;
  const ready = enemy.skills.filter((entry) => skillBlock(enemy, entry) == null);
  const pool = ready.length > 0 ? ready : [enemy.skills[0]];
  const hurt = enemy.hp <= enemy.maxHp * 0.45;

  if (hurt) {
    const sustain = pool.find(
      (entry) =>
        entry.heal != null ||
        entry.shield != null ||
        entry.drain != null ||
        entry.applies?.some((item) => item.status === 'REGEN'),
    );
    if (sustain) return sustain;
  }

  if (state.enemyTurns % 2 === 1) {
    const debuff = pool.find((entry) =>
      entry.applies?.some((item) => item.target === 'TARGET' && !hasStatus(hero, item.status)),
    );
    if (debuff) return debuff;
  }

  if (!hurt && state.enemyTurns % 3 === 2) {
    const buff = pool.find((entry) =>
      entry.applies?.some((item) => item.target === 'SELF' && !hasStatus(enemy, item.status)),
    );
    if (buff) return buff;
  }

  const attacks = pool.filter((entry) => entry.power > 0);
  if (attacks.length === 0) return pool[0];
  return attacks.reduce((best, entry) =>
    previewDamage(enemy, hero, entry) > previewDamage(enemy, hero, best) ? entry : best,
  );
}

function logEntries(key: string, texts: readonly string[]): BattleLogEntry[] {
  return texts.map((text, index) => ({ id: `${key}:${index}`, text }));
}

function finish(
  base: BattleState,
  draft: Draft,
  key: string,
  patch: Partial<BattleState>,
): BattleState {
  return {
    ...draft.state,
    ...patch,
    log: [...base.log, ...logEntries(key, draft.lines)].slice(-30),
    events: draft.events,
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function startBattle(input: StartBattleInput): BattleState {
  const { character } = input;
  const stats = heroBattleStats(character);
  const bonus: HeroBonus = { ...NO_BONUS, ...input.bonus };
  stats.maxHp += bonus.maxHp;
  stats.maxEnergy += bonus.maxEnergy;
  stats.critChance = Math.min(60, stats.critChance + bonus.critChance);
  const variant: EnemyVariant = input.variant ?? 'NORMAL';
  const boss = variant === 'BOSS' ? BOSSES[input.bossId ?? 'procrastination'] : null;
  const villain = boss
    ? { name: boss.name, defeatedTitle: `${boss.name} derrotada!` }
    : VILLAIN_BY_CATEGORY[input.category];
  const trimmed = input.heroName.trim();
  const heroName = trimmed.length > 0 ? trimmed : 'Herói';
  const startHp =
    input.heroHp == null
      ? stats.maxHp
      : Math.max(1, Math.min(stats.maxHp, Math.floor(input.heroHp)));
  const level = Math.max(1, character.level);
  const scaleDifficulty: Difficulty = variant === 'BOSS' ? 'HARD' : input.difficulty;
  const scaleLevel = level;
  const attributeBonus = variant === 'ELITE' ? ELITE_ATTRIBUTE_BONUS : 0;
  // O chefe bate como um monstro médio, mas aguenta mais que um difícil: a luta é longa, não injusta.
  const baseAttrs =
    variant === 'BOSS'
      ? enemyAttributes('MEDIUM', Math.max(1, scaleLevel - 1))
      : enemyAttributes(scaleDifficulty, scaleLevel);
  const enemyAttrs: Attributes = {
    strength: baseAttrs.strength + attributeBonus,
    intelligence: baseAttrs.intelligence + attributeBonus,
    agility: baseAttrs.agility,
    vitality: baseAttrs.vitality + attributeBonus,
  };
  const hpMultiplier =
    variant === 'BOSS' ? BOSS_HP_MULTIPLIER : variant === 'ELITE' ? ELITE_HP_MULTIPLIER : 1;
  const enemyHp = Math.round(enemyMaxHp(scaleDifficulty, scaleLevel) * hpMultiplier);
  const enemySubtitle =
    variant === 'BOSS'
      ? `Chefe da semana · Nv ${scaleLevel}`
      : `${variant === 'ELITE' ? 'Elite · ' : ''}${DIFFICULTY_LABELS[input.difficulty]} · Nv ${level}`;
  const enemyAsset = boss
    ? boss.assetKey
    : `${ENEMY_ASSET[input.category]}${variant === 'ELITE' ? '+elite' : ''}`;
  const pairTraits = [ENEMY_TRAITS[input.category].id, ENEMY_TRAITS_ALT[input.category].id];
  const enemyTrait: EnemyTraitId = boss
    ? 'TWO_PHASES'
    : input.trait && pairTraits.includes(input.trait)
      ? input.trait
      : ENEMY_TRAITS[input.category].id;
  const potions: PotionStock = { 'potion.water': 0, 'potion.coffee': 0 };
  for (const id of Object.keys(potions) as PotionId[]) {
    potions[id] = Math.max(0, Math.floor(input.potions?.[id] ?? 0));
  }

  const hero: BattleActor = {
    id: 'hero',
    name: heroName,
    subtitle: `${CLASS_DEFAULTS[character.characterClass].label} · Nv ${level}`,
    side: 'PLAYER',
    hp: startHp,
    maxHp: stats.maxHp,
    shield: 0,
    energy: stats.maxEnergy,
    maxEnergy: stats.maxEnergy,
    energyLabel: CLASS_ENERGY_LABEL[character.characterClass],
    attributes: { ...character.attributes },
    defense: stats.defense,
    critChance: stats.critChance,
    dodgeChance: stats.dodgeChance,
    damageBonus: bonus.damagePct,
    shieldBonus: bonus.shieldPct,
    statuses: [],
    cooldowns: {},
    skills:
      input.skills && input.skills.length > 0
        ? input.skills
        : HERO_SKILLS[character.characterClass],
    assetKey: `${HERO_ASSET[character.characterClass]}${input.heroLook ? `+${input.heroLook}` : ''}`,
    assetLayers: input.heroLayers
      ? { under: [...input.heroLayers.under], over: [...input.heroLayers.over] }
      : undefined,
  };
  const enemy: BattleActor = {
    id: 'enemy',
    name: villain.name,
    subtitle: enemySubtitle,
    side: 'ENEMY',
    hp: enemyHp,
    maxHp: enemyHp,
    shield: 0,
    energy: 0,
    maxEnergy: 0,
    energyLabel: '',
    attributes: enemyAttrs,
    defense: defenseFor(enemyAttrs),
    critChance: critChanceFor(enemyAttrs),
    dodgeChance: dodgeChanceFor(enemyAttrs),
    damageBonus: 0,
    shieldBonus: 0,
    statuses: [],
    cooldowns: {},
    skills: boss ? boss.skills : ENEMY_SKILLS[input.category],
    assetKey: enemyAsset,
    trait: enemyTrait,
    bossId: boss?.id,
  };

  const opening: BattleState = {
    phase: 'PLAYER_TURN',
    turn: 0,
    hero,
    enemy,
    log: logEntries('open', [`${enemy.name} apareceu!`]),
    lastPlayerMoveId: null,
    lastEnemyMoveId: null,
    enemyTurns: 0,
    enemyIntentId: null,
    events: [],
    eventSeq: 0,
    rng: (input.seed ?? 0x5eed) >>> 0,
    victoryTitle: villain.defeatedTitle,
    variant,
    potions,
    potionsUsed: { 'potion.water': 0, 'potion.coffee': 0 },
  };
  return { ...opening, enemyIntentId: chooseEnemySkill(opening).id };
}

/** Elite só em luta média ou difícil, a partir do nível 2. A semente decide. */
export function rollEnemyVariant(
  seed: number,
  difficulty: Difficulty,
  heroLevel: number,
): EnemyVariant {
  if (difficulty === 'EASY' || heroLevel < ELITE_MIN_LEVEL) return 'NORMAL';
  const [value] = nextRandom((seed ^ 0xe1173) >>> 0);
  return value < ELITE_CHANCE ? 'ELITE' : 'NORMAL';
}

/** Por que a poção não pode ser usada agora (null = pode). */
export type PotionBlock = 'NONE_LEFT' | 'LIMIT' | 'FULL' | 'NOT_YOUR_TURN';

export function potionBlock(state: BattleState, id: PotionId): PotionBlock | null {
  if (state.phase !== 'PLAYER_TURN') return 'NOT_YOUR_TURN';
  if (state.potions[id] - state.potionsUsed[id] <= 0) return 'NONE_LEFT';
  const used = state.potionsUsed['potion.water'] + state.potionsUsed['potion.coffee'];
  if (used >= MAX_POTIONS_PER_BATTLE) return 'LIMIT';
  const potion = POTIONS[id];
  if (potion.healPct && state.hero.hp >= state.hero.maxHp) return 'FULL';
  if (potion.energyPct && state.hero.energy >= state.hero.maxEnergy) return 'FULL';
  return null;
}

/** Usa uma poção. Gasta o turno do herói, como uma habilidade. */
export function applyPlayerItem(state: BattleState, id: PotionId): BattleState {
  if (potionBlock(state, id) != null) return state;
  const potion = POTIONS[id];
  const draft: Draft = { state: { ...state }, lines: [], events: [] };
  draft.lines.push(`${state.hero.name} usou ${potion.name}.`);
  emit(draft, {
    kind: 'CAST',
    target: 'PLAYER',
    source: 'PLAYER',
    fx: potion.healPct ? 'HEAL' : 'BUFF',
    skillName: potion.name,
    skillId: potion.id,
  });
  if (potion.healPct) heal(draft, 'PLAYER', (state.hero.maxHp * potion.healPct) / 100);
  if (potion.energyPct) {
    const hero = draft.state.hero;
    const energy = Math.min(
      hero.maxEnergy,
      hero.energy + Math.ceil((hero.maxEnergy * potion.energyPct) / 100),
    );
    const gained = energy - hero.energy;
    draft.state = { ...draft.state, hero: { ...hero, energy } };
    draft.lines.push(`${hero.name} recupera ${gained} de ${hero.energyLabel.toLowerCase()}.`);
    emit(draft, { kind: 'ENERGY', target: 'PLAYER', source: 'PLAYER', amount: gained, fx: 'BUFF' });
  }
  draft.state = {
    ...draft.state,
    potionsUsed: { ...state.potionsUsed, [id]: state.potionsUsed[id] + 1 },
  };
  endOfTurn(draft, 'PLAYER');
  const turn = state.turn + 1;
  return finish(state, draft, `p${turn}:${id}`, {
    phase: 'ENEMY_TURN',
    turn,
    lastPlayerMoveId: id,
  });
}

export function applyPlayerMove(state: BattleState, skillId: string): BattleState {
  if (state.phase !== 'PLAYER_TURN') return state;
  const entry = state.hero.skills.find((item) => item.id === skillId);
  if (!entry || skillBlock(state.hero, entry) != null) return state;

  const draft: Draft = { state: { ...state }, lines: [], events: [] };
  castSkill(draft, 'PLAYER', entry);
  const turn = state.turn + 1;
  const key = `p${turn}:${entry.id}`;

  if (draft.state.enemy.hp <= 0) {
    draft.lines.push(state.victoryTitle);
    emit(draft, { kind: 'KO', target: 'ENEMY', source: 'PLAYER' });
    return finish(state, draft, key, { phase: 'VICTORY', turn, lastPlayerMoveId: entry.id });
  }

  endOfTurn(draft, 'PLAYER');
  return finish(state, draft, key, { phase: 'ENEMY_TURN', turn, lastPlayerMoveId: entry.id });
}

/**
 * Turno do monstro, seguido da preparação do turno do herói.
 * Se o herói estiver atordoado, ele perde a vez e a fase continua ENEMY_TURN:
 * a tela chama `applyEnemyMove` de novo.
 */
export function applyEnemyMove(state: BattleState): BattleState {
  if (state.phase !== 'ENEMY_TURN') return state;
  const draft: Draft = { state: { ...state }, lines: [], events: [] };
  const enemyTurns = state.enemyTurns + 1;
  const key = `e${enemyTurns}`;
  let lastEnemyMoveId = state.lastEnemyMoveId;

  startOfTurn(draft, 'ENEMY');
  if (draft.state.enemy.hp <= 0) {
    draft.lines.push(state.victoryTitle);
    emit(draft, { kind: 'KO', target: 'ENEMY', source: 'PLAYER' });
    return finish(state, draft, key, { phase: 'VICTORY', enemyTurns });
  }

  applyEnemyTrait(draft, state.events, enemyTurns);

  if (hasStatus(draft.state.enemy, 'STUN')) {
    draft.state = { ...draft.state, enemy: removeStatus(draft.state.enemy, 'STUN') };
    draft.lines.push(`${draft.state.enemy.name} está travado e perde a vez.`);
    emit(draft, { kind: 'SKIP', target: 'ENEMY', source: 'ENEMY', status: 'STUN' });
  } else {
    const intent = draft.state.enemy.skills.find((item) => item.id === state.enemyIntentId);
    const action =
      intent && skillBlock(draft.state.enemy, intent) == null
        ? intent
        : chooseEnemySkill(draft.state);
    castSkill(draft, 'ENEMY', action);
    lastEnemyMoveId = action.id;
  }
  endOfTurn(draft, 'ENEMY');

  if (draft.state.hero.hp <= 0) {
    draft.lines.push(`${state.hero.name} caiu.`);
    emit(draft, { kind: 'KO', target: 'PLAYER', source: 'ENEMY' });
    return finish(state, draft, key, { phase: 'DEFEAT', enemyTurns, lastEnemyMoveId });
  }

  // Preparação do turno do herói.
  startOfTurn(draft, 'PLAYER');
  const hero = draft.state.hero;
  if (hero.hp <= 0) {
    draft.lines.push(`${hero.name} caiu.`);
    emit(draft, { kind: 'KO', target: 'PLAYER', source: 'ENEMY' });
    return finish(state, draft, key, { phase: 'DEFEAT', enemyTurns, lastEnemyMoveId });
  }
  if (state.turn >= turnLimitFor(state)) {
    draft.lines.push(`${hero.name} não aguenta mais.`);
    return finish(state, draft, key, { phase: 'DEFEAT', enemyTurns, lastEnemyMoveId });
  }

  draft.state = {
    ...draft.state,
    hero: { ...hero, energy: Math.min(hero.maxEnergy, hero.energy + ENERGY_REGEN_PER_TURN) },
  };
  const nextIntent = chooseEnemySkill({ ...draft.state, enemyTurns }).id;

  if (hasStatus(draft.state.hero, 'STUN')) {
    draft.state = { ...draft.state, hero: removeStatus(draft.state.hero, 'STUN') };
    draft.lines.push(`${hero.name} está travado e perde a vez.`);
    emit(draft, { kind: 'SKIP', target: 'PLAYER', source: 'PLAYER', status: 'STUN' });
    endOfTurn(draft, 'PLAYER');
    return finish(state, draft, key, {
      phase: 'ENEMY_TURN',
      turn: state.turn + 1,
      enemyTurns,
      lastEnemyMoveId,
      enemyIntentId: nextIntent,
    });
  }

  return finish(state, draft, key, {
    phase: 'PLAYER_TURN',
    enemyTurns,
    lastEnemyMoveId,
    enemyIntentId: nextIntent,
  });
}

export function enemyIntent(state: BattleState): BattleSkill | null {
  return state.enemy.skills.find((entry) => entry.id === state.enemyIntentId) ?? null;
}

/**
 * Escolha automática do herói (luta rápida): com pouca vida, cura ou escudo; no resto,
 * o golpe pronto de mais dano. Null quando nada está pronto.
 */
export function autoSkill(state: BattleState): BattleSkill | null {
  const { hero, enemy } = state;
  const ready = hero.skills.filter((entry) => skillBlock(hero, entry) == null);
  if (ready.length === 0) return null;
  if (hero.hp / hero.maxHp < 0.35) {
    const sustain = ready.find((entry) => entry.heal || entry.shield);
    if (sustain) return sustain;
  }
  let best = ready[ready.length - 1];
  let bestScore = -1;
  for (const entry of ready) {
    const score = previewDamage(hero, enemy, entry) + (entry.applies?.length ?? 0) * 2;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Luta rápida: joga até o fim com `autoSkill`, sem poções. A mesma semente dá o mesmo
 * resultado. Devolve o estado final (VICTORY ou DEFEAT; o mesmo estado se travar).
 */
export function autoBattle(state: BattleState, maxSteps = 240): BattleState {
  let current = state;
  for (let step = 0; step < maxSteps; step += 1) {
    let next = current;
    if (current.phase === 'PLAYER_TURN') {
      const entry = autoSkill(current);
      if (!entry) break;
      next = applyPlayerMove(current, entry.id);
    } else if (current.phase === 'ENEMY_TURN') {
      next = applyEnemyMove(current);
    } else {
      break;
    }
    if (next === current) break;
    current = next;
  }
  return current;
}
