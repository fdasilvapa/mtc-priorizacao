# MCOC Prioritization System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um app Next.js que lista os campeões 7★ do usuário ordenados por um *Priority Score*, indicando qual subir de rank a seguir.

**Architecture:** O cálculo do score vive num módulo TypeScript puro (`src/lib/scoring/`), sem dependência de React ou Supabase, testado com `bun test`. Server Components leem o roster do Supabase, pontuam em memória e renderizam. Mutações passam por Server Actions que nunca recebem `user_id` do cliente — o RLS do Postgres é a fronteira de segurança real.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, Supabase (Postgres + Auth + RLS), Bun 1.3.12, Vercel.

**Spec:** `docs/superpowers/specs/2026-07-30-mtc-priorizacao-design.md`

## Global Constraints

- **Package manager/runtime:** Bun. Use `bun add`, `bun run`, `bun test`. Nunca `npm` ou `yarn`.
- **Test runner:** `bun test` (nativo, sem instalar Jest ou Vitest).
- **Import alias:** `@/*` → `./src/*`, já configurado no `tsconfig.json`.
- **TypeScript strict** está ligado. Nada de `any` implícito.
- **`MAX_RANK = 5`** — o rank up 5→6 não existe no jogo. O `CHECK` do banco aceita 6 por antecipação; quem barra em 5 é a aplicação.
- **`recommended_sig` é `SMALLINT`**, não enum. `undup` = `0`.
- **Idioma:** UI em português do Brasil. Código, nomes de variáveis e mensagens de commit em inglês, sem acentos nas mensagens de commit.
- **Mobile-first:** todo componente é estilizado primeiro para telas pequenas; `sm:`/`md:`/`lg:` só acrescentam.
- **Server Actions nunca aceitam `user_id` como parâmetro.** Sempre derivam da sessão.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/001_add_is_ascended.sql` | Coluna `is_ascended` |
| `supabase/migrations/002_recommended_sig_to_int.sql` | Enum → SMALLINT + CHECK, drop do tipo |
| `supabase/migrations/003_unique_roster.sql` | `UNIQUE (user_id, champion_id)` |
| `supabase/seed_dev.sql` | 10 campeões de amostra para desenvolvimento |
| `src/lib/scoring/types.ts` | Tipos do domínio de pontuação |
| `src/lib/scoring/config.ts` | Pesos, limiares, custo, escassez |
| `src/lib/scoring/cost.ts` | `collapseCost()` — vetor de catalisadores → escalar |
| `src/lib/scoring/cost.test.ts` | Testes do custo |
| `src/lib/scoring/score.ts` | `buildRosterContext()`, `calculatePriorityScore()`, `scoreRoster()` |
| `src/lib/scoring/score.test.ts` | Testes da fórmula |
| `src/lib/supabase/server.ts` | Cliente Supabase para Server Components/Actions |
| `src/lib/supabase/client.ts` | Cliente Supabase para Client Components |
| `src/lib/supabase/middleware.ts` | Helper de renovação de sessão |
| `src/middleware.ts` | Middleware do Next: renova sessão, protege rotas |
| `src/lib/roster.ts` | `getRoster()` e `getUserChampion()` — busca, pontua e ordena |
| `src/lib/champions.ts` | `getAvailableChampions()` — base menos o roster |
| `src/app/actions/roster.ts` | Server Actions de mutação |
| `src/app/actions/add-champion.ts` | Action de cadastro |
| `src/app/actions/edit-champion.ts` | Actions de salvar e remover |
| `src/app/login/page.tsx` | Tela de magic link |
| `src/app/auth/confirm/route.ts` | Handler de callback do magic link |
| `src/app/error.tsx` | Error boundary da aplicação |
| `src/app/page.tsx` | Lista priorizada |
| `src/components/ChampionCard.tsx` | Card de campeão |
| `src/components/ChampionActions.tsx` | Rank up e favoritar, com estado otimista |
| `src/components/ChampionFields.tsx` | Campos rank/sig/ascensão, compartilhados |
| `src/components/RosterFilters.tsx` | Filtros (classe, rank, busca) |
| `src/app/adicionar/page.tsx` | Tela de adicionar campeão |
| `src/app/campeao/[id]/page.tsx` | Tela de editar campeão |

---

## Task 1: Migrations do banco

**Files:**
- Create: `supabase/migrations/001_add_is_ascended.sql`
- Create: `supabase/migrations/002_recommended_sig_to_int.sql`
- Create: `supabase/migrations/003_unique_roster.sql`

**Interfaces:**
- Consumes: nada
- Produces: schema com `user_champions.is_ascended BOOLEAN NOT NULL DEFAULT false`, `base_champions.attack_recommended_sig SMALLINT`, `base_champions.defense_recommended_sig SMALLINT`, constraint `user_champions_unique`

**Contexto:** As tabelas e o RLS já existem no Supabase. A `base_champions` está **vazia** (o seed ainda não rodou), por isso a conversão de tipo não precisa migrar dado nenhum.

- [ ] **Step 1: Criar a migration de `is_ascended`**

Arquivo `supabase/migrations/001_add_is_ascended.sql`:

```sql
-- Ascensao do campeao entra como bonus no Priority Score.
ALTER TABLE user_champions
  ADD COLUMN is_ascended BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Criar a migration de conversão do sig**

Arquivo `supabase/migrations/002_recommended_sig_to_int.sql`:

```sql
-- base_champions esta vazia, entao USING 0 basta.
-- Semantica: undup=0, x20=20, x60=60, x80=80, x200=200.
ALTER TABLE base_champions
  ALTER COLUMN attack_recommended_sig  TYPE SMALLINT USING 0,
  ALTER COLUMN defense_recommended_sig TYPE SMALLINT USING 0;

ALTER TABLE base_champions
  ALTER COLUMN attack_recommended_sig  SET DEFAULT 0,
  ALTER COLUMN defense_recommended_sig SET DEFAULT 0;

ALTER TABLE base_champions
  ADD CONSTRAINT attack_sig_range  CHECK (attack_recommended_sig  BETWEEN 0 AND 200),
  ADD CONSTRAINT defense_sig_range CHECK (defense_recommended_sig BETWEEN 0 AND 200);

DROP TYPE sig_requirement;
```

- [ ] **Step 3: Criar a migration de unicidade**

Arquivo `supabase/migrations/003_unique_roster.sql`:

```sql
-- Um campeao nao pode aparecer duas vezes no roster do mesmo usuario.
ALTER TABLE user_champions
  ADD CONSTRAINT user_champions_unique UNIQUE (user_id, champion_id);
```

- [ ] **Step 4: Aplicar no Supabase (passo manual do usuário)**

Abrir o SQL Editor do projeto no painel do Supabase e executar os três arquivos **em ordem**.

Se o `DROP TYPE sig_requirement` falhar com `cannot drop type ... because other objects depend on it`, alguma outra coluna ainda usa o enum. Rodar o diagnóstico abaixo e converter também a coluna listada antes de repetir o drop:

```sql
SELECT c.relname AS tabela, a.attname AS coluna
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_type t ON t.oid = a.atttypid
WHERE t.typname = 'sig_requirement';
```

- [ ] **Step 5: Verificar o schema resultante**

No SQL Editor:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('base_champions', 'user_champions')
ORDER BY table_name, column_name;
```

Esperado: `attack_recommended_sig` e `defense_recommended_sig` como `smallint`; `is_ascended` como `boolean` com default `false`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add migrations for ascension, int sig and roster uniqueness"
```

---

## Task 2: Tipos, config e cálculo de custo

**Files:**
- Create: `src/lib/scoring/types.ts`
- Create: `src/lib/scoring/config.ts`
- Create: `src/lib/scoring/cost.ts`
- Test: `src/lib/scoring/cost.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type McocClass = 'Cosmic' | 'Tech' | 'Science' | 'Mutant' | 'Mystic' | 'Skill'`
  - `type CatalystKey`, `type CatalystCost`
  - `interface RosterChampion`, `interface RosterContext`, `interface ScoredChampion`
  - `WEIGHTS`, `MAX_RANK`, `CLASS_RANK_THRESHOLD`, `RANK_UP_COST`, `CATALYST_SCARCITY`, `COST_DAMPENING`
  - `collapseCost(rank: number): number`

- [ ] **Step 1: Criar os tipos**

Arquivo `src/lib/scoring/types.ts`:

```ts
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

/** Agregados do roster inteiro, calculados uma unica vez. */
export interface RosterContext {
  classCounts: Record<McocClass, number>
  maxClassCount: number
}

export interface ScoredChampion extends RosterChampion {
  score: number
  maxed: boolean
}
```

- [ ] **Step 2: Criar o config**

Arquivo `src/lib/scoring/config.ts`:

```ts
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
```

- [ ] **Step 3: Escrever os testes de custo (que vão falhar)**

Arquivo `src/lib/scoring/cost.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { collapseCost } from './cost'

describe('collapseCost', () => {
  test('rank 1 e a referencia de normalizacao e vale exatamente 1', () => {
    expect(collapseCost(1)).toBe(1)
  })

  test('cresce monotonicamente do rank 1 ao 4', () => {
    const custos = [1, 2, 3, 4].map(collapseCost)
    for (let i = 1; i < custos.length; i++) {
      expect(custos[i]).toBeGreaterThan(custos[i - 1])
    }
  })

  test('reflete os custos relativos esperados', () => {
    expect(collapseCost(2)).toBeCloseTo(1.78, 2)
    expect(collapseCost(3)).toBeCloseTo(2.76, 2)
    expect(collapseCost(4)).toBeCloseTo(7.22, 2)
  })

  test('o salto do rank 4 e o maior, por causa do alpha T5', () => {
    const salto34 = collapseCost(4) - collapseCost(3)
    const salto23 = collapseCost(3) - collapseCost(2)
    expect(salto34).toBeGreaterThan(salto23)
  })

  test('lanca RangeError para rank sem custo definido', () => {
    expect(() => collapseCost(5)).toThrow(RangeError)
    expect(() => collapseCost(0)).toThrow(RangeError)
  })
})
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

Run: `bun test src/lib/scoring/cost.test.ts`
Expected: FAIL — o módulo `./cost` não existe.

- [ ] **Step 5: Implementar `cost.ts`**

Arquivo `src/lib/scoring/cost.ts`:

```ts
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
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `bun test src/lib/scoring/cost.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scoring/
git commit -m "feat: add scoring types, config and rank up cost calculation"
```

---

## Task 3: Cálculo do Priority Score

**Files:**
- Create: `src/lib/scoring/score.ts`
- Test: `src/lib/scoring/score.test.ts`

**Interfaces:**
- Consumes: `collapseCost()` da Task 2; todos os tipos e constantes da Task 2
- Produces:
  - `buildRosterContext(roster: RosterChampion[]): RosterContext`
  - `calculatePriorityScore(champion: RosterChampion, context: RosterContext): number`
  - `scoreRoster(roster: RosterChampion[]): ScoredChampion[]` — ordenado, maxed no fim

**Fórmula:**

```
S_tier  = attackTierScore / MAX_TIER_SCORE
S_rank  = (MAX_RANK - currentRank) / (MAX_RANK - 1)
S_class = maxClassCount === 0 ? 0 : (maxClassCount - classCount) / maxClassCount
S_sig   = attackRecommendedSig === 0 ? 1 : min(1, sigLevel / attackRecommendedSig)
S_fav   = isFavorite ? 1 : 0
S_asc   = isAscended ? 1 : 0

weighted = Σ (W_x · S_x)
score    = weighted / collapseCost(currentRank) ^ COST_DAMPENING
```

Campeão em `MAX_RANK`: `score = 0`, `maxed = true`.

- [ ] **Step 1: Escrever os testes (que vão falhar)**

Arquivo `src/lib/scoring/score.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { buildRosterContext, calculatePriorityScore, scoreRoster } from './score'
import type { McocClass, RosterChampion } from './types'

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

  test('o custo nao afunda um R4 forte abaixo de um R1 fraco', () => {
    const r4Forte = calculatePriorityScore(champ({ attackTierScore: 10, currentRank: 4 }), semContexto)
    const r1Fraco = calculatePriorityScore(champ({ attackTierScore: 6, currentRank: 1 }), semContexto)
    expect(r4Forte).toBeGreaterThan(r1Fraco)
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `bun test src/lib/scoring/score.test.ts`
Expected: FAIL — o módulo `./score` não existe.

- [ ] **Step 3: Implementar `score.ts`**

Arquivo `src/lib/scoring/score.ts`:

```ts
import {
  CLASS_RANK_THRESHOLD,
  COST_DAMPENING,
  MAX_RANK,
  MAX_TIER_SCORE,
  WEIGHTS,
} from './config'
import { collapseCost } from './cost'
import { MCOC_CLASSES } from './types'
import type { McocClass, RosterChampion, RosterContext, ScoredChampion } from './types'

/**
 * Agrega o roster inteiro uma unica vez: quantos campeoes de cada classe
 * ja passaram do limiar de rank. E o insumo do fator de equilibrio de classe.
 */
export function buildRosterContext(roster: RosterChampion[]): RosterContext {
  const classCounts = Object.fromEntries(
    MCOC_CLASSES.map((c) => [c, 0]),
  ) as Record<McocClass, number>

  for (const champion of roster) {
    if (champion.currentRank >= CLASS_RANK_THRESHOLD) {
      classCounts[champion.championClass] += 1
    }
  }

  return {
    classCounts,
    maxClassCount: Math.max(...Object.values(classCounts)),
  }
}

/**
 * Media ponderada dos fatores, dividida pelo custo amortecido do proximo
 * rank up. Campeoes no rank maximo devolvem 0 — nao ha para onde subir.
 */
export function calculatePriorityScore(
  champion: RosterChampion,
  context: RosterContext,
): number {
  if (champion.currentRank >= MAX_RANK) return 0

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

  const weighted =
    WEIGHTS.tier * sTier +
    WEIGHTS.rank * sRank +
    WEIGHTS.class * sClass +
    WEIGHTS.sig * sSig +
    WEIGHTS.fav * (champion.isFavorite ? 1 : 0) +
    WEIGHTS.asc * (champion.isAscended ? 1 : 0)

  return weighted / collapseCost(champion.currentRank) ** COST_DAMPENING
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
```

- [ ] **Step 4: Rodar todos os testes de scoring**

Run: `bun test src/lib/scoring/`
Expected: PASS — todos os testes de `cost.test.ts` e `score.test.ts`.

Se `o custo nao afunda um R4 forte abaixo de um R1 fraco` falhar, o `COST_DAMPENING` está alto demais. **Não relaxe o teste** — ele existe justamente para pegar isso. Baixe `COST_DAMPENING` no `config.ts` até passar e relate o valor usado.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/
git commit -m "feat: add priority score calculation"
```

---

## Task 4: Clientes Supabase e middleware de sessão

**Files:**
- Create: `.env.local`
- Create: `.env.example`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Modify: `.gitignore` (garantir que `.env*.local` está ignorado)

**Interfaces:**
- Consumes: nada do código anterior
- Produces:
  - `createClient(): Promise<SupabaseClient>` de `@/lib/supabase/server` (async — usa `cookies()`)
  - `createClient(): SupabaseClient` de `@/lib/supabase/client` (síncrono)
  - `updateSession(request: NextRequest): Promise<NextResponse>` de `@/lib/supabase/middleware`

- [ ] **Step 1: Criar `.env.example` e `.env.local`**

Arquivo `.env.example` (versionado):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Arquivo `.env.local` (**não** versionado) com os valores reais, copiados do painel do Supabase em *Project Settings → API*. A chave anônima pode aparecer no painel como "publishable key" — é a mesma coisa.

Conferir que `.gitignore` contém `.env*.local`. O template do Next já inclui; se não estiver, acrescentar.

- [ ] **Step 2: Criar o cliente de servidor**

Arquivo `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Cliente para Server Components, Server Actions e Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component nao pode escrever cookie. O middleware ja
            // renova a sessao, entao ignorar aqui e seguro.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 3: Criar o cliente de browser**

Arquivo `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

/** Cliente para Client Components. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 4: Criar o helper de sessão**

Arquivo `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Rotas acessiveis sem sessao. */
const PUBLIC_ROUTES = ['/login', '/auth']

/**
 * Renova a sessao a cada request e redireciona quem nao esta logado.
 * Nao inserir logica entre createServerClient e getUser — o Supabase avisa
 * que isso causa bugs dificeis de depurar de sessao expirando cedo demais.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic = PUBLIC_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  )

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 5: Criar o middleware do Next**

Arquivo `src/middleware.ts`:

```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todas as rotas exceto arquivos estaticos e imagens.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 6: Verificar que o app sobe e redireciona**

Run: `bun run dev`

Abrir `http://localhost:3000`. Esperado: redirecionamento para `/login`, que ainda responde 404 (a tela é a Task 5). O 404 **em `/login`** é o sinal de que o middleware funcionou.

Se aparecer erro de variável de ambiente indefinida, o `.env.local` não foi lido — confirmar o nome do arquivo e reiniciar o dev server.

Encerrar o servidor com Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add .env.example .gitignore src/lib/supabase/ src/middleware.ts
git commit -m "feat: add supabase clients and session middleware"
```

Confirmar que `.env.local` **não** aparece no `git status`.

---

## Task 5: Autenticação por magic link

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`
- Create: `src/app/auth/confirm/route.ts`
- Create: `src/components/SignOutButton.tsx`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/server`
- Produces:
  - Server Action `signInWithOtp(prevState: AuthState, formData: FormData): Promise<AuthState>`
  - `type AuthState = { status: 'idle' | 'sent' | 'error'; message?: string }`
  - Server Action `signOut(): Promise<void>`
  - Rota `GET /auth/confirm`

- [ ] **Step 1: Configurar a URL de redirect no Supabase (passo manual)**

No painel do Supabase, em *Authentication → URL Configuration*, acrescentar em **Redirect URLs**:

```
http://localhost:3000/auth/confirm
```

Sem isso o link do e-mail expira imediatamente com `otp_expired`.

- [ ] **Step 2: Criar as Server Actions de auth**

Arquivo `src/app/login/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  status: 'idle' | 'sent' | 'error'
  message?: string
}

export async function signInWithOtp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email.includes('@')) {
    return { status: 'error', message: 'Informe um e-mail valido.' }
  }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  })

  if (error) {
    return { status: 'error', message: 'Nao foi possivel enviar o link. Tente de novo.' }
  }

  return { status: 'sent' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

Acrescentar ao `.env.local` e ao `.env.example`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 3: Criar a tela de login**

Arquivo `src/app/login/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { signInWithOtp, type AuthState } from './actions'

const INITIAL: AuthState = { status: 'idle' }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInWithOtp, INITIAL)

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Priorizacao MCOC</h1>
          <p className="text-sm text-neutral-400">
            Entre para ver seu roster priorizado.
          </p>
        </header>

        {state.status === 'sent' ? (
          <p className="rounded-lg bg-emerald-950 p-4 text-center text-sm text-emerald-200">
            Link enviado. Confira sua caixa de entrada.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
            >
              {pending ? 'Enviando...' : 'Enviar link de acesso'}
            </button>
            {state.status === 'error' && (
              <p className="text-sm text-red-400">{state.message}</p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Criar o handler de callback**

Arquivo `src/app/auth/confirm/route.ts`:

```ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) redirect('/')
  }

  redirect('/login?erro=link_invalido')
}
```

- [ ] **Step 5: Criar o botão de sair**

Arquivo `src/components/SignOutButton.tsx`:

```tsx
import { signOut } from '@/app/login/actions'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm text-neutral-400 underline">
        Sair
      </button>
    </form>
  )
}
```

- [ ] **Step 6: Testar o fluxo ponta a ponta manualmente**

Run: `bun run dev`

1. Abrir `http://localhost:3000` → redireciona para `/login`.
2. Informar o e-mail e enviar → aparece "Link enviado".
3. Abrir o link recebido no e-mail → volta para `/` (que ainda mostra a página padrão do Next).
4. Recarregar `/` → **não** redireciona mais para `/login`. Sessão persistiu.

Se o passo 3 cair em `/login?erro=link_invalido`, a Redirect URL do Step 1 não foi salva no painel.

- [ ] **Step 7: Commit**

```bash
git add src/app/login/ src/app/auth/ src/components/SignOutButton.tsx .env.example
git commit -m "feat: add magic link authentication"
```

---

## Task 6: Leitura do roster e lista priorizada

**Files:**
- Create: `supabase/seed_dev.sql`
- Create: `src/lib/roster.ts`
- Create: `src/components/ChampionCard.tsx`
- Modify: `src/app/page.tsx` (substituir a página padrão do Next)
- Modify: `src/app/layout.tsx` (título e idioma)

**Interfaces:**
- Consumes: `scoreRoster()` da Task 3, `createClient()` da Task 4, `SignOutButton` da Task 5
- Produces:
  - `getRoster(): Promise<ScoredChampion[]>` de `@/lib/roster`
  - `<ChampionCard champion={ScoredChampion} />`
  - `CLASS_COLORS: Record<McocClass, string>` exportado de `@/components/ChampionCard`

**Nota sobre o seed:** o seed real da tier list entra depois. Esta task cria um seed de **amostra** com 10 campeões só para tornar a tela verificável. Os valores de tier são fictícios.

- [ ] **Step 1: Criar o seed de desenvolvimento**

Arquivo `supabase/seed_dev.sql`:

```sql
-- Seed de AMOSTRA para desenvolvimento. Notas ficticias.
-- Substituir pelo seed real da tier list quando ele existir.
INSERT INTO base_champions
  (name, champion_class, attack_tier_score, attack_recommended_sig)
VALUES
  ('Serpente',              'Cosmic',  10.0, 200),
  ('Hercules',              'Cosmic',   9.5,   0),
  ('Onslaught',             'Mutant',   9.5, 200),
  ('Cavaleiro da Lua',      'Mystic',   9.0,  80),
  ('Doutor Destino',        'Mystic',   9.0,   0),
  ('Homem de Ferro Infinito','Tech',    8.5,  20),
  ('Nimrod',                'Tech',     8.0,   0),
  ('Photon',                'Science',  9.0,  60),
  ('Bishop',                'Mutant',   7.5,   0),
  ('Shang-Chi',             'Skill',    8.5, 200)
ON CONFLICT (name) DO NOTHING;
```

Executar no SQL Editor do Supabase.

- [ ] **Step 2: Cadastrar alguns campeões no seu roster (passo manual)**

No SQL Editor, com a sessão já criada na Task 5:

```sql
INSERT INTO user_champions (user_id, champion_id, current_rank, sig_level, is_ascended)
SELECT
  (SELECT id FROM auth.users LIMIT 1),
  bc.id,
  CASE bc.name WHEN 'Serpente' THEN 4 WHEN 'Hercules' THEN 3 ELSE 2 END,
  CASE bc.name WHEN 'Serpente' THEN 200 ELSE 0 END,
  bc.name = 'Serpente'
FROM base_champions bc
ON CONFLICT (user_id, champion_id) DO NOTHING;
```

- [ ] **Step 3: Criar a leitura do roster**

Arquivo `src/lib/roster.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { scoreRoster } from '@/lib/scoring/score'
import type { McocClass, RosterChampion, ScoredChampion } from '@/lib/scoring/types'

/** Formato cru devolvido pelo join do Supabase. */
type RosterRow = {
  id: string
  champion_id: string
  current_rank: number
  sig_level: number
  is_favorite: boolean
  is_ascended: boolean
  base_champions: {
    name: string
    champion_class: McocClass
    attack_tier_score: number
    attack_recommended_sig: number
  } | null
}

/**
 * Busca o roster do usuario logado numa unica query, pontua e ordena.
 * O RLS ja filtra por usuario — nao passamos user_id aqui.
 */
export async function getRoster(): Promise<ScoredChampion[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_champions')
    .select(`
      id,
      champion_id,
      current_rank,
      sig_level,
      is_favorite,
      is_ascended,
      base_champions (
        name,
        champion_class,
        attack_tier_score,
        attack_recommended_sig
      )
    `)
    .returns<RosterRow[]>()

  if (error) throw new Error(`Falha ao buscar o roster: ${error.message}`)

  const roster: RosterChampion[] = (data ?? [])
    .filter((row): row is RosterRow & { base_champions: NonNullable<RosterRow['base_champions']> } =>
      row.base_champions !== null,
    )
    .map((row) => ({
      id: row.id,
      championId: row.champion_id,
      name: row.base_champions.name,
      championClass: row.base_champions.champion_class,
      attackTierScore: Number(row.base_champions.attack_tier_score),
      attackRecommendedSig: row.base_champions.attack_recommended_sig,
      currentRank: row.current_rank,
      sigLevel: row.sig_level,
      isFavorite: row.is_favorite,
      isAscended: row.is_ascended,
    }))

  return scoreRoster(roster)
}
```

- [ ] **Step 4: Criar o card**

Arquivo `src/components/ChampionCard.tsx`:

```tsx
import type { McocClass, ScoredChampion } from '@/lib/scoring/types'

/** Cores de classe do MCOC — identidade visual reconhecivel de relance. */
export const CLASS_COLORS: Record<McocClass, string> = {
  Cosmic: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
  Tech: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  Science: 'bg-green-500/15 text-green-300 ring-green-500/30',
  Mutant: 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30',
  Mystic: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  Skill: 'bg-red-500/15 text-red-300 ring-red-500/30',
}

export function ChampionCard({ champion }: { champion: ScoredChampion }) {
  return (
    <article
      className={`rounded-xl border border-neutral-800 bg-neutral-900 p-4 ${
        champion.maxed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{champion.name}</h2>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${
              CLASS_COLORS[champion.championClass]
            }`}
          >
            {champion.championClass}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums">
            {champion.maxed ? '—' : champion.score.toFixed(3)}
          </div>
          <div className="text-xs text-neutral-500">score</div>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
        <div className="flex gap-1">
          <dt>Rank</dt>
          <dd className="font-medium text-neutral-200">R{champion.currentRank}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Sig</dt>
          <dd className="font-medium text-neutral-200">{champion.sigLevel}</dd>
        </div>
        {champion.isAscended && <span className="text-amber-400">Ascendido</span>}
        {champion.isFavorite && <span className="text-amber-400">Favorito</span>}
        {champion.maxed && <span className="text-neutral-500">Rank maximo</span>}
      </dl>
    </article>
  )
}
```

- [ ] **Step 5: Substituir a home**

Arquivo `src/app/page.tsx` (substituir todo o conteúdo):

```tsx
import { ChampionCard } from '@/components/ChampionCard'
import { SignOutButton } from '@/components/SignOutButton'
import { getRoster } from '@/lib/roster'

export default async function HomePage() {
  const roster = await getRoster()

  return (
    <main className="mx-auto max-w-5xl p-4 pb-16">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Prioridade de rank up</h1>
        <SignOutButton />
      </header>

      {roster.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
          Nenhum campeao no seu roster ainda.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((champion) => (
            <li key={champion.id}>
              <ChampionCard champion={champion} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Ajustar o layout**

Em `src/app/layout.tsx`, trocar o `lang` para `pt-BR` e o `metadata`:

```tsx
export const metadata: Metadata = {
  title: 'Priorizacao MCOC',
  description: 'Prioridade de rank up para campeoes 7 estrelas',
}
```

Garantir que o `<html>` use `lang="pt-BR"` e que o `<body>` tenha fundo escuro: acrescentar `className="bg-neutral-950 text-neutral-100"` ao `<body>`.

- [ ] **Step 7: Verificar no navegador**

Run: `bun run dev`

Abrir `http://localhost:3000`. Esperado: os 10 campeões em cards, ordenados por score decrescente, com a Serpente (R4, tier 10, ascendida, sig 200) em posição coerente e nenhum card `maxed` (nenhum está em R5).

Verificar responsividade: estreitar a janela até largura de celular — os cards viram uma coluna só.

- [ ] **Step 8: Rodar a verificação completa**

```bash
bun test
bun run lint
bun run build
```

Esperado: testes passando, lint limpo, build sem erro.

- [ ] **Step 9: Commit**

```bash
git add supabase/seed_dev.sql src/lib/roster.ts src/components/ src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add prioritized roster listing"
```

---

## Task 7: Ações de mutação com atualização otimista

**Files:**
- Create: `src/app/actions/roster.ts`
- Create: `src/components/ChampionActions.tsx`
- Create: `src/app/error.tsx`
- Modify: `src/components/ChampionCard.tsx` (embutir as ações)

**Interfaces:**
- Consumes: `createClient()` da Task 4, `MAX_RANK` da Task 2, `ScoredChampion` da Task 2
- Produces:
  - `rankUp(userChampionId: string): Promise<void>`
  - `toggleFavorite(userChampionId: string, next: boolean): Promise<void>`
  - `updateChampion(userChampionId: string, patch: ChampionPatch): Promise<void>`
  - `removeChampion(userChampionId: string): Promise<void>`
  - `type ChampionPatch = { currentRank?: number; sigLevel?: number; isAscended?: boolean }`

- [ ] **Step 1: Criar as Server Actions**

Arquivo `src/app/actions/roster.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { MAX_RANK } from '@/lib/scoring/config'
import { createClient } from '@/lib/supabase/server'

export type ChampionPatch = {
  currentRank?: number
  sigLevel?: number
  isAscended?: boolean
}

/**
 * Nenhuma action recebe user_id: o RLS filtra pela sessao. Um id adivinhado
 * nao atinge a linha de outro usuario.
 */

export async function rankUp(userChampionId: string) {
  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('user_champions')
    .select('current_rank')
    .eq('id', userChampionId)
    .single()

  if (readError) throw new Error(`Campeao nao encontrado: ${readError.message}`)

  if (current.current_rank >= MAX_RANK) {
    throw new Error(`Campeao ja esta no rank maximo (R${MAX_RANK})`)
  }

  const { error } = await supabase
    .from('user_champions')
    .update({ current_rank: current.current_rank + 1 })
    .eq('id', userChampionId)

  if (error) throw new Error(`Falha ao subir de rank: ${error.message}`)

  revalidatePath('/')
}

export async function toggleFavorite(userChampionId: string, next: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_champions')
    .update({ is_favorite: next })
    .eq('id', userChampionId)

  if (error) throw new Error(`Falha ao favoritar: ${error.message}`)

  revalidatePath('/')
}

export async function updateChampion(userChampionId: string, patch: ChampionPatch) {
  if (patch.currentRank !== undefined && (patch.currentRank < 1 || patch.currentRank > MAX_RANK)) {
    throw new Error(`Rank deve estar entre 1 e ${MAX_RANK}`)
  }
  if (patch.sigLevel !== undefined && (patch.sigLevel < 0 || patch.sigLevel > 200)) {
    throw new Error('Sig deve estar entre 0 e 200')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('user_champions')
    .update({
      ...(patch.currentRank !== undefined && { current_rank: patch.currentRank }),
      ...(patch.sigLevel !== undefined && { sig_level: patch.sigLevel }),
      ...(patch.isAscended !== undefined && { is_ascended: patch.isAscended }),
    })
    .eq('id', userChampionId)

  if (error) throw new Error(`Falha ao atualizar: ${error.message}`)

  revalidatePath('/')
}

export async function removeChampion(userChampionId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('user_champions').delete().eq('id', userChampionId)

  if (error) throw new Error(`Falha ao remover: ${error.message}`)

  revalidatePath('/')
}
```

- [ ] **Step 2: Criar o componente de ações**

Arquivo `src/components/ChampionActions.tsx`:

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { rankUp, toggleFavorite } from '@/app/actions/roster'
import { MAX_RANK } from '@/lib/scoring/config'

type Props = {
  id: string
  currentRank: number
  isFavorite: boolean
}

/**
 * Estado otimista: numa rede de celular, esperar o round-trip para ver a
 * estrela acender e o suficiente para o usuario largar o app.
 */
export function ChampionActions({ id, currentRank, isFavorite }: Props) {
  const [, startTransition] = useTransition()
  const [optimisticRank, setOptimisticRank] = useOptimistic(currentRank)
  const [optimisticFav, setOptimisticFav] = useOptimistic(isFavorite)

  const maxed = optimisticRank >= MAX_RANK

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={maxed}
        onClick={() =>
          startTransition(async () => {
            setOptimisticRank(optimisticRank + 1)
            await rankUp(id)
          })
        }
        className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-40"
      >
        {maxed ? 'Rank maximo' : `Subir para R${optimisticRank + 1}`}
      </button>

      <button
        type="button"
        aria-label={optimisticFav ? 'Desfavoritar' : 'Favoritar'}
        aria-pressed={optimisticFav}
        onClick={() =>
          startTransition(async () => {
            setOptimisticFav(!optimisticFav)
            await toggleFavorite(id, !optimisticFav)
          })
        }
        className={`rounded-lg border px-3 py-2 text-sm ${
          optimisticFav
            ? 'border-amber-500 text-amber-400'
            : 'border-neutral-700 text-neutral-400'
        }`}
      >
        ★
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Embutir as ações no card**

Em `src/components/ChampionCard.tsx`, acrescentar o import e renderizar o componente logo antes de fechar o `</article>`:

```tsx
import { ChampionActions } from './ChampionActions'
```

```tsx
      <ChampionActions
        id={champion.id}
        currentRank={champion.currentRank}
        isFavorite={champion.isFavorite}
      />
    </article>
```

- [ ] **Step 4: Criar o error boundary**

Sem ele, uma action que lança derruba a rota para tela branca. O `useOptimistic` já reverte o estado sozinho quando a action falha; o que falta é dizer isso ao usuário e oferecer a saída.

Arquivo `src/app/error.tsx`:

```tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-lg font-bold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-neutral-950"
      >
        Tentar de novo
      </button>
    </main>
  )
}
```

- [ ] **Step 5: Testar as ações manualmente**

Run: `bun run dev`

1. Clicar em "Subir para RN" num card → o rótulo do botão muda **imediatamente**, e a lista reordena logo depois.
2. Clicar na estrela → acende na hora e o campeão sobe na ordenação.
3. Subir um campeão até R5 → o botão vira "Rank maximo" e fica desabilitado, o card fica opaco e vai para o fim.
4. Recarregar a página → todos os estados persistiram.
5. Verificar a reversão otimista: desligar a rede (DevTools → Network → Offline), clicar em favoritar. Esperado: a estrela acende e **volta ao estado anterior** quando a action falha, com a tela de erro aparecendo em vez de página em branco. Religar a rede depois.

- [ ] **Step 6: Rodar a verificação**

```bash
bun test
bun run lint
bun run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/ src/app/error.tsx src/components/
git commit -m "feat: add rank up and favorite actions with optimistic updates"
```

---

## Task 8: Adicionar campeão e filtros

**Files:**
- Create: `src/lib/champions.ts`
- Create: `src/app/adicionar/page.tsx`
- Create: `src/app/adicionar/AddChampionForm.tsx`
- Create: `src/app/actions/add-champion.ts`
- Create: `src/components/RosterFilters.tsx`
- Modify: `src/app/page.tsx` (aplicar filtros e link para adicionar)

**Interfaces:**
- Consumes: tudo das tasks anteriores
- Produces:
  - `addChampion(prevState: AddState, formData: FormData): Promise<AddState>` (de `@/app/actions/add-champion`)
  - `type AddState = { status: 'idle' | 'error'; message?: string }` (de `@/app/actions/add-champion`)
  - `getAvailableChampions(): Promise<AvailableChampion[]>` (de `@/lib/champions`)
  - `type AvailableChampion = { id: string; name: string; championClass: McocClass }` (de `@/lib/champions`)
  - `<RosterFilters />`

- [ ] **Step 1a: Criar a busca de campeões disponíveis**

Fica em `src/lib/champions.ts`, **não** num arquivo `'use server'`: é uma leitura chamada por Server Component, e marcá-la como Server Action a exporia como endpoint sem necessidade.

```ts
import type { McocClass } from '@/lib/scoring/types'
import { createClient } from '@/lib/supabase/server'

export type AvailableChampion = {
  id: string
  name: string
  championClass: McocClass
}

/** Campeoes da base que ainda nao estao no roster do usuario. */
export async function getAvailableChampions(): Promise<AvailableChampion[]> {
  const supabase = await createClient()

  const { data: owned } = await supabase.from('user_champions').select('champion_id')
  const ownedIds = new Set((owned ?? []).map((row) => row.champion_id))

  const { data, error } = await supabase
    .from('base_champions')
    .select('id, name, champion_class')
    .order('name')

  if (error) throw new Error(`Falha ao buscar campeoes: ${error.message}`)

  return (data ?? [])
    .filter((row) => !ownedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      championClass: row.champion_class as McocClass,
    }))
}
```

- [ ] **Step 1b: Criar a action de adicionar**

Arquivo `src/app/actions/add-champion.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { MAX_RANK } from '@/lib/scoring/config'
import { createClient } from '@/lib/supabase/server'

export type AddState = { status: 'idle' | 'error'; message?: string }

export async function addChampion(
  _prevState: AddState,
  formData: FormData,
): Promise<AddState> {
  const championId = String(formData.get('championId') ?? '')
  const currentRank = Number(formData.get('currentRank'))
  const sigLevel = Number(formData.get('sigLevel'))
  const isAscended = formData.get('isAscended') === 'on'

  if (!championId) {
    return { status: 'error', message: 'Escolha um campeao.' }
  }
  if (!Number.isInteger(currentRank) || currentRank < 1 || currentRank > MAX_RANK) {
    return { status: 'error', message: `Rank deve estar entre 1 e ${MAX_RANK}.` }
  }
  if (!Number.isInteger(sigLevel) || sigLevel < 0 || sigLevel > 200) {
    return { status: 'error', message: 'Sig deve estar entre 0 e 200.' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Sessao expirada.' }

  const { error } = await supabase.from('user_champions').insert({
    user_id: user.id,
    champion_id: championId,
    current_rank: currentRank,
    sig_level: sigLevel,
    is_ascended: isAscended,
  })

  if (error) {
    // 23505 = unique_violation (constraint user_champions_unique)
    if (error.code === '23505') {
      return { status: 'error', message: 'Esse campeao ja esta no seu roster.' }
    }
    return { status: 'error', message: `Falha ao adicionar: ${error.message}` }
  }

  revalidatePath('/')
  redirect('/')
}
```

- [ ] **Step 2: Criar o formulário**

Arquivo `src/app/adicionar/AddChampionForm.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { addChampion, type AddState } from '@/app/actions/add-champion'
import type { AvailableChampion } from '@/lib/champions'
import { MAX_RANK } from '@/lib/scoring/config'

const INITIAL: AddState = { status: 'idle' }

const FIELD = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base'

export function AddChampionForm({ champions }: { champions: AvailableChampion[] }) {
  const [state, formAction, pending] = useActionState(addChampion, INITIAL)

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Campeao</span>
        <select name="championId" required defaultValue="" className={FIELD}>
          <option value="" disabled>
            Selecione...
          </option>
          {champions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.championClass})
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Rank atual</span>
        <select name="currentRank" defaultValue="1" className={FIELD}>
          {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((r) => (
            <option key={r} value={r}>
              R{r}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Nivel de sig (0 a 200)</span>
        <input
          type="number"
          name="sigLevel"
          min={0}
          max={200}
          defaultValue={0}
          inputMode="numeric"
          className={FIELD}
        />
      </label>

      <label className="flex items-center gap-3">
        <input type="checkbox" name="isAscended" className="size-5" />
        <span className="text-sm">Ascendido</span>
      </label>

      {state.status === 'error' && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Adicionar ao roster'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Criar a página de adicionar**

Arquivo `src/app/adicionar/page.tsx`:

```tsx
import Link from 'next/link'
import { getAvailableChampions } from '@/lib/champions'
import { AddChampionForm } from './AddChampionForm'

export default async function AdicionarPage() {
  const champions = await getAvailableChampions()

  return (
    <main className="mx-auto max-w-md p-4">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Adicionar campeao</h1>
        <Link href="/" className="text-sm text-neutral-400 underline">
          Voltar
        </Link>
      </header>

      {champions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
          Todos os campeoes da base ja estao no seu roster.
        </p>
      ) : (
        <AddChampionForm champions={champions} />
      )}
    </main>
  )
}
```

- [ ] **Step 4: Criar os filtros**

Arquivo `src/components/RosterFilters.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MAX_RANK } from '@/lib/scoring/config'
import { MCOC_CLASSES } from '@/lib/scoring/types'

const FIELD = 'rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm'

/** Estado na URL: sobrevive ao refresh e da para salvar o link. */
export function RosterFilters() {
  const router = useRouter()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/?${next.toString()}`)
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <input
        type="search"
        placeholder="Buscar por nome"
        defaultValue={params.get('busca') ?? ''}
        onChange={(e) => setParam('busca', e.target.value)}
        className={`${FIELD} min-w-0 flex-1`}
      />

      <select
        value={params.get('classe') ?? ''}
        onChange={(e) => setParam('classe', e.target.value)}
        className={FIELD}
      >
        <option value="">Toda classe</option>
        {MCOC_CLASSES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={params.get('rank') ?? ''}
        onChange={(e) => setParam('rank', e.target.value)}
        className={FIELD}
      >
        <option value="">Todo rank</option>
        {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((r) => (
          <option key={r} value={r}>
            R{r}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 5: Aplicar os filtros na home**

Substituir `src/app/page.tsx`:

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { ChampionCard } from '@/components/ChampionCard'
import { RosterFilters } from '@/components/RosterFilters'
import { SignOutButton } from '@/components/SignOutButton'
import { getRoster } from '@/lib/roster'

type Props = {
  searchParams: Promise<{ classe?: string; rank?: string; busca?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { classe, rank, busca } = await searchParams
  const roster = await getRoster()

  const filtrado = roster.filter((c) => {
    if (classe && c.championClass !== classe) return false
    if (rank && c.currentRank !== Number(rank)) return false
    if (busca && !c.name.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <main className="mx-auto max-w-5xl p-4 pb-16">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Prioridade de rank up</h1>
        <div className="flex items-center gap-4">
          <Link href="/adicionar" className="text-sm font-semibold text-amber-400">
            + Adicionar
          </Link>
          <SignOutButton />
        </div>
      </header>

      <Suspense>
        <RosterFilters />
      </Suspense>

      {filtrado.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
          {roster.length === 0
            ? 'Nenhum campeao no seu roster ainda.'
            : 'Nenhum campeao com esses filtros.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrado.map((champion) => (
            <li key={champion.id}>
              <ChampionCard champion={champion} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Testar manualmente**

Run: `bun run dev`

1. `/adicionar` → o select lista só quem **não** está no roster.
2. Adicionar um campeão → volta para `/` com ele na lista.
3. Tentar adicionar o mesmo de novo → ele nem aparece no select.
4. Filtrar por classe → a URL vira `/?classe=Mutant` e a lista reduz.
5. Recarregar com o filtro na URL → o filtro continua aplicado.
6. Buscar por nome parcial → filtra corretamente.

- [ ] **Step 7: Rodar a verificação**

```bash
bun test
bun run lint
bun run build
```

- [ ] **Step 8: Commit**

```bash
git add src/app/ src/components/ src/lib/champions.ts
git commit -m "feat: add champion registration and roster filters"
```

---

## Task 9: Tela de edição do campeão

**Files:**
- Create: `src/components/ChampionFields.tsx`
- Create: `src/app/campeao/[id]/page.tsx`
- Create: `src/app/campeao/[id]/EditChampionForm.tsx`
- Create: `src/app/actions/edit-champion.ts`
- Modify: `src/lib/roster.ts` (acrescentar `getUserChampion`)
- Modify: `src/app/adicionar/AddChampionForm.tsx` (passar a usar `ChampionFields`)
- Modify: `src/components/ChampionCard.tsx` (nome vira link para a edição)

**Interfaces:**
- Consumes: `updateChampion()` e `removeChampion()` da Task 7, `MAX_RANK` da Task 2
- Produces:
  - `<ChampionFields defaults={{ currentRank: number; sigLevel: number; isAscended: boolean }} />`
  - `getUserChampion(id: string): Promise<RosterChampion | null>` de `@/lib/roster`
  - `saveChampion(prevState: EditState, formData: FormData): Promise<EditState>`
  - `deleteChampion(formData: FormData): Promise<void>`
  - `type EditState = { status: 'idle' | 'saved' | 'error'; message?: string }`

**Por que agora e não na Task 8:** os campos rank/sig/ascendido são idênticos entre adicionar e editar. Extrair o componente compartilhado na *segunda* ocorrência — e não antecipadamente — evita projetar uma abstração antes de conhecer os dois usos.

- [ ] **Step 1: Extrair os campos compartilhados**

Arquivo `src/components/ChampionFields.tsx`:

```tsx
import { MAX_RANK } from '@/lib/scoring/config'

const FIELD = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base'

export type ChampionFieldDefaults = {
  currentRank: number
  sigLevel: number
  isAscended: boolean
}

/**
 * Campos comuns a adicionar e editar. Sem 'use client': sao inputs nao
 * controlados, lidos pelo FormData da action que envolve o formulario.
 */
export function ChampionFields({ defaults }: { defaults: ChampionFieldDefaults }) {
  return (
    <>
      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Rank atual</span>
        <select name="currentRank" defaultValue={defaults.currentRank} className={FIELD}>
          {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((r) => (
            <option key={r} value={r}>
              R{r}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Nivel de sig (0 a 200)</span>
        <input
          type="number"
          name="sigLevel"
          min={0}
          max={200}
          defaultValue={defaults.sigLevel}
          inputMode="numeric"
          className={FIELD}
        />
      </label>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="isAscended"
          defaultChecked={defaults.isAscended}
          className="size-5"
        />
        <span className="text-sm">Ascendido</span>
      </label>
    </>
  )
}
```

- [ ] **Step 2: Fazer o formulário de adicionar usar os campos compartilhados**

Em `src/app/adicionar/AddChampionForm.tsx`, remover os três blocos de rank, sig e ascendido, e substituir por:

```tsx
<ChampionFields defaults={{ currentRank: 1, sigLevel: 0, isAscended: false }} />
```

Acrescentar o import:

```tsx
import { ChampionFields } from '@/components/ChampionFields'
```

O `MAX_RANK` e a constante `FIELD` podem sair do arquivo se não forem mais usados — o `select` de campeão ainda usa `FIELD`, então mantenha essa constante.

- [ ] **Step 3: Verificar que a tela de adicionar continua funcionando**

Run: `bun run dev`

Abrir `/adicionar` e cadastrar um campeão. Esperado: comportamento idêntico ao da Task 8 — a refatoração não muda nada visível.

- [ ] **Step 4: Commit da refatoração**

Commitar separado da funcionalidade nova, para que o diff da refatoração seja legível.

```bash
git add src/components/ChampionFields.tsx src/app/adicionar/AddChampionForm.tsx
git commit -m "refactor: extract shared champion form fields"
```

- [ ] **Step 5: Acrescentar a busca de um campeão só**

Em `src/lib/roster.ts`, acrescentar ao final:

```ts
/** Busca um campeao do roster pelo id. O RLS garante que so retorna o do dono. */
export async function getUserChampion(id: string): Promise<RosterChampion | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_champions')
    .select(`
      id,
      champion_id,
      current_rank,
      sig_level,
      is_favorite,
      is_ascended,
      base_champions (
        name,
        champion_class,
        attack_tier_score,
        attack_recommended_sig
      )
    `)
    .eq('id', id)
    .maybeSingle<RosterRow>()

  if (error) throw new Error(`Falha ao buscar o campeao: ${error.message}`)
  if (!data || !data.base_champions) return null

  return {
    id: data.id,
    championId: data.champion_id,
    name: data.base_champions.name,
    championClass: data.base_champions.champion_class,
    attackTierScore: Number(data.base_champions.attack_tier_score),
    attackRecommendedSig: data.base_champions.attack_recommended_sig,
    currentRank: data.current_rank,
    sigLevel: data.sig_level,
    isFavorite: data.is_favorite,
    isAscended: data.is_ascended,
  }
}
```

- [ ] **Step 6: Criar as actions de salvar e remover**

Arquivo `src/app/actions/edit-champion.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { removeChampion, updateChampion } from './roster'

export type EditState = { status: 'idle' | 'saved' | 'error'; message?: string }

export async function saveChampion(
  _prevState: EditState,
  formData: FormData,
): Promise<EditState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { status: 'error', message: 'Campeao invalido.' }

  const currentRank = Number(formData.get('currentRank'))
  const sigLevel = Number(formData.get('sigLevel'))
  const isAscended = formData.get('isAscended') === 'on'

  try {
    await updateChampion(id, { currentRank, sigLevel, isAscended })
    return { status: 'saved' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Falha ao salvar.',
    }
  }
}

export async function deleteChampion(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  await removeChampion(id)
  redirect('/')
}
```

- [ ] **Step 7: Criar o formulário de edição**

Arquivo `src/app/campeao/[id]/EditChampionForm.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { deleteChampion, saveChampion, type EditState } from '@/app/actions/edit-champion'
import { ChampionFields } from '@/components/ChampionFields'
import type { RosterChampion } from '@/lib/scoring/types'

const INITIAL: EditState = { status: 'idle' }

export function EditChampionForm({ champion }: { champion: RosterChampion }) {
  const [state, formAction, pending] = useActionState(saveChampion, INITIAL)

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={champion.id} />

        <ChampionFields
          defaults={{
            currentRank: champion.currentRank,
            sigLevel: champion.sigLevel,
            isAscended: champion.isAscended,
          }}
        />

        {state.status === 'error' && <p className="text-sm text-red-400">{state.message}</p>}
        {state.status === 'saved' && (
          <p className="text-sm text-emerald-400">Alteracoes salvas.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </form>

      <form action={deleteChampion}>
        <input type="hidden" name="id" value={champion.id} />
        <button type="submit" className="w-full py-2 text-sm text-red-400 underline">
          Remover do roster
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8: Criar a página de edição**

Arquivo `src/app/campeao/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CLASS_COLORS } from '@/components/ChampionCard'
import { getUserChampion } from '@/lib/roster'
import { EditChampionForm } from './EditChampionForm'

export default async function ChampionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const champion = await getUserChampion(id)

  if (!champion) notFound()

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className="text-sm text-neutral-400 underline">
        Voltar
      </Link>

      <header className="my-6 space-y-2">
        <h1 className="text-2xl font-bold">{champion.name}</h1>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${
            CLASS_COLORS[champion.championClass]
          }`}
        >
          {champion.championClass}
        </span>
      </header>

      <EditChampionForm champion={champion} />
    </main>
  )
}
```

- [ ] **Step 9: Ligar o card à página**

Em `src/components/ChampionCard.tsx`, importar o `Link` e transformar o nome em link:

```tsx
import Link from 'next/link'
```

Trocar o `<h2>` por:

```tsx
        <h2 className="truncate font-semibold">
          <Link href={`/campeao/${champion.id}`} className="hover:underline">
            {champion.name}
          </Link>
        </h2>
```

- [ ] **Step 10: Testar manualmente**

Run: `bun run dev`

1. Clicar no nome de um campeão na lista → abre `/campeao/<id>` com os valores atuais preenchidos.
2. Mudar o sig e salvar → aparece "Alteracoes salvas".
3. Voltar para `/` → o score do campeão mudou e a ordenação refletiu.
4. Marcar "Ascendido" e salvar → o card passa a exibir o selo e o score sobe.
5. Remover do roster → volta para `/` sem o campeão, e ele reaparece no select de `/adicionar`.
6. Acessar `/campeao/00000000-0000-0000-0000-000000000000` → página 404, **não** erro de servidor.

- [ ] **Step 11: Rodar a verificação**

```bash
bun test
bun run lint
bun run build
```

- [ ] **Step 12: Commit**

```bash
git add src/app/campeao/ src/app/actions/edit-champion.ts src/lib/roster.ts src/components/ChampionCard.tsx
git commit -m "feat: add champion edit page"
```

---

## Task 10: Deploy na Vercel

**Files:**
- Modify: `README.md` (marcar o checklist e documentar o setup)

**Interfaces:**
- Consumes: a aplicação completa
- Produces: URL de produção funcionando

- [ ] **Step 1: Confirmar que o build passa localmente**

```bash
bun test
bun run lint
bun run build
```

Não prosseguir com nenhum erro pendente.

- [ ] **Step 2: Publicar o repositório**

```bash
git push origin main
```

- [ ] **Step 3: Importar na Vercel (passo manual)**

Em vercel.com, importar o repositório. A Vercel detecta Next.js sozinha.

Em *Settings → Environment Variables*, cadastrar para **Production**:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | mesma do `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma do `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | a URL de produção, ex. `https://mtc-priorizacao.vercel.app` |

- [ ] **Step 4: Liberar a URL de produção no Supabase (passo manual)**

No painel do Supabase, em *Authentication → URL Configuration*:

- **Site URL:** a URL de produção
- **Redirect URLs:** acrescentar `https://<sua-url>.vercel.app/auth/confirm`, mantendo a de localhost

Pular este passo faz o magic link funcionar em dev e quebrar em produção — com a mensagem genérica `link_invalido`.

- [ ] **Step 5: Testar em produção pelo celular**

Abrir a URL no celular e validar:

1. Login por magic link funciona.
2. A lista aparece em uma coluna, legível sem zoom.
3. Os botões de rank up e favoritar respondem ao toque.
4. Nenhuma rolagem horizontal.

- [ ] **Step 6: Atualizar o README**

Marcar no checklist do `README.md` os itens concluídos (cliente Supabase, Priority Score, componentes de UI, deploy) e corrigir a seção de modelagem: `attack_recommended_sig` e `defense_recommended_sig` agora são `SMALLINT`, o enum `sig_requirement` não existe mais, e `user_champions` tem `is_ascended`.

Acrescentar uma seção de setup local:

```markdown
## 🚀 Rodando localmente

1. `bun install`
2. Copiar `.env.example` para `.env.local` e preencher com as chaves do Supabase
3. Aplicar as migrations de `supabase/migrations/` em ordem no SQL Editor
4. `bun run dev`

Testes: `bun test`
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: update readme with setup and current schema"
git push origin main
```

---

## O que este plano deixa de fora

Consciente, conforme a seção 8 do spec:

- **Seed real da tier list** — a Task 6 usa 10 campeões de amostra com notas fictícias. O seed de verdade é trabalho à parte.
- Tier list de defesa e campeões híbridos
- Inventário de catalisadores
- Pesos ajustáveis pela UI
- Múltiplos usuários / compartilhamento com aliança
- Campeões de outras raridades
