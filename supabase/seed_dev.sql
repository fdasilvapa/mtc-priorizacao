-- Seed de AMOSTRA para desenvolvimento. Notas ficticias.
-- Substituir pelo seed real da tier list quando ele existir.
INSERT INTO base_champions
  (name, champion_class, attack_tier_score, attack_recommended_sig)
VALUES
  ('Serpente',              'Cosmic',  10.0, 200),
  ('Hercules',              'Cosmic',   9.5,   0),
  ('Onslaught',             'Mutant',   9.5, 200),
  ('Cavaleiro da Lua',      'Mystic',   9.0,  80),
  ('Doutor Destino',        'Mystic',   9.0,   0),
  ('Homem de Ferro Infinito','Tech',    8.5,  20),
  ('Nimrod',                'Tech',     8.0,   0),
  ('Photon',                'Science',  9.0,  60),
  ('Bishop',                'Mutant',   7.5,   0),
  ('Shang-Chi',             'Skill',    8.5, 200)
ON CONFLICT (name) DO NOTHING;
