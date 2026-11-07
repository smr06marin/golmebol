-- ============================================================
-- DIAGNÓSTICO DE AVISOS (solo LEE, no cambia nada)
-- Cómo usarlo: Supabase → SQL Editor → pegar → RUN. Corre cada bloque por separado
-- (selecciona el bloque y RUN) y mírale los resultados.
-- ============================================================

-- 1) ¿Hay celulares registrados? (debe salir al menos 1 fila activa con tu plataforma: web / android / ios)
select plataforma, activo, count(*) as celulares,
       max(actualizado_en) as ultimo_registro,
       sum(coalesce(array_length(equipos,1),0)) as equipos_seguidos,
       sum(coalesce(array_length(torneos,1),0)) as torneos_activados
from public.push_dispositivos
group by plataforma, activo
order by plataforma, activo;

-- 2) ¿Los avisos están llegando a la cola? (últimos 15). Si "enviado_en" está vacío, el envío no está corriendo.
select id, tipo, titulo, left(cuerpo, 60) as cuerpo, creado_en, enviado_en
from public.push_cola
order by id desc
limit 15;

-- 3) ¿Está programado el envío automático cada 5 minutos?  (debe salir 1 fila: golmebol-push, active = true)
select jobid, jobname, schedule, active from cron.job where jobname = 'golmebol-push';

-- 4) ¿El envío automático corrió bien? (últimas 10 veces; "succeeded" y sin error)
select j.start_time, j.status, left(j.return_message, 120) as mensaje
from cron.job_run_details j
join cron.job c on c.jobid = j.jobid
where c.jobname = 'golmebol-push'
order by j.start_time desc
limit 10;

-- 5) ¿Qué respondió la página al cron? (pg_net guarda las respuestas unos días: 200 = bien, 401 = secreto distinto,
--    500 = falta una variable en Vercel, 502 = Firebase/claves no aceptaron nada)
select created, status_code, left(content::text, 200) as respuesta
from net._http_response
order by created desc
limit 10;
