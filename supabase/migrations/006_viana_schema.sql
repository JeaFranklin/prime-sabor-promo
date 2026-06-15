-- ============================================================================
-- MÓDULO Bot Viana — Tabelas isoladas (cliente: Viana Supermercado)
-- ============================================================================
-- ⚠️ Cliente DIFERENTE do Prime Sabor Promo (mesmo repo, infra compartilhada).
-- Todas as tabelas levam prefixo `viana_` pra evitar mistura. Ver src/lib/viana/
-- e a diretriz [[feedback-isolar-clientes]] no Claude memory.
--
-- Bot Viana = assistente WhatsApp consultivo da agenda de fornecedores.
-- Operadores autorizados: Kênia (proprietária), Duda (assistente), Jeã (NERESCO).
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- viana_usuarios_autorizados
-- Whitelist de números que podem conversar com o Bot Viana via WhatsApp.
-- A env var VIANA_NUMEROS_AUTORIZADOS espelha essa tabela em cache (perf no
-- webhook). Esta tabela é a fonte de verdade pra UI/auditoria futura.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists viana_usuarios_autorizados (
  id uuid primary key default gen_random_uuid(),
  numero_whatsapp text not null unique,
  nome text not null,
  papel text not null check (papel in ('proprietaria', 'assistente', 'consultor', 'outro')),
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_viana_usr_ativo
  on viana_usuarios_autorizados(numero_whatsapp) where ativo = true;

-- ──────────────────────────────────────────────────────────────────────────
-- viana_interacoes
-- Log de todas as conversas com o bot. Útil pra auditoria, métricas e debug.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists viana_interacoes (
  id uuid primary key default gen_random_uuid(),
  numero_whatsapp text not null,
  nome_remetente text,
  pergunta text not null,
  intent text,
  resposta_resumo text,
  duracao_ms integer,
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists idx_viana_inter_data
  on viana_interacoes(created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- Seed inicial: Kênia, Duda e Jeã (idempotente)
-- ──────────────────────────────────────────────────────────────────────────
insert into viana_usuarios_autorizados (numero_whatsapp, nome, papel) values
  ('556392197949', 'Kênia',         'proprietaria'),
  ('556392430636', 'Duda',          'assistente'),
  ('556392253618', 'Jeã (NERESCO)', 'consultor')
on conflict (numero_whatsapp) do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — segue o padrão das migrations 003/004/005 (authenticated full access)
-- ──────────────────────────────────────────────────────────────────────────
alter table viana_usuarios_autorizados enable row level security;
alter table viana_interacoes enable row level security;

drop policy if exists "viana_usr: equipe ve"    on viana_usuarios_autorizados;
drop policy if exists "viana_usr: equipe edita" on viana_usuarios_autorizados;
drop policy if exists "viana_int: equipe ve"    on viana_interacoes;

create policy "viana_usr: equipe ve"
  on viana_usuarios_autorizados for select to authenticated using (true);

create policy "viana_usr: equipe edita"
  on viana_usuarios_autorizados for all to authenticated using (true) with check (true);

create policy "viana_int: equipe ve"
  on viana_interacoes for select to authenticated using (true);
