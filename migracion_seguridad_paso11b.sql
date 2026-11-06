-- =====================================================================
-- PASO 11B — Links de finanzas y de deudores de tarjetas: tokens y contraseña PRIVADOS
-- =====================================================================
-- PROBLEMA: link_finanzas_token, link_deudores_token y link_deudores_password (en texto plano)
-- estaban en la tabla pública "tournaments", y cualquier sesión (incluso anónima) las podía leer
-- de TODOS los torneos. Con eso se veían los deudores y se podían marcar tarjetas como pagadas.
--
-- QUÉ HACE (la app NO necesita cambios: solo usa estas columnas a través de funciones):
--   1) Crea la tabla privada tournament_link_tokens (nadie la lee desde fuera).
--   2) Copia ahí los tokens y contraseñas actuales (los links YA REPARTIDOS SIGUEN FUNCIONANDO
--      y las contraseñas puestas siguen siendo las mismas).
--   3) Vacía esas tres columnas en tournaments.
--   4) Reescribe las 11 funciones que las usaban para que lean/escriban en la tabla privada.
-- CUÁNDO CORRERLO: en cualquier momento (no afecta partidos en vivo). Una sola transacción.
-- =====================================================================
begin;

-- 1) Tabla privada ----------------------------------------------------
create table if not exists public.tournament_link_tokens (
  tournament_id    uuid primary key references public.tournaments(id) on delete cascade,
  finanzas_token   uuid,
  deudores_token   uuid,
  deudores_password text,
  created_at       timestamptz not null default now()
);
create unique index if not exists tournament_link_tokens_finanzas_uk
  on public.tournament_link_tokens (finanzas_token) where finanzas_token is not null;
create unique index if not exists tournament_link_tokens_deudores_uk
  on public.tournament_link_tokens (deudores_token) where deudores_token is not null;

alter table public.tournament_link_tokens enable row level security;
revoke all on table public.tournament_link_tokens from public, anon, authenticated;

-- 2) Copiar lo que ya existe -----------------------------------------
insert into public.tournament_link_tokens (tournament_id, finanzas_token, deudores_token, deudores_password)
select id, link_finanzas_token, link_deudores_token, link_deudores_password
from public.tournaments
where link_finanzas_token is not null
   or link_deudores_token is not null
   or nullif(link_deudores_password, '') is not null
on conflict (tournament_id) do update set
  finanzas_token    = coalesce(public.tournament_link_tokens.finanzas_token, excluded.finanzas_token),
  deudores_token    = coalesce(public.tournament_link_tokens.deudores_token, excluded.deudores_token),
  deudores_password = coalesce(public.tournament_link_tokens.deudores_password, excluded.deudores_password);

-- 3) Vaciar las columnas públicas ------------------------------------
update public.tournaments
set link_finanzas_token = null,
    link_deudores_token = null,
    link_deudores_password = null
where link_finanzas_token is not null
   or link_deudores_token is not null
   or link_deudores_password is not null;

-- 4) Funciones --------------------------------------------------------

create or replace function public.generar_link_finanzas(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_organizador_id uuid;
  v_token uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not exists (select 1 from tournaments where id = p_tournament_id) then
    raise exception 'Torneo no encontrado';
  end if;

  select organizador_id into v_organizador_id from tournaments where id = p_tournament_id;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  select k.finanzas_token into v_token
  from tournament_link_tokens k where k.tournament_id = p_tournament_id;

  if v_token is not null then
    return jsonb_build_object('token', v_token);
  end if;

  v_token := gen_random_uuid();
  insert into tournament_link_tokens (tournament_id, finanzas_token)
  values (p_tournament_id, v_token)
  on conflict (tournament_id) do update set finanzas_token = excluded.finanzas_token;
  return jsonb_build_object('token', v_token);
end;
$function$;

create or replace function public.generar_link_deudores(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_organizador_id uuid;
  v_token uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not exists (select 1 from tournaments where id = p_tournament_id) then
    raise exception 'Torneo no encontrado';
  end if;

  select organizador_id into v_organizador_id from tournaments where id = p_tournament_id;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  select k.deudores_token into v_token
  from tournament_link_tokens k where k.tournament_id = p_tournament_id;

  if v_token is not null then
    return jsonb_build_object('token', v_token);
  end if;

  v_token := gen_random_uuid();
  insert into tournament_link_tokens (tournament_id, deudores_token)
  values (p_tournament_id, v_token)
  on conflict (tournament_id) do update set deudores_token = excluded.deudores_token;

  return jsonb_build_object('token', v_token);
end;
$function$;

create or replace function public.set_password_link_deudores(p_tournament_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_organizador_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not exists (select 1 from tournaments where id = p_tournament_id) then
    raise exception 'Torneo no encontrado';
  end if;

  select organizador_id into v_organizador_id from tournaments where id = p_tournament_id;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  insert into tournament_link_tokens (tournament_id, deudores_password)
  values (p_tournament_id, nullif(trim(coalesce(p_password, '')), ''))
  on conflict (tournament_id) do update
    set deudores_password = nullif(trim(coalesce(p_password, '')), '');

  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.ver_password_link_deudores(p_tournament_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_organizador_id uuid;
  v_password text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select organizador_id into v_organizador_id
  from tournaments where id = p_tournament_id;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  select k.deudores_password into v_password
  from tournament_link_tokens k where k.tournament_id = p_tournament_id;

  return v_password;
end;
$function$;

create or replace function public.link_deudores_requiere_password(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_password text;
begin
  select k.deudores_password into v_password
  from tournament_link_tokens k where k.deudores_token = p_token;
  if not found then
    raise exception 'Link inválido';
  end if;
  return v_password is not null and v_password <> '';
end;
$function$;

create or replace function public.verificar_password_deudores(p_token uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_password text;
begin
  select k.deudores_password into v_password
  from tournament_link_tokens k where k.deudores_token = p_token;
  if not found then
    raise exception 'Link inválido';
  end if;
  return v_password is null or v_password = '' or v_password = p_password;
end;
$function$;

create or replace function public.finanzas_link_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_t uuid;
  v_result jsonb;
begin
  select k.tournament_id into v_t
  from tournament_link_tokens k where k.finanzas_token = p_token;
  if v_t is null then
    raise exception 'Link inválido';
  end if;

  select jsonb_build_object(
    'torneo', (select jsonb_build_object('name', name, 'logo_url', logo_url) from tournaments where id = v_t),
    'equipos', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'logo_url', t.logo_url) order by t.name)
      from tournament_teams tt join teams t on t.id = tt.team_id
      where tt.tournament_id = v_t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.finanzas_equipo_ver(p_token uuid, p_team_id uuid, p_cedula text, p_registrar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_t uuid;
  v_nombre text;
  v_logo text;
  v_cfg jsonb;
  v_ced_real text;
  v_ced_in text;
  v_fallos_equipo int;
  v_fallos_torneo int;
  v_ultimo_ok timestamptz;
  v_equipo jsonb;
begin
  select tt0.id, tt0.name, tt0.logo_url, coalesce(tt0.finanzas_config, '{}'::jsonb)
    into v_t, v_nombre, v_logo, v_cfg
  from tournaments tt0
  join tournament_link_tokens k on k.tournament_id = tt0.id
  where k.finanzas_token = p_token;
  if v_t is null then
    raise exception 'Link inválido';
  end if;

  if not exists (select 1 from tournament_teams where tournament_id = v_t and team_id = p_team_id) then
    return jsonb_build_object('ok', false, 'error', 'equipo');
  end if;

  select count(*) into v_fallos_equipo from finanzas_accesos
   where tournament_id = v_t and team_id = p_team_id and not ok and created_at > now() - interval '15 minutes';
  select count(*) into v_fallos_torneo from finanzas_accesos
   where tournament_id = v_t and not ok and created_at > now() - interval '15 minutes';
  if v_fallos_equipo >= 5 or v_fallos_torneo >= 40 then
    return jsonb_build_object('ok', false, 'error', 'bloqueado');
  end if;

  select representante_cedula into v_ced_real from teams where id = p_team_id;
  v_ced_real := regexp_replace(coalesce(v_ced_real, ''), '\D', '', 'g');
  v_ced_in   := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');

  if v_ced_real = '' then
    return jsonb_build_object('ok', false, 'error', 'sin_cedula');
  end if;
  if v_ced_in = '' or v_ced_in <> v_ced_real then
    insert into finanzas_accesos (tournament_id, team_id, ok) values (v_t, p_team_id, false);
    return jsonb_build_object('ok', false, 'error', 'incorrecta');
  end if;

  -- Un "ingreso" nuevo se anota si el último fue hace más de 10 minutos (así no se llena de filas al refrescar)
  select max(created_at) into v_ultimo_ok from finanzas_accesos
   where tournament_id = v_t and team_id = p_team_id and ok;
  if p_registrar and (v_ultimo_ok is null or v_ultimo_ok < now() - interval '10 minutes') then
    insert into finanzas_accesos (tournament_id, team_id, ok) values (v_t, p_team_id, true);
  end if;

  select jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url) into v_equipo from teams where id = p_team_id;

  return jsonb_build_object(
    'ok', true,
    'torneo', jsonb_build_object('name', v_nombre, 'logo_url', v_logo, 'config', v_cfg),
    'equipo', v_equipo,
    -- partidos del equipo
    'partidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'played_at', m.played_at, 'status', m.status, 'tipo_resultado', m.tipo_resultado,
        'home_team_id', m.home_team_id, 'away_team_id', m.away_team_id,
        'home_nombre', ht.name, 'away_nombre', at.name,
        'home_score', m.home_score, 'away_score', m.away_score, 'matchday', m.matchday
      ) order by m.played_at)
      from matches m
      left join teams ht on ht.id = m.home_team_id
      left join teams at on at.id = m.away_team_id
      where m.tournament_id = v_t and (m.home_team_id = p_team_id or m.away_team_id = p_team_id)
    ), '[]'::jsonb),
    -- tarjetas por eventos del partido (incluye jugadores sin registro, con su nombre)
    'tarjetas_eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', e.match_id, 'player_id', e.player_id, 'event_type', e.event_type,
        'nombre', coalesce(p.name, to_jsonb(e) ->> 'player_nombre')
      ))
      from match_events e
      left join players p on p.id = e.player_id
      where e.tournament_id = v_t and e.team_id = p_team_id
        and e.event_type in ('yellow_card', 'blue_card', 'red_card')
    ), '[]'::jsonb),
    -- respaldo: estadísticas por partido (partidos viejos guardados sin eventos)
    'tarjetas_stats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', s.match_id, 'player_id', s.player_id,
        'yellow_cards', s.yellow_cards, 'blue_cards', s.blue_cards, 'red_cards', s.red_cards,
        'yellow_paid', coalesce(s.yellow_paid, false), 'blue_paid', coalesce(s.blue_paid, false), 'red_paid', coalesce(s.red_paid, false),
        'nombre', p.name
      ))
      from player_match_stats s
      left join players p on p.id = s.player_id
      where s.tournament_id = v_t and s.team_id = p_team_id
        and (coalesce(s.yellow_cards, 0) + coalesce(s.blue_cards, 0) + coalesce(s.red_cards, 0)) > 0
    ), '[]'::jsonb),
    -- inscripción por jugador: cuántos están inscritos y cuántos ya pagaron
    'inscritos', (select count(*) from tournament_player_registrations r
                  where r.tournament_id = v_t and r.team_id = p_team_id and r.activo is distinct from false),
    -- movimientos de dinero del equipo (pagos, abonos y deudas anotadas)
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'tipo', f.tipo, 'monto', f.monto, 'concepto', f.concepto,
        'pagado', f.pagado, 'created_at', f.created_at, 'jugador', p.name
      ) order by f.created_at desc)
      from torneo_finanzas f
      left join players p on p.id = f.player_id
      where f.tournament_id = v_t and f.team_id = p_team_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.ver_deudores_por_link(p_token uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tournament_id uuid;
  v_config jsonb;
  v_password_real text;
  v_amarilla numeric;
  v_azul numeric;
  v_roja numeric;
  v_result jsonb;
begin
  select tt0.id, coalesce(tt0.finanzas_config, '{}'::jsonb), k.deudores_password
    into v_tournament_id, v_config, v_password_real
  from tournaments tt0
  join tournament_link_tokens k on k.tournament_id = tt0.id
  where k.deudores_token = p_token;

  if v_tournament_id is null then
    raise exception 'Link inválido';
  end if;
  if v_password_real is not null and v_password_real <> '' and v_password_real <> p_password then
    raise exception 'Contraseña incorrecta';
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
$function$;

create or replace function public.ver_historial_pagos_tarjetas_por_link(p_token uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tournament_id uuid;
  v_password_real text;
  v_result jsonb;
begin
  select k.tournament_id, k.deudores_password into v_tournament_id, v_password_real
  from tournament_link_tokens k where k.deudores_token = p_token;

  if v_tournament_id is null then
    raise exception 'Link inválido';
  end if;
  if v_password_real is not null and v_password_real <> '' and v_password_real <> p_password then
    raise exception 'Contraseña incorrecta';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'jugador', coalesce(p.name, 'Jugador'),
    'equipo', tm.name,
    'monto', f.monto,
    'concepto', f.concepto,
    'tarjetas', f.tarjetas_pagadas,
    'fecha', f.created_at
  ) order by f.created_at desc), '[]'::jsonb)
  into v_result
  from torneo_finanzas f
  left join players p on p.id = f.player_id
  left join teams tm on tm.id = f.team_id
  where f.tournament_id = v_tournament_id and f.tipo = 'pago_tarjetas';

  return v_result;
end;
$function$;

create or replace function public.pagar_tarjeta_por_link(p_token uuid, p_player_id uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  select tt0.id, coalesce(tt0.finanzas_config, '{}'::jsonb), k.deudores_password
    into v_tournament_id, v_config, v_password_real
  from tournaments tt0
  join tournament_link_tokens k on k.tournament_id = tt0.id
  where k.deudores_token = p_token;

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
$function$;

commit;

-- =====================================================================
-- PRUEBAS (cada una por separado)
-- =====================================================================
-- A) Ya no hay tokens ni contraseñas en tournaments (debe dar 0, 0, 0):
--    select count(*) filter (where link_finanzas_token is not null) as finanzas,
--           count(*) filter (where link_deudores_token is not null) as deudores,
--           count(*) filter (where link_deudores_password is not null) as password
--    from public.tournaments;
-- B) Quedaron en la tabla privada (un número mayor que 0 si ya tenías links generados):
--    select count(*) filter (where finanzas_token is not null) as finanzas,
--           count(*) filter (where deudores_token is not null) as deudores,
--           count(*) filter (where nullif(deudores_password, '') is not null) as password
--    from public.tournament_link_tokens;
-- C) Ni un visitante ni una sesión anónima pueden leer la tabla privada (las dos deben dar ERROR permission denied):
--    begin; set local role anon; select count(*) from public.tournament_link_tokens; rollback;
--    begin; set local role authenticated; select count(*) from public.tournament_link_tokens; rollback;
-- D) En la web:
--    1. /admin del torneo -> Finanzas: sacar el link de finanzas de equipos, abrirlo en ventana privada,
--       escoger un equipo y entrar con la cédula del representante.
--    2. Link de deudores de tarjetas: en el panel debe verse el link y la contraseña que ya tenía.
--       Abrirlo en ventana privada, poner la contraseña y ver los deudores y el historial.
--       (No hace falta marcar un pago; si lo haces, que sea con un caso de prueba.)
--    3. Cambiar la contraseña desde el panel y entrar con la nueva.
--    4. Un link de finanzas o de deudores repartido ANTES debe seguir abriendo.
-- ROLLBACK: rollback_seguridad_paso11b.sql
