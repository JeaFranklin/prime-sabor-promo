-- ============================================================================
-- MÓDULO #13 — Notificações internas (sino no header + drawer + realtime)
-- ============================================================================
-- Tabela de notificações in-app que aparecem no sino do header.
-- Disparadas em eventos: promotora aceita/recusa proposta, cliente aceita/recusa
-- contrato, pagamento atrasou.
--
-- Padrão: single-tenant. user_id é opcional — null = "para todos os admins".
-- ============================================================================

create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),

  -- Tipo (controla emoji/cor padrão e roteamento futuro)
  tipo text not null check (tipo in (
    'proposta_aceita',
    'proposta_recusada',
    'contrato_aceito',
    'contrato_recusado',
    'pagamento_atrasado',
    'info'
  )),

  -- Conteúdo exibido
  titulo text not null,
  mensagem text,
  icone text,                       -- emoji opcional (override do padrão)

  -- Destino do clique (rota interna, ex.: '/servicos/abc123')
  link_para text,

  -- Estado
  lida boolean not null default false,
  read_at timestamptz,

  -- Para quem é (null = "todos os admins logados")
  user_id uuid references auth.users(id) on delete cascade,

  -- Contexto extra (servico_id, promotora_id, etc.)
  metadata jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_notif_lida_created
  on notificacoes(lida, created_at desc);
create index if not exists idx_notif_user
  on notificacoes(user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — segue o padrão das migrations 003/004 (authenticated full access)
-- ──────────────────────────────────────────────────────────────────────────
alter table notificacoes enable row level security;

drop policy if exists "notificacoes: equipe ve"     on notificacoes;
drop policy if exists "notificacoes: equipe insere" on notificacoes;
drop policy if exists "notificacoes: equipe edita"  on notificacoes;
drop policy if exists "notificacoes: equipe apaga"  on notificacoes;

create policy "notificacoes: equipe ve"
  on notificacoes for select to authenticated using (true);

create policy "notificacoes: equipe insere"
  on notificacoes for insert to authenticated with check (true);

create policy "notificacoes: equipe edita"
  on notificacoes for update to authenticated using (true) with check (true);

create policy "notificacoes: equipe apaga"
  on notificacoes for delete to authenticated using (true);

-- ──────────────────────────────────────────────────────────────────────────
-- Habilita REALTIME — pra notificação aparecer no sino na hora,
-- sem o usuário precisar dar refresh.
-- ──────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table notificacoes;
  end if;
end$$;
