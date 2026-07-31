-- Baseline explicito de RLS para base_champions e user_champions.
--
-- Contexto: as tabelas base_champions e user_champions foram criadas a mao
-- no dashboard do Supabase e nunca tiveram DDL versionada neste repositorio
-- (nao ha CREATE TABLE aqui de proposito — as definicoes de coluna
-- autoritativas nao estao disponiveis para este autor, e adivinha-las
-- seria pior do que deixar a lacuna documentada). Este arquivo nao recria
-- as tabelas; ele apenas torna explicito e reproduzivel o boundary de RLS
-- que ja existe no banco em producao, para que parar de depender de estado
-- nao versionado.
--
-- Idempotente: reexecutar contra o banco vivo e um no-op; em um projeto
-- novo (com as tabelas ja criadas), deixa o RLS no mesmo estado.

ALTER TABLE base_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_champions ENABLE ROW LEVEL SECURITY;

-- Cada usuario so ve e escreve as proprias linhas de user_champions.
-- WITH CHECK explicito (igual ao USING) para deixar a garantia de escrita
-- na pagina, mesmo que para FOR ALL sem WITH CHECK o Postgres ja aplique
-- o USING tambem as novas linhas.
DROP POLICY IF EXISTS "Usuario acessa apenas o proprio roster" ON user_champions;
CREATE POLICY "Usuario acessa apenas o proprio roster"
  ON user_champions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
