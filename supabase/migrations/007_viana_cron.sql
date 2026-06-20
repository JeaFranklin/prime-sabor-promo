-- 007_viana_cron.sql
-- Agendamentos das Edge Functions do Bot Viana via pg_cron
-- Substitui os crons da VPS (PuTTY nao e mais necessario)
--
-- INSTRUCAO: Substitua SEU_ANON_KEY_AQUI pela sua anon key
-- (Supabase Dashboard > Project Settings > API > anon public)

-- ─────────────────────────────────────────────────────────────
-- Mensagem da manha para Kenia (9h BRT = 12h UTC)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'viana-envio-manha') THEN
    PERFORM cron.unschedule('viana-envio-manha');
  END IF;
END $$;

SELECT cron.schedule(
  'viana-envio-manha',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://knbcnplmuiuigfwogdfb.supabase.co/functions/v1/viana-envio-manha',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU_ANON_KEY_AQUI"}'::jsonb,
    body    := '{}'::jsonb
  );
  $cron$
);

-- ─────────────────────────────────────────────────────────────
-- Mensagem da tarde para Kenia - agenda do dia seguinte (14h BRT = 17h UTC)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'viana-envio-tarde') THEN
    PERFORM cron.unschedule('viana-envio-tarde');
  END IF;
END $$;

SELECT cron.schedule(
  'viana-envio-tarde',
  '0 17 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://knbcnplmuiuigfwogdfb.supabase.co/functions/v1/viana-envio-tarde',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU_ANON_KEY_AQUI"}'::jsonb,
    body    := '{}'::jsonb
  );
  $cron$
);

-- Verificar agendamentos criados
SELECT jobname, schedule, active FROM cron.job
WHERE jobname LIKE 'viana-%';
