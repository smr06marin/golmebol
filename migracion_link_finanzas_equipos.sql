-- ============================================================
-- MIGRACIÓN: Link de FINANZAS para los equipos (un link por torneo, no vence).
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- FLUJO:
--   1) El organizador, desde Finanzas del torneo, toca "Link para equipos": se genera UN link fijo
--      (no vence) que puede mandar a todos los equipos.
--   2) Quien abre el link ve la lista de TODOS los equipos del torneo, pero para entrar a uno tiene que
--      escribir la CÉDULA DEL REPRESENTANTE (dueño) de ESE equipo — esa es la contraseña.
--      Ya adentro ve SOLO los movimientos de plata de su equipo (lo que debe, lo que pagó y el detalle).
--   3) Cada ingreso queda anotado (equipo, día y hora): el organizador ve quién ya entró, cuándo,
--      cuántas veces, y quiénes NUNCA han entrado.
--
-- SEGURIDAD:
--   · La cédula del representante (teams.representante_cedula) es privada: nunca sale de la base de datos.
--     El celular solo manda lo que escribió la persona y la base responde "entró" o "contraseña incorrecta".
--   · Máximo 5 intentos fallidos por equipo cada 15 minutos (y 40 por torneo), para que nadie pueda ir
--     probando cédulas.
--   · La tabla de ingresos no se puede leer directo: solo con las funciones de abajo.
-- ============================================================

alter table tournaments add column if not exists link_finanzas_token uuid;
create unique index if not exists tournaments_link_finanzas_token_idx
  on tournaments(link_finanzas_token) where link_finanzas_token is not null;

create table if not exists finanzas_accesos (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  ok            boolean not null,
  created_at    timestamptz not null default now()
);
create index if not exists finanzas_accesos_idx on finanzas_accesos (tournament_id, team_id, created_at desc);
alter table finanzas_accesos enable row level security; -- sin políticas: nadie la lee directo

-- ── 1) Generar el link (una sola vez; después devuelve el mismo) ─────────────────────────────
create or replace function public.generar_link_finanzas(p_tournament_id uuid)
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

  select organizador_id, link_finanzas_token into v_organizador_id, v_token
  from tournaments where id = p_tournament_id;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  if v_token is not null then
    return jsonb_build_object('token', v_token);
  end if;

  v_token := gen_random_uuid();
  update tournaments set link_finanzas_token = v_token where id = p_tournament_id;
  return jsonb_build_object('token', v_token);
end;
$$;
revoke all on function public.generar_link_finanzas(uuid) from public;
grant execute on function public.generar_link_finanzas(uuid) to authenticated;

-- ── 2) Lista pública de equipos del torneo (solo nombre y escudo; sin plata ni cédulas) ─────
create or replace function public.finanzas_link_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t uuid;
  v_result jsonb;
begin
  select id into v_t from tournaments where link_finanzas_token = p_token;
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
$$;
grant execute on function public.finanzas_link_info(uuid) to anon, authenticated;

-- ── 3) Entrar a UN equipo con la cédula del representante ────────────────────────────────────
-- Devuelve { ok:false, error } si algo falla (NO se usa "raise" porque eso desharía el registro del intento)
-- o { ok:true, ...datos } con TODO lo necesario para armar la cuenta de ESE equipo.
-- (si ya habías corrido una versión anterior, se quita la firma vieja para que no queden dos funciones iguales)
drop function if exists public.finanzas_equipo_ver(uuid, uuid, text);
create or replace function public.finanzas_equipo_ver(p_token uuid, p_team_id uuid, p_cedula text, p_registrar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  select id, name, logo_url, coalesce(finanzas_config, '{}'::jsonb)
    into v_t, v_nombre, v_logo, v_cfg
  from tournaments where link_finanzas_token = p_token;
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
$$;
grant execute on function public.finanzas_equipo_ver(uuid, uuid, text, boolean) to anon, authenticated;

-- ── 4) Para el ORGANIZADOR: quién entró, cuándo y cuántas veces (y quién nunca) ──────────────
create or replace function public.finanzas_accesos_resumen(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizador_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select organizador_id into v_organizador_id from tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Torneo no encontrado';
  end if;
  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id', t.id,
      'nombre', t.name,
      'logo_url', t.logo_url,
      'representante', nullif(trim(coalesce(t.representante_nombre, '')), ''),
      'tiene_cedula', regexp_replace(coalesce(t.representante_cedula, ''), '\D', '', 'g') <> '',
      'ingresos', coalesce(ac.ingresos, 0),
      'primero', ac.primero,
      'ultimo', ac.ultimo,
      'fallidos_24h', coalesce(ac.fallidos, 0),
      'recientes', coalesce(ac.recientes, '[]'::jsonb)
    ) order by t.name)
    from tournament_teams tt
    join teams t on t.id = tt.team_id
    left join lateral (
      select
        count(*) filter (where a.ok) as ingresos,
        min(a.created_at) filter (where a.ok) as primero,
        max(a.created_at) filter (where a.ok) as ultimo,
        count(*) filter (where not a.ok and a.created_at > now() - interval '24 hours') as fallidos,
        (select coalesce(jsonb_agg(x.created_at order by x.created_at desc), '[]'::jsonb)
           from (select a2.created_at from finanzas_accesos a2
                  where a2.tournament_id = p_tournament_id and a2.team_id = t.id and a2.ok
                  order by a2.created_at desc limit 8) x) as recientes
      from finanzas_accesos a
      where a.tournament_id = p_tournament_id and a.team_id = t.id
    ) ac on true
    where tt.tournament_id = p_tournament_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.finanzas_accesos_resumen(uuid) from public;
grant execute on function public.finanzas_accesos_resumen(uuid) to authenticated;
