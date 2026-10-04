-- Habilita Supabase Realtime en las 3 tablas que usa la PLANILLA RÁPIDA para
-- sincronizar dos celulares en vivo:
--   · matches                          → lo que carga el otro celular (reloj, números, goles, tarjetas)
--   · tournament_player_registrations  → jugadores nuevos registrados/inscritos mientras la planilla está abierta
--   · player_match_stats               → tarjetas pagadas (se desbloquea el jugador en la planilla al instante)
--
-- Es seguro correrlo las veces que sea (revisa antes de agregar cada tabla)
-- y no cambia ni borra ningún dato. Pegar completo en el SQL Editor de
-- Supabase y darle "Run".

do $$
declare
  t text;
begin
  foreach t in array array['matches', 'tournament_player_registrations', 'player_match_stats']
  loop
    if to_regclass('public.' || t) is null then
      raise exception 'No se encontró la tabla public.%', t;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Para confirmar que quedaron las 3 (deben salir 3 filas):
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
  and tablename in ('matches', 'tournament_player_registrations', 'player_match_stats')
order by tablename;
