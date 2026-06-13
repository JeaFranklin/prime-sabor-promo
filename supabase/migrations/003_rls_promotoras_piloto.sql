-- ============================================================================
-- RLS PILOTO — Tabela `promotoras`
-- ============================================================================
-- Fecha a brecha de segurança nas tabelas antigas (item 14 das pendências).
-- Esta migration é o PILOTO: aplica RLS só em `promotoras` pra validar que o
-- app continua funcionando antes de protegermos as outras 7 tabelas.
--
-- Padrão de policies (espelha a migration 002_propostas.sql):
--   • authenticated  → acesso total (Jeã / equipe logada)
--   • anon           → nenhum acesso (atacante sem login NÃO entra)
--   • service_role   → bypassa RLS por design do Postgres (webhook continua ok)
--
-- ⚠️ Reversível: se algo quebrar, basta rodar:
--      alter table promotoras disable row level security;
-- ============================================================================

-- 1) Liga a tranca da tabela
alter table promotoras enable row level security;

-- 2) Apaga policies antigas (se já existirem) pra evitar duplicação ao re-rodar
drop policy if exists "promotoras: equipe ve"      on promotoras;
drop policy if exists "promotoras: equipe insere"  on promotoras;
drop policy if exists "promotoras: equipe edita"   on promotoras;
drop policy if exists "promotoras: equipe apaga"   on promotoras;

-- 3) Cria policies: equipe logada (authenticated) tem acesso total
create policy "promotoras: equipe ve"
  on promotoras for select to authenticated using (true);

create policy "promotoras: equipe insere"
  on promotoras for insert to authenticated with check (true);

create policy "promotoras: equipe edita"
  on promotoras for update to authenticated using (true) with check (true);

create policy "promotoras: equipe apaga"
  on promotoras for delete to authenticated using (true);

-- ============================================================================
-- VERIFICAÇÃO (rode separado depois pra conferir o estado)
-- ============================================================================
-- Confirma RLS ligado + lista as policies criadas:
--
--   select tablename, rowsecurity from pg_tables where tablename = 'promotoras';
--   select policyname, cmd, roles from pg_policies where tablename = 'promotoras';
--
-- Esperado:
--   • rowsecurity = true
--   • 4 policies: equipe ve / insere / edita / apaga, todas com role {authenticated}
-- ============================================================================
