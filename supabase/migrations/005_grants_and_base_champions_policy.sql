-- Grants de DML e policy de leitura da base_champions.
--
-- Diagnostico: o app quebrou com "permission denied for table user_champions".
-- O Postgres checa os privilegios da tabela ANTES de avaliar o RLS, entao a
-- ausencia de GRANT produz erro em vez do silencio de uma policy que nega.
-- Alem disso base_champions tinha RLS ligado e nenhuma policy, o que nega
-- toda leitura — o join da tier list voltaria vazio mesmo apos os grants.
--
-- anon nao recebe nada de proposito: o middleware ja exige sessao.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON TABLE base_champions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_champions TO authenticated;

DROP POLICY IF EXISTS "Leitura da tier list para usuarios logados" ON base_champions;
CREATE POLICY "Leitura da tier list para usuarios logados"
  ON base_champions
  FOR SELECT
  TO authenticated
  USING (true);
