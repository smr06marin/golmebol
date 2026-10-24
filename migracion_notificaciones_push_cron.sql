-- ============================================================
-- NOTIFICACIONES PUSH — paso 2: que el envío corra solo cada 5 minutos
-- Cómo ejecutar: Supabase → SQL Editor → pegar → CAMBIAR el texto
-- CAMBIA_ESTE_SECRETO por el mismo valor que pusiste en Vercel como
-- PUSH_CRON_SECRET → RUN.
--
-- Antes, en Supabase → Database → Extensions, activar "pg_cron" y "pg_net".
-- Cada 5 minutos Supabase llama a https://golmebol.com/api/push-enviar, que
-- manda los avisos pendientes (solo entre las 10:00 am y las 10:00 pm de Colombia;
-- fuera de ese horario los avisos esperan hasta las 10:00 am).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('golmebol-push');
exception when others then null;
end $$;

select cron.schedule(
  'golmebol-push',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://golmebol.com/api/push-enviar',
      headers := jsonb_build_object('Authorization', 'Bearer CAMBIA_ESTE_SECRETO', 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);

-- Para ver si está corriendo:   select * from cron.job_run_details order by start_time desc limit 5;
-- Para apagarlo:                select cron.unschedule('golmebol-push');
