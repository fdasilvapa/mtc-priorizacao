-- Nome em ingles e marcador de existencia em 7 estrelas.
--
-- name_en e a chave de juncao com tier lists de terceiros. O nome em portugues
-- nao serve: o jogo desambigua num idioma e nao no outro (o catalogo tem
-- "Massacre" e "Masacre", campeoes diferentes separados por uma letra), e cada
-- fonte de tier list publica em ingles. Sem essa coluna, cruzar uma lista nova
-- e casar 326 nomes a mao de novo.
--
-- Fica nullable porque as linhas de amostra de seed_dev.sql ainda podem estar
-- na tabela e nao tem equivalente em ingles. Depois de rodar limpeza_seed_dev.sql
-- e seed_tier_list.sql, toda linha tem valor e vale apertar para NOT NULL.
-- UNIQUE aceita multiplos NULL no Postgres, entao a constraint ja pode entrar.
ALTER TABLE base_champions
  ADD COLUMN IF NOT EXISTS name_en TEXT;

ALTER TABLE base_champions
  DROP CONSTRAINT IF EXISTS base_champions_name_en_key;
ALTER TABLE base_champions
  ADD CONSTRAINT base_champions_name_en_key UNIQUE (name_en);

-- Nem todo campeao do jogo existe em 7 estrelas — hoje sao 13 no catalogo.
-- Nao da para simplesmente omiti-los da tier list: a Kabam vai liberando as
-- versoes 7 estrelas com o tempo, e quando isso acontecer basta virar o
-- booleano em vez de reimportar a lista inteira.
--
-- DEFAULT true porque a ausencia de versao 7 estrelas e a excecao, e porque
-- as linhas ja existentes sao todas de campeoes que o dono possui em 7 estrelas.
ALTER TABLE base_champions
  ADD COLUMN IF NOT EXISTS has_7star BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN base_champions.name_en IS
  'Nome oficial em ingles. Chave de juncao com tier lists externas.';
COMMENT ON COLUMN base_champions.has_7star IS
  'False quando o campeao ainda nao tem versao 7 estrelas no jogo.';
