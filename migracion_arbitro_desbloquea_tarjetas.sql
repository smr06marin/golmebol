-- =====================================================================
-- ÁRBITRO DESBLOQUEA TARJETAS DESDE LA PLANILLA PROFESIONAL
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Se puede correr más de una vez.
--
-- Qué hace: crea la función desbloquear_tarjetas_en_planilla(partido, jugador).
-- Cuando el jugador le paga la tarjeta al árbitro en la cancha, el árbitro toca
-- «Ya pagó — desbloquear» en la planilla y esta función:
--   1) revisa que quien la llama es un árbitro con SU PROPIO USUARIO (o el dueño del
--      torneo / organizador). Quien planilla por LINK, sin usuario, NO puede desbloquear,
--   2) revisa que el jugador es de uno de los dos equipos de ESE partido,
--   3) marca como pagadas sus tarjetas pendientes del torneo (así sale el bloqueo),
--   4) anota el pago en Finanzas del torneo (tipo "pago_tarjetas"), para que la cuenta
--      del equipo cuadre igual que cuando se paga por el link de deudores.
-- Es la misma regla de cobro del link de deudores: por cada partido con tarjetas sin
-- pagar se cobra solo la de mayor valor.
-- =====================================================================
create or replace function public.desbloquear_tarjetas_en_planilla(p_match_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tid      uuid;
  v_home     uuid;
  v_away     uuid;
  v_config   jsonb;
  v_nombre   text;
  v_team     uuid;
  v_vs       text;
  v_total    numeric := 0;
  v_tipos    text[] := '{}';
begin
  -- SOLO el árbitro que entró con su PROPIO usuario (asignado al partido, árbitro líder o árbitro de la plataforma),
  -- el dueño del torneo o el organizador de la plataforma. Quien planilla con un LINK (sin usuario) NO puede.
  if auth.uid() is null or not exists (
    select 1 from matches m
    where m.id = p_match_id
      and (
           coalesce(public.es_dueno_torneo(m.tournament_id), false)
        or coalesce(public.es_organizador_plataforma(), false)
        or exists (select 1 from players p
                   where p.user_id = auth.uid()
                     and (p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id) or p.es_arbitro_lider is true))
        or (m.status is distinct from 'finished'
            and exists (select 1 from players p
                        where p.user_id = auth.uid() and (p.es_arbitro is true or p.rol = 'arbitro')))
      )
  ) then
    raise exception 'No tienes permiso para desbloquear jugadores en este partido';
  end if;

  select m.tournament_id, m.home_team_id, m.away_team_id
    into v_tid, v_home, v_away
  from matches m where m.id = p_match_id;
  if v_tid is null then
    raise exception 'Partido no encontrado';
  end if;

  select coalesce(t.finanzas_config, '{}'::jsonb) into v_config from tournaments t where t.id = v_tid;

  -- El jugador tiene que ser de uno de los dos equipos de este partido
  select s.team_id into v_team
  from player_match_stats s
  where s.tournament_id = v_tid and s.player_id = p_player_id and s.team_id in (v_home, v_away)
  order by (s.yellow_cards > 0 or s.blue_cards > 0 or s.red_cards > 0) desc
  limit 1;
  if v_team is null then
    raise exception 'Ese jugador no es de uno de los equipos de este partido';
  end if;

  select name into v_nombre from players where id = p_player_id;
  select coalesce(h.name, '?') || ' vs ' || coalesce(a.name, '?') into v_vs
  from matches m left join teams h on h.id = m.home_team_id left join teams a on a.id = m.away_team_id
  where m.id = p_match_id;

  -- Monto: por cada partido con tarjetas sin pagar se cobra la más cara de ese partido
  select coalesce(sum(greatest(
           case when s.yellow_cards > 0 and not s.yellow_paid then coalesce((v_config->>'precio_amarilla')::numeric, 0) else 0 end,
           case when s.blue_cards   > 0 and not s.blue_paid   then coalesce((v_config->>'precio_azul')::numeric, 0)     else 0 end,
           case when s.red_cards    > 0 and not s.red_paid    then coalesce((v_config->>'precio_roja')::numeric, 0)     else 0 end
         )), 0)
    into v_total
  from player_match_stats s
  where s.tournament_id = v_tid and s.player_id = p_player_id;

  if exists (select 1 from player_match_stats where tournament_id = v_tid and player_id = p_player_id and yellow_cards > 0 and not yellow_paid) then
    update player_match_stats set yellow_paid = true where tournament_id = v_tid and player_id = p_player_id and yellow_cards > 0;
    v_tipos := array_append(v_tipos, 'Amarilla');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tid and player_id = p_player_id and blue_cards > 0 and not blue_paid) then
    update player_match_stats set blue_paid = true where tournament_id = v_tid and player_id = p_player_id and blue_cards > 0;
    v_tipos := array_append(v_tipos, 'Azul');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tid and player_id = p_player_id and red_cards > 0 and not red_paid) then
    update player_match_stats set red_paid = true where tournament_id = v_tid and player_id = p_player_id and red_cards > 0;
    v_tipos := array_append(v_tipos, 'Roja');
  end if;

  if array_length(v_tipos, 1) is null then
    raise exception 'Este jugador ya no tiene tarjetas pendientes';
  end if;

  insert into torneo_finanzas (tournament_id, team_id, player_id, tipo, monto, pagado, concepto, tarjetas_pagadas)
  values (v_tid, v_team, p_player_id, 'pago_tarjetas', v_total, true,
    'Tarjeta(s) de ' || coalesce(v_nombre, 'jugador') || ' — cobrada por el árbitro en la planilla (' || v_vs || ')',
    array_length(v_tipos, 1));

  return jsonb_build_object('ok', true, 'total', v_total, 'tipos', to_jsonb(v_tipos));
end;
$function$;

revoke all on function public.desbloquear_tarjetas_en_planilla(uuid, uuid) from public, anon;
grant execute on function public.desbloquear_tarjetas_en_planilla(uuid, uuid) to authenticated;

-- Para deshacerlo:  drop function if exists public.desbloquear_tarjetas_en_planilla(uuid, uuid);
