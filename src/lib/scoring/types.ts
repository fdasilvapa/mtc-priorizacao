export type McocClass =
  | 'Cosmic' | 'Tech' | 'Science' | 'Mutant' | 'Mystic' | 'Skill'

export const MCOC_CLASSES: readonly McocClass[] = [
  'Cosmic', 'Tech', 'Science', 'Mutant', 'Mystic', 'Skill',
] as const

export type CatalystKey =
  | 'alphaT3' | 'alphaT4' | 'alphaT5'
  | 'basicT6' | 'basicT7'
  | 'classT5' | 'classT6'

export type CatalystCost = Partial<Record<CatalystKey, number>>

/** Um campeao do roster, ja com os dados da base_champions embutidos. */
export interface RosterChampion {
  id: string
  championId: string
  name: string
  championClass: McocClass
  attackTierScore: number
  attackRecommendedSig: number
  currentRank: number
  sigLevel: number
  isFavorite: boolean
  isAscended: boolean
}

/**
 * Agregados do roster inteiro, calculados uma unica vez.
 *
 * Pontos de rank, NAO custo de catalisador: collapseCost responde "quanto vai
 * me custar subir este campeao", calibrado contra a taxa de aquisicao do dono.
 * O fator de classe faz outra pergunta — "quao bem servida essa classe ja
 * esta" — e poder de combate cresce muito mais suavemente entre ranks do que
 * custo cresce. Cada rank up conta igual aqui, de proposito.
 */
export interface RosterContext {
  classRankPoints: Record<McocClass, number>
  maxClassRankPoints: number
}

export interface ScoredChampion extends RosterChampion {
  score: number
  maxed: boolean
}
