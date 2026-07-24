-- Habilita Supabase Realtime en la tabla "matches" para que la página del
-- jugador (árbol de eliminatorias, partidos, goleadores) se actualice sola
-- por websocket apenas se guarda un resultado, sin que el jugador tenga que
-- recargar la página.
--
-- Es seguro correr esto aunque ya esté habilitado (el bloque IF revisa antes
-- de agregarlo) y no cambia ni borra ningún dato.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table matches;
  end if;
end $$;
