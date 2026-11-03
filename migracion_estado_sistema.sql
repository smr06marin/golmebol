-- ESTADO DEL SISTEMA (semáforo del administrador principal en el panel).
-- Devuelve solo números agregados (conexiones, consultas lentas...), nada de datos de personas.
-- (Las conexiones fijas de Supabase, como la réplica de tiempo real y el SQL Editor, no cuentan como consultas lentas.)
-- Correr UNA vez en Supabase → SQL Editor. Si no se corre, el semáforo igual funciona midiendo la velocidad de respuesta.

create or replace function public.estado_sistema()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'conexiones',       (select count(*) from pg_stat_activity where datname = current_database()),
    'max_conexiones',   (select setting::int from pg_settings where name = 'max_connections'),
    'consultas_lentas', (select count(*) from pg_stat_activity where state = 'active' and pid <> pg_backend_pid() and now() - query_start > interval '20 seconds' and coalesce(application_name, '') not like 'realtime_replication%' and coalesce(application_name, '') not like 'supabase/dashboard%'),
    'bloqueadas',       (select count(*) from pg_stat_activity where wait_event_type = 'Lock'),
    'tamano_mb',        (select round(pg_database_size(current_database()) / 1048576.0))
  );
$$;

revoke all on function public.estado_sistema() from public, anon;
grant execute on function public.estado_sistema() to authenticated;
