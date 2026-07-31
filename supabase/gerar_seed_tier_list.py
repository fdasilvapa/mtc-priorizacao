#!/usr/bin/env python3
"""Gera seed_tier_list.sql a partir da tier list fundida em CSV.

    python3 supabase/gerar_seed_tier_list.py caminho/tier_list_fundida.csv

O CSV de entrada e a fusao 50/50 por percentil entre a planilha do dono e o
mcoc.app. Colunas esperadas:

    nome, classe, nota_ataque, sig_recomendado, tier_origem, nome_en,
    faixa_anterior, nota_anterior, regra, high_skill, sem_7_estrelas

As tres ultimas sao de auditoria; so `sem_7_estrelas` vira coluna no banco.

O script ABORTA sem escrever nada se qualquer linha falhar na validacao. Um
seed que roda e grava lixo e pior que um que falha: o `ON CONFLICT DO UPDATE`
sobrescreveria o catalogo bom com o ruim, e a tela inteira ordena por essas
notas.
"""

import collections
import csv
import pathlib
import sys

CLASSES = {"Cosmic", "Tech", "Science", "Mutant", "Mystic", "Skill"}
SIGS = {"0", "20", "60", "80", "200"}
FAIXAS = [
    "Top of the Class", "Incredible", "Fantastic", "Great",
    "Very Good", "Good", "Mediocre", "Awful",
]
DESTINO = pathlib.Path(__file__).parent / "seed_tier_list.sql"


def validar(rows: list[dict]) -> list[str]:
    erros = []
    for i, r in enumerate(rows, 2):  # 2 = primeira linha de dados no CSV
        if r["classe"] not in CLASSES:
            erros.append(f"L{i} classe invalida: {r['classe']!r}")
        if r["sig_recomendado"] not in SIGS:
            erros.append(f"L{i} sig invalido: {r['sig_recomendado']!r}")
        try:
            nota = float(r["nota_ataque"].replace(",", "."))
            if not 0 <= nota <= 10:
                erros.append(f"L{i} nota fora de 0-10: {nota}")
        except ValueError:
            erros.append(f"L{i} nota nao numerica: {r['nota_ataque']!r}")
        if not r["nome"].strip() or not r["nome_en"].strip():
            erros.append(f"L{i} nome vazio")

    # Duplicata em qualquer das duas chaves quebra o seed ou a juncao futura
    # com outra tier list. Barato de checar, caro de descobrir depois.
    for col in ("nome", "nome_en"):
        for valor, n in collections.Counter(r[col] for r in rows).items():
            if n > 1:
                erros.append(f"{col} duplicado: {valor!r} ({n}x)")
    return erros


def aspas(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def gerar(rows: list[dict]) -> str:
    pad = lambda s, n: s + " " * max(0, n - len(s))
    linhas = [
        "  (%s %s %s %s %s)" % (
            pad(aspas(r["nome"]) + ",", 36),
            pad(aspas(r["classe"]) + ",", 11),
            pad(r["nota_ataque"].replace(",", ".") + ",", 6),
            pad(r["sig_recomendado"] + ",", 5),
            pad(aspas(r["nome_en"]) + ",", 34)
            + ("false" if r["sem_7_estrelas"] == "sim" else "true"),
        )
        for r in rows
    ]
    conta = collections.Counter(r["tier_origem"] for r in rows)
    sem7 = sum(1 for r in rows if r["sem_7_estrelas"] == "sim")

    return f"""-- Tier list real de ataque (7 estrelas). {len(rows)} campeoes.
--
-- GERADO por supabase/gerar_seed_tier_list.py — nao edite a mao. A fonte e a
-- planilha do dono cruzada com o mcoc.app; reveja la e regenere este arquivo.
--
-- Idempotente e REEXECUTAVEL: casa por nome e sobrescreve classe, nota, sig
-- recomendado, nome em ingles e a flag de 7 estrelas. E o mecanismo de
-- atualizacao da tier list — quando as fontes revisarem as notas, regenere e
-- rode de novo. Os ids nao mudam, entao os rosters continuam apontando para
-- os mesmos campeoes.
--
-- Nao apaga nada: um campeao que saia das fontes permanece no catalogo.
--
-- ORDEM: exige a migration 007 (name_en, has_7star). Se as linhas de amostra
-- de seed_dev.sql ainda estiverem na tabela, rode limpeza_seed_dev.sql antes —
-- a grafia delas difere ("Serpente" vs "O serpente") e o ON CONFLICT (name)
-- nao as alcancaria, duplicando o catalogo.
--
-- COMO AS NOTAS FORAM OBTIDAS
-- Media 50/50 do percentil de duas tier lists independentes: a do dono e a do
-- mcoc.app (letras S+..F, ela propria consenso de dois criadores). Percentil e
-- nao nota crua porque as escalas diferem — comparar "9,5" com "S" nao teria
-- significado. As faixas mantiveram o tamanho original, entao mudou quem esta
-- em cada uma, nao quantas vagas ela tem.
--
-- Excecao: onde o mcoc.app promove um campeao que ele mesmo marca como
-- high_skill, o bonus e descontado e vale so a nota do dono. O perfil de jogo
-- e Valiant sem Battlegrounds nem Guerra de Alianca, onde teto de performance
-- rende menos que utilidade pratica.
--
-- Faixas: {", ".join(f"{f} {conta[f]}" for f in FAIXAS if conta[f])}.
-- Sem versao 7 estrelas (has_7star = false): {sem7}.

INSERT INTO base_champions
  (name, champion_class, attack_tier_score, attack_recommended_sig, name_en, has_7star)
VALUES
{",\n".join(linhas)}
ON CONFLICT (name) DO UPDATE SET
  champion_class         = EXCLUDED.champion_class,
  attack_tier_score      = EXCLUDED.attack_tier_score,
  attack_recommended_sig = EXCLUDED.attack_recommended_sig,
  name_en                = EXCLUDED.name_en,
  has_7star              = EXCLUDED.has_7star;
"""


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    with open(sys.argv[1], encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if erros := validar(rows):
        print("ABORTADO, nada foi escrito:", *erros, sep="\n  ", file=sys.stderr)
        return 1

    DESTINO.write_text(gerar(rows), encoding="utf-8")
    sem7 = sum(1 for r in rows if r["sem_7_estrelas"] == "sim")
    print(f"{DESTINO}: {len(rows)} campeoes, {sem7} sem versao 7 estrelas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
