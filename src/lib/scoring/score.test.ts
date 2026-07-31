import { describe, expect, test } from 'bun:test'
import { COST_DAMPENING, MAX_RANK, WEIGHTS } from './config'
import { collapseCost } from './cost'
import {
  buildRosterContext,
  calculatePriorityScore,
  normalizeTier,
  scoreRoster,
} from './score'
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
  const sTier = normalizeTier(champion.attackTierScore)
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

/**
 * Invariantes da calibragem contra a tier list real. Sao afirmacoes sobre a
 * RELACAO entre os fatores, nao sobre valores absolutos: os pesos podem mudar
 * desde que a hierarquia continue de pe.
 *
 * A unidade de referencia e a faixa da tier list — 0,5 de nota, a distancia
 * entre duas faixas vizinhas da fonte (Incredible 9,5 -> Top of the Class 10).
 */
describe('calibragem: hierarquia dos fatores', () => {
  const faixa = WEIGHTS.tier * (normalizeTier(10) - normalizeTier(9.5))
  const ponto = WEIGHTS.tier * (normalizeTier(10) - normalizeTier(9))

  test('a nota e ancorada num piso, nao em zero', () => {
    expect(normalizeTier(10)).toBe(1)
    // Duas faixas abaixo do topo ja custam metade da escala; com nota/10
    // custariam 10%, o que esvaziava o peso de tier na faixa util.
    expect(normalizeTier(8.5)).toBeCloseTo(0.5, 10)
    // Mediocre e Awful colapsam no piso: nao sao candidatos a rank up.
    expect(normalizeTier(5.75)).toBe(0)
    expect(normalizeTier(2.5)).toBe(0)
  })

  test('favoritar nao inverte uma faixa de tier', () => {
    expect(WEIGHTS.fav).toBeLessThan(faixa)
  })

  test('o sig cheio nao inverte uma faixa de tier', () => {
    expect(WEIGHTS.sig).toBeLessThan(faixa)
  })

  test('ascender vence uma faixa de tier, mas nao um ponto inteiro de nota', () => {
    expect(WEIGHTS.asc).toBeGreaterThan(faixa)
    expect(WEIGHTS.asc).toBeLessThan(ponto)
  })

  test('favorito + ascendido juntos nao alcancam um ponto inteiro de nota', () => {
    expect(WEIGHTS.fav + WEIGHTS.asc).toBeLessThan(ponto)
  })

  test('somando o sig, os tres nao alcancam dois pontos de nota', () => {
    const doisPontos = WEIGHTS.tier * (normalizeTier(10) - normalizeTier(8))
    expect(WEIGHTS.fav + WEIGHTS.asc + WEIGHTS.sig).toBeLessThan(doisPontos)
  })

  test('na pratica: Incredible ascendido passa Top of the Class puro', () => {
    const [primeiro] = scoreRoster([
      champ({ id: 'top', attackTierScore: 10 }),
      champ({ id: 'ascendido', attackTierScore: 9.5, isAscended: true }),
    ])
    expect(primeiro.id).toBe('ascendido')
  })

  test('na pratica: Fantastic ascendido e favoritado NAO passa Top of the Class puro', () => {
    const [primeiro] = scoreRoster([
      champ({ id: 'top', attackTierScore: 10 }),
      champ({ id: 'turbinado', attackTierScore: 9, isAscended: true, isFavorite: true }),
    ])
    expect(primeiro.id).toBe('top')
  })

  test('na pratica: sig zerado nao derruba um Top of the Class abaixo de um Very Good', () => {
    const [primeiro] = scoreRoster([
      champ({ id: 'top', attackTierScore: 10, attackRecommendedSig: 200, sigLevel: 0 }),
      champ({ id: 'vg', attackTierScore: 8, attackRecommendedSig: 0 }),
    ])
    expect(primeiro.id).toBe('top')
  })

  test('os pesos somam 1', () => {
    const soma = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
    expect(soma).toBeCloseTo(1, 10)
  })

  test('pontuar nao depende do contexto de classe para valer a hierarquia', () => {
    // Guarda contra alguem reintroduzir dependencia de contexto nos bonus.
    const a = calculatePriorityScore(champ({ attackTierScore: 10 }), semContexto)
    const b = calculatePriorityScore(
      champ({ attackTierScore: 9.5, isAscended: true }),
      semContexto,
    )
    expect(b).toBeGreaterThan(a)
  })
})
