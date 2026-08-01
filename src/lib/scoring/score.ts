import {
  COST_DAMPENING,
  MAX_RANK,
  MAX_RECOMMENDED_SIG,
  MAX_TIER_SCORE,
  TIER_SCORE_FLOOR,
  WEIGHTS,
} from './config'
import { collapseCost } from './cost'
import { MCOC_CLASSES } from './types'
import type { McocClass, RosterChampion, RosterContext, ScoredChampion } from './types'

/**
 * Custo ja pago para levar um campeao do R1 ate o rank atual, na mesma unidade
 * de collapseCost (o rank up 1->2 vale 1.0).
 */
export function investedInRank(rank: number): number {
  let total = 0
  for (let r = 1; r < rank; r++) total += collapseCost(r)
  return total
}

/**
 * Agrega o roster inteiro uma unica vez: quanto custo ja foi pago em cada
 * classe. E o insumo do fator de equilibrio de classe.
 */
export function buildRosterContext(roster: RosterChampion[]): RosterContext {
  const classInvestment = Object.fromEntries(
    MCOC_CLASSES.map((c) => [c, 0]),
  ) as Record<McocClass, number>

  for (const champion of roster) {
    classInvestment[champion.championClass] += investedInRank(champion.currentRank)
  }

  return {
    classInvestment,
    maxClassInvestment: Math.max(...Object.values(classInvestment)),
  }
}

/**
 * Nota da tier list em 0..1, ancorada em TIER_SCORE_FLOOR e nao em zero.
 * Tudo no piso ou abaixo dele colapsa em 0 — ver o comentario da constante.
 */
export function normalizeTier(attackTierScore: number): number {
  const span = MAX_TIER_SCORE - TIER_SCORE_FLOOR
  return Math.max(0, Math.min(1, (attackTierScore - TIER_SCORE_FLOOR) / span))
}

/**
 * Media ponderada dos fatores, antes da divisao pelo custo. Exportada para que
 * os testes possam isolar o efeito do divisor sem reimplementar a formula.
 */
export function weightedScore(
  champion: RosterChampion,
  context: RosterContext,
): number {
  const sTier = normalizeTier(champion.attackTierScore)
  const sRank = (MAX_RANK - champion.currentRank) / (MAX_RANK - 1)

  const sClass =
    context.maxClassInvestment === 0
      ? 0
      : 1 - context.classInvestment[champion.championClass] / context.maxClassInvestment

  // O que importa e quanto sig ainda FALTA, nao a fracao ja percorrida: quem
  // precisa de 20 e esta em 0 esta a um passo de pronto, e a razao antiga o
  // tratava igual a quem precisa de 200. Recomendado 0 da gap 0, ou seja, nota
  // cheia — agora por coerencia da formula e nao por um caso especial.
  const sigGap = Math.max(0, champion.attackRecommendedSig - champion.sigLevel)
  const sSig = 1 - Math.min(1, sigGap / MAX_RECOMMENDED_SIG)

  return (
    WEIGHTS.tier * sTier +
    WEIGHTS.rank * sRank +
    WEIGHTS.class * sClass +
    WEIGHTS.sig * sSig +
    WEIGHTS.fav * (champion.isFavorite ? 1 : 0) +
    WEIGHTS.asc * (champion.isAscended ? 1 : 0)
  )
}

/**
 * Media ponderada dividida pelo custo amortecido do proximo rank up.
 * Campeoes no rank maximo devolvem 0 — nao ha para onde subir.
 */
export function calculatePriorityScore(
  champion: RosterChampion,
  context: RosterContext,
): number {
  if (champion.currentRank >= MAX_RANK) return 0

  return weightedScore(champion, context) / collapseCost(champion.currentRank) ** COST_DAMPENING
}

/** Pontua o roster inteiro e devolve ordenado, com os maxed no fim. */
export function scoreRoster(roster: RosterChampion[]): ScoredChampion[] {
  const context = buildRosterContext(roster)

  return roster
    .map((champion) => ({
      ...champion,
      score: calculatePriorityScore(champion, context),
      maxed: champion.currentRank >= MAX_RANK,
    }))
    .sort((a, b) => {
      if (a.maxed !== b.maxed) return a.maxed ? 1 : -1
      return b.score - a.score
    })
}
