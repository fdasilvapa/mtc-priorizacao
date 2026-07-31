-- Um campeao nao pode aparecer duas vezes no roster do mesmo usuario.
ALTER TABLE user_champions
  DROP CONSTRAINT IF EXISTS user_champions_unique;

ALTER TABLE user_champions
  ADD CONSTRAINT user_champions_unique UNIQUE (user_id, champion_id);
