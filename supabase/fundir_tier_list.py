#!/usr/bin/env python3
"""Funde a planilha do dono com a tier list do mcoc.app.

    python3 supabase/fundir_tier_list.py planilha.csv tierlist.json saida.csv

`tierlist.json` e uma copia de https://mcoc.app/data/tierlist.json. A saida
alimenta gerar_seed_tier_list.py.

Metodo (ver o cabecalho de seed_tier_list.sql):
- cada lista vira percentil dentro de si mesma (posto medio nos empates,
  reescalado para 0-100), porque as escalas nao sao comparaveis;
- nota fundida = media 50/50 dos dois percentis;
- se o mcoc.app marca o campeao como high_skill e o promove acima do dono,
  vale so o percentil do dono;
- campeao ausente do mcoc.app fica so com o percentil do dono;
- a lista e reordenada pela nota fundida e redistribuida nas faixas com o
  MESMO tamanho que elas tem na planilha. Empates: percentil do dono, depois
  score do mcoc.app, depois nome.

Na planilha, nome_en "?" significa "ainda nao existe no mcoc.app": o campeao
entra sem nome em ingles e sem casar com a segunda fonte.
"""

import collections
import csv
import json
import sys

FAIXAS = {
    "Top of the Class": "10", "Incredible": "9,5", "Fantastic": "9",
    "Great": "8,5", "Very Good": "8", "Good": "7,25", "Mediocre": "5,75",
    "Awful": "2,5",
}
# Notas em intervalo reduzidas ao ponto medio, so para ordenar.
INTERVALOS = {"7,5-7": 7.25, "6,5-5": 5.75, "4-1": 2.5}
# Mesmo campeao, grafia diferente no mcoc.app.
ALIASES = {
    "Spider-Man (Classic)": "Spider-Man",
    "Daredevil (Classic)": "Daredevil",
    "Blade (Stellar Forged)": "Blade (Stellar Forge)",
    "Star-Lord (Stellar Forged)": "Star-Lord (Stellar-Forged)",
}
SEM_NOME_EN = "?"


def percentis(valores: list[float]) -> list[float]:
    posicoes = collections.defaultdict(list)
    for i, v in enumerate(sorted(valores), 1):
        posicoes[v].append(i)
    medio = {v: sum(p) / len(p) for v, p in posicoes.items()}
    lo, hi = min(medio.values()), max(medio.values())
    return [(medio[v] - lo) / (hi - lo) * 100 for v in valores]


def nota(texto: str) -> float:
    return INTERVALOS.get(texto) or float(texto.replace(",", "."))


def fundir(rows: list[dict], mcoc: dict[str, dict]) -> list[dict]:
    casados = [r for r in rows if r["_mcoc"]]
    p_dono = dict(zip(map(id, rows), percentis([nota(r["nota_ataque"]) for r in rows])))
    p_mcoc = dict(zip(map(id, casados), percentis([r["_mcoc"]["score"] for r in casados])))

    for r in rows:
        pd, c = p_dono[id(r)], r["_mcoc"]
        if not c:
            r["_fundida"], r["regra"] = pd, "so o seu (fora do mcoc.app)"
        elif "high_skill" in c["tags"] and p_mcoc[id(r)] > pd:
            r["_fundida"], r["regra"] = pd, "high_skill: bonus descontado"
        else:
            r["_fundida"], r["regra"] = (pd + p_mcoc[id(r)]) / 2, "media 50/50"
        r["_pd"] = pd

    ordem = sorted(rows, key=lambda r: (
        -r["_fundida"], -r["_pd"], -(r["_mcoc"] or {"score": -1})["score"], r["nome"],
    ))
    tamanho = collections.Counter(r["tier_origem"] for r in rows)
    i = 0
    for faixa in FAIXAS:
        for r in ordem[i:i + tamanho[faixa]]:
            r["faixa_nova"] = faixa
        i += tamanho[faixa]
    return rows


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    planilha, json_path, saida = sys.argv[1:]

    with open(planilha, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    with open(json_path, encoding="utf-8") as f:
        mcoc = {c["name"]: c for c in json.load(f)["champions"]}

    faltando = [r["tier_origem"] for r in rows if r["tier_origem"] not in FAIXAS]
    if faltando:
        print(f"ABORTADO, faixa desconhecida: {faltando}", file=sys.stderr)
        return 1

    for r in rows:
        en = r["nome_en"].strip()
        r["_mcoc"] = None if en == SEM_NOME_EN else mcoc.get(ALIASES.get(en, en))
    fundir(rows, mcoc)

    colunas = ["nome", "classe", "nota_ataque", "sig_recomendado", "tier_origem",
               "nome_en", "faixa_anterior", "nota_anterior", "regra",
               "high_skill", "sem_7_estrelas"]
    with open(saida, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, colunas)
        w.writeheader()
        for r in rows:
            c = r["_mcoc"] or {"tags": [], "no7star": False}
            w.writerow({
                "nome": r["nome"], "classe": r["classe"],
                "nota_ataque": FAIXAS[r["faixa_nova"]],
                "sig_recomendado": r["sig_recomendado"],
                "tier_origem": r["faixa_nova"], "nome_en": r["nome_en"],
                "faixa_anterior": r["tier_origem"], "nota_anterior": r["nota_ataque"],
                "regra": r["regra"],
                "high_skill": "sim" if "high_skill" in c["tags"] else "",
                "sem_7_estrelas": "sim" if c["no7star"] else "",
            })

    trocas = sum(r["faixa_nova"] != r["tier_origem"] for r in rows)
    fora = [r["nome"] for r in rows if not r["_mcoc"]]
    print(f"{saida}: {len(rows)} campeoes, {trocas} trocaram de faixa")
    print(f"fora do mcoc.app ({len(fora)}): {', '.join(fora)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
