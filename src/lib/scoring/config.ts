import type { CatalystCost, CatalystKey } from './types'

/**
 * Pesos da media ponderada. Somam 1.0.
 *
 * Calibrados em 01/08/2026 contra o roster real (91 campeoes), nao so contra a
 * tier list. Com TIER_SCORE_FLOOR = 7 e tier em 0.49, uma faixa de tier
 * (0,5 de nota) vale 0.0817 no termo ponderado — a referencia para dimensionar
 * o resto:
 *
 *   asc 0.09  ascender vale pouco mais que uma faixa de tier, de proposito:
 *             ascensao virou um salto de poder real no jogo. Subiu de 0.08
 *             junto com tier — o que se preserva e a RELACAO com a faixa, nao
 *             o numero absoluto.
 *   sig 0.07  abaixo de uma faixa. Mede o gap que falta, nao a razao.
 *   fav 0.06  desempate do dono, sem forca para inverter uma faixa de tier.
 *
 * rank caiu de 0.20 para 0.14: ele contava a mesma coisa que o divisor de
 * custo, que tambem favorece rank baixo. Somados valiam mais que a tier list.
 *
 * Uma advertencia medida: o top 20 do roster cabe numa faixa de 0.103, com
 * 0.0054 entre vizinhos. Nenhum peso aqui e ajuste fino — mexer 0.01 reordena
 * o topo de forma visivel, e diferencas abaixo de 0.005 sao ruido.
 */
export const WEIGHTS = {
  tier: 0.49,
  rank: 0.14,
  class: 0.15,
  sig: 0.07,
  fav: 0.06,
  asc: 0.09,
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
 * ~0.10 de amplitude real, menos que sig e menos que classe, apesar do peso alto de tier.
 *
 * Em 7, as faixas Mediocre e Awful da tier list zeram as duas. Nao e perda:
 * nenhuma delas e candidata a rank up, e isso torna irrelevante como colapsar
 * as notas em intervalo ("6,5-5", "4-1") num numero so.
 */
export const TIER_SCORE_FLOOR = 7

/**
 * Maior sig recomendado do catalogo (os valores sao 0, 20, 60, 80 e 200).
 * Serve de escala para o gap: quem precisa de 200 e esta em 0 zera o fator, e
 * todo o resto se mede contra isso. Se a fonte passar a recomendar mais que
 * 200, este numero acompanha.
 */
export const MAX_RECOMMENDED_SIG = 200

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
 * Em 0.1 o divisor vai de 1.0 (R1) ate ~1.22 (R4) — um rank up caro custa ate
 * ~18% do score, contra ~33% em 0.2. Baixou porque o custo estava contando
 * duas vezes junto com o peso de rank.
 *
 * Nao baixar mais: 64 dos 91 campeoes do roster sao R1, entao ~14 no top 20 e
 * o esperado por proporcao. Ja e o que sai hoje; menos dampening criaria vies
 * na direcao oposta.
 */
export const COST_DAMPENING = 0.1
