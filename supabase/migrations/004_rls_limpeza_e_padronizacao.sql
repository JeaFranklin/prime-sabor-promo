-- ============================================================================
-- RLS — LIMPEZA TOTAL DAS POLICIES PÚBLICAS + PADRONIZAÇÃO
-- ============================================================================
-- Continuação da migration 003 (que só tratou `promotoras` como piloto).
-- Aqui:
--   1) Removemos TODAS as 37 policies públicas (role 'public') que estavam
--      espalhadas pelas tabelas antigas — é por elas que qualquer um conseguia
--      ler/inserir/atualizar/apagar dados sem login.
--   2) Adicionamos as 4 policies padrão `{authenticated}` em cada tabela em uso,
--      espelhando o padrão da migration 002 (propostas) e 003 (promotoras).
--   3) `avaliacoes` (órfã/lixo) fica SEM policies — efetivamente trancada,
--      pra ser apagada num próximo passo.
--
-- Padrão final por tabela:
--   • authenticated  → acesso total (SELECT/INSERT/UPDATE/DELETE)
--   • anon           → nenhum acesso (não existe policy pra ele)
--   • service_role   → bypassa RLS por design (webhook/automações ok)
--
-- ⚠️ Reversível: cada DROP/CREATE usa "if exists" / pode ser re-rodada à vontade.
--    Em caso de pânico, pra reabrir: alter table <nome> disable row level security;
-- ============================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- 1) avaliacoes (ÓRFÃ — só limpa as públicas, NÃO adiciona authenticated)
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Atualização pública" on avaliacoes;
drop policy if exists "Inserção pública"    on avaliacoes;
drop policy if exists "Leitura pública"     on avaliacoes;


-- ──────────────────────────────────────────────────────────────────────────
-- 2) avaliacoes_promotora — TABELA EM USO (painel de média/histórico)
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Public delete avaliacoes" on avaliacoes_promotora;
drop policy if exists "Public insert avaliacoes" on avaliacoes_promotora;
drop policy if exists "Public select avaliacoes" on avaliacoes_promotora;

drop policy if exists "avaliacoes_promotora: equipe ve"     on avaliacoes_promotora;
drop policy if exists "avaliacoes_promotora: equipe insere" on avaliacoes_promotora;
drop policy if exists "avaliacoes_promotora: equipe edita"  on avaliacoes_promotora;
drop policy if exists "avaliacoes_promotora: equipe apaga"  on avaliacoes_promotora;

create policy "avaliacoes_promotora: equipe ve"
  on avaliacoes_promotora for select to authenticated using (true);

create policy "avaliacoes_promotora: equipe insere"
  on avaliacoes_promotora for insert to authenticated with check (true);

create policy "avaliacoes_promotora: equipe edita"
  on avaliacoes_promotora for update to authenticated using (true) with check (true);

create policy "avaliacoes_promotora: equipe apaga"
  on avaliacoes_promotora for delete to authenticated using (true);


-- ──────────────────────────────────────────────────────────────────────────
-- 3) clientes
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Atualização pública"   on clientes;
drop policy if exists "Inserção pública"      on clientes;
drop policy if exists "Leitura pública"       on clientes;
drop policy if exists "Public delete clientes" on clientes;
drop policy if exists "Public insert clientes" on clientes;
drop policy if exists "Public select clientes" on clientes;
drop policy if exists "Public update clientes" on clientes;

drop policy if exists "clientes: equipe ve"     on clientes;
drop policy if exists "clientes: equipe insere" on clientes;
drop policy if exists "clientes: equipe edita"  on clientes;
drop policy if exists "clientes: equipe apaga"  on clientes;

create policy "clientes: equipe ve"
  on clientes for select to authenticated using (true);

create policy "clientes: equipe insere"
  on clientes for insert to authenticated with check (true);

create policy "clientes: equipe edita"
  on clientes for update to authenticated using (true) with check (true);

create policy "clientes: equipe apaga"
  on clientes for delete to authenticated using (true);


-- ──────────────────────────────────────────────────────────────────────────
-- 4) contatos_cliente
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Public delete contatos_cliente" on contatos_cliente;
drop policy if exists "Public insert contatos_cliente" on contatos_cliente;
drop policy if exists "Public select contatos_cliente" on contatos_cliente;
drop policy if exists "Public update contatos_cliente" on contatos_cliente;

drop policy if exists "contatos_cliente: equipe ve"     on contatos_cliente;
drop policy if exists "contatos_cliente: equipe insere" on contatos_cliente;
drop policy if exists "contatos_cliente: equipe edita"  on contatos_cliente;
drop policy if exists "contatos_cliente: equipe apaga"  on contatos_cliente;

create policy "contatos_cliente: equipe ve"
  on contatos_cliente for select to authenticated using (true);

create policy "contatos_cliente: equipe insere"
  on contatos_cliente for insert to authenticated with check (true);

create policy "contatos_cliente: equipe edita"
  on contatos_cliente for update to authenticated using (true) with check (true);

create policy "contatos_cliente: equipe apaga"
  on contatos_cliente for delete to authenticated using (true);


-- ──────────────────────────────────────────────────────────────────────────
-- 5) escala
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Atualização pública"  on escala;
drop policy if exists "Inserção pública"     on escala;
drop policy if exists "Leitura pública"      on escala;
drop policy if exists "Public delete escala" on escala;
drop policy if exists "Public insert escala" on escala;
drop policy if exists "Public select escala" on escala;
drop policy if exists "Public update escala" on escala;

drop policy if exists "escala: equipe ve"     on escala;
drop policy if exists "escala: equipe insere" on escala;
drop policy if exists "escala: equipe edita"  on escala;
drop policy if exists "escala: equipe apaga"  on escala;

create policy "escala: equipe ve"
  on escala for select to authenticated using (true);

create policy "escala: equipe insere"
  on escala for insert to authenticated with check (true);

create policy "escala: equipe edita"
  on escala for update to authenticated using (true) with check (true);

create policy "escala: equipe apaga"
  on escala for delete to authenticated using (true);


-- ──────────────────────────────────────────────────────────────────────────
-- 6) fotos_promotora
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Public delete fotos_promotora" on fotos_promotora;
drop policy if exists "Public insert fotos_promotora" on fotos_promotora;
drop policy if exists "Public select fotos_promotora" on fotos_promotora;

drop policy if exists "fotos_promotora: equipe ve"     on fotos_promotora;
drop policy if exists "fotos_promotora: equipe insere" on fotos_promotora;
drop policy if exists "fotos_promotora: equipe edita"  on fotos_promotora;
drop policy if exists "fotos_promotora: equipe apaga"  on fotos_promotora;

create policy "fotos_promotora: equipe ve"
  on fotos_promotora for select to authenticated using (true);

create policy "fotos_promotora: equipe insere"
  on fotos_promotora for insert to authenticated with check (true);

create policy "fotos_promotora: equipe edita"
  on fotos_promotora for update to authenticated using (true) with check (true);

create policy "fotos_promotora: equipe apaga"
  on fotos_promotora for delete to authenticated using (true);


-- ──────────────────────────────────────────────────────────────────────────
-- 7) promotoras — só limpa as públicas (as authenticated já vieram na 003)
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Atualização pública" on promotoras;
drop policy if exists "Inserção pública"    on promotoras;
drop policy if exists "Leitura pública"     on promotoras;


-- ──────────────────────────────────────────────────────────────────────────
-- 8) servicos
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "Atualização pública"   on servicos;
drop policy if exists "Inserção pública"      on servicos;
drop policy if exists "Leitura pública"       on servicos;
drop policy if exists "Public delete servicos" on servicos;
drop policy if exists "Public insert servicos" on servicos;
drop policy if exists "Public select servicos" on servicos;
drop policy if exists "Public update servicos" on servicos;

drop policy if exists "servicos: equipe ve"     on servicos;
drop policy if exists "servicos: equipe insere" on servicos;
drop policy if exists "servicos: equipe edita"  on servicos;
drop policy if exists "servicos: equipe apaga"  on servicos;

create policy "servicos: equipe ve"
  on servicos for select to authenticated using (true);

create policy "servicos: equipe insere"
  on servicos for insert to authenticated with check (true);

create policy "servicos: equipe edita"
  on servicos for update to authenticated using (true) with check (true);

create policy "servicos: equipe apaga"
  on servicos for delete to authenticated using (true);


-- ──────────────────────────────────────────────────────────────────────────
-- 9) empresa_config — protege CNPJ/CPF do representante (singleton)
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists "empresa_config: equipe ve"     on empresa_config;
drop policy if exists "empresa_config: equipe insere" on empresa_config;
drop policy if exists "empresa_config: equipe edita"  on empresa_config;
drop policy if exists "empresa_config: equipe apaga"  on empresa_config;

create policy "empresa_config: equipe ve"
  on empresa_config for select to authenticated using (true);

create policy "empresa_config: equipe insere"
  on empresa_config for insert to authenticated with check (true);

create policy "empresa_config: equipe edita"
  on empresa_config for update to authenticated using (true) with check (true);

create policy "empresa_config: equipe apaga"
  on empresa_config for delete to authenticated using (true);


-- ============================================================================
-- VERIFICAÇÃO (rode SEPARADAMENTE depois pra conferir o resultado)
-- ============================================================================
-- 1) Deve retornar 0 (nenhuma policy pública sobrou):
--      select count(*) from pg_policies
--       where schemaname = 'public' and 'public' = any(roles);
--
-- 2) Deve listar todas as tabelas em uso com 4 policies authenticated cada:
--      select tablename, count(*) as policies_authenticated
--        from pg_policies
--       where schemaname = 'public' and 'authenticated' = any(roles)
--       group by tablename order by tablename;
--
--    Esperado (8 tabelas, 4 policies cada):
--      avaliacoes_promotora | 4
--      clientes             | 4
--      contatos_cliente     | 4
--      empresa_config       | 4
--      escala               | 4
--      fotos_promotora      | 4
--      promotoras           | 4
--      servicos             | 4
--
--    Mais as tabelas novas (contratos, propostas, documentos_*) também
--    com authenticated — mas elas já estavam OK desde a migration 002.
-- ============================================================================
