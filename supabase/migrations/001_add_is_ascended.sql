-- Ascensao do campeao entra como bonus no Priority Score.
ALTER TABLE user_champions
  ADD COLUMN IF NOT EXISTS is_ascended BOOLEAN NOT NULL DEFAULT false;
