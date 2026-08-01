import type { CatalystCost, CatalystKey } from './types'

/**
 * Pesos da media ponderada. Somam 1.0.
 *
 * Calibrados contra a tier list real (326 campeoes, 8 faixas). Com
 * TIER_SCORE_FLOOR = 7, uma faixa de tier (0,5 de nota) vale 0.075 no termo
 * ponderado — a referencia para dimensionar todo o resto:
 *
 *   asc 0.08  ascender vale uma faixa de tier e um fio a mais. E o unico
 *             fator que vence tier no empate curto, de proposito: ascensao
 *             virou um salto de poder real no jogo.
 *   sig 0.07  abaixo de uma faixa. Nao pode ser mais: 87 dos 326 campeoes
 *             tem sig_recomendado = 0 e levam nota cheia de graca.
 *   fav 0.05  desempate deliberado do dono, sem forca para inverter tier.
 *
 * Nenhuma combinacao de fav + asc + sig (0.20) alcanca dois pontos de nota
 * (0.30). A tier list continua mandando.
 */
export const WEIGHTS = {
  tier: 0.45,
  rank: 0.20,
  class: 0.15,
  sig: 0.07,
  fav: 0.05,
  asc: 0.08,
} as const

/**
 * O rank up 5->6 nao existe no jogo ("Currently Impossible").
 * Quando a Kabam liberar, trocar aqui e acrescentar a linha 5 em RANK_UP_COST.
 */
export const MAX_RANK = 5

/** Nota maxima da tier list, usada para normalizar S_tier. */
export const MAX_TIER_SCORE = 10

/**
 * Piso da normalizacao de S_tier. Ancorar em zero seria medir a nota contra
 * um valor que nunca ocorre: campeao que se cogita subir vive entre 8 e 10,
 * ou seja, entre 0,80 e 1,00 — tier gastaria 20% da propria faixa e entregaria
 * 0.09 de amplitude real, menos que sig e menos que classe, apesar do peso 0.45.
 *
 * Em 7, as faixas Mediocre e Awful da tier list zeram as duas. Nao e perda:
 * nenhuma delas e candidata a rank up, e isso torna irrelevante como colapsar
 * as notas em intervalo ("6,5-5", "4-1") num numero so.
 */
export const TIER_SCORE_FLOOR = 7

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

/**
 * Amortece o divisor de custo: 0 ignora custo, 1 aplica cheio.
 * Em 0.2 o divisor de custo vai de 1.0 (R1) ate ~1.48 (R4) — um rank up caro
 * pode custar ate ~33% do score do campeao, mas uma diferenca de tier list
 * completa (2.5x no termo ponderado) ainda pesa mais que isso. Um valor
 * maior deixaria o custo dominar a tier list, o que nao e o objetivo.
 */
export const COST_DAMPENING = 0.2
