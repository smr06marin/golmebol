-- =====================================================================
-- RED DE SEGURIDAD: reparar solo las estadísticas que falten en partidos ya cerrados
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Se puede correr más de una vez.
--
-- Qué hace: si un partido quedó cerrado con goles/tarjetas de jugadores REGISTRADOS en los eventos pero sin su fila
-- de estadísticas (por ejemplo porque el guardado se cortó a la mitad), la función los agrega a partir de los eventos.
--   · Solo AGREGA filas que no existen (nunca pisa ni borra una fila existente).
--   · El número de camiseta lo toma de otros partidos del mismo jugador, y solo si en ESE partido no lo usa ya otro
--     jugador del mismo equipo (así no crea números repetidos).
--   · Goles recibidos del arquero: se le asignan al último arquero anotado en el partido (si lo hay).
--   · Un cron la corre cada 15 minutos, así no hay que acordarse de nada.
-- =====================================================================

create or replace function public.reparar_stats_faltantes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer := 0;
begin
  with objetivo as (
    select distinct e.match_id
    from match_events e
    where e.event_type = 'goal' and e.player_id is not null
      and not exists (select 1 from player_match_stats s where s.match_id = e.match_id and s.player_id = e.player_id)
  ),
  m as (
    select mt.id, mt.tournament_id, mt.home_team_id, mt.home_score, mt.away_score
    from matches mt join objetivo o on o.match_id = mt.id
    where mt.status = 'finished' and coalesce(mt.tipo_resultado, '') not in ('w', 'desierto')
  ),
  ev0 as (
    select e.match_id, e.player_id, e.team_id,
      count(*) filter (where e.event_type = 'goal') as goles,
      (count(*) filter (where e.event_type = 'yellow_card') > 0)::int as amarillas,
      (count(*) filter (where e.event_type = 'blue_card') > 0)::int as azules,
      (count(*) filter (where e.event_type = 'red_card') > 0)::int as rojas,
      count(*) filter (where e.event_type = 'falta_acum') as faltas
    from match_events e join m on m.id = e.match_id
    where e.player_id is not null
    group by e.match_id, e.player_id, e.team_id
  ),
  -- Los arqueros anotados (aunque no tengan goles ni tarjetas) también necesitan su fila, para los goles recibidos
  ev as (
    select * from ev0
    union all
    select distinct pa.match_id, pa.player_id, pa.team_id, 0::bigint, 0, 0, 0, 0::bigint
    from partido_arqueros pa join m on m.id = pa.match_id
    where pa.player_id is not null
      and not exists (select 1 from ev0 x where x.match_id = pa.match_id and x.player_id = pa.player_id)
  ),
  arq as (
    select distinct on (pa.match_id, pa.team_id) pa.match_id, pa.team_id, pa.player_id
    from partido_arqueros pa join m on m.id = pa.match_id
    where pa.player_id is not null
    order by pa.match_id, pa.team_id, pa.orden desc
  ),
  ins as (
    insert into player_match_stats
      (match_id, tournament_id, player_id, team_id, numero_camiseta, goals_scored, goals_conceded, fue_arquero,
       own_goals, yellow_cards, blue_cards, red_cards, fouls, team_result)
    select m.id, m.tournament_id, ev.player_id, ev.team_id,
      (select s.numero_camiseta from player_match_stats s
         where s.player_id = ev.player_id and s.team_id = ev.team_id and s.numero_camiseta is not null
           and not exists (select 1 from player_match_stats x
                           where x.match_id = m.id and x.team_id = ev.team_id and x.numero_camiseta = s.numero_camiseta)
         limit 1),
      ev.goles,
      case when arq.player_id = ev.player_id then (case when ev.team_id = m.home_team_id then m.away_score else m.home_score end) else 0 end,
      coalesce(arq.player_id = ev.player_id, false),
      0, ev.amarillas, ev.azules, ev.rojas, ev.faltas,
      case
        when m.home_score = m.away_score then 'draw'
        when (ev.team_id = m.home_team_id) = (m.home_score > m.away_score) then 'win'
        else 'loss'
      end
    from m
    join ev on ev.match_id = m.id
    left join arq on arq.match_id = m.id and arq.team_id = ev.team_id
    where not exists (select 1 from player_match_stats s where s.match_id = m.id and s.player_id = ev.player_id)
    on conflict (match_id, player_id) do nothing
    returning 1
  )
  select count(*) into v_filas from ins;
  return v_filas;
end $$;

revoke all on function public.reparar_stats_faltantes() from public, anon, authenticated;

-- Cron cada 15 minutos (pg_cron ya se usa en el proyecto para los avisos push).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('golmebol-reparar-stats', '*/15 * * * *', 'select public.reparar_stats_faltantes()');
  else
    raise notice 'pg_cron no está activado: la función existe pero no se programó. Corre select public.reparar_stats_faltantes(); a mano cuando quieras.';
  end if;
end $$;

-- Prueba manual (devuelve cuántas filas agregó; 0 = no faltaba nada):
select public.reparar_stats_faltantes() as filas_agregadas;

-- ROLLBACK:
--   select cron.unschedule('golmebol-reparar-stats');
--   drop function if exists public.reparar_stats_faltantes();
