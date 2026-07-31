-- base_champions esta vazia, entao USING 0 basta.
-- Semantica: undup=0, x20=20, x60=60, x80=80, x200=200.

-- O DEFAULT precisa cair ANTES da conversao. O USING converte os dados,
-- mas o Postgres nao converte 'undup'::sig_requirement para smallint
-- sozinho e aborta com:
--   ERROR 42804: default for column ... cannot be cast automatically
ALTER TABLE base_champions
  ALTER COLUMN attack_recommended_sig  DROP DEFAULT,
  ALTER COLUMN defense_recommended_sig DROP DEFAULT;

ALTER TABLE base_champions
  ALTER COLUMN attack_recommended_sig  TYPE SMALLINT USING 0,
  ALTER COLUMN defense_recommended_sig TYPE SMALLINT USING 0;

ALTER TABLE base_champions
  ALTER COLUMN attack_recommended_sig  SET DEFAULT 0,
  ALTER COLUMN defense_recommended_sig SET DEFAULT 0;

ALTER TABLE base_champions
  DROP CONSTRAINT IF EXISTS attack_sig_range,
  DROP CONSTRAINT IF EXISTS defense_sig_range;

ALTER TABLE base_champions
  ADD CONSTRAINT attack_sig_range  CHECK (attack_recommended_sig  BETWEEN 0 AND 200),
  ADD CONSTRAINT defense_sig_range CHECK (defense_recommended_sig BETWEEN 0 AND 200);

DROP TYPE IF EXISTS sig_requirement;
