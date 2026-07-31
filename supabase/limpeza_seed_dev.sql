-- Limpeza UNICA dos 10 campeoes de amostra com notas ficticias.
--
-- Rodar UMA VEZ, antes do primeiro seed_tier_list.sql. Depois disso o
-- arquivo vira no-op e pode ser esquecido (nao apague — ele documenta
-- de onde as linhas antigas sairam).
--
-- Os nomes de amostra estavam em grafia diferente da tier list real
-- ("Serpente" vs "O serpente"), entao o ON CONFLICT (name) do seed nao
-- os alcancaria: sem este DELETE o catalogo ficaria duplicado.
--
-- ATENCAO: isto apaga tambem as linhas de user_champions que apontam
-- para esses campeoes — ou seja, o roster de teste. E o efeito desejado:
-- aqueles nunca foram campeoes de verdade de ninguem.

BEGIN;

DELETE FROM user_champions
WHERE champion_id IN (
  SELECT id FROM base_champions WHERE name IN (
    'Serpente',
    'Hercules',
    'Onslaught',
    'Cavaleiro da Lua',
    'Doutor Destino',
    'Homem de Ferro Infinito',
    'Nimrod',
    'Photon',
    'Bishop',
    'Shang-Chi'
  )
);

DELETE FROM base_champions
WHERE name IN (
  'Serpente',
  'Hercules',
  'Onslaught',
  'Cavaleiro da Lua',
  'Doutor Destino',
  'Homem de Ferro Infinito',
  'Nimrod',
  'Photon',
  'Bishop',
  'Shang-Chi'
);

COMMIT;
