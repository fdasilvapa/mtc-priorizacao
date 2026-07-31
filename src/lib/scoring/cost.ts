import { CATALYST_SCARCITY, RANK_UP_COST } from './config'
import type { CatalystCost, CatalystKey } from './types'

/** Soma ponderada pela escassez. Unidade arbitraria — so a razao importa. */
function rawCost(cost: CatalystCost): number {
  return Object.entries(cost).reduce(
    (total, [key, qty]) => total + qty * CATALYST_SCARCITY[key as CatalystKey],
    0,
  )
}

const BASE_COST = rawCost(RANK_UP_COST[1])

/**
 * Colapsa o vetor de catalisadores num escalar, normalizado pelo rank up
 * mais barato (1->2 vale 1.0).
 *
 * @throws RangeError se o rank nao tem rank up definido (R5 ja e o maximo).
 */
export function collapseCost(rank: number): number {
  const cost = RANK_UP_COST[rank]
  if (!cost) {
    throw new RangeError(`Sem custo de rank up definido para o rank ${rank}`)
  }
  return rawCost(cost) / BASE_COST
}
