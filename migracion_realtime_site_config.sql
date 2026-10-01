-- Habilita Supabase Realtime en la tabla "site_config" — sin esto, el panel
-- de control en vivo (/admin/config-sitio: botones de Repetición, Cámara
-- lenta, Tabla de posiciones, Goles) guarda bien el cambio en la base de
-- datos, pero la página de inicio pública (golmebol.com) nunca se entera:
-- esa página solo trae site_config UNA VEZ al cargar, y depende de
-- Realtime para enterarse de cambios después sin que alguien recargue.
-- Mismo patrón que migracion_realtime_matches.sql (ahí para el marcador en
-- vivo) — es seguro correr esto aunque ya esté habilitado.
do $$
begin
  if to_regclass('public.site_config') is null then
    raise exception 'No se encontró la tabla public.site_config en esta base de datos';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_config'
  ) then
    alter publication supabase_realtime add table public.site_config;
  end if;
end $$;
