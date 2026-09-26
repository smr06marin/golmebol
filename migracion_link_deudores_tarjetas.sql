-- ============================================================
-- MIGRACIÓN: Link público por torneo para ver deudores de
-- tarjetas (con filtro por equipo) y registrar sus pagos desde
-- ahí mismo, sin tener que entrar al panel de admin.
-- Cómo ejecutar: Supabase → SQL Editor → RUN.
-- Es idempotente (add column if not exists / create or replace).
--
-- FLUJO:
--   1) El organizador, desde Finanzas del torneo (admin), genera
--      el link con "Link deudores de tarjetas". A diferencia del
--      link de planilla (24h, para UN partido puntual), este NO
--      vence — es un link fijo de todo el torneo que el
--      organizador reutiliza mientras dure.
--   2) Quien abre el link (público, sin login) ve la lista de
--      jugadores que deben tarjeta en el torneo, con filtro por
--      equipo, y puede tocar "Ya pagó" para marcarla pagada —
--      eso es justo lo que ya usa la planilla (yellow_paid /
--      blue_paid / red_paid) para dejar de bloquear al jugador.
--   3) Cada pago registrado por el link queda anotado en
--      Finanzas del torneo con el detalle de partido/cancha/fecha
--      de cada tarjeta pagada, para que el organizador pueda
--      verificarlo — y se ve en la misma página, en "Historial de
--      pagos".
--   4) El link es SIEMPRE el mismo (se genera una sola vez) y cada
--      vez que se abre (o se toca "Actualizar") vuelve a calcular
--      los deudores al momento — apenas termina un partido y se
--      guardan sus tarjetas, la próxima vez que se abra (o el
--      auto-refresco cada 30s) ya sale reflejado, sin tener que
--      generar un link nuevo.
--
-- OJO: el árbitro YA NO tiene esta opción desde la planilla (ver
-- PlanillaRapida.jsx) — el cobro/desbloqueo de tarjetas ahora
-- pasa solo por acá o por el panel de Finanzas del admin.
-- ============================================================

alter table tournaments add column if not exists link_deudores_token uuid;

create unique index if not exists tournaments_link_deudores_token_idx
  on tournaments(link_deudores_token) where link_deudores_token is not null;

-- Genera (o reutiliza, si ya existe) el link fijo de deudores de tarjetas
-- de un torneo. Solo el organizador dueño del torneo o un admin principal
-- pueden generarlo — mismo chequeo inline que generar_link_planilla() en
-- migracion_link_planilla_arbitro.sql.
create or replace function public.generar_link_deudores(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizador_id uuid;
  v_token uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not exists (select 1 from tournaments where id = p_tournament_id) then
    raise exception 'Torneo no encontrado';
  end if;

  select organizador_id, link_deudores_token into v_organizador_id, v_token
  from tournaments where id = p_tournament_id;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  if v_token is not null then
    return jsonb_build_object('token', v_token);
  end if;

  v_token := gen_random_uuid();
  update tournaments set link_deudores_token = v_token where id = p_tournament_id;

  return jsonb_build_object('token', v_token);
end;
$$;

revoke all on function public.generar_link_deudores(uuid) from public;
grant execute on function public.generar_link_deudores(uuid) to authenticated;

-- Vista pública (sin login) de los deudores de tarjetas de un torneo — arma
-- el mismo cálculo que ya usa la app en src/lib/tarjetasDeuda.js
-- (construirDeudaTarjetas): si un jugador tiene varias tarjetas sin pagar en
-- el MISMO partido, solo se cobra la de mayor valor de ese partido.
create or replace function public.ver_deudores_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_config jsonb;
  v_amarilla numeric;
  v_azul numeric;
  v_roja numeric;
  v_result jsonb;
begin
  select id, coalesce(finanzas_config, '{}'::jsonb)
    into v_tournament_id, v_config
  from tournaments
  where link_deudores_token = p_token;

  if v_tournament_id is null then
    raise exception 'Link inválido';
  end if;

  v_amarilla := coalesce((v_config->>'precio_amarilla')::numeric, 0);
  v_azul     := coalesce((v_config->>'precio_azul')::numeric, 0);
  v_roja     := coalesce((v_config->>'precio_roja')::numeric, 0);

  with filas as (
    select
      s.player_id, s.team_id, s.match_id,
      coalesce(p.name, 'Jugador') as player_nombre,
      tm.name as team_nombre,
      m.played_at, m.location as cancha_nombre, ht.name as home_nombre, at.name as away_nombre,
      (s.yellow_cards > 0 and not s.yellow_paid) as debe_am,
      (s.blue_cards   > 0 and not s.blue_paid)   as debe_az,
      (s.red_cards    > 0 and not s.red_paid)    as debe_rj
    from player_match_stats s
    join players p on p.id = s.player_id
    left join teams tm on tm.id = s.team_id
    left join matches m on m.id = s.match_id
    left join teams ht on ht.id = m.home_team_id
    left join teams at on at.id = m.away_team_id
    where s.tournament_id = v_tournament_id
      and (
        (s.yellow_cards > 0 and not s.yellow_paid) or
        (s.blue_cards   > 0 and not s.blue_paid)   or
        (s.red_cards    > 0 and not s.red_paid)
      )
  ),
  con_monto as (
    select f.*,
      greatest(
        case when debe_am then v_amarilla else 0 end,
        case when debe_az then v_azul     else 0 end,
        case when debe_rj then v_roja     else 0 end
      ) as monto,
      case
        when debe_am and v_amarilla >= greatest(
          case when debe_az then v_azul else 0 end,
          case when debe_rj then v_roja else 0 end) then 'Amarilla'
        when debe_az and v_azul >= case when debe_rj then v_roja else 0 end then 'Azul'
        else 'Roja'
      end as tipo_cobrado,
      array_remove(array[
        case when debe_am then 'Amarilla' end,
        case when debe_az then 'Azul' end,
        case when debe_rj then 'Roja' end
      ], null) as tipos_del_partido
    from filas f
  ),
  por_jugador as (
    select
      player_id, team_id,
      max(player_nombre) as player_nombre,
      max(team_nombre) as team_nombre,
      sum(monto) as total,
      jsonb_agg(jsonb_build_object(
        'tipo', tipo_cobrado,
        'tiposDelPartido', to_jsonb(tipos_del_partido),
        'monto', monto,
        'fecha', played_at,
        'cancha', cancha_nombre,
        'home', home_nombre,
        'away', away_nombre
      ) order by played_at) as items
    from con_monto
    group by player_id, team_id
  )
  select jsonb_build_object(
    'torneo', (select name from tournaments where id = v_tournament_id),
    'equipos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', name) order by name), '[]'::jsonb)
                from teams where id in (select distinct team_id from por_jugador)),
    'deudores', coalesce(jsonb_agg(jsonb_build_object(
      'player_id', player_id, 'team_id', team_id, 'nombre', player_nombre,
      'equipo', team_nombre, 'total', total, 'items', items
    ) order by team_nombre, player_nombre), '[]'::jsonb)
  )
  into v_result
  from por_jugador;

  return v_result;
end;
$$;

grant execute on function public.ver_deudores_por_link(uuid) to anon, authenticated;

-- Registra el pago de TODAS las tarjetas sin pagar de un jugador en el
-- torneo (mismo criterio que ya usa marcarTarjetaPagada en
-- src/lib/tarjetasDeuda.js: no separa por partido, pone al día todos los
-- colores que deba) y lo anota en Finanzas del torneo. El concepto queda
-- con el detalle (partido, cancha y fecha) de CADA tarjeta que se pagó,
-- armado ANTES de marcarlas pagadas — así el historial de pagos del link
-- (ver_historial_pagos_tarjetas_por_link) puede mostrar cancha y fecha de
-- cada una, aunque player_match_stats ya no distinga cuál pago fue cuál.
create or replace function public.pagar_tarjeta_por_link(p_token uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_config jsonb;
  v_team_id uuid;
  v_player_nombre text;
  v_total numeric := 0;
  v_tipos text[] := '{}';
  v_detalle text := '';
  v_item record;
begin
  select id, coalesce(finanzas_config, '{}'::jsonb) into v_tournament_id, v_config
  from tournaments where link_deudores_token = p_token;

  if v_tournament_id is null then
    raise exception 'Link inválido';
  end if;

  select name into v_player_nombre from players where id = p_player_id;

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
    v_total := v_total + coalesce((v_config->>'precio_amarilla')::numeric, 0);
    v_tipos := array_append(v_tipos, 'Amarilla');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tournament_id and player_id = p_player_id and blue_cards > 0 and not blue_paid) then
    update player_match_stats set blue_paid = true where tournament_id = v_tournament_id and player_id = p_player_id and blue_cards > 0;
    v_total := v_total + coalesce((v_config->>'precio_azul')::numeric, 0);
    v_tipos := array_append(v_tipos, 'Azul');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tournament_id and player_id = p_player_id and red_cards > 0 and not red_paid) then
    update player_match_stats set red_paid = true where tournament_id = v_tournament_id and player_id = p_player_id and red_cards > 0;
    v_total := v_total + coalesce((v_config->>'precio_roja')::numeric, 0);
    v_tipos := array_append(v_tipos, 'Roja');
  end if;

  if array_length(v_tipos, 1) is null then
    raise exception 'Este jugador ya no tiene tarjetas pendientes';
  end if;

  select s.team_id into v_team_id
  from player_match_stats s
  left join matches m on m.id = s.match_id
  where s.tournament_id = v_tournament_id and s.player_id = p_player_id
  order by m.played_at desc nulls last
  limit 1;

  insert into torneo_finanzas (tournament_id, team_id, player_id, tipo, monto, pagado, concepto)
  values (v_tournament_id, v_team_id, p_player_id, 'pago_tarjetas', v_total, true,
    'Tarjeta(s) de ' || coalesce(v_player_nombre, 'jugador') || ' — ' || v_detalle || ' — pagada por el link de deudores de tarjetas');

  return jsonb_build_object('ok', true, 'total', v_total, 'tipos', to_jsonb(v_tipos));
end;
$$;

grant execute on function public.pagar_tarjeta_por_link(uuid, uuid) to anon, authenticated;

-- Historial de pagos de tarjetas de un torneo, para mostrarlo en la misma
-- página del link de deudores — con fecha (created_at, cuándo se registró
-- el pago) y el detalle de partido/cancha/fecha que quedó anotado en el
-- concepto al momento de pagar (ver pagar_tarjeta_por_link más arriba).
-- Incluye los pagos de tarjetas registrados por CUALQUIER vía (este link,
-- el panel de Finanzas del admin), no solo los del link.
create or replace function public.ver_historial_pagos_tarjetas_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_result jsonb;
begin
  select id into v_tournament_id from tournaments where link_deudores_token = p_token;

  if v_tournament_id is null then
    raise exception 'Link inválido';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'jugador', coalesce(p.name, 'Jugador'),
    'equipo', tm.name,
    'monto', f.monto,
    'concepto', f.concepto,
    'fecha', f.created_at
  ) order by f.created_at desc), '[]'::jsonb)
  into v_result
  from torneo_finanzas f
  left join players p on p.id = f.player_id
  left join teams tm on tm.id = f.team_id
  where f.tournament_id = v_tournament_id and f.tipo = 'pago_tarjetas';

  return v_result;
end;
$$;

grant execute on function public.ver_historial_pagos_tarjetas_por_link(uuid) to anon, authenticated;
