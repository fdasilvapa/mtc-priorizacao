import { describe, expect, test } from 'bun:test'
import { COST_DAMPENING, MAX_RANK, MAX_TIER_SCORE, WEIGHTS } from './config'
import { collapseCost } from './cost'
import { buildRosterContext, calculatePriorityScore, scoreRoster } from './score'
import type { McocClass, RosterChampion, RosterContext } from './types'

/** Campeao base; cada teste sobrescreve so o que importa. */
function champ(over: Partial<RosterChampion> = {}): RosterChampion {
  return {
    id: 'uc-1',
    championId: 'bc-1',
    name: 'Teste',
    championClass: 'Mutant' as McocClass,
    attackTierScore: 8,
    attackRecommendedSig: 0,
    currentRank: 2,
    sigLevel: 0,
    isFavorite: false,
    isAscended: false,
    ...over,
  }
}

const semContexto = buildRosterContext([])

/**
 * Reproduz a media ponderada de calculatePriorityScore, mas sem a divisao
 * pelo custo. Serve para isolar o efeito do divisor de custo nos testes.
 */
function weightedOf(champion: RosterChampion, context: RosterContext): number {
  const sTier = champion.attackTierScore / MAX_TIER_SCORE
  const sRank = (MAX_RANK - champion.currentRank) / (MAX_RANK - 1)

  const sClass =
    context.maxClassCount === 0
      ? 0
      : (context.maxClassCount - context.classCounts[champion.championClass]) /
        context.maxClassCount

  const sSig =
    champion.attackRecommendedSig === 0
      ? 1
      : Math.min(1, champion.sigLevel / champion.attackRecommendedSig)

  return (
    WEIGHTS.tier * sTier +
    WEIGHTS.rank * sRank +
    WEIGHTS.class * sClass +
    WEIGHTS.sig * sSig +
    WEIGHTS.fav * (champion.isFavorite ? 1 : 0) +
    WEIGHTS.asc * (champion.isAscended ? 1 : 0)
  )
}

describe('buildRosterContext', () => {
  test('conta apenas campeoes no limiar de rank ou acima', () => {
    const ctx = buildRosterContext([
      champ({ id: 'a', championClass: 'Mutant', currentRank: 4 }),
      champ({ id: 'b', championClass: 'Mutant', currentRank: 3 }),
      champ({ id: 'c', championClass: 'Mutant', currentRank: 2 }),
      champ({ id: 'd', championClass: 'Tech', currentRank: 3 }),
    ])
    expect(ctx.classCounts.Mutant).toBe(2)
    expect(ctx.classCounts.Tech).toBe(1)
    expect(ctx.classCounts.Cosmic).toBe(0)
    expect(ctx.maxClassCount).toBe(2)
  })

  test('roster vazio nao quebra e zera o maximo', () => {
    expect(semContexto.maxClassCount).toBe(0)
    expect(semContexto.classCounts.Skill).toBe(0)
  })
})

describe('calculatePriorityScore', () => {
  test('tier alto em R1 supera tier alto em R4', () => {
    const r1 = calculatePriorityScore(champ({ attackTierScore: 10, currentRank: 1 }), semContexto)
    const r4 = calculatePriorityScore(champ({ attackTierScore: 10, currentRank: 4 }), semContexto)
    expect(r1).toBeGreaterThan(r4)
  })

  test('classe carente supera classe saturada, resto igual', () => {
    const ctx = buildRosterContext([
      champ({ id: 'a', championClass: 'Tech', currentRank: 4 }),
      champ({ id: 'b', championClass: 'Tech', currentRank: 4 }),
    ])
    const carente = calculatePriorityScore(champ({ championClass: 'Mystic' }), ctx)
    const saturada = calculatePriorityScore(champ({ championClass: 'Tech' }), ctx)
    expect(carente).toBeGreaterThan(saturada)
  })

  test('undup exigindo x200 pontua abaixo do mesmo campeao com sig 200', () => {
    const undup = calculatePriorityScore(champ({ attackRecommendedSig: 200, sigLevel: 0 }), semContexto)
    const dupado = calculatePriorityScore(champ({ attackRecommendedSig: 200, sigLevel: 200 }), semContexto)
    expect(undup).toBeLessThan(dupado)
  })

  test('sig acima do recomendado nao pontua mais que o recomendado exato', () => {
    const exato = calculatePriorityScore(champ({ attackRecommendedSig: 20, sigLevel: 20 }), semContexto)
    const acima = calculatePriorityScore(champ({ attackRecommendedSig: 20, sigLevel: 200 }), semContexto)
    expect(acima).toBe(exato)
  })

  test('recomendado undup (0) nao penaliza campeao sem sig', () => {
    const semReq = calculatePriorityScore(champ({ attackRecommendedSig: 0, sigLevel: 0 }), semContexto)
    const comReqAtendido = calculatePriorityScore(champ({ attackRecommendedSig: 20, sigLevel: 20 }), semContexto)
    expect(semReq).toBe(comReqAtendido)
  })

  test('favorito supera nao-favorito, resto igual', () => {
    const fav = calculatePriorityScore(champ({ isFavorite: true }), semContexto)
    const naoFav = calculatePriorityScore(champ({ isFavorite: false }), semContexto)
    expect(fav).toBeGreaterThan(naoFav)
  })

  test('ascendido supera nao-ascendido, resto igual', () => {
    const asc = calculatePriorityScore(champ({ isAscended: true }), semContexto)
    const naoAsc = calculatePriorityScore(champ({ isAscended: false }), semContexto)
    expect(asc).toBeGreaterThan(naoAsc)
  })

  test('campeao no rank maximo recebe score zero', () => {
    expect(calculatePriorityScore(champ({ currentRank: 5 }), semContexto)).toBe(0)
  })

  test('o custo penaliza de forma perceptivel um rank up caro', () => {
    const r4 = champ({ attackTierScore: 10, currentRank: 4 })
    const score = calculatePriorityScore(r4, semContexto)
    const multiplicador = weightedOf(r4, semContexto) / score

    expect(multiplicador).toBeCloseTo(collapseCost(4) ** COST_DAMPENING, 10)
    expect(multiplicador).toBeGreaterThan(1.3)
  })

  test('o custo nunca pesa mais que a diferenca de tier', () => {
    const multiplicadorMaximo = collapseCost(4) ** COST_DAMPENING
    expect(multiplicadorMaximo).toBeLessThan(2)
  })
})

describe('scoreRoster', () => {
  test('ordena por score decrescente', () => {
    const resultado = scoreRoster([
      champ({ id: 'fraco', attackTierScore: 5 }),
      champ({ id: 'forte', attackTierScore: 10 }),
    ])
    expect(resultado.map((c) => c.id)).toEqual(['forte', 'fraco'])
  })

  test('joga os maxed para o fim mesmo com tier alto', () => {
    const resultado = scoreRoster([
      champ({ id: 'maxed', attackTierScore: 10, currentRank: 5 }),
      champ({ id: 'normal', attackTierScore: 5, currentRank: 2 }),
    ])
    expect(resultado.map((c) => c.id)).toEqual(['normal', 'maxed'])
    expect(resultado[1].maxed).toBe(true)
    expect(resultado[0].maxed).toBe(false)
  })

  test('roster vazio devolve lista vazia', () => {
    expect(scoreRoster([])).toEqual([])
  })
})
