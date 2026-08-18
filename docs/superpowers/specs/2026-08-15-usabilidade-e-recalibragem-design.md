# Usabilidade mobile e terceira recalibragem — design

Data: 2026-08-15
Estado: aprovado pelo dono, pronto para virar plano

Duas frentes independentes, na mesma leva. A Parte 1 mexe só no motor de
score (`src/lib/scoring/`), a Parte 2 mexe só na interface. Não há acoplamento
entre elas além de ambas alterarem o mesmo repositório.

---

## Parte 1 — Recalibragem do fator de classe

### O defeito

O fator de equilíbrio de classe usa `investedInRank`, que soma `collapseCost`
de cada rank up já pago. Como `collapseCost` embute a escassez de catalisadores
(`alphaT5: 30`), a escala entre ranks é violentamente não-linear:

| Rank | Investimento acumulado (unidade: rank up 1→2 = 1.0) |
|---|---|
| R1 | 0 |
| R2 | 1.00 |
| R3 | 2.78 |
| R4 | 5.54 |
| R5 | 12.76 |

Um único R5 vale 12,76 — mais que doze campeões R2.

Medido contra o roster real do dono (100 campeões, exportado em 15/08/2026):

| classe | n | R1 | R2 | R3 | R4 | R5 | investimento | R2+ |
|---|---|---|---|---|---|---|---|---|
| Cosmic | 13 | 7 | 5 | 0 | 0 | 1 | **17.76** | 6 |
| Tech | 19 | 13 | 3 | 3 | 0 | 0 | 11.34 | 6 |
| Science | 19 | 13 | 4 | 2 | 0 | 0 | 9.56 | 6 |
| Mutant | 18 | 12 | 4 | 1 | 1 | 0 | 12.32 | 6 |
| Mystic | 22 | 12 | 9 | 0 | 1 | 0 | 14.54 | **10** |
| Skill | 9 | 2 | 5 | 1 | 1 | 0 | 13.32 | 7 |

O Cosmic aparece como a classe mais investida e leva `sClass = 0`. Mas 12,76 dos
seus 17,76 (72%) são o Serpente sozinho — que é R5, está no rank máximo e recebe
score 0, ou seja, **nem participa do ranking que ele está calibrando**. Sem ele o
Cosmic soma 5,00 e seria a segunda classe *menos* investida.

A consequência medida: zero campeões Cosmic no top 20, enquanto o Mystic — que
tem 10 campeões em R2+, mais que qualquer outra classe — é tratado como mais
carente que o Cosmic e recebe bônus.

Foi verificado que **não há inflação de nota** nos místicos, hipótese levantada
pelo dono: a média de tier do Mystic é 9,02 e ele tem 8 místicos em 9,5+, quatro
deles em 10,0 (Kushala, Doutor Estranho, Madelyne Pryor, Pavitr Prabhakar). Os
místicos estão no topo porque são bons; o defeito era não descontar o quanto a
classe já está servida.

### A correção

`buildRosterContext` passa a somar **pontos de rank** (`currentRank - 1`) em vez
de `investedInRank`:

```
R1 = 0    R2 = 1    R3 = 2    R4 = 3    R5 = 4
```

`sClass = 1 - pontos[classe] / maiorPontuação` permanece idêntico. Só muda o que
alimenta a soma.

A justificativa, que deve constar como comentário no código: `collapseCost`
responde *"quanto vai me custar subir este campeão"*, calibrado contra a taxa de
aquisição do dono. O fator de classe faz outra pergunta — *"quão bem servida essa
classe já está"* — e poder de combate cresce muito mais suavemente entre ranks do
que custo cresce. Pontos lineares afirmam que cada rank up conta igual.

Efeito medido nos `sClass`:

| variante | Cosmic | Tech | Science | Mutant | Mystic | Skill |
|---|---|---|---|---|---|---|
| atual (custo) | **0.00** | 0.36 | 0.46 | 0.31 | 0.18 | 0.25 |
| pontos lineares | 0.25 | 0.25 | 0.33 | 0.25 | **0.00** | 0.17 |

O Mystic vira corretamente a classe mais servida, e o Cosmic passa de 0 para 2
campeões no top 20.

Alternativas medidas e rejeitadas:

- **Contagem pura de R2+**: também corrige a inversão, mas descarta profundidade
  de rank (um R4 contaria igual a um R2) e joga 4 cosmics no top 20 de uma vez.
- **Raiz do custo**: produz ranking praticamente idêntico ao de pontos lineares,
  mas nenhum comentário de código consegue justificar uma raiz quadrada.

`investedInRank` fica sem uso e deve ser removida, junto com seus testes.
`collapseCost` **permanece** — segue sendo o divisor de custo em
`calculatePriorityScore`.

### Vetor de pesos

| peso | de | para |
|---|---|---|
| tier | 0.49 | 0.49 |
| class | 0.15 | 0.15 |
| rank | 0.14 | **0.12** |
| sig | 0.07 | 0.07 |
| fav | 0.06 | 0.06 |
| asc | 0.09 | **0.11** |

Soma 1.00.

O aumento de `asc` sai do peso de `rank`, e a medição sustenta essa origem: entre
os campeões elegíveis (R1–R4), R1 é 60% do roster mas apenas 40% do top 20 — já
está sub-representado, então `rank` não precisa do peso que tem. A percepção do
dono de que campeões R1 apareciam alto demais rastreava, na verdade, para o fator
de classe do Skill, não para o peso de rank.

**O aumento de `asc` é direcional, não observável**, e isso foi aceito
explicitamente: com 0.09 ou 0.11 os mesmos 3 ascendidos ficam no top 20. Dos 9
ascendidos do roster, 5 estão entre as posições 32 e 83 por terem tier ou classe
fracos, e ascensão não deveria resgatá-los.

### Propriedade conhecida, deliberadamente não corrigida

Com pontos lineares o Serpente ainda vale 4 dos 9 pontos do Cosmic (44%, contra
72% hoje). Um único R5 continua tendo peso desproporcional numa classe rasa.

Não é atacado agora porque a alternativa `(max - min)` já foi medida e rejeitada
na recalibragem de 01/08/2026 — com peso 0.15 ela varria a classe penalizada
inteira para fora do top 20 — e porque trocar o denominador exige recalibrar
todos os pesos de novo, não aplicar um patch.

Campeões no rank máximo **continuam contando** para os pontos da classe. Um
cosmic maxado significa que a classe está servida em combate, mesmo que ele não
apareça no ranking.

### Testes

- A guarda existente que amarra `asc > faixa de tier` continua valendo. Com
  `tier = 0.49` a faixa vale 0.0817 e `asc = 0.11` dá 1.35×.
- **Teste novo**, travando a inversão relatada: dado um roster sintético onde a
  classe X tem estritamente mais campeões em R2+ que a classe Y, e nenhuma outra
  diferença relevante, `sClass(X)` deve ser menor que `sClass(Y)`.
- **Teste novo**, travando o defeito do R5: um único campeão R5 numa classe não
  pode tornar essa classe a mais investida se outra classe tem mais rank ups
  somados.
- Os testes de `investedInRank` saem junto com a função.

### Ressalva sobre os dados

O CSV exportado veio truncado em exatamente 100 linhas — a classe Skill termina
em "Gata Negra" (R1, 9.5) enquanto todas as outras descem até 8.0 no R1. Isso
**não invalida a análise**: campeões R1 contribuem 0 tanto para investimento
quanto para contagem de R2+, então os `sClass` medidos estão corretos. O que falta
são apenas alguns R1 de Skill que poderiam figurar no top 20.

---

## Parte 2 — Usabilidade mobile

Contexto: o dono joga no celular (Samsung A15) e frequentemente abre o site na
janela sobreposta do GameHub da Samsung, uma viewport de aproximadamente 320px
CSS.

### 2.1 Estouro horizontal em 320px

**É um bug, não um aperto.** Nas capturas enviadas a página rola na horizontal:
o título aparece cortado à esquerda ("oridade de rank up") e o score do card
cortado à direita ("0.65").

Dois candidatos a causa, ambos a tratar:

- `RosterFilters` — busca com `flex-1` mais dois `<select>` sem `min-w-0`, cujos
  rótulos ("Toda classe", "Todo rank") impõem largura intrínseca.
- O `header` de `page.tsx` — título, "+ Adicionar" e "Sair" numa linha com
  `justify-between`.

Requisito: a 320px nada rola na horizontal. A responsividade acima desse tamanho
não muda — hoje está boa em pé e deitado, e isso deve continuar valendo.

Qual dos dois é o culpado real se resolve medindo na implementação, não
adivinhando aqui.

### 2.2 Componente `NumberStepper`

Novo componente compartilhado, usado no adicionar e no editar.

```
Nivel de sig
┌──────┬─────┬───────────┬─────┬──────┐
│ −20  │ −1  │    120    │ +1  │ +20  │
└──────┴─────┴───────────┴─────┴──────┘
```

- Passos de ±1 e ±20. O passo de 20 existe porque o sig sobe de 20 em 20 quando
  uma duplicata do campeão sai no cristal.
- Alvo de toque de 48px por botão.
- Valor preso entre 0 e 200. Nos extremos os botões correspondentes ficam
  desabilitados e visivelmente apagados, em vez de aceitar o toque sem efeito.
- O número no meio vira campo de digitação ao ser tocado, para valores que não
  são alcançáveis de 20 em 20.
- O valor precisa continuar chegando na server action pelo `FormData` sob o nome
  `sigLevel`, como hoje.

### 2.3 Rank vira controle segmentado

`R1 R2 R3 R4 R5` numa linha, em vez do `<select>` atual. São cinco opções fixas;
o seletor nativo custa dois toques e abre um overlay do sistema onde um toque
resolve. Mesmo nome de campo (`currentRank`) no `FormData`.

Em 320px os cinco segmentos precisam caber sem estourar.

### 2.4 Alvos de toque

A queixa original: *"clicar em cima de um botão que a área clicável é apenas o
texto dele fica um pouco ruim"*. Vale para o app inteiro, não só para os campos:

- "Ascendido" e "Favorito": a linha inteira vira área clicável, não só o texto.
- "+ Adicionar" e "Sair" no cabeçalho: hoje são texto puro sem preenchimento.
- "Remover do roster": hoje é texto sublinhado.
- Alvo mínimo de 44px em qualquer controle interativo.

### 2.5 Salvar volta para a lista

Hoje o formulário de edição salva e permanece na tela com uma mensagem verde.

Passa a: a action redireciona para a lista, onde o campeão já aparece reordenado
na posição nova, com um aviso curto no topo que some sozinho.

Sem biblioteca de estado. O nome do campeão salvo vai por parâmetro na URL e a
faixa de aviso lê dali.

### 2.6 Busca ao adicionar campeão

O `<select>` de `/adicionar` lista 326 campeões — inutilizável no celular.

Passa a: campo de texto que filtra a lista conforme se digita, mostrando nome e
classe de cada resultado.

**Não esconder os campeões sem versão 7★**, decisão explícita do dono. A coluna
`has_7star` existe mas não deve ser usada como filtro aqui.

O `championId` selecionado precisa continuar chegando na action pelo `FormData`.

### 2.7 Polimento visual

Mantém a identidade atual: fundo escuro, âmbar como cor de ação, cores de classe
do MCOC nos selos. O trabalho é de affordance — botão com cara de botão, alvo
grande, estado desabilitado visível — e não redesenho estético. Um redesenho
seria escopo diferente e não foi pedido.

---

## Fora de escopo, com motivo

**Tela de ajuste de pesos in-app e persistência dos pesos no banco.** A fonte da
verdade continua sendo `config.ts`, porque os comentários de justificativa lá são
o que permite diagnosticar a calibragem seguinte — e esta terceira rodada é a
prova disso, já que o diagnóstico saiu de ler o comentário do `collapseCost`. Um
slider não guarda um "porquê".

**Edição em massa de campeões.**

**Pipeline de atualização da tier list (projeto C).** Investigado nesta sessão e
adiado com decisão do dono. O achado, para não ser redescoberto: o guiamtc.com é
um Google Sites e as tier lists são PNGs hospedados no Google Drive — não existe
JSON por trás. Pior, **as imagens não trazem os nomes dos campeões**, apenas
retratos e o sig recomendado (`x20`, `x60`, `x80`, `x200`, `undup`). A estrutura
é determinística (linha = faixa de nota, coluna = classe) e o rótulo de sig é OCR
trivial; só a identidade é difícil. O caminho recomendado, quando for a hora, é
casamento de template contra retratos de referência — com pontuação por tile e
fila de revisão para os que ficarem abaixo do limiar, de modo que erro não seja
silencioso — e o conjunto de referência sai de graça cruzando a imagem do mês
anterior com a planilha já rotulada do dono. A outra fonte, o mcoc.app, serve
`https://mcoc.app/data/tierlist.json` e é script trivial.

**Atualizar a tier list de agosto de 2026.** Já saiu no site e ainda não foi
aplicada. Fica para uma leva própria, usando `supabase/gerar_seed_tier_list.py`,
que já é versionado e aborta sem escrever se qualquer linha falhar na validação.
Há também uma campeã nova ainda ausente do catálogo.

---

## Verificação

`bun test && bun run lint && bun run build`.

**Não usar `bunx tsc --noEmit`** como gate: ele falha com
`Cannot find module 'bun:test'` nos arquivos de teste porque falta `bun-types`.
É dívida anterior a este trabalho e o `bun run build` passa porque o Next exclui
os testes — mas é um gate que nunca pode passar neste repositório.

Além dos testes automatizados, a Parte 2 exige verificação visual a 320px de
largura, que é o cenário que motivou o trabalho.
