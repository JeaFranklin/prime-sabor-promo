-- 008_viana_fila_alteracoes.sql
-- Fila de alterações do Bot Viana — changes confirmadas aguardam VPS aplicar no Excel

CREATE TABLE IF NOT EXISTS viana_fila_alteracoes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_whatsapp text        NOT NULL,
  nome_remetente  text,
  campo           text        NOT NULL
                  CHECK (campo IN ('status', 'prazo', 'fluxo', 'comprador', 'pedido')),
  codigo_fornec   text        NOT NULL,
  valor_novo      text        NOT NULL,
  data_agenda     date,
  status_fila     text        NOT NULL DEFAULT 'aguardando_confirmacao'
                  CHECK (status_fila IN (
                    'aguardando_confirmacao',
                    'confirmado',
                    'cancelado',
                    'aplicado',
                    'erro_aplicacao'
                  )),
  erro_msg        text,
  expira_em       timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  aplicado_em     timestamptz
);

-- webhook consulta "tem pendência deste número?"
CREATE INDEX IF NOT EXISTS idx_viana_fila_numero_status
  ON viana_fila_alteracoes (numero_whatsapp, status_fila);

-- VPS consulta "o que foi confirmado e ainda não aplicado?"
CREATE INDEX IF NOT EXISTS idx_viana_fila_status_expira
  ON viana_fila_alteracoes (status_fila, expira_em);

ALTER TABLE viana_fila_alteracoes ENABLE ROW LEVEL SECURITY;
