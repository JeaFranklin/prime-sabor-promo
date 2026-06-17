-- 007_viana_cron.sql
-- Agendamentos das Edge Functions do Bot Viana via pg_cron
-- Substitui os crons da VPS (PuTTY não é mais necessário)
--
-- ATENÇÃO: Aplicar APÓS fazer o deploy das Edge Functions e configurar os secrets.
-- Ver: docs/setup-microsoft-graph.md

-- Ativa extensão pg_net (necessária para chamadas HTTP do pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamentos antigos se existirem (para reaplicar limpo)
SELECT cron.unschedule('viana-upload-agenda') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'viana-upload-agenda'
);
SELECT cron.unschedule('viana-envio-manha') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'viana-envio-manha'
);
SELECT cron.unschedule('viana-envio-tarde') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'viana-envio-tarde'
);

-- ─────────────────────────────────────────────────────────────
-- Upload da agenda (toda hora)
-- 0 * * * * UTC = toda hora (mesmo horário)
-- ─────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'viana-upload-agenda',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://knbcnplmuiuigfwogdfb.supabase.co/functions/v1/viana-upload-agenda',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- Mensagem da manhã para Kênia (9h BRT = 12h UTC)
-- ─────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'viana-envio-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://knbcnplmuiuigfwogdfb.supabase.co/functions/v1/viana-envio-manha',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- Mensagem da tarde para Kênia — agenda do dia seguinte (14h BRT = 17h UTC)
-- ─────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'viana-envio-tarde',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://knbcnplmuiuigfwogdfb.supabase.co/functions/v1/viana-envio-tarde',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verificar agendamentos criados
SELECT jobname, schedule, active FROM cron.job
WHERE jobname LIKE 'viana-%';
