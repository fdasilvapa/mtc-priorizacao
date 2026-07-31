# ⚔️ MCOC Prioritization System (Marvel Torneio de Campeões)

Sistema para priorização de evolução (*rank up*) de heróis **7 estrelas** no jogo Marvel Torneio de Campeões. A aplicação calcula um score ponderado de prioridade para cada campeão com base no meta atual, necessidade de classe na conta, posição atual e nível de duplicação.

---

## 🎯 Contexto e Objetivo

À medida que a conta evolui no MCOC, decidir qual campeão 7★ subir de nível torna-se estratégico. O objetivo deste sistema é remover a dúvida no momento de evoluir heróis, oferecendo uma listagem recomendada baseada em regras de pesos dinâmicas, mantendo a liberdade de o jogador realizar upgrades manuais a qualquer momento.

---

## 🛠️ Stack Tecnológica

* **Front-end / Framework:** Next.js (App Router, TypeScript, Tailwind CSS)
* **Package Manager / Runtime:** Bun
* **Backend & Banco de Dados:** Supabase (PostgreSQL + Auth + RLS)
* **Hospedagem:** Vercel

---

## 📐 Algoritmo de Priorização (Lógica de Pesos)

A ordenação dos heróis é calculada por uma fórmula de média ponderada:

$$\text{Prioridade} = (W_{\text{tier}} \cdot S_{\text{tier}}) + (W_{\text{rank}} \cdot S_{\text{rank}}) + (W_{\text{class}} \cdot S_{\text{class}}) + (W_{\text{sig}} \cdot S_{\text{sig}})$$

### Variáveis e Pesos Considerados:

1. **Nota na Tier List ($S_{\text{tier}}$ - Peso Principal):**
   * Pega a nota de ataque do campeão na Tier List base (ex: 10.0, 9.5, 9.0, 8.5...).
2. **Posição/Rank Atual ($S_{\text{rank}}$):**
   * Heróis em Ranks mais baixos (ex: R1 ou R2) recebem prioridade maior para subir do que os que já estão no R5/R6.
3. **Equilíbrio de Classe ($S_{\text{class}}$):**
   * Quantidade de heróis já evoluídos daquela classe na conta do usuário. Classes com menos heróis upados ganham bônus de prioridade.
4. **Requisito de Duplicação / Sig ($S_{\text{sig}}$):**
   * Verifica se o campeão atinge o nível de duplicação recomendado pela Tier List (0, 20, 60, 80, 200). Campeões que exigem 200 mas estão duplicação 0 sofrem uma leve penalidade no score.
5. **Ascensão do Campeão ($S_{\text{ascended}}$):**
   * Heróis ascendidos recebem um bônus de prioridade no cálculo do score.

---

## 🗄️ Modelagem do Banco de Dados (Supabase)

### Enums
* `mcoc_class`: `'Cosmic'`, `'Tech'`, `'Science'`, `'Mutant'`, `'Mystic'`, `'Skill'`

### Tabelas
1. **`base_champions` (Global / Meta)**
   * `id` (UUID, PK)
   * `name` (VARCHAR, Unique)
   * `champion_class` (ENUM mcoc_class)
   * `attack_tier_score` (NUMERIC)
   * `attack_recommended_sig` (SMALLINT)
   * `defense_tier_score` (NUMERIC - Preparado para uso futuro)
   * `defense_recommended_sig` (SMALLINT - Preparado para uso futuro)

2. **`user_champions` (Roster do Usuário)**
   * `id` (UUID, PK)
   * `user_id` (FK -> auth.users)
   * `champion_id` (FK -> base_champions)
   * `current_rank` (INT, 1 a 6)
   * `sig_level` (INT, 0 a 200)
   * `is_favorite` (BOOLEAN)
   * `is_ascended` (BOOLEAN)

---

## ⚙️ Funcionalidades e UI/UX Implementadas

* **Listagem Priorizada:** Exibição dos campeões do usuário ordenados pelo *Priority Score*.
* **Ação Rápida de Upgrade:** Botão direto para subir a posição (*Rank Up*) do campeão no card.
* **Filtros Combinados:** Filtragem por Classe, Posição Atual (Rank) e Busca por Nome.
* **Flexibilidade de Decisão:** O sistema sugere, mas o usuário tem autonomia total para promover qualquer herói independente do score.
* **Suporte Futuro a Híbridos:** A estrutura já está pronta para integrar a Tier List de Defesa no futuro e identificar campeões que se destacam em ambos os modos.

---

## ✅ Checklist do Projeto

- [x] Definição do escopo e focar em heróis **7 estrelas**.
- [x] Escolha da stack (Next.js + Bun + Supabase + Vercel).
- [x] Inicialização do repositório no GitHub e projeto Next.js local com Bun.
- [x] Criação da organização e projeto no Supabase.
- [x] Definição e execução da DDL SQL no Supabase (Tabelas `base_champions`, `user_champions`, Enums e RLS).
- [ ] População inicial de dados na `base_champions` (Seed de heróis e notas da Tier List).
- [x] Criação do cliente de conexão Supabase e Server Actions no Next.js.
- [x] Implementação da lógica do cálculo do *Priority Score* no código.
- [x] Construção dos componentes de UI (Filtros, Cards de Herói, Modais).
- [ ] Deploy na Vercel.

---

## 🚀 Rodando localmente

1. `bun install`
2. Copiar `.env.example` para `.env.local` e preencher com as chaves do Supabase
3. Aplicar as migrations de `supabase/migrations/` em ordem no SQL Editor
4. `bun run dev`

Testes: `bun test`
