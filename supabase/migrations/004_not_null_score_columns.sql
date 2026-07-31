-- Colunas consumidas pelo Priority Score nao podem ser nulas.
-- attack_recommended_sig nulo produz NaN: o teste `=== 0` falha e a
-- divisao `sigLevel / null` vira NaN, que contamina a ordenacao inteira
-- sem lancar erro nenhum.
UPDATE base_champions SET attack_tier_score      = 0 WHERE attack_tier_score      IS NULL;
UPDATE base_champions SET attack_recommended_sig = 0 WHERE attack_recommended_sig IS NULL;
UPDATE base_champions SET defense_tier_score      = 0 WHERE defense_tier_score      IS NULL;
UPDATE base_champions SET defense_recommended_sig = 0 WHERE defense_recommended_sig IS NULL;
UPDATE user_champions SET is_favorite = false WHERE is_favorite IS NULL;

ALTER TABLE base_champions
  ALTER COLUMN attack_tier_score       SET DEFAULT 0,
  ALTER COLUMN attack_tier_score       SET NOT NULL,
  ALTER COLUMN attack_recommended_sig  SET NOT NULL,
  ALTER COLUMN defense_tier_score      SET DEFAULT 0,
  ALTER COLUMN defense_tier_score      SET NOT NULL,
  ALTER COLUMN defense_recommended_sig SET NOT NULL;

ALTER TABLE user_champions
  ALTER COLUMN is_favorite SET DEFAULT false,
  ALTER COLUMN is_favorite SET NOT NULL;
