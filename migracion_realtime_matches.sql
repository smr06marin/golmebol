-- Habilita Supabase Realtime en la tabla "matches" para que la página del
-- jugador (árbol de eliminatorias, partidos, goleadores) y la planilla
-- rápida compartida entre dos árbitros se actualicen solas por websocket,
-- sin que haya que recargar la página.
--
-- Es seguro correr esto aunque ya esté habilitado (el bloque IF revisa antes
-- de agregarlo) y no cambia ni borra ningún dato.
--
-- Se usa "public.matches" (con el esquema puesto a mano) porque en algunos
-- proyectos el editor SQL de Supabase no trae "public" listo para
-- encontrar solo por "matches" y tira el error 42P01 "relation matches
-- does not exist" — con el esquema explícito no depende de eso.

do $$
begin
  if to_regclass('public.matches') is null then
    raise exception 'No se encontró la tabla public.matches en esta base de datos';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
