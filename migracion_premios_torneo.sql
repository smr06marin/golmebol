-- ============================================================
-- PREMIOS DE CADA TORNEO: GOLEADOR y VALLA MENOS VENCIDA
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez (no duplica nada).
--
-- Qué hace:
--  1. Crea la función calcular_premios_torneo(torneo): mira quién fue el
--     máximo goleador del torneo y qué arquero tuvo la valla menos vencida,
--     y lo deja guardado en la hoja de vida de ese jugador (tournament_logros,
--     tipos 'goleador' y 'valla_menos_vencida'), igual que campeón o MVP.
--  2. La corre ahora para todos los torneos que YA se cerraron (los que
--     tienen campeón guardado), para que los premios viejos también queden.
--
-- Reglas:
--  · Goleador: el que más goles hizo en el torneo (según goleadores_por_torneo,
--    la misma tabla que ve la gente). Si hay empate en el primer puesto,
--    comparten el premio. Con 0 goles no se da.
--  · Valla menos vencida: entre los arqueros que atajaron en el torneo, el de
--    MENOR promedio de goles recibidos por partido. Desempata: más arcos en
--    cero, luego más partidos. Si algún arquero atajó 2 o más partidos, los
--    que atajaron solo 1 no compiten (para que no gane uno con un partido suelto).
--  · A partir de ahora la app la llama sola al "Guardar logros" de un torneo.
-- ============================================================

-- Seguridad previa: si la tabla limita los tipos permitidos y no incluye los
-- nuevos, esto avisa ANTES de tocar nada.
do $$
declare v_def text;
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'public.tournament_logros'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%tipo%'
  limit 1;
  if v_def is not null and (v_def not ilike '%goleador%' or v_def not ilike '%valla_menos_vencida%') then
    raise exception 'tournament_logros limita los tipos permitidos: %  — avísale a Claude para ampliarlos antes de seguir', v_def;
  end if;
end $$;

create or replace function public.calcular_premios_torneo(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goleadores int := 0;
  v_valla      int := 0;
begin
  -- Solo el dueño del torneo, un organizador o un admin (desde el SQL Editor no hay sesión: se permite)
  if auth.uid() is not null
     and not (public.es_dueno_torneo(p_tournament_id) or public.es_organizador_plataforma()) then
    raise exception 'No tienes permiso para guardar los premios de este torneo';
  end if;

  -- Se recalculan siempre desde cero (si se corrigió un gol, se arregla solo)
  delete from public.tournament_logros
  where tournament_id = p_tournament_id
    and tipo in ('goleador', 'valla_menos_vencida');

  -- ── Goleador(es) ──
  with g as (
    select player_id, total_goals
    from public.goleadores_por_torneo
    where tournament_id = p_tournament_id and total_goals > 0
  ),
  maximo as (select max(total_goals) as m from g),
  equipo as (
    -- el equipo con el que más partidos jugó en este torneo
    select distinct on (x.player_id) x.player_id, x.team_id
    from (
      select s.player_id, s.team_id, count(*) as c
      from public.player_match_stats s
      where s.tournament_id = p_tournament_id and s.team_id is not null
      group by s.player_id, s.team_id
    ) x
    order by x.player_id, x.c desc
  )
  insert into public.tournament_logros (tournament_id, team_id, player_id, tipo)
  select p_tournament_id, e.team_id, g.player_id, 'goleador'
  from g
  join maximo on g.total_goals = maximo.m
  left join equipo e on e.player_id = g.player_id
  where g.player_id is not null;
  get diagnostics v_goleadores = row_count;

  -- ── Valla menos vencida (arquero) ──
  with arq as (
    select
      s.player_id, s.team_id,
      count(*) as pj,
      sum(case when s.team_id = m.home_team_id then coalesce(m.away_score, 0) else coalesce(m.home_score, 0) end) as recibidos,
      sum(case when (case when s.team_id = m.home_team_id then m.away_score else m.home_score end) = 0 then 1 else 0 end) as ceros
    from public.player_match_stats s
    join public.matches m on m.id = s.match_id
    where s.tournament_id = p_tournament_id
      and s.fue_arquero is true
      and s.player_id is not null
      and m.status = 'finished'
      and m.home_score is not null and m.away_score is not null
    group by s.player_id, s.team_id
  ),
  minimo as (
    select case when coalesce(max(pj), 0) >= 2 then 2 else 1 end as pj_min from arq
  ),
  ganador as (
    select a.*
    from arq a, minimo
    where a.pj >= minimo.pj_min
    order by (a.recibidos::numeric / a.pj) asc, a.ceros desc, a.pj desc
    limit 1
  )
  insert into public.tournament_logros (tournament_id, team_id, player_id, tipo)
  select p_tournament_id, ganador.team_id, ganador.player_id, 'valla_menos_vencida'
  from ganador;
  get diagnostics v_valla = row_count;

  return jsonb_build_object('goleadores', v_goleadores, 'valla', v_valla);
end
$$;

revoke all on function public.calcular_premios_torneo(uuid) from public, anon;
grant execute on function public.calcular_premios_torneo(uuid) to authenticated;

-- ── Relleno de los torneos que ya se cerraron ──
do $$
declare t record;
begin
  for t in
    select distinct tournament_id
    from public.tournament_logros
    where tipo = 'campeon' and tournament_id is not null
  loop
    perform public.calcular_premios_torneo(t.tournament_id);
  end loop;
end $$;

-- Comprobación (opcional): cuántos premios quedaron guardados
-- select tipo, count(*) from public.tournament_logros where tipo in ('goleador','valla_menos_vencida') group by tipo;
