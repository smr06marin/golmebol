-- Habilita Supabase Realtime en la tabla "player_match_stats" para que la
-- planilla (PlanillaPartido.jsx) se entere EN VIVO cuando alguien registra el
-- pago de una tarjeta desde otro lado (ej. el admin marca "pagada" una
-- amarilla/azul/roja) — así el jugador que debía queda liberado de una en la
-- planilla abierta, sin que el árbitro tenga que recargar la página, y ya
-- puede registrarle el número de camiseta.
--
-- Es seguro correr esto aunque ya esté habilitado (el bloque IF revisa antes
-- de agregarlo) y no cambia ni borra ningún dato.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'player_match_stats'
  ) then
    alter publication supabase_realtime add table player_match_stats;
  end if;
end $$;
