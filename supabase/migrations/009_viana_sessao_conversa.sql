-- 009_viana_sessao_conversa.sql
-- Estado de conversa por número — guarda se usuário está aguardando confirmação (SIM/NÃO)
-- Necessário porque Vercel é serverless: memória não persiste entre requisições

CREATE TABLE IF NOT EXISTS viana_sessao_conversa (
  numero_whatsapp text        PRIMARY KEY,
  ultimo_intent   text,
  aguardando      text        CHECK (aguardando IN ('confirmacao', null)),
  fila_id         uuid        REFERENCES viana_fila_alteracoes(id) ON DELETE SET NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE viana_sessao_conversa ENABLE ROW LEVEL SECURITY;
