-- ============================================================================
-- MÓDULO DE CONTRATOS E DOCUMENTOS — Prime Sabor Promo / GustPro
-- ============================================================================
-- Aplica-se automaticamente a serviços com duração >= 5 dias corridos.
-- Suporta dois tipos de contrato:
--   • CLIENTE   — contrato B2B entre Prime Sabor e o contratante final
--   • PROMOTORA — contrato de prestação de serviços autônoma (CC art. 593-609)
--
-- Bases legais:
--   • Código Civil arts. 593 a 609 (prestação de serviços)
--   • CLT art. 442-B (autônomo contínuo lícito, desde que sem subordinação)
--   • Lei 13.709/2018 (LGPD)
--   • MP 2.200-2/2001 (validade jurídica do documento eletrônico)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1) Configuração da empresa (singleton)
--    Dados da Prime Sabor / GustPro usados nos cabeçalhos dos contratos.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists empresa_config (
  id smallint primary key default 1,
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null,
  endereco_completo text,
  cidade text,
  estado text,
  cep text,
  telefone text,
  email text,
  representante_nome text,           -- quem assina pela empresa
  representante_cpf text,
  representante_cargo text,
  logo_url text,                     -- logo da nossa empresa (cabeçalho do PDF)
  foro_cidade text,                  -- ex.: 'Palmas'
  foro_estado text,                  -- ex.: 'TO'
  updated_at timestamptz default now(),
  constraint empresa_config_singleton check (id = 1)
);

-- ──────────────────────────────────────────────────────────────────────────
-- 2) Tabela principal de CONTRATOS
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,                              -- "CT-2026-0001"
  tipo text not null check (tipo in ('cliente','promotora')),
  servico_id uuid not null references servicos(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete restrict,
  promotora_id uuid references promotoras(id) on delete restrict,

  status text not null default 'rascunho'
    check (status in ('rascunho','enviado','aceito','recusado','expirado','cancelado')),

  -- Valores e prazo
  valor_total numeric(10,2),
  data_inicio_servico date,
  data_fim_servico date,
  qtd_dias integer,

  -- Snapshot do conteúdo no momento da geração (versão imutável do PDF)
  conteudo_json jsonb,
  template_versao text,

  -- Arquivos
  pdf_path text,                    -- caminho no bucket (privado)
  pdf_hash text,                    -- SHA-256 do PDF (integridade)

  -- Aceite eletrônico (MP 2.200-2/2001)
  token_aceite text unique,         -- token aleatório p/ URL pública
  expira_em timestamptz,            -- prazo p/ aceitar
  aceito_em timestamptz,
  aceito_ip inet,
  aceito_user_agent text,
  aceito_nome_digitado text,        -- pessoa digita o próprio nome ao aceitar
  recusado_em timestamptz,
  recusa_motivo text,

  -- Envio WhatsApp
  enviado_whatsapp_em timestamptz,
  enviado_whatsapp_numero text,

  -- Auditoria
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint contrato_partes_check check (
    (tipo = 'cliente'   and cliente_id   is not null and promotora_id is null) or
    (tipo = 'promotora' and promotora_id is not null and cliente_id   is null)
  )
);

create index if not exists idx_contratos_servico    on contratos(servico_id);
create index if not exists idx_contratos_cliente    on contratos(cliente_id);
create index if not exists idx_contratos_promotora  on contratos(promotora_id);
create index if not exists idx_contratos_status     on contratos(status);
create index if not exists idx_contratos_token      on contratos(token_aceite);

-- ──────────────────────────────────────────────────────────────────────────
-- 3) Documentos avulsos por CLIENTE
--    Espaço para anexar contrato social, CNPJ, procuração etc.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists documentos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null check (tipo in (
    'contrato_assinado','contrato_social','cartao_cnpj','procuracao',
    'comprovante_endereco','rg_socio','cpf_socio','outro'
  )),
  nome text not null,
  storage_path text not null,
  tamanho_bytes bigint,
  mime_type text,
  observacao text,
  uploaded_at timestamptz default now()
);

create index if not exists idx_doc_cliente on documentos_cliente(cliente_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 4) Documentos avulsos por PROMOTORA
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists documentos_promotora (
  id uuid primary key default gen_random_uuid(),
  promotora_id uuid not null references promotoras(id) on delete cascade,
  tipo text not null check (tipo in (
    'contrato_assinado','rg','cpf','comprovante_endereco','comprovante_bancario',
    'mei_certificado','foto_3x4','curriculo','laudo_medico','outro'
  )),
  nome text not null,
  storage_path text not null,
  tamanho_bytes bigint,
  mime_type text,
  validade date,                    -- documentos com validade (ex.: laudo)
  observacao text,
  uploaded_at timestamptz default now()
);

create index if not exists idx_doc_promotora on documentos_promotora(promotora_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 5) Trigger de updated_at
-- ──────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_contratos_updated on contratos;
create trigger trg_contratos_updated before update on contratos
  for each row execute function set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- 6) Linha-semente da empresa (EDITE os dados depois pela tela /config)
-- ──────────────────────────────────────────────────────────────────────────
insert into empresa_config (id, razao_social, cnpj, foro_cidade, foro_estado)
values (1, 'GUSTPRO PROMOTORAS LTDA', '00.000.000/0001-00', 'Palmas', 'TO')
on conflict (id) do nothing;

-- ============================================================================
-- STORAGE (rodar manualmente na UI do Supabase em Storage → New bucket)
-- ============================================================================
-- 1) Bucket  'contratos'   → PRIVADO, max 10 MB, MIME: application/pdf
-- 2) Bucket  'documentos'  → PRIVADO, max 20 MB, MIME: imagem ou pdf
--
-- URLs públicas serão geradas como Signed URL com validade de 7 dias.
-- ============================================================================
