-- Arreglo: pagar una tarjeta desde el link de deudores ahora anota el monto COMPLETO.
-- Antes, si un jugador debía tarjetas de varios partidos, se marcaban todas como pagadas
-- pero solo se anotaba UN precio por color en Finanzas, y la cuenta del equipo quedaba
-- debiendo la diferencia (sin ningún jugador que explicara esa deuda).
-- Pegar completo en Supabase → SQL Editor → RUN. Se puede correr más de una vez.

create or replace function public.pagar_tarjeta_por_link(p_token uuid, p_player_id uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_config jsonb;
  v_password_real text;
  v_team_id uuid;
  v_player_nombre text;
  v_total numeric := 0;
  v_tipos text[] := '{}';
  v_detalle text := '';
  v_item record;
begin
  select id, coalesce(finanzas_config, '{}'::jsonb), link_deudores_password
    into v_tournament_id, v_config, v_password_real
  from tournaments where link_deudores_token = p_token;

  if v_tournament_id is null then
    raise exception 'Link inválido';
  end if;
  if v_password_real is not null and v_password_real <> '' and v_password_real <> p_password then
    raise exception 'Contraseña incorrecta';
  end if;

  select name into v_player_nombre from players where id = p_player_id;

  -- Monto REAL a pagar: por cada partido con tarjetas sin pagar se cobra la más cara de ese partido
  -- (igual que el panel de Finanzas). Antes se anotaba un solo precio por color aunque el jugador
  -- tuviera tarjetas sin pagar en varios partidos, y la cuenta del equipo quedaba debiendo la diferencia.
  select coalesce(sum(greatest(
           case when s.yellow_cards > 0 and not s.yellow_paid then coalesce((v_config->>'precio_amarilla')::numeric, 0) else 0 end,
           case when s.blue_cards   > 0 and not s.blue_paid   then coalesce((v_config->>'precio_azul')::numeric, 0)     else 0 end,
           case when s.red_cards    > 0 and not s.red_paid    then coalesce((v_config->>'precio_roja')::numeric, 0)     else 0 end
         )), 0)
    into v_total
  from player_match_stats s
  where s.tournament_id = v_tournament_id and s.player_id = p_player_id;

  for v_item in
    select 'Amarilla' as tipo, m.played_at, m.location as cancha, ht.name as home_nombre, at.name as away_nombre
      from player_match_stats s
      left join matches m on m.id = s.match_id
      left join teams ht on ht.id = m.home_team_id
      left join teams at on at.id = m.away_team_id
      where s.tournament_id = v_tournament_id and s.player_id = p_player_id and s.yellow_cards > 0 and not s.yellow_paid
    union all
    select 'Azul', m.played_at, m.location, ht.name, at.name
      from player_match_stats s
      left join matches m on m.id = s.match_id
      left join teams ht on ht.id = m.home_team_id
      left join teams at on at.id = m.away_team_id
      where s.tournament_id = v_tournament_id and s.player_id = p_player_id and s.blue_cards > 0 and not s.blue_paid
    union all
    select 'Roja', m.played_at, m.location, ht.name, at.name
      from player_match_stats s
      left join matches m on m.id = s.match_id
      left join teams ht on ht.id = m.home_team_id
      left join teams at on at.id = m.away_team_id
      where s.tournament_id = v_tournament_id and s.player_id = p_player_id and s.red_cards > 0 and not s.red_paid
    order by played_at
  loop
    v_detalle := v_detalle || case when v_detalle = '' then '' else ' | ' end
      || v_item.tipo
      || coalesce(' · ' || v_item.home_nombre || ' vs ' || v_item.away_nombre, '')
      || coalesce(' · cancha ' || v_item.cancha, '')
      || coalesce(' · ' || to_char(v_item.played_at, 'DD/MM/YYYY'), '');
  end loop;

  if exists (select 1 from player_match_stats where tournament_id = v_tournament_id and player_id = p_player_id and yellow_cards > 0 and not yellow_paid) then
    update player_match_stats set yellow_paid = true where tournament_id = v_tournament_id and player_id = p_player_id and yellow_cards > 0;
    v_tipos := array_append(v_tipos, 'Amarilla');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tournament_id and player_id = p_player_id and blue_cards > 0 and not blue_paid) then
    update player_match_stats set blue_paid = true where tournament_id = v_tournament_id and player_id = p_player_id and blue_cards > 0;
    v_tipos := array_append(v_tipos, 'Azul');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tournament_id and player_id = p_player_id and red_cards > 0 and not red_paid) then
    update player_match_stats set red_paid = true where tournament_id = v_tournament_id and player_id = p_player_id and red_cards > 0;
    v_tipos := array_append(v_tipos, 'Roja');
  end if;

  if array_length(v_tipos, 1) is null then
    raise exception 'Este jugador ya no tiene tarjetas pendientes';
  end if;

  select s.team_id into v_team_id
  from player_match_stats s
  left join matches m on m.id = s.match_id
  where s.tournament_id = v_tournament_id and s.player_id = p_player_id
  order by (s.yellow_cards > 0 or s.blue_cards > 0 or s.red_cards > 0) desc, m.played_at desc nulls last
  limit 1;

  insert into torneo_finanzas (tournament_id, team_id, player_id, tipo, monto, pagado, concepto, tarjetas_pagadas)
  values (v_tournament_id, v_team_id, p_player_id, 'pago_tarjetas', v_total, true,
    'Tarjeta(s) de ' || coalesce(v_player_nombre, 'jugador') || ' — ' || v_detalle || ' — pagada por el link de deudores de tarjetas',
    array_length(v_tipos, 1));

  return jsonb_build_object('ok', true, 'total', v_total, 'tipos', to_jsonb(v_tipos));
end;
$$;

grant execute on function public.pagar_tarjeta_por_link(uuid, uuid, text) to anon, authenticated;
