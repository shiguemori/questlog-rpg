import {
  defendSkillFor,
  HERO_SKILLS,
  NO_BONUS,
  TALENT_SKILLS,
  type BattleSkill,
  type HeroBonus,
} from './battle';
import type { AppState, Character, CharacterClass } from './types';

/**
 * Árvore de talentos e loadout de habilidades.
 *
 * - O herói ganha 1 ponto de talento por nível depois do 1 (nível 4 = 3 pontos).
 *   Os pontos não ficam no save: saem do nível menos os talentos aprendidos.
 * - Cada classe tem 3 ramos com 3 talentos. Para aprender um, precisa do anterior
 *   do mesmo ramo e do nível mínimo da camada.
 * - Talentos dão bônus passivos ou liberam habilidades novas.
 * - O loadout é a escolha de até 5 habilidades levadas para a luta. Respirar Fundo
 *   vai sempre, fora da conta.
 */

export type TalentBranch = 'ATTACK' | 'GUARD' | 'ROUTINE';

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  branch: TalentBranch;
  tier: 1 | 2 | 3;
  /** Talento do mesmo ramo que precisa vir antes. */
  requires: string | null;
  minLevel: number;
  passive?: Partial<HeroBonus>;
  /** Id da habilidade liberada (em `TALENT_SKILLS`). */
  unlocksSkill?: string;
}

export const TALENT_BRANCH_LABELS: Record<TalentBranch, string> = {
  ATTACK: 'Mão na massa',
  GUARD: 'Autocuidado',
  ROUTINE: 'Rotina',
};

export const TALENT_BRANCHES: readonly TalentBranch[] = ['ATTACK', 'GUARD', 'ROUTINE'];

/** Nível mínimo por camada da árvore. */
export const TALENT_TIER_LEVEL: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 5 };

/** Quantas habilidades (além de Respirar Fundo) vão para a luta. */
export const LOADOUT_SIZE = 5;

const CLASS_PREFIX: Record<CharacterClass, string> = {
  WARRIOR: 'warrior',
  MAGE: 'mage',
  ROGUE: 'rogue',
};

function skillName(characterClass: CharacterClass, skillId: string): string {
  return TALENT_SKILLS[characterClass].find((entry) => entry.id === skillId)?.name ?? skillId;
}

function buildTree(characterClass: CharacterClass): readonly TalentNode[] {
  const p = CLASS_PREFIX[characterClass];
  const [attackSkill, guardSkill, routineSkill, finalSkill] = TALENT_SKILLS[characterClass].map(
    (entry) => entry.id,
  );
  const unlock = (id: string) => `Libera a habilidade ${skillName(characterClass, id)}.`;
  return [
    {
      id: `${p}.attack.1`,
      name: 'Mão Firme',
      description: '+10% de dano em todos os golpes.',
      branch: 'ATTACK',
      tier: 1,
      requires: null,
      minLevel: TALENT_TIER_LEVEL[1],
      passive: { damagePct: 10 },
    },
    {
      id: `${p}.attack.2`,
      name: skillName(characterClass, attackSkill),
      description: unlock(attackSkill),
      branch: 'ATTACK',
      tier: 2,
      requires: `${p}.attack.1`,
      minLevel: TALENT_TIER_LEVEL[2],
      unlocksSkill: attackSkill,
    },
    {
      id: `${p}.attack.3`,
      name: 'Olho no Detalhe',
      description: '+10% de chance de crítico.',
      branch: 'ATTACK',
      tier: 3,
      requires: `${p}.attack.2`,
      minLevel: TALENT_TIER_LEVEL[3],
      passive: { critChance: 10 },
    },
    {
      id: `${p}.guard.1`,
      name: 'Noite Bem Dormida',
      description: '+8 de vida máxima.',
      branch: 'GUARD',
      tier: 1,
      requires: null,
      minLevel: TALENT_TIER_LEVEL[1],
      passive: { maxHp: 8 },
    },
    {
      id: `${p}.guard.2`,
      name: skillName(characterClass, guardSkill),
      description: unlock(guardSkill),
      branch: 'GUARD',
      tier: 2,
      requires: `${p}.guard.1`,
      minLevel: TALENT_TIER_LEVEL[2],
      unlocksSkill: guardSkill,
    },
    {
      id: `${p}.guard.3`,
      name: 'Prevenido',
      description: '+30% em todos os escudos.',
      branch: 'GUARD',
      tier: 3,
      requires: `${p}.guard.2`,
      minLevel: TALENT_TIER_LEVEL[3],
      passive: { shieldPct: 30 },
    },
    {
      id: `${p}.routine.1`,
      name: 'Café da Manhã',
      description: '+4 de energia máxima.',
      branch: 'ROUTINE',
      tier: 1,
      requires: null,
      minLevel: TALENT_TIER_LEVEL[1],
      passive: { maxEnergy: 4 },
    },
    {
      id: `${p}.routine.2`,
      name: skillName(characterClass, routineSkill),
      description: unlock(routineSkill),
      branch: 'ROUTINE',
      tier: 2,
      requires: `${p}.routine.1`,
      minLevel: TALENT_TIER_LEVEL[2],
      unlocksSkill: routineSkill,
    },
    {
      id: `${p}.routine.3`,
      name: skillName(characterClass, finalSkill),
      description: unlock(finalSkill),
      branch: 'ROUTINE',
      tier: 3,
      requires: `${p}.routine.2`,
      minLevel: TALENT_TIER_LEVEL[3],
      unlocksSkill: finalSkill,
    },
  ];
}

export const TALENT_TREES: Record<CharacterClass, readonly TalentNode[]> = {
  WARRIOR: buildTree('WARRIOR'),
  MAGE: buildTree('MAGE'),
  ROGUE: buildTree('ROGUE'),
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function talentPointsTotal(level: number): number {
  return Math.max(0, Math.floor(level) - 1);
}

/** Talentos aprendidos que valem para a classe atual, sem repetição, na ordem da árvore. */
export function learnedTalents(character: Character): string[] {
  const learned = new Set(character.talents ?? []);
  return TALENT_TREES[character.characterClass]
    .filter((node) => learned.has(node.id))
    .map((node) => node.id);
}

export function talentPointsLeft(character: Character): number {
  return Math.max(0, talentPointsTotal(character.level) - learnedTalents(character).length);
}

export type TalentStatus = 'LEARNED' | 'AVAILABLE' | 'NEEDS_PREVIOUS' | 'NEEDS_LEVEL' | 'NO_POINTS';

export function talentStatus(character: Character, node: TalentNode): TalentStatus {
  const learned = learnedTalents(character);
  if (learned.includes(node.id)) return 'LEARNED';
  if (node.requires && !learned.includes(node.requires)) return 'NEEDS_PREVIOUS';
  if (character.level < node.minLevel) return 'NEEDS_LEVEL';
  if (talentPointsLeft(character) <= 0) return 'NO_POINTS';
  return 'AVAILABLE';
}

/** Soma dos bônus passivos aprendidos. */
export function heroBonus(character: Character): HeroBonus {
  const learned = new Set(learnedTalents(character));
  const total: HeroBonus = { ...NO_BONUS };
  for (const node of TALENT_TREES[character.characterClass]) {
    if (!learned.has(node.id) || !node.passive) continue;
    for (const key of Object.keys(node.passive) as (keyof HeroBonus)[]) {
      total[key] += node.passive[key] ?? 0;
    }
  }
  return total;
}

/** Habilidades da classe que o herói pode levar (sem Respirar Fundo). */
export function unlockedSkills(character: Character): BattleSkill[] {
  const cls = character.characterClass;
  const defend = defendSkillFor(cls);
  const base = HERO_SKILLS[cls].filter((entry) => entry.id !== defend.id);
  const learned = new Set(learnedTalents(character));
  const unlockedIds = new Set(
    TALENT_TREES[cls]
      .filter((node) => learned.has(node.id) && node.unlocksSkill)
      .map((node) => node.unlocksSkill as string),
  );
  return [...base, ...TALENT_SKILLS[cls].filter((entry) => unlockedIds.has(entry.id))];
}

/** Ids do loadout atual, já validados. Sem escolha salva = as 5 habilidades iniciais. */
export function loadoutIds(character: Character): string[] {
  const available = unlockedSkills(character).map((entry) => entry.id);
  const chosen = [...new Set(character.loadout ?? [])].filter((id) => available.includes(id));
  const ids = chosen.length > 0 ? chosen : available;
  return ids.slice(0, LOADOUT_SIZE);
}

/** Habilidades que vão para a luta: o loadout + Respirar Fundo no fim. */
export function battleSkillsFor(character: Character): BattleSkill[] {
  const all = unlockedSkills(character);
  const picked = loadoutIds(character)
    .map((id) => all.find((entry) => entry.id === id))
    .filter((entry): entry is BattleSkill => entry != null);
  return [...picked, defendSkillFor(character.characterClass)];
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

function withCharacter(state: AppState, character: Character): AppState {
  return { ...state, character };
}

/** Aprende um talento. Null se não estiver disponível. */
export function learnTalent(state: AppState, talentId: string): AppState | null {
  const node = TALENT_TREES[state.character.characterClass].find((entry) => entry.id === talentId);
  if (!node || talentStatus(state.character, node) !== 'AVAILABLE') return null;
  return withCharacter(state, {
    ...state.character,
    talents: [...learnedTalents(state.character), node.id],
  });
}

/** Devolve todos os pontos de talento. Habilidades que saem da árvore saem do loadout. */
export function resetTalents(state: AppState): AppState | null {
  if (learnedTalents(state.character).length === 0) return null;
  const character: Character = { ...state.character, talents: [] };
  const kept = loadoutIds({ ...character, loadout: state.character.loadout });
  return withCharacter(state, { ...character, loadout: kept });
}

/**
 * Põe ou tira uma habilidade do loadout. Null se não der:
 * habilidade bloqueada, loadout cheio, ou tirar a última.
 */
export function toggleLoadoutSkill(state: AppState, skillId: string): AppState | null {
  const { character } = state;
  if (!unlockedSkills(character).some((entry) => entry.id === skillId)) return null;
  const current = loadoutIds(character);
  if (current.includes(skillId)) {
    if (current.length <= 1) return null;
    return withCharacter(state, {
      ...character,
      loadout: current.filter((id) => id !== skillId),
    });
  }
  if (current.length >= LOADOUT_SIZE) return null;
  return withCharacter(state, { ...character, loadout: [...current, skillId] });
}

/** Lê ids de uma lista do save: só textos, sem repetir, no máximo `limit`. */
export function sanitizeIdList(raw: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((value): value is string => typeof value === 'string' && value.length > 0);
  return [...new Set(ids)].slice(0, limit);
}
