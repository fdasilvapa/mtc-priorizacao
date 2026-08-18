# Usabilidade mobile e terceira recalibragem — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o fator de equilíbrio de classe do motor de score, que hoje é
determinado por um único campeão maxado, e tornar o app usável com uma só mão
numa viewport de 320px.

**Architecture:** Duas frentes independentes no mesmo repositório. A Parte 1
(Tasks 1–2) mexe apenas em `src/lib/scoring/`, que é TypeScript puro sem I/O e
tem cobertura de testes real. A Parte 2 (Tasks 3–9) mexe apenas na interface. Não
há acoplamento entre elas; se uma travar, a outra segue.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS
v4, Supabase, Bun como runtime e test runner.

**Spec:** `docs/superpowers/specs/2026-08-15-usabilidade-e-recalibragem-design.md`

## Global Constraints

- **Comandos de verificação:** `bun test && bun run lint && bun run build`.
- **NUNCA usar `bunx tsc --noEmit` como gate.** Ele falha com
  `Cannot find module 'bun:test'` nos arquivos de teste porque falta `bun-types`.
  É dívida anterior a este trabalho — não tente consertá-la aqui, está fora de
  escopo. `bun run build` passa porque o Next exclui os testes.
- **Não existe `test` em `package.json`.** `bun test` funciona sem script.
- **Não há setup de teste de componente React** neste repositório (sem
  `@testing-library/react`, sem `happy-dom`). Instalar um está fora de escopo.
  Por isso as tasks de interface verificam por `lint` + `build` + inspeção visual,
  e toda lógica que *pode* ser testada é extraída para função pura e testada de
  verdade. Não escreva testes de componente falsos ou vazios.
- **Idioma:** todo texto de interface, nome de teste e comentário em português,
  sem acentuação em identificadores de código. Siga o estilo já existente nos
  arquivos vizinhos.
- **Comentários de código são a documentação viva deste projeto.** O `config.ts`
  registra o *porquê* de cada peso, e foi lendo esses comentários que o defeito
  desta rodada foi diagnosticado. Ao mudar um número, atualize a justificativa.
- **Pesos devem somar exatamente 1.0** — já existe um teste `'os pesos somam 1'`.
- **Alvo mínimo de toque: 44px** em qualquer controle interativo novo ou tocado.
- **A 320px de largura nada pode rolar na horizontal.**

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `src/lib/scoring/score.ts` | `rankPoints` substitui `investedInRank`; `buildRosterContext` soma pontos | 1 |
| `src/lib/scoring/types.ts` | `RosterContext` passa a falar em pontos, não em investimento | 1 |
| `src/lib/scoring/score.test.ts` | Testes do fator de classe, incluindo as duas guardas novas | 1, 2 |
| `src/lib/scoring/config.ts` | Vetor de pesos e sua justificativa | 2 |
| `src/lib/step-value.ts` | **Novo.** Aritmética pura do stepper (passo + clamp) | 3 |
| `src/lib/step-value.test.ts` | **Novo.** Testes da aritmética | 3 |
| `src/components/NumberStepper.tsx` | **Novo.** Stepper `−20 −1 valor +1 +20` | 4 |
| `src/components/RankPicker.tsx` | **Novo.** Controle segmentado `R1..R5` | 5 |
| `src/components/ChampionFields.tsx` | Passa a compor Stepper + RankPicker + toggle | 4, 5, 6 |
| `src/components/ToggleRow.tsx` | **Novo.** Checkbox com a linha inteira clicável | 6 |
| `src/app/actions/edit-champion.ts` | Redireciona para a lista após salvar | 7 |
| `src/app/campeao/[id]/EditChampionForm.tsx` | Perde a mensagem "salvas"; ganha o nome oculto | 7 |
| `src/components/SavedBanner.tsx` | **Novo.** Aviso que some sozinho | 7 |
| `src/app/page.tsx` | Renderiza o aviso; cabeçalho que não estoura | 7, 9 |
| `src/app/adicionar/AddChampionForm.tsx` | `<select>` vira campo com busca | 8 |
| `src/components/RosterFilters.tsx` | Filtros que não estouram | 9 |
| `src/components/ChampionActions.tsx` | Alvos de toque maiores | 6 |
| `src/components/SignOutButton.tsx` | Vira botão de verdade | 6 |

---

## Parte 1 — Recalibragem

### Task 1: Fator de classe passa a contar pontos de rank

O fator de equilíbrio de classe hoje soma `investedInRank`, que acumula
`collapseCost`. Como `collapseCost` embute a escassez de catalisadores
(`alphaT5: 30`), um campeão R5 vale 12,76 — mais que doze R2. No roster real isso
fez o Serpente sozinho responder por 72% do investimento do Cosmic e definir o
denominador do fator inteiro, **apesar de campeões no rank máximo receberem score
0 e nem participarem do ranking**. Resultado medido: zero cosmics no top 20,
enquanto o Mystic, com 10 campeões em R2+ (mais que qualquer classe), era tratado
como carente.

**Files:**
- Modify: `src/lib/scoring/score.ts`
- Modify: `src/lib/scoring/types.ts`
- Test: `src/lib/scoring/score.test.ts`

**Interfaces:**
- Consumes: `collapseCost(rank: number): number` de `./cost` — **permanece em
  uso** como divisor de custo em `calculatePriorityScore`. Não remova.
- Produces:
  - `rankPoints(rank: number): number` — substitui `investedInRank`
  - `RosterContext = { classRankPoints: Record<McocClass, number>; maxClassRankPoints: number }`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/scoring/score.test.ts`, **apague o `describe('investedInRank', ...)`
inteiro** (linhas 33–52) e **apague `investedInRank` do bloco de import** no topo.
Troque o `describe('buildRosterContext', ...)` existente por este:

```ts
describe('rankPoints', () => {
  test('R1 nao teve rank up nenhum', () => {
    expect(rankPoints(1)).toBe(0)
  })

  test('cada rank vale um ponto a mais que o anterior', () => {
    expect(rankPoints(2)).toBe(1)
    expect(rankPoints(3)).toBe(2)
    expect(rankPoints(4)).toBe(3)
    expect(rankPoints(5)).toBe(4)
  })

  test('nao depende da escassez de catalisador', () => {
    // O ponto da mudanca: subir de R4 para R5 e o rank up mais caro do jogo,
    // mas para medir o quanto uma classe esta servida ele conta igual aos outros.
    expect(rankPoints(5) - rankPoints(4)).toBe(rankPoints(2) - rankPoints(1))
  })
})

describe('buildRosterContext', () => {
  test('soma os pontos de todos os campeoes da classe, sem limiar de rank', () => {
    const ctx = buildRosterContext([
      champ({ id: 'a', championClass: 'Mutant', currentRank: 4 }),
      champ({ id: 'b', championClass: 'Mutant', currentRank: 2 }),
      champ({ id: 'c', championClass: 'Tech', currentRank: 3 }),
    ])

    expect(ctx.classRankPoints.Mutant).toBe(4)
    expect(ctx.classRankPoints.Tech).toBe(2)
    expect(ctx.classRankPoints.Science).toBe(0)
    expect(ctx.maxClassRankPoints).toBe(4)
  })

  test('um unico R5 nao torna a classe a mais servida do roster', () => {
    // Guarda contra o defeito de 15/08/2026: com investimento por custo, o
    // Serpente (R5, unico rank up alto do Cosmic) valia 12,76 e sozinho fazia
    // a classe parecer a mais investida, apesar de nem entrar no ranking.
    const ctx = buildRosterContext([
      champ({ id: 'r5', championClass: 'Cosmic', currentRank: 5 }),
      champ({ id: 'm1', championClass: 'Mystic', currentRank: 2 }),
      champ({ id: 'm2', championClass: 'Mystic', currentRank: 2 }),
      champ({ id: 'm3', championClass: 'Mystic', currentRank: 2 }),
      champ({ id: 'm4', championClass: 'Mystic', currentRank: 2 }),
      champ({ id: 'm5', championClass: 'Mystic', currentRank: 2 }),
    ])

    expect(ctx.classRankPoints.Mystic).toBeGreaterThan(ctx.classRankPoints.Cosmic)
    expect(ctx.maxClassRankPoints).toBe(ctx.classRankPoints.Mystic)
  })

  test('a classe com mais campeoes upados recebe o menor bonus de carencia', () => {
    // Guarda contra a inversao relatada pelo dono: o Mystic tinha mais
    // campeoes em R2+ que qualquer classe e ainda recebia bonus de carente.
    const roster = [
      ...Array.from({ length: 5 }, (_, i) =>
        champ({ id: `myst-${i}`, championClass: 'Mystic', currentRank: 2 }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        champ({ id: `tech-${i}`, championClass: 'Tech', currentRank: 2 }),
      ),
    ]
    const ctx = buildRosterContext(roster)

    const sClassDe = (championClass: McocClass) =>
      1 - ctx.classRankPoints[championClass] / ctx.maxClassRankPoints

    expect(sClassDe('Mystic')).toBeLessThan(sClassDe('Tech'))
  })
})
```

Acrescente `rankPoints` ao bloco de import de `./score` no topo do arquivo, no
lugar de `investedInRank`.

- [ ] **Step 2: Rodar para ver falhar**

Run: `bun test src/lib/scoring/score.test.ts`
Expected: FAIL — `rankPoints` não existe e `classRankPoints` é `undefined`.

- [ ] **Step 3: Implementar**

Em `src/lib/scoring/types.ts`, substitua a interface `RosterContext`:

```ts
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
```

Em `src/lib/scoring/score.ts`, remova `investedInRank` por inteiro e ponha no
lugar:

```ts
/**
 * Quantos rank ups o campeao ja recebeu. R1 = 0, R5 = 4.
 *
 * Substituiu uma soma de collapseCost em 15/08/2026. Com custo, um R5 valia
 * 12,76 — mais que doze R2 — e no roster real um unico campeao maxado passou a
 * definir o denominador do fator de classe inteiro, apesar de campeoes no rank
 * maximo receberem score 0 e nem entrarem no ranking.
 */
export function rankPoints(rank: number): number {
  return rank - 1
}
```

E reescreva `buildRosterContext`:

```ts
export function buildRosterContext(roster: RosterChampion[]): RosterContext {
  const classRankPoints = Object.fromEntries(
    MCOC_CLASSES.map((c) => [c, 0]),
  ) as Record<McocClass, number>

  for (const champion of roster) {
    classRankPoints[champion.championClass] += rankPoints(champion.currentRank)
  }

  return {
    classRankPoints,
    maxClassRankPoints: Math.max(...Object.values(classRankPoints)),
  }
}
```

Em `weightedScore`, ajuste as duas referências:

```ts
  const sClass =
    context.maxClassRankPoints === 0
      ? 0
      : 1 - context.classRankPoints[champion.championClass] / context.maxClassRankPoints
```

Campeões no rank máximo **continuam contando** para os pontos da classe — um
cosmic maxado significa que a classe está servida em combate, mesmo que ele não
apareça no ranking. Não filtre.

- [ ] **Step 4: Rodar os testes**

Run: `bun test`
Expected: PASS, todos.

Se algum outro teste do arquivo falhar por referenciar `classInvestment` ou
`maxClassInvestment`, atualize-o para os nomes novos — a semântica do teste não
muda, só o nome do campo.

- [ ] **Step 5: Verificar e commitar**

Run: `bun run lint && bun run build`
Expected: ambos passam.

```bash
git add src/lib/scoring/score.ts src/lib/scoring/types.ts src/lib/scoring/score.test.ts
git commit -m "fix: Mede equilibrio de classe por rank ups, nao por custo

Um unico R5 valia 12,76 em collapseCost e sozinho definia o denominador
do fator de classe, apesar de campeoes maxados nem entrarem no ranking."
```

---

### Task 2: Vetor de pesos

Aumenta a ascensão financiando pelo peso de rank. A medição sustenta essa
origem: entre os elegíveis (R1–R4), R1 é 60% do roster mas apenas 40% do top 20 —
já está sub-representado, então `rank` não precisa do peso que tem.

**Files:**
- Modify: `src/lib/scoring/config.ts`
- Test: `src/lib/scoring/score.test.ts`

**Interfaces:**
- Consumes: nada de Task 1 além do código já mesclado.
- Produces: `WEIGHTS` com `rank: 0.12` e `asc: 0.11`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao `describe` que já contém `'os pesos somam 1'`:

```ts
  test('ascender continua valendo mais que uma faixa de tier', () => {
    // Invariante do projeto. A tier list anda de 0,5 em 0,5 e S_tier e
    // normalizado entre TIER_SCORE_FLOOR e MAX_TIER_SCORE, entao uma faixa
    // vale tier * (0,5 / (10 - 7)). Subir 'tier' sem subir 'asc' junto quebra
    // isso em silencio — ja quase aconteceu na recalibragem de 01/08/2026.
    const faixaDeTier = WEIGHTS.tier * (0.5 / (MAX_TIER_SCORE - TIER_SCORE_FLOOR))
    expect(WEIGHTS.asc).toBeGreaterThan(faixaDeTier)
  })
```

Acrescente `MAX_TIER_SCORE` e `TIER_SCORE_FLOOR` ao import de `./config` no topo
do arquivo de teste.

- [ ] **Step 2: Rodar para ver o estado atual**

Run: `bun test src/lib/scoring/score.test.ts`
Expected: PASS — com `asc: 0.09` e faixa de 0.0817 a invariante já vale (1.10×).
Este teste é uma **guarda**, não um teste vermelho: ele existe para travar o
próximo que mexer em `tier` sem mexer em `asc`. Confirme que ele passa antes de
mudar os pesos, para saber que ele mede o que promete.

- [ ] **Step 3: Mudar os pesos**

Em `src/lib/scoring/config.ts`, substitua o objeto `WEIGHTS` e o bloco de
comentário acima dele:

```ts
/**
 * Pesos da media ponderada. Somam 1.0.
 *
 * Recalibrados em 15/08/2026 contra o roster real (100 campeoes). Com
 * TIER_SCORE_FLOOR = 7 e tier em 0.49, uma faixa de tier (0,5 de nota) vale
 * 0.0817 no termo ponderado — a referencia para dimensionar o resto:
 *
 *   asc 0.11  subiu de 0.09. Ascensao virou um salto de poder real no jogo.
 *             Vale 1.35x uma faixa de tier. E um ajuste DIRECIONAL: no roster
 *             atual os mesmos 3 ascendidos ficam no top 20 com 0.09 ou 0.11,
 *             porque 5 dos 9 ascendidos tem tier ou classe fracos e nao
 *             deveriam ser resgatados por ascensao.
 *   sig 0.07  abaixo de uma faixa. Mede o gap que falta, nao a razao.
 *   fav 0.06  desempate do dono, sem forca para inverter uma faixa de tier.
 *
 * rank caiu de 0.14 para 0.12 para financiar asc. A medicao sustenta tirar
 * dali: entre os elegiveis (R1-R4), R1 e 60% do roster mas so 40% do top 20 —
 * ja esta sub-representado. A percepcao de que campeoes R1 apareciam alto
 * demais rastreava para o fator de classe do Skill, nao para o peso de rank.
 *
 * Uma advertencia medida: o top 20 do roster cabe numa faixa estreita. Nenhum
 * peso aqui e ajuste fino — mexer 0.01 reordena o topo de forma visivel, e
 * diferencas abaixo de 0.005 sao ruido.
 */
export const WEIGHTS = {
  tier: 0.49,
  rank: 0.12,
  class: 0.15,
  sig: 0.07,
  fav: 0.06,
  asc: 0.11,
} as const
```

- [ ] **Step 4: Rodar os testes**

Run: `bun test`
Expected: PASS. Em particular `'os pesos somam 1'` (0.49+0.12+0.15+0.07+0.06+0.11
= 1.00) e a guarda nova (0.11 > 0.0817).

- [ ] **Step 5: Verificar e commitar**

Run: `bun run lint && bun run build`

```bash
git add src/lib/scoring/config.ts src/lib/scoring/score.test.ts
git commit -m "feat: Sobe o peso de ascensao, financiado pelo peso de rank

R1 e 60% do roster e so 40% do top 20 — rank ja estava sub-representado.
Acrescenta guarda para a invariante asc > faixa de tier."
```

---

## Parte 2 — Usabilidade

### Task 3: Aritmética do stepper

Extrai a única parte testável do stepper para uma função pura, já que não há
setup de teste de componente React neste repositório.

**Files:**
- Create: `src/lib/step-value.ts`
- Test: `src/lib/step-value.test.ts`

**Interfaces:**
- Produces: `stepValue(current: number, delta: number, min: number, max: number): number`

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/lib/step-value.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { stepValue } from './step-value'

describe('stepValue', () => {
  test('soma o passo', () => {
    expect(stepValue(100, 20, 0, 200)).toBe(120)
    expect(stepValue(100, -1, 0, 200)).toBe(99)
  })

  test('prende no maximo em vez de estourar', () => {
    expect(stepValue(190, 20, 0, 200)).toBe(200)
  })

  test('prende no minimo em vez de ficar negativo', () => {
    expect(stepValue(10, -20, 0, 200)).toBe(0)
  })

  test('ja no limite, o passo nao muda nada', () => {
    expect(stepValue(200, 20, 0, 200)).toBe(200)
    expect(stepValue(0, -1, 0, 200)).toBe(0)
  })

  test('valor fora da faixa e trazido para dentro', () => {
    // Defesa contra o campo digitavel: o usuario pode colar 999.
    expect(stepValue(999, 0, 0, 200)).toBe(200)
    expect(stepValue(-5, 0, 0, 200)).toBe(0)
  })

  test('valor nao numerico vira o minimo', () => {
    // O campo digitavel devolve NaN quando esta vazio.
    expect(stepValue(Number.NaN, 20, 0, 200)).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `bun test src/lib/step-value.test.ts`
Expected: FAIL — `Cannot find module './step-value'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/step-value.ts`:

```ts
/**
 * Soma um passo e prende o resultado na faixa. Passo 0 serve para so
 * normalizar um valor que veio do campo digitavel, que pode estar fora da
 * faixa ou vazio (NaN).
 */
export function stepValue(
  current: number,
  delta: number,
  min: number,
  max: number,
): number {
  const base = Number.isFinite(current) ? current : min
  return Math.min(max, Math.max(min, base + delta))
}
```

- [ ] **Step 4: Rodar os testes**

Run: `bun test src/lib/step-value.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/step-value.ts src/lib/step-value.test.ts
git commit -m "feat: Acrescenta a aritmetica de passo e clamp do stepper"
```

---

### Task 4: Componente `NumberStepper`

Substitui o campo numérico digitável do sig. O passo de 20 existe porque o sig
sobe de 20 em 20 quando uma duplicata do campeão sai no cristal.

```
Nivel de sig
┌──────┬─────┬───────────┬─────┬──────┐
│ −20  │ −1  │    120    │ +1  │ +20  │
└──────┴─────┴───────────┴─────┴──────┘
```

**Files:**
- Create: `src/components/NumberStepper.tsx`
- Modify: `src/components/ChampionFields.tsx`

**Interfaces:**
- Consumes: `stepValue(current, delta, min, max)` de `@/lib/step-value` (Task 3).
- Produces: `<NumberStepper name label defaultValue min max />`, que envia o
  valor no `FormData` sob `name`.

- [ ] **Step 1: Criar o componente**

Crie `src/components/NumberStepper.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { stepValue } from '@/lib/step-value'

type Props = {
  name: string
  label: string
  defaultValue: number
  min: number
  max: number
}

const BOTAO =
  'flex h-12 min-w-12 items-center justify-center rounded-lg border border-neutral-700 ' +
  'bg-neutral-800 px-3 text-sm font-semibold tabular-nums text-neutral-100 ' +
  'active:bg-neutral-700 disabled:opacity-30'

/**
 * Passos de 1 e de 20: o sig sobe de 20 em 20 quando uma duplicata sai no
 * cristal, mas nem todo valor e alcancavel assim — dai o numero do meio virar
 * campo digitavel. Nos extremos o botao desabilita, para o toque nao parecer
 * quebrado.
 */
export function NumberStepper({ name, label, defaultValue, min, max }: Props) {
  const [valor, setValor] = useState(defaultValue)

  const aplicar = (delta: number) => setValor((v) => stepValue(v, delta, min, max))

  return (
    <div className="space-y-1">
      <span className="text-sm text-neutral-400">{label}</span>

      <div className="flex items-stretch gap-1">
        {[-20, -1].map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => aplicar(delta)}
            disabled={valor <= min}
            aria-label={`Diminuir ${Math.abs(delta)}`}
            className={BOTAO}
          >
            −{Math.abs(delta)}
          </button>
        ))}

        <input
          type="number"
          name={name}
          value={valor}
          min={min}
          max={max}
          inputMode="numeric"
          aria-label={label}
          onChange={(e) => setValor(Number(e.target.value))}
          onBlur={() => setValor((v) => stepValue(v, 0, min, max))}
          className="h-12 min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-center text-base tabular-nums"
        />

        {[1, 20].map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => aplicar(delta)}
            disabled={valor >= max}
            aria-label={`Aumentar ${delta}`}
            className={BOTAO}
          >
            +{delta}
          </button>
        ))}
      </div>
    </div>
  )
}
```

O `onBlur` com passo 0 normaliza o que o usuário digitou — é para isso que
`stepValue` aceita delta 0 e trata `NaN`.

- [ ] **Step 2: Usar no formulário**

Em `src/components/ChampionFields.tsx`, troque o `<label>` do sig por:

```tsx
      <NumberStepper name="sigLevel" label="Nivel de sig" defaultValue={defaults.sigLevel} min={0} max={200} />
```

Acrescente o import `import { NumberStepper } from './NumberStepper'`.

`ChampionFields` continua **sem** `'use client'` — ele é um componente de
servidor que renderiza um filho cliente, o que é válido no App Router.

- [ ] **Step 3: Verificar**

Run: `bun run lint && bun run build`
Expected: ambos passam.

Run: `bun run dev`, abra `/adicionar` e a tela de um campeão. Confirme, com a
janela do navegador estreitada para 320px:
1. Os quatro botões e o campo cabem numa linha, sem rolagem horizontal.
2. `−20` e `−1` ficam apagados quando o valor é 0; `+1` e `+20` quando é 200.
3. Digitar `999` no campo e tocar fora corrige para 200.
4. Salvar grava o valor certo no banco.

- [ ] **Step 4: Commitar**

```bash
git add src/components/NumberStepper.tsx src/components/ChampionFields.tsx
git commit -m "feat: Troca o campo de sig por stepper de mais e menos

Passos de 1 e 20 — o sig sobe de 20 em 20 quando uma duplicata sai no
cristal. Alvo de toque de 48px, pensado para uso com uma mao no celular."
```

---

### Task 5: Controle segmentado de rank

O `<select>` de rank tem cinco opções fixas e custa dois toques mais um overlay
do sistema. Um controle segmentado resolve em um toque.

**Files:**
- Create: `src/components/RankPicker.tsx`
- Modify: `src/components/ChampionFields.tsx`

**Interfaces:**
- Consumes: `MAX_RANK` de `@/lib/scoring/config`.
- Produces: `<RankPicker name defaultValue />`, que envia o rank no `FormData`
  sob `name` (usado como `currentRank`).

- [ ] **Step 1: Criar o componente**

Crie `src/components/RankPicker.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MAX_RANK } from '@/lib/scoring/config'

type Props = {
  name: string
  defaultValue: number
}

const RANKS = Array.from({ length: MAX_RANK }, (_, i) => i + 1)

/** Cinco opcoes fixas — um toque, sem overlay do sistema. */
export function RankPicker({ name, defaultValue }: Props) {
  const [rank, setRank] = useState(defaultValue)

  return (
    <div className="space-y-1">
      <span className="text-sm text-neutral-400">Rank atual</span>

      <input type="hidden" name={name} value={rank} />

      <div role="radiogroup" aria-label="Rank atual" className="flex gap-1">
        {RANKS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={rank === r}
            onClick={() => setRank(r)}
            className={`h-12 min-w-0 flex-1 rounded-lg border text-sm font-semibold tabular-nums ${
              rank === r
                ? 'border-amber-500 bg-amber-500 text-neutral-950'
                : 'border-neutral-700 bg-neutral-800 text-neutral-300'
            }`}
          >
            R{r}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Usar no formulário**

Em `src/components/ChampionFields.tsx`, troque o `<label>` do rank por:

```tsx
      <RankPicker name="currentRank" defaultValue={defaults.currentRank} />
```

Acrescente o import e **remova o import agora sem uso de `MAX_RANK`** em
`ChampionFields.tsx` — o lint reprova import morto.

- [ ] **Step 3: Verificar**

Run: `bun run lint && bun run build`

Com `bun run dev` e a janela a 320px: os cinco segmentos cabem numa linha sem
rolagem horizontal, o selecionado fica âmbar, e salvar grava o rank certo.

- [ ] **Step 4: Commitar**

```bash
git add src/components/RankPicker.tsx src/components/ChampionFields.tsx
git commit -m "feat: Troca o select de rank por controle segmentado"
```

---

### Task 6: Alvos de toque

Queixa literal do dono: *"clicar em cima de um botão que a área clicável é apenas
o texto dele fica um pouco ruim"*. Vale para o app inteiro.

**Files:**
- Create: `src/components/ToggleRow.tsx`
- Modify: `src/components/ChampionFields.tsx`
- Modify: `src/components/ChampionActions.tsx`
- Modify: `src/components/SignOutButton.tsx`
- Modify: `src/app/campeao/[id]/EditChampionForm.tsx`

**Interfaces:**
- Produces: `<ToggleRow name label defaultChecked />`, um checkbox nativo cuja
  área clicável é a linha inteira. Envia `'on'` no `FormData` quando marcado,
  igual ao checkbox de hoje — as actions já leem `=== 'on'` e não mudam.

- [ ] **Step 1: Criar o `ToggleRow`**

Crie `src/components/ToggleRow.tsx`:

```tsx
type Props = {
  name: string
  label: string
  defaultChecked: boolean
}

/**
 * Checkbox com a linha inteira clicavel. Sem 'use client': e um input nao
 * controlado, lido pelo FormData da action que envolve o formulario.
 */
export function ToggleRow({ name, label, defaultChecked }: Props) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-6 shrink-0 accent-amber-500"
      />
      <span className="text-base">{label}</span>
    </label>
  )
}
```

- [ ] **Step 2: Usar no formulário**

Em `src/components/ChampionFields.tsx`, troque o `<label>` do "Ascendido" por:

```tsx
      <ToggleRow name="isAscended" label="Ascendido" defaultChecked={defaults.isAscended} />
```

Acrescente o import. Depois desta task e das duas anteriores, `ChampionFields`
deve conter apenas os três componentes e a constante `FIELD` deve ter sumido —
**apague-a se ficou sem uso**, o lint reprova.

- [ ] **Step 3: Aumentar os alvos restantes**

Em `src/components/ChampionActions.tsx`, os dois botões passam a ter altura
mínima de 44px. Troque `px-3 py-2` por `min-h-11 px-3 py-2` no botão de rank up,
e no botão de favorito troque `px-3 py-2 text-sm` por
`min-h-11 min-w-11 px-3 py-2 text-base`.

Em `src/components/SignOutButton.tsx`, o botão precisa de preenchimento próprio
em vez de ser texto puro. Acrescente às classes existentes:
`min-h-11 rounded-lg px-3 py-2`. Preserve o texto e a action atuais — leia o
arquivo antes de editar e mude só a classe.

Em `src/app/campeao/[id]/EditChampionForm.tsx`, o "Remover do roster" é texto
sublinhado. Troque a classe do botão por:

```tsx
          className="min-h-11 w-full rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400"
```

- [ ] **Step 4: Verificar**

Run: `bun run lint && bun run build`

Com `bun run dev` a 320px: tocar em qualquer ponto da linha "Ascendido" marca o
checkbox; nenhum controle exige mirar no texto.

- [ ] **Step 5: Commitar**

```bash
git add src/components/ToggleRow.tsx src/components/ChampionFields.tsx src/components/ChampionActions.tsx src/components/SignOutButton.tsx "src/app/campeao/[id]/EditChampionForm.tsx"
git commit -m "feat: Aumenta os alvos de toque para uso no celular

A area clicavel era so o texto em varios controles."
```

---

### Task 7: Salvar volta para a lista

Hoje o formulário salva e fica na tela com uma mensagem verde. Passa a
redirecionar para a lista, onde o campeão já aparece reordenado.

**Files:**
- Modify: `src/app/actions/edit-champion.ts`
- Modify: `src/app/campeao/[id]/EditChampionForm.tsx`
- Create: `src/components/SavedBanner.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `updateChampion(id, dados)` de `./roster`, já existente.
- Produces: a rota `/` passa a aceitar o parâmetro de busca `salvo=<nome>`.

- [ ] **Step 1: Redirecionar na action**

Em `src/app/actions/edit-champion.ts`, reescreva `saveChampion`:

```ts
export async function saveChampion(
  _prevState: EditState,
  formData: FormData,
): Promise<EditState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { status: 'error', message: 'Campeao invalido.' }

  const nome = String(formData.get('nome') ?? '')
  const currentRank = Number(formData.get('currentRank'))
  const sigLevel = Number(formData.get('sigLevel'))
  const isAscended = formData.get('isAscended') === 'on'

  try {
    await updateChampion(id, { currentRank, sigLevel, isAscended })
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Falha ao salvar.',
    }
  }

  // Fora do try: redirect() sinaliza lancando NEXT_REDIRECT, e um catch em
  // volta engoliria o redirecionamento e devolveria "Falha ao salvar".
  revalidatePath('/')
  redirect(`/?salvo=${encodeURIComponent(nome)}`)
}
```

Acrescente `import { revalidatePath } from 'next/cache'` ao topo do arquivo.

**Este detalhe não é opcional:** `redirect()` do Next funciona lançando uma
exceção. Chamá-lo dentro do `try` faria o `catch` capturá-la e o usuário veria um
erro em vez de ir para a lista.

- [ ] **Step 2: Mandar o nome no formulário**

Em `src/app/campeao/[id]/EditChampionForm.tsx`, ao lado do input oculto de `id`:

```tsx
        <input type="hidden" name="nome" value={champion.name} />
```

E **remova** o bloco da mensagem de sucesso, que não tem mais como aparecer:

```tsx
        {state.status === 'saved' && (
          <p className="text-sm text-emerald-400">Alteracoes salvas.</p>
        )}
```

O bloco de erro (`state.status === 'error'`) **fica** — ele ainda é alcançável.

- [ ] **Step 3: Criar o aviso**

Crie `src/components/SavedBanner.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Aviso curto depois de salvar. Some sozinho e limpa o parametro da URL, para
 * um refresh nao ressuscitar a mensagem.
 */
export function SavedBanner({ nome }: { nome: string }) {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <p
      role="status"
      className="mb-3 rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-300"
    >
      {nome ? `${nome} salvo.` : 'Alteracoes salvas.'}
    </p>
  )
}
```

- [ ] **Step 4: Renderizar na lista**

Em `src/app/page.tsx`, acrescente `salvo?: string` ao tipo de `searchParams` e à
desestruturação, e renderize logo depois do `</header>`:

```tsx
      {salvo !== undefined && <SavedBanner nome={salvo} />}
```

Acrescente o import de `SavedBanner`.

- [ ] **Step 5: Verificar**

Run: `bun run lint && bun run build`

Com `bun run dev`: editar um campeão e salvar leva de volta à lista, com o aviso
no topo e o campeão já na posição nova. Depois de ~3 segundos o aviso some e a
URL volta a ser `/`. Recarregar não traz o aviso de volta.

- [ ] **Step 6: Commitar**

```bash
git add src/app/actions/edit-champion.ts "src/app/campeao/[id]/EditChampionForm.tsx" src/components/SavedBanner.tsx src/app/page.tsx
git commit -m "feat: Salvar volta para a lista com aviso

Ficar na tela de edicao depois de salvar obrigava a voltar na mao para
ver o efeito na ordem."
```

---

### Task 8: Busca ao adicionar campeão

O `<select>` de `/adicionar` lista o catálogo inteiro — inutilizável no celular.

**Files:**
- Modify: `src/app/adicionar/AddChampionForm.tsx`

**Interfaces:**
- Consumes: `AvailableChampion = { id: string; name: string; championClass: McocClass }`
  de `@/lib/champions`, já existente.
- Produces: nada para tasks posteriores. O `championId` continua chegando na
  action pelo `FormData`, como hoje.

**Decisão do dono, explícita:** **não** esconder os campeões sem versão 7★. A
coluna `has_7star` existe no banco mas não deve ser usada como filtro aqui.

- [ ] **Step 1: Trocar o seletor pela busca**

Em `src/app/adicionar/AddChampionForm.tsx`, substitua o `<label>` que contém o
`<select name="championId">` por:

```tsx
      <div className="space-y-1">
        <span className="text-sm text-neutral-400">Campeao</span>

        <input type="hidden" name="championId" value={escolhido?.id ?? ''} />

        {escolhido ? (
          <button
            type="button"
            onClick={() => setEscolhido(null)}
            className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border border-amber-500 bg-neutral-900 px-4 py-3 text-left text-base"
          >
            <span className="min-w-0 truncate">{escolhido.name}</span>
            <span className="shrink-0 text-sm text-neutral-400">trocar</span>
          </button>
        ) : (
          <>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar campeao"
              aria-label="Buscar campeao"
              className="h-12 w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-base"
            />

            <ul className="max-h-64 divide-y divide-neutral-800 overflow-y-auto rounded-lg border border-neutral-800">
              {encontrados.length === 0 ? (
                <li className="px-4 py-3 text-sm text-neutral-500">
                  Nenhum campeao com esse nome.
                </li>
              ) : (
                encontrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setEscolhido(c)}
                      className="flex min-h-12 w-full items-center justify-between gap-2 px-4 py-3 text-left active:bg-neutral-800"
                    >
                      <span className="min-w-0 truncate text-base">{c.name}</span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {c.championClass}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
```

- [ ] **Step 2: Acrescentar o estado**

No topo do componente `AddChampionForm`, junto do `useActionState` que já existe:

```tsx
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<AvailableChampion | null>(null)

  // Limita a lista: renderizar o catalogo inteiro a cada tecla trava o celular.
  const encontrados = champions
    .filter((c) => c.name.toLowerCase().includes(busca.trim().toLowerCase()))
    .slice(0, 30)
```

Acrescente `useState` ao import de `react`. A constante `FIELD` do arquivo pode
ficar sem uso — **apague-a se ficar**, o lint reprova.

- [ ] **Step 3: Verificar**

Run: `bun run lint && bun run build`

Com `bun run dev` em `/adicionar`, a 320px:
1. Digitar filtra a lista; tocar num resultado o fixa e some com a busca.
2. "trocar" volta para a busca.
3. Enviar sem escolher ninguém devolve "Escolha um campeao." — a validação da
   action já cobre isso e não muda.
4. Adicionar de verdade grava e volta para a lista.

- [ ] **Step 4: Commitar**

```bash
git add src/app/adicionar/AddChampionForm.tsx
git commit -m "feat: Busca ao adicionar campeao no lugar do select

O catalogo passou de 300 campeoes e o select nativo ficou inutilizavel
no celular. Campeoes sem versao 7 estrelas continuam listados, de proposito."
```

---

### Task 9: Nada rola na horizontal a 320px

O dono abre o site na janela sobreposta do GameHub da Samsung, cerca de 320px CSS.
Nas capturas enviadas **a página rola na horizontal**: o título aparece cortado à
esquerda e o score do card cortado à direita. É bug, não aperto.

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/RosterFilters.tsx`
- Modify: `src/components/ChampionCard.tsx` (só se a medição acusar)

**Interfaces:**
- Consumes: nada novo.
- Produces: nada para tasks posteriores.

- [ ] **Step 1: Medir antes de mexer**

Com `bun run dev` e o DevTools em 320px de largura, rode no console:

```js
document.documentElement.scrollWidth > document.documentElement.clientWidth
```

Se `true`, ache o culpado:

```js
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth).map(e => e.className)
```

**Anote o que saiu.** Os dois suspeitos da spec são o `header` de `page.tsx` e o
`RosterFilters`, mas corrija o que a medição apontar, não o que a spec supôs.

- [ ] **Step 2: Cabeçalho que quebra**

Em `src/app/page.tsx`, o `<header>` hoje é
`mb-4 flex items-center justify-between gap-4`. Troque por
`mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2` e dê
`min-w-0` ao `<h1>`, para o título poder encolher em vez de empurrar os irmãos.

- [ ] **Step 3: Filtros que quebram**

Em `src/components/RosterFilters.tsx`, o `<input type="search">` já tem
`min-w-0 flex-1`, mas os dois `<select>` não têm nada que os deixe encolher — o
texto das opções ("Toda classe", "Todo rank") impõe largura intrínseca.

Dê ao contêiner `basis-full` no input de busca e `min-w-0 flex-1` nos dois
selects, de modo que a busca ocupe a primeira linha inteira e os dois selects
dividam a segunda:

```tsx
    <div className="mb-4 flex flex-wrap gap-2">
```
mantém-se; o input de busca ganha `basis-full` no lugar de `flex-1`, e cada
`<select>` passa a `${FIELD} min-w-0 flex-1`.

Aproveite para levar os três a `min-h-11`, que é o alvo mínimo desta leva.

- [ ] **Step 4: Confirmar**

Repita o Step 1. A primeira expressão precisa devolver `false`.

Verifique também que **acima** de 320px nada regrediu: a 390px (retrato), a 844px
(paisagem) e no desktop a lista continua com uma, duas e três colunas conforme os
breakpoints `sm:` e `lg:` de `page.tsx`.

- [ ] **Step 5: Verificar e commitar**

Run: `bun test && bun run lint && bun run build`

```bash
git add src/app/page.tsx src/components/RosterFilters.tsx
git commit -m "fix: Elimina a rolagem horizontal a 320px

O dono abre o site na janela sobreposta do GameHub, onde o cabecalho e a
linha de filtros estouravam a viewport."
```

---

## Fechamento

- [ ] **Rodar a verificação completa**

Run: `bun test && bun run lint && bun run build`
Expected: tudo passa.

- [ ] **Conferir o ranking real**

Com `bun run dev` e o roster do dono carregado, confirme na tela que o top 20
mudou como a spec previu: campeões Cosmic voltam a aparecer (eram zero) e o
Mystic recua um pouco. Se o topo ficar irreconhecível, **pare e reporte** — a
spec registra que o top 20 cabe numa faixa estreita e que nenhum peso ali é
ajuste fino.

- [ ] **Abrir o PR**

A branch é `feat/usabilidade-e-recalibragem-3`. O corpo do PR deve mencionar as
duas frentes e o achado central: o fator de classe era determinado por um
campeão maxado que nem entra no ranking.

## Fora de escopo — não faça

Confirmado com o dono nesta sessão. Não implemente nada disto, mesmo parecendo
uma melhoria óbvia enquanto você está no arquivo:

- Tela de ajuste de pesos in-app ou persistência dos pesos no banco. A fonte da
  verdade é o `config.ts`, porque os comentários de justificativa lá são o que
  permite diagnosticar a calibragem seguinte — esta terceira rodada saiu de ler o
  comentário do `collapseCost`.
- Edição em massa de campeões.
- Pipeline de extração da tier list a partir do guiamtc.com.
- Atualizar a tier list de agosto de 2026 ou cadastrar a campeã nova.
- Redesenho estético. Mantenha fundo escuro, âmbar como cor de ação e as cores
  de classe do MCOC. O trabalho desta leva é de affordance.
- Consertar o `bunx tsc --noEmit` / instalar `bun-types`.
- Filtrar campeões sem versão 7★ do `/adicionar`.
