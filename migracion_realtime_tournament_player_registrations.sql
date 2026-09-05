-- Habilita Supabase Realtime en "tournament_player_registrations" para que
-- la Planilla Rápida (PlanillaRapida.jsx) se entere EN VIVO cuando alguien
-- (admin u organizador) registra o agrega un jugador nuevo a uno de los dos
-- equipos MIENTRAS el partido se está planillando — el jugador nuevo
-- aparece solo en la lista de la planilla abierta (o en el link del
-- árbitro), sin que nadie tenga que recargar la página ni salir y volver a
-- entrar.
--
-- Es seguro correr esto aunque ya esté habilitado (el bloque IF revisa antes
-- de agregarlo) y no cambia ni borra ningún dato.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tournament_player_registrations'
  ) then
    alter publication supabase_realtime add table tournament_player_registrations;
  end if;
end $$;
