# Recalibragem dos pesos de priorizacao — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir tres defeitos do motor de score — o fator de classe que premia a classe mais investida, o fator de sig que confunde "longe" com "quase pronto", e a baixa resolucao do ranking.

**Architecture:** Tudo acontece dentro de `src/lib/scoring/`, que e TypeScript puro sem I/O. Nenhum arquivo fora do modulo consome `RosterContext` — verificado por busca. Sem migration, sem mudanca de UI, sem mudanca de dados. O modulo ja tem 31 testes passando; o trabalho e guiado por eles.

**Tech Stack:** TypeScript, Next.js 16, Bun (runtime e test runner). Testes com `bun:test`.

## Global Constraints

- Os pesos de `WEIGHTS` devem somar exatamente 1.00. Ha um teste que verifica isso.
- Valores finais, copiados da spec: `tier 0.49`, `rank 0.14`, `class 0.15`, `sig 0.07`, `fav 0.06`, `asc 0.09`, `COST_DAMPENING 0.1`, `MAX_RECOMMENDED_SIG 200`.
- `CATALYST_SCARCITY`, `TIER_SCORE_FLOOR`, `RANK_UP_COST`, `MAX_RANK` e `MAX_TIER_SCORE` **nao** mudam.
- Comentarios em portugues sem acentuacao, seguindo o padrao ja existente em `config.ts`.
- Cada constante alterada mantem um comentario explicando o **porque** do numero. Esse padrao e o que permitiu diagnosticar a calibragem anterior; nao o quebre.
- Rodar a suite com `bun test`. Nunca declarar sucesso sem ver a saida.

---

## Task 0: Sincronizar a branch com a remota

Nenhum codigo. Este passo existe porque trabalhar sobre uma base desatualizada
faz o ranking de referencia da spec nao bater.

- [ ] **Step 1: Buscar o estado da remota**

```bash
git fetch origin
```

- [ ] **Step 2: Conferir em que branch estas e se ha divergencia**

```bash
git status -sb
git log --oneline -1 origin/main
```

Esperado: estar em `feat/recalibragem-pesos`. Anote o hash de `origin/main`.

- [ ] **Step 3: Trazer a main remota para dentro da branch**

```bash
git merge --ff-only origin/main
```

Se o `--ff-only` falhar, a branch divergiu de `origin/main`. **Pare e pergunte
ao dono** antes de fazer merge ou rebase — nao decida sozinho como reconciliar.

- [ ] **Step 4: Confirmar que a suite passa antes de mexer em nada**

```bash
bun test
```

Esperado: `31 pass, 0 fail`. Se falhar aqui, o problema e anterior a este plano —
pare e reporte.

---

## Task 1: Extrair `weightedScore` para o teste parar de duplicar a formula

O `score.test.ts` tem um helper `weightedOf` (linhas 31-58) que **reimplementa** a
media ponderada. Um teste que recalcula a formula que testa so pega erro de
digitacao — e pior, ele teria que ser editado em toda task seguinte. Extrair
primeiro faz as tasks 2, 3 e 4 mexerem num lugar so.

**Files:**
- Modify: `src/lib/scoring/score.ts:47-76`
- Test: `src/lib/scoring/score.test.ts:31-58,131-138`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `weightedScore(champion: RosterChampion, context: RosterContext): number` — a media ponderada **sem** a divisao pelo custo. `calculatePriorityScore` passa a ser `weightedScore / custo`, com a mesma assinatura de antes.

- [ ] **Step 1: Trocar o helper do teste pela funcao real**

Em `src/lib/scoring/score.test.ts`, apague o helper `weightedOf` inteiro
(linhas 31-58, incluindo o comentario acima dele) e acrescente `weightedScore`
ao import que ja existe:

```ts
import {
  buildRosterContext,
  calculatePriorityScore,
  normalizeTier,
  scoreRoster,
  weightedScore,
} from './score'
```

O import de `WEIGHTS` continua necessario (o bloco de calibragem usa). O import
de `MAX_RANK` pode ficar; ele tambem e usado em outros pontos.

No teste `o custo penaliza de forma perceptivel um rank up caro` (linha ~134),
troque a chamada:

```ts
    const multiplicador = weightedScore(r4, semContexto) / score
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
bun test
```

Esperado: FALHA com algo como `Export named 'weightedScore' not found in module`.

- [ ] **Step 3: Extrair a funcao em `score.ts`**

Substitua o corpo de `calculatePriorityScore` (linhas 47-76) por:

```ts
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
```

Este passo e refatoracao pura: nenhum numero muda.

- [ ] **Step 4: Rodar e ver passar**

```bash
bun test
```

Esperado: `31 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/score.ts src/lib/scoring/score.test.ts
git commit -m "refactor: Extrai weightedScore para o teste nao duplicar a formula

O helper weightedOf do score.test.ts reimplementava a media ponderada.
Um teste que recalcula a formula que testa so pega erro de digitacao.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Fator de classe passa a medir investimento acumulado

O defeito que originou tudo. Hoje `CLASS_RANK_THRESHOLD = 3` conta apenas
campeoes em R3+, o que no roster real apaga 16 dos 17 misticos e faz Mystic — a
classe **mais** investida (12.5 em custo acumulado) — receber o bonus maximo de
"classe carente", igual a Tech, que e a **menos** investida (4.8).

**Files:**
- Modify: `src/lib/scoring/types.ts:29-33`
- Modify: `src/lib/scoring/config.ts:35-36` (remover `CLASS_RANK_THRESHOLD`)
- Modify: `src/lib/scoring/score.ts:1-32` (imports e `buildRosterContext`), e o `sClass` dentro de `weightedScore`
- Test: `src/lib/scoring/score.test.ts:60-78`

**Interfaces:**
- Consumes: `weightedScore(champion, context)` da Task 1. `collapseCost(rank: number): number` de `./cost`, que ja existe e lanca `RangeError` para rank sem custo definido (R5).
- Produces:
  - `investedInRank(rank: number): number` — custo ja pago para levar um campeao do R1 ate `rank`. R1=0, R2=1.0, R3=2.780, R4=5.537, R5=12.756.
  - `RosterContext` com os campos `classInvestment: Record<McocClass, number>` e `maxClassInvestment: number`. Os campos antigos `classCounts` e `maxClassCount` deixam de existir.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/scoring/score.test.ts`, substitua o `describe('buildRosterContext', ...)`
inteiro (linhas 60-78) por:

```ts
describe('investedInRank', () => {
  test('R1 nao teve investimento nenhum', () => {
    expect(investedInRank(1)).toBe(0)
  })

  test('cada rank acumula o custo de todos os rank ups anteriores', () => {
    expect(investedInRank(2)).toBeCloseTo(collapseCost(1), 10)
    expect(investedInRank(3)).toBeCloseTo(collapseCost(1) + collapseCost(2), 10)
    expect(investedInRank(5)).toBeCloseTo(
      collapseCost(1) + collapseCost(2) + collapseCost(3) + collapseCost(4),
      10,
    )
  })

  test('o investimento cresce mais rapido nos ranks altos', () => {
    const doR1AoR2 = investedInRank(2) - investedInRank(1)
    const doR3AoR4 = investedInRank(4) - investedInRank(3)
    expect(doR3AoR4).toBeGreaterThan(doR1AoR2 * 2)
  })
})

describe('buildRosterContext', () => {
  test('soma o investimento de todos os campeoes da classe, sem limiar de rank', () => {
    const ctx = buildRosterContext([
      champ({ id: 'a', championClass: 'Mutant', currentRank: 4 }),
      champ({ id: 'b', championClass: 'Mutant', currentRank: 2 }),
      champ({ id: 'c', championClass: 'Tech', currentRank: 3 }),
    ])
    expect(ctx.classInvestment.Mutant).toBeCloseTo(investedInRank(4) + investedInRank(2), 10)
    expect(ctx.classInvestment.Tech).toBeCloseTo(investedInRank(3), 10)
    expect(ctx.classInvestment.Cosmic).toBe(0)
    expect(ctx.maxClassInvestment).toBeCloseTo(investedInRank(4) + investedInRank(2), 10)
  })

  test('um rank up de R1 para R2 move o fator — era o defeito do limiar em R3', () => {
    const antes = buildRosterContext([champ({ championClass: 'Mystic', currentRank: 1 })])
    const depois = buildRosterContext([champ({ championClass: 'Mystic', currentRank: 2 })])
    expect(antes.classInvestment.Mystic).toBe(0)
    expect(depois.classInvestment.Mystic).toBeGreaterThan(0)
  })

  test('roster inteiro em R1 zera tudo sem dividir por zero', () => {
    const ctx = buildRosterContext([
      champ({ id: 'a', championClass: 'Skill', currentRank: 1 }),
      champ({ id: 'b', championClass: 'Tech', currentRank: 1 }),
    ])
    expect(ctx.maxClassInvestment).toBe(0)
    expect(calculatePriorityScore(champ({ championClass: 'Skill', currentRank: 1 }), ctx)).toBeGreaterThan(0)
  })

  test('roster vazio nao quebra e zera o maximo', () => {
    expect(semContexto.maxClassInvestment).toBe(0)
    expect(semContexto.classInvestment.Skill).toBe(0)
  })

  test('a classe menos investida recebe o bonus maximo', () => {
    const ctx = buildRosterContext([
      champ({ id: 'a', championClass: 'Mystic', currentRank: 4 }),
      champ({ id: 'b', championClass: 'Mystic', currentRank: 4 }),
      champ({ id: 'c', championClass: 'Tech', currentRank: 2 }),
    ])
    const menosInvestida = calculatePriorityScore(champ({ championClass: 'Cosmic' }), ctx)
    const intermediaria = calculatePriorityScore(champ({ championClass: 'Tech' }), ctx)
    const maisInvestida = calculatePriorityScore(champ({ championClass: 'Mystic' }), ctx)
    expect(menosInvestida).toBeGreaterThan(intermediaria)
    expect(intermediaria).toBeGreaterThan(maisInvestida)
  })
})
```

Acrescente `investedInRank` ao import de `./score` e garanta que `collapseCost`
esta importado de `./cost` (ja esta, na linha 3).

- [ ] **Step 2: Rodar e ver falhar**

```bash
bun test
```

Esperado: FALHA com `Export named 'investedInRank' not found in module`.

- [ ] **Step 3: Trocar o tipo do contexto**

Em `src/lib/scoring/types.ts`, substitua a interface `RosterContext` (linhas 29-33):

```ts
/**
 * Agregados do roster inteiro, calculados uma unica vez.
 * O investimento por classe e a base do fator de equilibrio: ele mede o custo
 * ja pago em cada classe, nao quantos campeoes cruzaram um limiar de rank.
 */
export interface RosterContext {
  classInvestment: Record<McocClass, number>
  maxClassInvestment: number
}
```

- [ ] **Step 4: Remover a constante que perdeu uso**

Em `src/lib/scoring/config.ts`, apague as linhas 35-36:

```ts
/** A partir deste rank o campeao conta como "evoluido" no equilibrio de classe. */
export const CLASS_RANK_THRESHOLD = 3
```

- [ ] **Step 5: Reescrever `buildRosterContext` e o `sClass`**

Em `src/lib/scoring/score.ts`, ajuste o import de `./config` removendo
`CLASS_RANK_THRESHOLD`:

```ts
import {
  COST_DAMPENING,
  MAX_RANK,
  MAX_TIER_SCORE,
  TIER_SCORE_FLOOR,
  WEIGHTS,
} from './config'
```

Substitua `buildRosterContext` (linhas 13-32) por:

```ts
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
```

E dentro de `weightedScore`, troque o bloco do `sClass` por:

```ts
  const sClass =
    context.maxClassInvestment === 0
      ? 0
      : 1 - context.classInvestment[champion.championClass] / context.maxClassInvestment
```

- [ ] **Step 6: Rodar e ver passar**

```bash
bun test
```

Esperado: todos passando. Se o teste `classe carente supera classe saturada`
(o antigo, linha ~87) falhar, leia-o: ele monta um contexto com dois Tech em R4
e compara Mystic contra Tech. Com a formula nova Mystic tem investimento 0 e
Tech tem o maximo, entao ele deve continuar passando — se falhou, o erro esta
na implementacao, nao no teste.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scoring/
git commit -m "fix: Mede equilibrio de classe por investimento, nao por contagem

CLASS_RANK_THRESHOLD = 3 contava so campeoes em R3+, o que no roster real
apagava 16 dos 17 misticos e fazia Mystic — a classe mais investida, 12.5 em
custo acumulado — receber o mesmo bonus de carencia que Tech, a menos
investida com 4.8. A contagem binaria tambem so assumia dois valores neste
roster, usando metade do peso nominal, e era cega a qualquer rank up que nao
cruzasse a fronteira do R3.

Agora sClass = 1 - investimento[classe] / maior investimento, reusando
collapseCost. Um rank up de R1 para R2 passa a mover o fator.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Fator de sig passa a medir o gap absoluto

Hoje `sSig` e uma razao, entao quem precisa de 20 sig e esta em 0 recebe `0.00`
— o mesmo que quem precisa de 200 e esta em 0, apesar de estar a um passo de
pronto. No roster real, 48 campeoes caem nesse caso.

**Files:**
- Modify: `src/lib/scoring/config.ts` (acrescentar `MAX_RECOMMENDED_SIG`)
- Modify: `src/lib/scoring/score.ts` (o `sSig` dentro de `weightedScore`)
- Test: `src/lib/scoring/score.test.ts` (bloco `calculatePriorityScore`)

**Interfaces:**
- Consumes: `weightedScore` da Task 1, `RosterContext` novo da Task 2.
- Produces: `MAX_RECOMMENDED_SIG = 200` exportado de `./config`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/scoring/score.test.ts`, dentro do `describe('calculatePriorityScore', ...)`,
acrescente estes testes logo depois do teste
`recomendado undup (0) nao penaliza campeao sem sig`:

```ts
  test('quem precisa de pouco sig pontua bem acima de quem precisa de muito', () => {
    const quasePronto = calculatePriorityScore(
      champ({ attackRecommendedSig: 20, sigLevel: 0 }), semContexto,
    )
    const bemLonge = calculatePriorityScore(
      champ({ attackRecommendedSig: 200, sigLevel: 0 }), semContexto,
    )
    expect(quasePronto).toBeGreaterThan(bemLonge)
  })

  test('o que conta e o gap absoluto, nao a fracao percorrida', () => {
    // 36/60 e 60% da razao, mas faltam so 24 sig; 120/200 tambem e 60%,
    // mas faltam 80. O primeiro esta mais perto de pronto.
    const gapPequeno = calculatePriorityScore(
      champ({ attackRecommendedSig: 60, sigLevel: 36 }), semContexto,
    )
    const gapGrande = calculatePriorityScore(
      champ({ attackRecommendedSig: 200, sigLevel: 120 }), semContexto,
    )
    expect(gapPequeno).toBeGreaterThan(gapGrande)
  })

  test('o gap maximo do catalogo zera o fator', () => {
    const semNada = weightedScore(
      champ({ attackRecommendedSig: MAX_RECOMMENDED_SIG, sigLevel: 0 }), semContexto,
    )
    const cheio = weightedScore(
      champ({ attackRecommendedSig: MAX_RECOMMENDED_SIG, sigLevel: MAX_RECOMMENDED_SIG }),
      semContexto,
    )
    expect(cheio - semNada).toBeCloseTo(WEIGHTS.sig, 10)
  })
```

Acrescente `MAX_RECOMMENDED_SIG` ao import de `./config` no topo do arquivo:

```ts
import { COST_DAMPENING, MAX_RANK, MAX_RECOMMENDED_SIG, WEIGHTS } from './config'
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
bun test
```

Esperado: FALHA. O teste `quem precisa de pouco sig...` falha porque hoje os dois
campeoes recebem exatamente 0.00, e `MAX_RECOMMENDED_SIG` nao existe.

- [ ] **Step 3: Acrescentar a constante**

Em `src/lib/scoring/config.ts`, logo depois de `TIER_SCORE_FLOOR`:

```ts
/**
 * Maior sig recomendado do catalogo (os valores sao 0, 20, 60, 80 e 200).
 * Serve de escala para o gap: quem precisa de 200 e esta em 0 zera o fator, e
 * todo o resto se mede contra isso. Se a fonte passar a recomendar mais que
 * 200, este numero acompanha.
 */
export const MAX_RECOMMENDED_SIG = 200
```

- [ ] **Step 4: Trocar a formula**

Em `src/lib/scoring/score.ts`, acrescente `MAX_RECOMMENDED_SIG` ao import de
`./config` e troque o bloco do `sSig` dentro de `weightedScore` por:

```ts
  // O que importa e quanto sig ainda FALTA, nao a fracao ja percorrida: quem
  // precisa de 20 e esta em 0 esta a um passo de pronto, e a razao antiga o
  // tratava igual a quem precisa de 200. Recomendado 0 da gap 0, ou seja, nota
  // cheia — agora por coerencia da formula e nao por um caso especial.
  const sigGap = Math.max(0, champion.attackRecommendedSig - champion.sigLevel)
  const sSig = 1 - Math.min(1, sigGap / MAX_RECOMMENDED_SIG)
```

- [ ] **Step 5: Rodar e ver passar**

```bash
bun test
```

Esperado: todos passando. Os tres testes antigos de sig continuam validos —
`sig acima do recomendado` e `recomendado undup (0)` dao gap 0 nos dois lados, e
`undup exigindo x200` compara gap 200 contra gap 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring/
git commit -m "fix: Mede o sig pelo gap absoluto, nao pela razao

min(1, sig/recomendado) dava 0.00 tanto para quem precisa de 20 sig e esta
em 0 quanto para quem precisa de 200 e esta em 0, apesar de o primeiro estar
a um passo de pronto. No roster real sao 48 campeoes nesse caso, e o efeito
colateral era o topo do ranking sendo decidido pelos 19 campeoes com
recomendado 0, que levavam o fator cheio de graca.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Novos pesos e dampening

**Files:**
- Modify: `src/lib/scoring/config.ts:20-27` (`WEIGHTS`) e `:84` (`COST_DAMPENING`)
- Test: `src/lib/scoring/score.test.ts:131-138` (limiar do multiplicador)

**Interfaces:**
- Consumes: tudo das tasks 1-3.
- Produces: nenhuma interface nova. Só valores.

Esta task troca constantes, entao **nao segue o ciclo TDD** das anteriores: nao
ha comportamento novo a especificar, so valores a mudar sob os testes que ja
existem. Os dois primeiros passos preparam as assercoes que dependem desses
valores; ambos continuam verdes com os pesos antigos, e isso e o esperado.

- [ ] **Step 1: Afrouxar a assercao que le o dampening**

Com `COST_DAMPENING = 0.1`, o multiplicador de custo do R4 cai de `1.4849` para
`1.2186`. O teste `o custo penaliza de forma perceptivel um rank up caro` afirma
`> 1.3` e passaria a falhar no Step 3. Em `src/lib/scoring/score.test.ts`
(linha ~137):

```ts
    expect(multiplicador).toBeGreaterThan(1.2)
```

A assercao `toBeCloseTo(collapseCost(4) ** COST_DAMPENING, 10)` logo acima nao
muda — ela le a constante, entao acompanha sozinha.

- [ ] **Step 2: Acrescentar a guarda que trava a relacao da ascensao**

Esta e a invariante que quase se perdeu ao escrever a spec: subir `tier` faz a
faixa crescer, e `asc` precisa acompanhar, senao a ascensao deixa de vencer uma
faixa de tier em silencio. No `describe('calibragem: hierarquia dos fatores', ...)`,
logo depois do teste `ascender vence uma faixa de tier...`:

```ts
  test('a margem da ascensao sobre a faixa e estreita de proposito', () => {
    // Guarda contra um ajuste em WEIGHTS.tier que faca a faixa ultrapassar
    // asc: a hierarquia inverteria sem nenhum teste reclamar.
    expect(WEIGHTS.asc - faixa).toBeGreaterThan(0)
    expect(WEIGHTS.asc - faixa).toBeLessThan(faixa / 2)
  })
```

- [ ] **Step 3: Rodar e confirmar que a suite continua verde**

```bash
bun test
```

Esperado: **todos passando**. Com `tier 0.45` e `asc 0.08` a margem e `0.005`,
dentro do limite `faixa / 2 = 0.0375`; e `1.4849 > 1.2`. Os dois passos acima
sao guardas para a troca de valores do Step 4, nao testes de mudanca — se algo
falhar aqui, o erro veio de uma task anterior.

- [ ] **Step 4: Trocar os pesos**

Em `src/lib/scoring/config.ts`, substitua o bloco `WEIGHTS` e seu comentario
(linhas 3-27) por:

```ts
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
```

E substitua `COST_DAMPENING` (linhas 77-84) por:

```ts
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
```

- [ ] **Step 5: Rodar a suite inteira**

```bash
bun test
```

Esperado: todos passando. Se `ascender vence uma faixa de tier` falhar, confira
que `asc` e `0.09` e nao `0.08` — foi exatamente esse o conflito que motivou a
mudanca.

- [ ] **Step 6: Verificar o lint e os tipos**

```bash
bunx tsc --noEmit && bun run lint
```

Esperado: sem erros. Um erro de tipo aqui provavelmente e algum ponto que ainda
usa `classCounts`/`maxClassCount`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scoring/
git commit -m "feat: Recalibra os pesos contra o roster real

tier 0.45 -> 0.49, rank 0.20 -> 0.14, fav 0.05 -> 0.06, asc 0.08 -> 0.09,
COST_DAMPENING 0.2 -> 0.1. class e sig mantem o peso; o que mudou neles foi
a formula.

rank caiu porque contava a mesma coisa que o divisor de custo. asc subiu para
preservar a relacao com a faixa de tier, que cresceu junto com o peso de tier
— a intencao e a mesma, muda a escala contra a qual ela e medida.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Conferir o resultado no roster real

Os testes provam que a formula esta correta, nao que o ranking ficou bom. Este
passo compara contra os numeros que a spec previu.

**Files:** nenhum. So verificacao.

- [ ] **Step 1: Subir a aplicacao**

```bash
bun run dev
```

- [ ] **Step 2: Abrir o roster e conferir contra a previsao da spec**

Abra `http://localhost:3000` e confira, na ordem:

| esperado | onde |
|---|---|
| Top 3: Vox, Ossos Cruzados, Venom | topo da lista |
| Simbionte Supremo por volta de #16 | era #1 |
| No maximo 2 misticos no top 20 | eram 4 |
| Shang-Chi por volta de #10 | era #29 |
| Gorr por volta de #17 | era #10 |

Divergencia de uma ou duas posicoes e normal — a spec foi calculada com um
snapshot do roster, e ele pode ter mudado. **Divergencia grande no top 3, ou
mais de 2 misticos no top 20, indica erro de implementacao**: pare e investigue
antes de seguir.

- [ ] **Step 3: Conferir que nenhuma pagina quebrou**

Visite `/adicionar` e a pagina de um campeao (`/campeao/<id>`, clicando em
qualquer card). Ambas leem o roster; um erro de tipo nao pego pelo `tsc`
apareceria aqui como a tela generica de erro.

- [ ] **Step 4: Commit, se algo precisou de ajuste**

Se os passos acima nao pediram mudanca nenhuma, nao ha o que commitar — siga
para a Task 6.

---

## Task 6: Abrir o PR

- [ ] **Step 1: Rodar a verificacao final**

```bash
bun test && bunx tsc --noEmit && bun run lint
```

Esperado: suite verde, sem erro de tipo, sem erro de lint. **Nao abra o PR sem
ver esta saida.**

- [ ] **Step 2: Publicar a branch**

```bash
git push -u origin feat/recalibragem-pesos
```

- [ ] **Step 3: Abrir o PR**

```bash
gh pr create --title "Recalibra os pesos de priorizacao" --body "$(cat <<'EOF'
Corrige tres defeitos achados ao rodar o roster real (91 campeoes) contra o
motor de score.

## O fator de classe premiava a classe errada

Mystic e a classe mais investida do roster (12.5 em custo acumulado) e recebia
o bonus maximo de "classe carente"; Tech, a menos investida (4.8), recebia o
mesmo bonus. Causas: o limiar em R3 apagava 16 dos 17 misticos, a contagem
binaria so assumia dois valores neste roster (usando metade do peso nominal), e
nenhum rank up que nao cruzasse o R3 movia o fator.

Agora `sClass = 1 - investimento[classe] / maior investimento`, reusando
`collapseCost`.

## O fator de sig confundia "longe" com "quase pronto"

`min(1, sig/recomendado)` dava 0.00 tanto para quem precisa de 20 sig quanto
para quem precisa de 200, estando ambos em 0. Agora mede o gap absoluto.

## Pesos

tier 0.45 -> 0.49, rank 0.20 -> 0.14, fav 0.05 -> 0.06, asc 0.08 -> 0.09,
`COST_DAMPENING` 0.2 -> 0.1.

## Resultado

Simbionte Supremo cai de #1 para ~#16, misticos no top 20 vao de 4 para 2, e a
resolucao do ranking melhora: scores distintos no top 20 vao de 8 para 15.

Spec: `docs/superpowers/specs/2026-08-01-recalibragem-pesos-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas para quem executar

**O que NAO fazer:**

- Nao mexa em `CATALYST_SCARCITY`. Ela reflete o perfil de jogo do dono
  (Valiant, sem Battlegrounds nem Guerras de Alianca) e ja foi calibrada.
- Nao mexa em `TIER_SCORE_FLOOR = 7`. Foi ele que resolveu a calibragem
  anterior e o comentario dele explica por que.
- Nao persista pesos no banco nem crie tela de ajuste. Foi decidido fora de
  escopo; a fonte da verdade e o `config.ts`, onde os comentarios guardam o
  porque de cada numero.
- Nao apague os comentarios longos de `config.ts` ao editar os valores. Eles
  sao o ativo mais util do arquivo.

**Se um teste de calibragem falhar depois de um ajuste de peso:** leia a
invariante antes de relaxar o limiar. Os testes do bloco
`calibragem: hierarquia dos fatores` afirmam relacoes entre fatores, nao valores
absolutos — se um deles falha, provavelmente a hierarquia inverteu de verdade.
