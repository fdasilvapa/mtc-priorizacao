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
 * O investimento por classe e a base do fator de equilibrio: ele mede o custo
 * ja pago em cada classe, nao quantos campeoes cruzaram um limiar de rank.
 */
export interface RosterContext {
  classInvestment: Record<McocClass, number>
  maxClassInvestment: number
}

export interface ScoredChampion extends RosterChampion {
  score: number
  maxed: boolean
}
