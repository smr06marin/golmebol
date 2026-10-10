-- Rendimiento de la portada y de la página pública de torneos.
-- Ejecutar una vez en Supabase > SQL Editor (se puede re-ejecutar sin problema).

-- 1) Los 4 números de la portada (torneos, equipos, jugadores, goles) calculados
--    DENTRO de la base. Antes la portada descargaba todos los partidos terminados
--    de la plataforma solo para sumar los goles.
create or replace function public.stats_inicio()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'torneos',   (select count(*) from tournaments),
    'equipos',   (select count(*) from teams),
    'jugadores', (select count(*) from players_publico),
    'goles',     (select coalesce(sum(coalesce(home_score, 0) + coalesce(away_score, 0)), 0)
                  from matches where status = 'finished')
  );
$$;

grant execute on function public.stats_inicio() to anon, authenticated;

-- 2) Índices para las consultas más repetidas de las páginas públicas
--    (si ya existen, no pasa nada).
create index if not exists idx_matches_tournament_id        on matches (tournament_id);
create index if not exists idx_matches_status               on matches (status);
create index if not exists idx_tournament_teams_tournament  on tournament_teams (tournament_id);
create index if not exists idx_player_match_stats_tournament on player_match_stats (tournament_id);
create index if not exists idx_tournament_grupos_tournament on tournament_grupos (tournament_id);
-- Solo si la tabla existe (en algunas bases todavía no se creó tournament_sponsors)
do $$
begin
  if to_regclass('public.tournament_sponsors') is not null then
    create index if not exists idx_tournament_sponsors_tournament on public.tournament_sponsors (tournament_id);
  end if;
end $$;
