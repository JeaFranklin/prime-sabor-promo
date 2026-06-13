-- ============================================================================
-- MÓDULO DE PROPOSTAS — Prime Sabor Promo
-- ============================================================================
-- Tabela usada no fluxo ANTES do contrato: a promotora primeiro recebe uma
-- "proposta" (sondagem) pelo WhatsApp. Só depois de aceitar é que a JFS
-- decide gerar o contrato formal.
-- ============================================================================

create table if not exists propostas (
  id uuid primary key default gen_random_uuid(),

  servico_id uuid not null references servicos(id) on delete cascade,
  promotora_id uuid not null references promotoras(id) on delete restrict,

  status text not null default 'enviada' check (status in (
    'enviada',         -- promotora recebeu via WhatsApp
    'aceita',          -- promotora aceitou pelo link
    'recusada',        -- promotora recusou
    'cancelada',       -- JFS cancelou antes da resposta
    'expirada',        -- prazo passou sem resposta
    'gerou_contrato'   -- JFS confirmou e gerou contrato a partir desta proposta
  )),

  -- Dados snapshot da proposta no momento do envio
  valor_diaria numeric(10,2),
  valor_total numeric(10,2),
  qtd_dias integer,
  data_inicio_servico date,
  data_fim_servico date,
  data_pagamento_promotora date,
  local_completo text,
  servico_nome text,
  cliente_nome text,

  -- Token público para o link de resposta
  token text unique,
  expira_em timestamptz,

  -- Envio
  enviada_whatsapp_em timestamptz,
  enviada_whatsapp_numero text,

  -- Resposta
  respondida_em timestamptz,
  respondida_ip inet,
  respondida_user_agent text,
  recusa_motivo text,

  -- Ligação com contrato (se gerou)
  contrato_id uuid references contratos(id) on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Evita criar 2 propostas ativas pra mesma (servico, promotora)
  unique (servico_id, promotora_id)
);

create index if not exists idx_propostas_servico   on propostas(servico_id);
create index if not exists idx_propostas_promotora on propostas(promotora_id);
create index if not exists idx_propostas_status    on propostas(status);
create index if not exists idx_propostas_token     on propostas(token);

-- Trigger de updated_at (reutiliza a function criada na migration 001)
drop trigger if exists trg_propostas_updated on propostas;
create trigger trg_propostas_updated before update on propostas
  for each row execute function set_updated_at();

-- ============================================================================
-- POLÍTICAS DE RLS (segurança em nível de linha)
-- ============================================================================
alter table propostas enable row level security;

-- Equipe logada: acesso total
create policy "propostas: equipe ve"
  on propostas for select to authenticated using (true);

create policy "propostas: equipe insere"
  on propostas for insert to authenticated with check (true);

create policy "propostas: equipe edita"
  on propostas for update to authenticated using (true) with check (true);

create policy "propostas: equipe apaga"
  on propostas for delete to authenticated using (true);

-- Público (sem login): apenas leitura via token + atualização para aceitar/recusar
create policy "propostas: leitura publica por token"
  on propostas for select to anon
  using (token is not null);

create policy "propostas: aceite recusa publica por token"
  on propostas for update to anon
  using (token is not null and status = 'enviada')
  with check (status in ('aceita','recusada'));
