-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Rankings globales de la tarjeta del jugador (Partidos, Goles, Promedio, Eficacia, PG/PE/PP)
--
-- Qué arregla: la app leía la tabla de estadísticas completa en una sola consulta y Supabase entrega
-- máximo 1000 filas, así que con muchos torneos el ranking salía incompleto y los puestos no eran los reales.
-- Esta función suma TODOS los partidos de TODOS los torneos de cada jugador directamente en la base
-- (rápido y exacto) y la app solo recibe una fila por jugador.
--
-- Es OPCIONAL: si no la corres, la app igual funciona (lee la tabla por páginas), solo que más lento.
-- Solo la pueden usar usuarios con sesión iniciada. Entrega nombre, foto y posición (lo mismo que ya muestra el ranking).
--
-- Correr UNA vez en Supabase → SQL Editor. Se puede volver a correr sin problema.
-- Para quitarla:  drop function if exists public.ranking_jugadores_stats();
-- ════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.ranking_jugadores_stats()
returns table (
  player_id text,
  nombre    text,
  foto      text,
  pos5      text,
  pos7      text,
  pos11     text,
  pj        integer,
  goles     integer,
  recibidos integer,
  goles_arq integer,
  pg        integer,
  pe        integer,
  pp        integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id::text,
    p.name::text,
    coalesce(p.photo_face_url, p.photo_url)::text,
    p.posicion_futbol5::text,
    p.posicion_futbol7::text,
    p.posicion_futbol11::text,
    count(*)::int,
    coalesce(sum(s.goals_scored), 0)::int,
    coalesce(sum(s.goals_conceded), 0)::int,
    coalesce(sum(case when s.fue_arquero then s.goals_scored else 0 end), 0)::int,
    (count(*) filter (where s.team_result = 'win'))::int,
    (count(*) filter (where s.team_result = 'draw'))::int,
    (count(*) filter (where s.team_result = 'loss'))::int
  from public.player_match_stats s
  join public.players p on p.id = s.player_id
  group by p.id, p.name, p.photo_face_url, p.photo_url, p.posicion_futbol5, p.posicion_futbol7, p.posicion_futbol11
$$;

revoke all on function public.ranking_jugadores_stats() from public, anon;
grant execute on function public.ranking_jugadores_stats() to authenticated;

-- Comprobación rápida (opcional): debe devolver un número de jugadores
-- select count(*) from public.ranking_jugadores_stats();
