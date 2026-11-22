-- ════════════════════════════════════════════════════════════════════════════════════════════
-- MEDIA DEL JUGADOR (número tipo FIFA) con LO RECIENTE PESANDO MÁS
--
-- Qué hace: suma las estadísticas de cada jugador pero dándole MÁS peso a lo reciente. Un partido de hoy vale 1,
-- uno de hace 6 meses vale la mitad (0,5), uno de hace un año la cuarta parte (0,25), y así va bajando.
-- Lo mismo con los MVP, los arcos en cero y los títulos (campeón 3, subcampeón 2, tercer puesto 1): un título de
-- hace dos años pesa muy poco. Los títulos salen de lo que guardó el organizador al cerrar el torneo y, si el torneo
-- no tiene nada guardado, se deducen de la final y del partido por el tercer puesto (igual que en "Mis torneos"). Así un jugador que jugaba muy bien antes pero ahora no tanto va bajando su media,
-- y uno que viene jugando bien sube rápido.
--
-- La app la usa sola apenas exista. Si no la corres, la media igual sale pero contando todo igual (sin el tiempo).
-- Solo la pueden usar usuarios con sesión iniciada. No entrega datos privados (solo números y la posición).
--
-- Correr en Supabase → SQL Editor. Se puede volver a correr sin problema.
-- Para quitarla:  drop function if exists public.media_jugadores_stats();
-- ════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.media_jugadores_stats()
returns table (
  player_id   text,
  pos5        text,
  pos7        text,
  pos11       text,
  pj          integer,   -- partidos de verdad (sin peso): para saber si ya tiene 3 y para mostrar
  goles       integer,
  mvp         integer,
  ceros       integer,
  campeon     integer,
  subcampeon  integer,
  tercero     integer,
  w_pj        numeric,   -- lo mismo pero con el peso del tiempo
  w_goles     numeric,
  w_recibidos numeric,
  w_pg        numeric,
  w_ceros     numeric,
  w_mvp       numeric,
  w_titulos   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with partidos as (
    -- Cada partido del jugador con su peso: 0,5 elevado a (días de antigüedad / 180)
    select s.player_id, s.goals_scored, s.goals_conceded, s.team_result, s.fue_arquero,
           power(0.5, greatest(0, extract(epoch from (now() - coalesce(m.played_at, s.created_at))) / 86400.0) / 180.0) as w
    from public.player_match_stats s
    left join public.matches m on m.id = s.match_id
  ),
  stats as (
    select player_id,
           count(*)::int                                                         as pj,
           coalesce(sum(goals_scored), 0)::int                                   as goles,
           (count(*) filter (where fue_arquero and coalesce(goals_conceded, 0) = 0))::int as ceros,
           sum(w)                                                                as w_pj,
           sum(w * coalesce(goals_scored, 0))                                    as w_goles,
           sum(w * coalesce(goals_conceded, 0))                                  as w_recibidos,
           sum(w) filter (where team_result = 'win')                             as w_pg,
           sum(w) filter (where fue_arquero and coalesce(goals_conceded, 0) = 0) as w_ceros
    from partidos
    group by player_id
  ),
  mvps as (
    select l.player_id, count(*)::int as mvp,
           sum(power(0.5, greatest(0, extract(epoch from (now() - coalesce(m.played_at, l.created_at))) / 86400.0) / 180.0)) as w_mvp
    from public.tournament_logros l
    left join public.matches m on m.id = l.match_id
    where l.tipo = 'mvp'
    group by l.player_id
  ),
  titulos_guardados as (
    -- Lo que guardó el organizador al cerrar el torneo ("Guardar logros")
    select l.player_id, l.tournament_id,
           case when l.tipo in ('campeon', 'campeonato') then 3 when l.tipo in ('subcampeon', 'final') then 2 when l.tipo = 'tercer_puesto' then 1 else 0 end as valor
    from public.tournament_logros l
    where l.tipo in ('campeon', 'campeonato', 'subcampeon', 'final', 'tercer_puesto', 'semifinal', 'cuartos', 'octavos', 'fase_grupos')
  ),
  titulos_deducidos as (
    -- Torneos SIN logros guardados para ese jugador: se deduce de sus partidos de eliminación
    -- (perdió la final → subcampeón, la ganó → campeón, ganó el partido por el 3.º → tercero). Los cruces de ida y
    -- vuelta no se deducen (un partido de ida no define nada).
    select s.player_id, m.tournament_id,
           max(case
                 when m.fase = 'final' and coalesce(m.ronda, '') !~* 'tercer' and s.team_result = 'win'  then 3
                 when m.fase = 'final' and coalesce(m.ronda, '') !~* 'tercer' and s.team_result = 'loss' then 2
                 when coalesce(m.ronda, '') ~* 'tercer' and s.team_result = 'win' then 1
                 else 0 end) as valor
    from public.player_match_stats s
    join public.matches m on m.id = s.match_id
    where (m.fase = 'final' or coalesce(m.ronda, '') ~* 'tercer')
      and coalesce(m.ronda, '') !~* '\((ida|vuelta)\)'
      and m.tournament_id is not null
      and not exists (select 1 from titulos_guardados g where g.player_id = s.player_id and g.tournament_id = m.tournament_id)
    group by s.player_id, m.tournament_id
  ),
  titulos_torneo as (
    -- El mejor resultado de cada jugador en cada torneo
    select player_id, tournament_id, max(valor) as valor
    from (select * from titulos_guardados union all select * from titulos_deducidos) x
    where valor > 0
    group by player_id, tournament_id
  ),
  titulos as (
    select t.player_id,
           (count(*) filter (where t.valor = 3))::int as campeon,
           (count(*) filter (where t.valor = 2))::int as subcampeon,
           (count(*) filter (where t.valor = 1))::int as tercero,
           -- El título pesa desde el último partido de ese torneo (cuando se jugó la final)
           sum(t.valor * power(0.5, greatest(0, extract(epoch from (now() - coalesce(
             (select max(m.played_at) from public.matches m where m.tournament_id = t.tournament_id), now()))) / 86400.0) / 180.0)) as w_titulos
    from titulos_torneo t
    group by t.player_id
  )
  select p.id::text, p.posicion_futbol5::text, p.posicion_futbol7::text, p.posicion_futbol11::text,
         st.pj, st.goles, coalesce(mv.mvp, 0), st.ceros,
         coalesce(ti.campeon, 0), coalesce(ti.subcampeon, 0), coalesce(ti.tercero, 0),
         round(st.w_pj::numeric, 4), round(st.w_goles::numeric, 4), round(st.w_recibidos::numeric, 4),
         round(coalesce(st.w_pg, 0)::numeric, 4), round(coalesce(st.w_ceros, 0)::numeric, 4),
         round(coalesce(mv.w_mvp, 0)::numeric, 4), round(coalesce(ti.w_titulos, 0)::numeric, 4)
  from stats st
  join public.players p on p.id = st.player_id
  left join mvps mv on mv.player_id = st.player_id
  left join titulos ti on ti.player_id = st.player_id
$$;

revoke all on function public.media_jugadores_stats() from public, anon;
grant execute on function public.media_jugadores_stats() to authenticated;

-- Comprobación rápida (opcional): debe devolver un número de jugadores
-- select count(*) from public.media_jugadores_stats();
