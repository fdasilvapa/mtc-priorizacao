# Recalibragem dos pesos de priorizacao

Data: 2026-08-01
Escopo: `src/lib/scoring/` apenas. Sem mudanca de schema, de UI ou de dados.

## Problema

O dono subiu campeoes misticos de rank e o ranking nao reagiu: os dois maiores
scores continuaram sendo misticos. A investigacao rodou o roster real (91
campeoes) contra o codigo de producao e encontrou tres defeitos independentes.

### 1. O fator de classe premia a classe errada

O fator existe para contrabalancar a tier list: classe pouco desenvolvida
recebe bonus. Medindo o investimento real por classe (soma do custo de todos os
rank ups ja pagos, via `collapseCost`) contra o que o score enxerga hoje:

| classe | investimento | R3+ contados | sClass hoje |
|---|---:|---:|---:|
| Mystic | 12.54 (maior) | 1 | 0.500 (bonus maximo) |
| Mutant | 11.32 | 2 | 0.000 |
| Skill | 10.32 | 2 | 0.000 |
| Cosmic | 7.54 | 1 | 0.500 |
| Science | 5.78 | 1 | 0.500 |
| Tech | 4.78 (menor) | 1 | 0.500 |

Mystic e a classe mais investida do roster e recebe o bonus maximo. Tres causas
somadas:

- `CLASS_RANK_THRESHOLD = 3` apaga 16 dos 17 misticos do roster. Sao justamente
  os R1/R2 que fazem o investimento real da classe ser o maior.
- A contagem e binaria e o roster e pequeno: `maxClassCount = 2` com contagens
  1,1,1,2,1,2, entao `sClass` assume apenas dois valores (0.5 ou 0). Metade do
  peso nominal nunca e usada — a amplitude real e 0.075, nao 0.15.
- Um R5 conta igual a um R3; a contagem nao mede profundidade.

Efeito colateral: a fronteira em R3 torna o fator cego a quase todo rank up.
Subir R1 -> R2 ou R3 -> R4 nao altera `classCounts`.

### 2. O fator de sig confunde "longe" com "quase pronto"

`sSig = min(1, sigLevel / attackRecommendedSig)` e uma razao. Um campeao que
precisa de 20 sig e esta em 0 recebe 0.00 — o mesmo que um que precisa de 200 e
esta em 0, apesar de estar a um passo de pronto. No roster, 48 campeoes caem
nesse caso e 19 recebem 1.00 de graca por terem recomendado 0.

Consequencia observada: o campeao no topo do ranking (Simbionte Supremo) estava
la por causa do 0.07 gratuito.

### 3. Baixa resolucao

O top 20 tinha apenas 8 scores distintos em 20 posicoes.

## Restricao descoberta na medicao

O top 20 inteiro cabe numa faixa de **0.103**, com **0.0054** entre vizinhos
consecutivos. Um fator de amplitude 0.15 desloca um campeao cerca de 28
posicoes.

Isso tem duas consequencias que valem registro:

- Nenhum peso deste sistema e um "ajuste fino". Qualquer alteracao acima de
  ~0.01 reordena o topo de forma visivel.
- Diferencas de peso menores que ~0.005 sao do tamanho do ruido do ranking e
  nao devem ser tratadas como distinguiveis.

Foi essa medicao que descartou a normalizacao mais agressiva do fator de classe
(`(max - inv) / (max - min)`): com peso 0.15 ela varria a classe penalizada
inteira para fora do top 20.

## Mudancas

### A. Fator de classe passa a medir investimento

Substituir a contagem acima do limiar por investimento acumulado, reusando
`collapseCost()`.

```
investimentoDoCampeao(rank) = soma de collapseCost(r) para r em [1, rank)
    R1 = 0.000   R2 = 1.000   R3 = 2.780   R4 = 5.537   R5 = 12.756

investimentoDaClasse[c] = soma sobre os campeoes da classe c
maxInvestimento         = maior valor entre as seis classes

sClass = maxInvestimento === 0 ? 0 : 1 - investimentoDaClasse[c] / maxInvestimento
```

Quando o roster inteiro esta em R1, `maxInvestimento` e 0 e todas as classes
recebem 0 — correto, porque nenhuma esta adiantada em relacao as outras.

Resultado no roster atual: Tech 0.619, Science 0.539, Cosmic 0.399, Skill 0.177,
Mutant 0.097, Mystic 0.000 — o inverso exato do investimento.

`CLASS_RANK_THRESHOLD` deixa de ter uso e sai do `config.ts`.

`RosterContext` troca de forma:

```ts
export interface RosterContext {
  classInvestment: Record<McocClass, number>
  maxClassInvestment: number
}
```

Nada fora de `src/lib/scoring/` consome esse tipo — verificado.

### B. Fator de sig passa a medir o gap absoluto

```
gap  = max(0, attackRecommendedSig - sigLevel)
sSig = 1 - min(1, gap / MAX_RECOMMENDED_SIG)

MAX_RECOMMENDED_SIG = 200   // maior valor do catalogo (valores: 0, 20, 60, 80, 200)
```

Como isso muda os casos reais:

| recomendado | sig atual | razao (hoje) | gap (novo) |
|---:|---:|---:|---:|
| 0 | 0 | 1.00 | 1.00 |
| 20 | 0 | **0.00** | **0.90** |
| 60 | 0 | 0.00 | 0.70 |
| 60 | 36 | 0.60 | 0.88 |
| 200 | 0 | 0.00 | 0.00 |
| 200 | 120 | 0.60 | 0.60 |

Recomendado 0 continua valendo 1.00, agora por coerencia da formula e nao por
um caso especial: gap zero significa pronto.

### C. Novos pesos

| | atual | novo | por que |
|---|---:|---:|---|
| tier | 0.45 | **0.49** | absorve o que saiu de `rank`; a tier list volta a mandar mais |
| rank | 0.20 | **0.14** | contava a mesma coisa que o divisor de custo |
| class | 0.15 | 0.15 | mesmo peso, mas agora com amplitude util de verdade |
| sig | 0.07 | 0.07 | inalterado; muda a forma da curva, nao a forca |
| fav | 0.05 | **0.06** | pedido do dono, sem poder de inverter qualidade |
| asc | 0.08 | **0.09** | sobe para preservar a relacao com a faixa de tier |

Soma: 1.00.

`COST_DAMPENING`: 0.2 -> **0.1**. Reduz o corte maximo de ~33% para ~18%.

Sobre a ascensao: o teste `ascender vence uma faixa de tier` define a faixa como
`WEIGHTS.tier * 0.1667`. Subir `tier` de 0.45 para 0.49 leva a faixa de 0.075
para 0.0817, e `asc = 0.08` cairia abaixo dela. O peso sobe para 0.09 para
manter a relacao intacta — a intencao nao mudou, so a escala contra a qual ela
e medida. Efeito pratico no roster: Gorr vai de #19 para #17.

O comportamento da ascensao foi medido e e o desejado: cada um dos 4 ascendidos
ganha 18 a 25 posicoes, e ainda assim nenhum entra no top 15, porque os outros
fatores os seguram. Em 0.12 o fator viraria decisivo (Gorr saltaria para o #4).

Um numero foi medido e deliberadamente **nao** mudou:

- **Vies pro-R1.** 64 dos 91 campeoes sao R1, entao ~14 no top 20 e o esperado
  por proporcao. O ranking atual da 13 e o novo da 14. Nao ha vies a corrigir;
  baixar mais `COST_DAMPENING` criaria vies na direcao oposta.

## Resultado esperado no roster de referencia

- Simbionte Supremo: #1 -> #16. Madelyne Pryor e Doutor Estranho caem junto.
- Misticos no top 20: 4 -> 2.
- Sobem Shang-Chi (#29 -> #10), Shuri (~#21), e a faixa de Tech/Science.
- Top 3: Vox, Ossos Cruzados, Venom.
- Scores distintos no top 20: 8 -> 15.
- Gorr (ascendido) fica em #17.

Mutant continua ausente do top 20, e isso **nao** e defeito: os melhores mutants
ja estao upados (Massacre 10.0 em R4, Gentil 9.5 em R3) e os restantes chegam a
9.0, enquanto outras classes ainda tem 9.5/10.0 disponiveis. Testadas 192
configuracoes, Mutant zera em todas, inclusive com peso de classe 0.04.

## Testes

A suite atual tem 31 testes passando, toda em `src/lib/scoring/`.

Precisam mudar:

- `buildRosterContext`: as assercoes sobre `classCounts`/`maxClassCount` passam a
  falar de `classInvestment`/`maxClassInvestment`, em unidades de custo.
- Os testes de sig por razao passam a esperar a curva de gap.
- O helper de `score.test.ts` que reimplementa a formula precisa acompanhar as
  duas mudancas. Vale reduzir essa duplicacao: um teste que recalcula a formula
  que testa so pega erro de digitacao.
- O bloco `calibragem: hierarquia dos fatores` precisa revisar os limiares, ja
  que a hierarquia mudou.

Acrescentar:

- Classe: um rank up R1 -> R2 muda `sClass` (o defeito que originou tudo isso).
- Classe: roster inteiro em R1 devolve 0 para todas as classes, sem divisao por
  zero.
- Sig: recomendado 20 com sig 0 pontua bem acima de recomendado 200 com sig 0.
- Ordem: a soma dos pesos e 1.00.

## Fora de escopo

- Tela de calibragem in-app. Decidida como trabalho separado.
- Persistir pesos no banco. A fonte da verdade continua sendo `config.ts`, onde
  os comentarios registram o porque de cada numero — foi o comentario do
  `TIER_SCORE_FLOOR` que permitiu diagnosticar a calibragem anterior.
- `CATALYST_SCARCITY`, `TIER_SCORE_FLOOR`, `RANK_UP_COST`: inalterados.
