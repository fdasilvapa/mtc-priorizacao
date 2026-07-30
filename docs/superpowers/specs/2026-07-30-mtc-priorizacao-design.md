# Design — MCOC Prioritization System

**Data:** 2026-07-30
**Escopo:** v1 do sistema de priorização de rank up para campeões 7★.

---

## 1. Objetivo

Responder a uma pergunta só, rápido e no celular: **qual campeão 7★ eu subo agora?**

O sistema calcula um *Priority Score* por campeão do roster e exibe a lista ordenada. A sugestão nunca é obrigatória — o usuário pode promover qualquer campeão a qualquer momento.

---

## 2. Decisões tomadas

| Tema | Decisão | Motivo |
|---|---|---|
| Auth | Magic link (Supabase Auth, OTP por e-mail) | Sem senha para lembrar, bom no mobile, mantém o RLS existente |
| Cadastro do roster | Tela "Adicionar campeão", incremental | Acompanha o ritmo real do jogo (abriu um 7★, cadastrou) |
| Pesos | Constantes em arquivo de config | Calibra editando + deploy; sem tela e sem tabela extra |
| Equilíbrio de classe | Contagem de campeões **R3+** por classe | Mede investimento utilizável, não coleção |
| Fatores extras | Favorito, ascensão, custo do rank up | Favorito = override manual; ascensão = dado real do jogo; custo = ganho por recurso |
| Inventário de catalisadores | **Fora do escopo da v1** | Exigiria atualização manual constante |
| Onde o score é calculado | TypeScript no servidor, função pura | Testável sem banco; pesos versionados; roster é pequeno |
| Custo entra como | **Divisor** do score final, não parcela da soma | Custo e rank puxam na mesma direção; somar dobraria o efeito |
| Custo no config | Vetor real de catalisadores + peso de escassez por tipo | Rastreável até a planilha de origem; recalibra sem refazer conta no papel |
| `MAX_RANK` | **5** | O 5→6 não existe no jogo hoje |
| `recommended_sig` | Migrar de ENUM para `SMALLINT` | Comparação aritmética direta com `sig_level`; elimina mapa enum→int |

---

## 3. Modelo de dados

### 3.1 Estado atual (já aplicado no Supabase)

- Enums `mcoc_class`, `sig_requirement`
- Tabelas `base_champions`, `user_champions` com RLS

### 3.2 Migrations desta v1

Versionadas em `supabase/migrations/`, mesmo quando aplicadas pelo painel.

**Migration 1 — `is_ascended`**

```sql
ALTER TABLE user_champions
  ADD COLUMN is_ascended BOOLEAN NOT NULL DEFAULT false;
```

**Migration 2 — `recommended_sig` para inteiro**

A `base_champions` ainda está vazia (seed pendente), então a conversão não migra dado nenhum.

```sql
ALTER TABLE base_champions
  ALTER COLUMN attack_recommended_sig  TYPE SMALLINT USING 0,
  ALTER COLUMN defense_recommended_sig TYPE SMALLINT USING 0;

ALTER TABLE base_champions
  ADD CONSTRAINT attack_sig_range  CHECK (attack_recommended_sig  BETWEEN 0 AND 200),
  ADD CONSTRAINT defense_sig_range CHECK (defense_recommended_sig BETWEEN 0 AND 200);

DROP TYPE sig_requirement;
```

Semântica: `undup → 0`, e os demais valem o próprio número (`20`, `60`, `80`, `200`).
`mcoc_class` **permanece** enum — ali o tipo restrito ganha.

**Migration 3 — unicidade do roster**

Um campeão não pode aparecer duas vezes no roster do mesmo usuário.

```sql
ALTER TABLE user_champions
  ADD CONSTRAINT user_champions_unique UNIQUE (user_id, champion_id);
```

### 3.3 Schema resultante

**`base_champions`** — `id`, `name`, `champion_class`, `attack_tier_score` (NUMERIC), `attack_recommended_sig` (SMALLINT), `defense_tier_score`, `defense_recommended_sig`

**`user_champions`** — `id`, `user_id`, `champion_id`, `current_rank` (1–6), `sig_level` (0–200), `is_favorite`, `is_ascended`

Campos de defesa ficam no schema mas **não entram no score da v1**.

---

## 4. Algoritmo do Priority Score

Cada fator normaliza para `0..1` antes da ponderação — sem isso o `attack_tier_score` (escala 0–10) esmagaria os booleans.

### 4.1 Fatores

| Fator | Fórmula | Faixa |
|---|---|---|
| `S_tier` | `attack_tier_score / 10` | 0..1 |
| `S_rank` | `(MAX_RANK - current_rank) / (MAX_RANK - 1)` | R1 = 1.0, R5 = 0 |
| `S_class` | `maxCount === 0 ? 0 : (maxCount - classCount) / maxCount` | Classe mais carente = 1.0 |
| `S_sig` | `rec === 0 ? 1 : min(1, sig_level / rec)` | 0..1 |
| `S_fav` | `is_favorite ? 1 : 0` | 0 ou 1 |
| `S_asc` | `is_ascended ? 1 : 0` | 0 ou 1 |

Onde `classCount` = número de campeões da classe com `current_rank >= CLASS_RANK_THRESHOLD`, e `maxCount` = o maior `classCount` entre todas as classes. Quando nenhuma classe tem R3+ ainda, `S_class = 0` para todos (o fator não emite sinal em vez de dividir por zero).

### 4.2 Ponderação e custo

```
weighted = W_tier·S_tier + W_rank·S_rank + W_class·S_class
         + W_sig·S_sig + W_fav·S_fav + W_asc·S_asc

cost     = Σ (quantidade[catalisador] · CATALYST_SCARCITY[catalisador])
score    = weighted / ((cost / costOfRank1) ^ COST_DAMPENING)
```

O custo é normalizado pelo rank up mais barato (1→2), então o divisor vale 1,0 para um R1 e cresce a partir dali.

Campeões em `MAX_RANK` não têm próximo rank up: recebem `score = 0` e são marcados como `maxed`, indo para o fim da lista.

### 4.3 Constantes iniciais (`config.ts`)

```ts
export const WEIGHTS = {
  tier:  0.45,   // peso principal — a tier list manda
  rank:  0.20,
  class: 0.15,
  sig:   0.10,
  fav:   0.05,
  asc:   0.05,
} // soma 1.0

// O 5→6 não existe no jogo hoje ("Currently Impossible").
// Quando a Kabam liberar, é trocar este número e acrescentar a linha em RANK_UP_COST.
export const MAX_RANK = 5

export const CLASS_RANK_THRESHOLD = 3   // R3+ conta como "evoluído"
```

**Custo do rank up 7★** — transcrito de planilha comunitária, quantidade por catalisador:

```ts
export const RANK_UP_COST = {
  1: { alphaT3: 7, basicT6: 7, classT5: 4, classT6: 4 },
  2: { alphaT3: 8, alphaT4: 3, basicT6: 8, classT5: 5, classT6: 5 },
  3: { alphaT3: 9, alphaT4: 4, basicT6: 9, basicT7: 3, classT6: 6 },
  4: { alphaT4: 6, alphaT5: 3, basicT7: 4, classT6: 7 },
}
```

O ouro é omitido de propósito: varia só ~1,5× entre R1 e R4, enquanto a dificuldade real dispara. Incluí-lo diluiria o sinal.

**Escassez relativa por catalisador** — o ponto de calibração principal deste fator:

```ts
export const CATALYST_SCARCITY = {
  alphaT3: 1,  alphaT4: 4,  alphaT5: 20,
  basicT6: 0.5, basicT7: 3,
  classT5: 0.5, classT6: 2,
}

// Amortece o divisor: 0 ignora custo, 1 aplica cheio.
export const COST_DAMPENING = 0.5
```

Custos relativos resultantes: **R1 = 1,00 · R2 = 1,78 · R3 = 2,46 · R4 = 5,37**. Com `COST_DAMPENING = 0,5`, um R4 tem o score dividido por ~2,3 — penalizado o suficiente para refletir o gargalo do Alpha T5, sem sumir da lista.

Todos esses números são pontos de calibração, e a validação real só vem na fatia 4, com o roster na tela.

---

## 5. Arquitetura

### 5.1 Domínio do score — `src/lib/scoring/`

Núcleo puro: sem React, sem Supabase, sem I/O.

- **`config.ts`** — pesos, limiares, vetor de custo, escassez por catalisador
- **`types.ts`** — `ScoredChampion`, `RosterContext`, `CatalystCost`
- **`cost.ts`** — `collapseCost(rank): number`, que colapsa o vetor de catalisadores num escalar normalizado pelo custo do R1. Isolado do `score.ts` porque é a peça que mais vai mudar quando a Kabam mexer nos custos
- **`score.ts`** — `calculatePriorityScore(champion, context): number` e `buildRosterContext(roster): RosterContext` (calcula a contagem R3+ por classe **uma vez** para o roster inteiro)
- **`score.test.ts`** — via `bun test`

Casos de teste obrigatórios:

1. Tier alto em R1 supera tier alto em R5
2. Campeão de classe carente supera igual de classe saturada
3. `undup` com `recommended = 200` pontua abaixo do mesmo campeão em sig 200
4. Favorito supera não-favorito, mantido o resto igual
5. Ascendido supera não-ascendido, mantido o resto igual
6. `maxCount === 0` não quebra e zera `S_class` para todos
7. Campeão em `MAX_RANK` (R5) recebe score 0 e é marcado `maxed`
8. **Custo não afunda R4:** um R4 de tier 10 ainda aparece acima de um R1 de tier 6
9. `collapseCost` devolve exatamente 1,0 para o rank 1 (é a referência de normalização) e cresce monotonicamente até o rank 4

### 5.2 Acesso a dados — `src/lib/supabase/`

- `server.ts` / `client.ts` — clientes via `@supabase/ssr`
- `middleware.ts` (raiz) — renova sessão e protege rotas
- `src/lib/roster.ts` — `getRoster()`: join `user_champions × base_champions` numa query, monta o `RosterContext`, pontua e ordena

### 5.3 Server Actions — `src/app/actions/roster.ts`

Todas com `revalidatePath`. Nenhuma recebe `user_id` do cliente — sempre da sessão.

- `addChampion(championId, rank, sigLevel, isAscended)`
- `rankUp(userChampionId)` — incrementa, barra em `MAX_RANK`
- `updateChampion(userChampionId, patch)` — sig, ascensão, rank, favorito
- `removeChampion(userChampionId)`

O RLS continua sendo a fronteira de segurança real; um `userChampionId` adivinhado não vaza nada.

### 5.4 Interface — `src/app/`

Mobile-first, desktop como progressive enhancement.

- **`/login`** — e-mail + magic link + estado de "confere sua caixa"
- **`/`** — Server Component com a lista priorizada
  - **Card**: nome, classe (cor da classe como identidade visual), rank, sig, score, badges de favorito/ascendido, botões de rank up e favoritar. 1 coluna no mobile, 2–3 no desktop
  - **Filtros**: classe, rank, busca por nome. Estado na URL (`?class=mutant&rank=2`) para sobreviver ao refresh
- **`/adicionar`** — busca na `base_champions`, define rank/sig/ascensão, salva
- **Modal de edição** — abre do card

`rankUp` e `favoritar` usam `useOptimistic`: o card reage no toque e a action confirma atrás.

---

## 6. Tratamento de erros

- **Action falha** → estado otimista reverte e um toast informa; o dado no servidor é a verdade
- **Campeão duplicado no roster** → constraint `UNIQUE (user_id, champion_id)`; a UI trata como "já cadastrado" em vez de erro cru
- **Rank up em `MAX_RANK`** → botão desabilitado no card *e* validação na action (a UI não é a defesa). O `CHECK` do banco aceita até 6 por antecipação; quem barra em 5 é a aplicação, via `MAX_RANK`
- **Sessão expirada** → middleware redireciona para `/login`
- **`base_champions` vazia** → estado vazio explicando que o seed não rodou, não uma tela em branco

---

## 7. Fatiamento da implementação

Cada fatia entrega algo verificável.

| # | Fatia | Entrega |
|---|---|---|
| 1 | Migrations + clientes Supabase + middleware | Base pronta |
| 2 | Módulo de scoring + testes | Fórmula validada, sem UI |
| 3 | Auth (magic link + rotas protegidas) | Login funciona |
| — | *Seed da `base_champions`* | *Pré-requisito da fatia 4* |
| 4 | Lista priorizada + card (read-only) | Responde a pergunta central |
| 5 | Ações: rank up, favoritar, editar | Sistema vivo |
| 6 | Tela de adicionar + filtros | Roster gerenciável ponta a ponta |
| 7 | Deploy na Vercel | No ar |

---

## 8. Fora de escopo (v1)

- Tier list de defesa e campeões híbridos (colunas existem, não são usadas)
- Inventário de catalisadores e gemas
- Pesos ajustáveis pela UI ou presets de perfil
- Múltiplos usuários / compartilhamento com aliança
- Campeões de outras raridades (6★ e abaixo)
