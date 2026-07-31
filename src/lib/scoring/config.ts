import type { CatalystCost, CatalystKey } from './types'

/** Pesos da media ponderada. Somam 1.0. */
export const WEIGHTS = {
  tier: 0.45,
  rank: 0.20,
  class: 0.15,
  sig: 0.10,
  fav: 0.05,
  asc: 0.05,
} as const

/**
 * O rank up 5->6 nao existe no jogo ("Currently Impossible").
 * Quando a Kabam liberar, trocar aqui e acrescentar a linha 5 em RANK_UP_COST.
 */
export const MAX_RANK = 5

/** A partir deste rank o campeao conta como "evoluido" no equilibrio de classe. */
export const CLASS_RANK_THRESHOLD = 3

/** Nota maxima da tier list, usada para normalizar S_tier. */
export const MAX_TIER_SCORE = 10

/** Custo de catalisadores para subir A PARTIR do rank N (7 estrelas). */
export const RANK_UP_COST: Record<number, CatalystCost> = {
  1: { alphaT3: 7, basicT6: 7, classT5: 4, classT6: 4 },
  2: { alphaT3: 8, alphaT4: 3, basicT6: 8, classT5: 5, classT6: 5 },
  3: { alphaT3: 9, alphaT4: 4, basicT6: 9, basicT7: 3, classT6: 6 },
  4: { alphaT4: 6, alphaT5: 3, basicT7: 4, classT6: 7 },
}

/**
 * Escassez relativa por catalisador. NAO sao dados medidos — refletem o perfil
 * do usuario: Valiant, eventos mensais e Ato 9, sem Battlegrounds nem Guerras
 * de Alianca. Como BG e AW sao as fontes recorrentes de tier alto, alphaT5 e
 * basicT7 pesam mais aqui. Se a rotina mudar, esta e a primeira constante a revisar.
 */
export const CATALYST_SCARCITY: Record<CatalystKey, number> = {
  alphaT3: 1,
  alphaT4: 4,
  alphaT5: 30,
  basicT6: 0.5,
  basicT7: 5,
  classT5: 0.5,
  classT6: 2,
}

/** Amortece o divisor de custo: 0 ignora custo, 1 aplica cheio. */
export const COST_DAMPENING = 0.5
