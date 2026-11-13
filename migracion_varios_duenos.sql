-- =====================================================================
-- VARIOS DUEÑOS POR EQUIPO
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
-- Requisito: migracion_seguridad_paso11c_a.sql ya corrida (tabla privada teams_privado).
--
-- QUÉ HACE:
--   1) Tabla equipo_duenos: los dueños ADICIONALES de cada equipo (cédula + nombre). El dueño "principal" sigue
--      siendo el representante de siempre; no se pierde ni cambia nada.
--   2) Todo lo que revisaba "¿es el dueño?" ahora acepta a CUALQUIER dueño (principal o adicional), con los
--      mismos permisos: "Eres dueño de…" en su perfil, inscribir y quitar jugadores, link para que se
--      inscriban solos, desactivar jugadores desde el link, planilla en PDF y link de finanzas del equipo.
--   3) Funciones para ver / agregar / quitar dueños: las usan el admin, el organizador de un torneo donde
--      juega el equipo y los propios dueños.
-- Una sola transacción: si algo falla, no queda nada a medias.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.teams_privado') is null then
    raise exception 'Primero corre migracion_seguridad_paso11c_a.sql (tabla teams_privado)';
  end if;
end $$;

-- 1) Dueños adicionales ---------------------------------------------------------------
create table if not exists public.equipo_duenos (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  cedula       text not null,           -- solo números
  nombre       text,
  agregado_por uuid,
  created_at   timestamptz not null default now(),
  unique (team_id, cedula)
);
create index if not exists equipo_duenos_cedula_idx on public.equipo_duenos (cedula);
alter table public.equipo_duenos enable row level security;
revoke all on table public.equipo_duenos from public, anon, authenticated; -- solo se toca por las funciones de abajo

-- Cédula del dueño principal (tabla privada; si aún no se movió, la de teams)
create or replace function public._cedula_principal_equipo(p_team uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(nullif(trim(k.representante_cedula), ''), nullif(trim(t.representante_cedula), ''))
  from public.teams t
  left join public.teams_privado k on k.team_id = t.id
  where t.id = p_team;
$function$;

-- ¿Esta cédula es dueña (principal o adicional) de este equipo?
create or replace function public.es_cedula_duena(p_team uuid, p_cedula text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  with c as (select regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g') as d, trim(coalesce(p_cedula, '')) as t),
       pr as (select public._cedula_principal_equipo(p_team) as v)
  select (select d from c) <> '' and (
       exists (select 1 from pr where pr.v is not null and (trim(pr.v) = (select t from c) or regexp_replace(pr.v, '\D', '', 'g') = (select d from c)))
    or exists (select 1 from public.equipo_duenos e where e.team_id = p_team and e.cedula = (select d from c))
  );
$function$;

-- ¿Soy dueño de este equipo? (cualquiera de mis perfiles con cédula)
create or replace function public.soy_dueno_de_equipo(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.players p
    where p.user_id = auth.uid() and p.numero_cedula is not null
      and public.es_cedula_duena(p_team_id, p.numero_cedula)
  );
$function$;

-- La misma regla con el nombre que usan las reglas de inscripción y plantilla
create or replace function public.es_representante_de_equipo(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.soy_dueno_de_equipo(p_team);
$function$;

-- Quién puede ver los datos privados de un equipo: admin, staff de la escuela, organizador de un torneo
-- donde está el equipo, o CUALQUIERA de sus dueños.
create or replace function public.puede_ver_datos_equipo(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null and (
       coalesce(public.es_admin_plataforma(), false)
    or coalesce(public.es_staff_escuela(p_team), false)
    or exists (
         select 1
         from public.tournament_teams tt
         join public.tournaments t on t.id = tt.tournament_id
         where tt.team_id = p_team and t.organizador_id = auth.uid()
       )
    or public.soy_dueno_de_equipo(p_team)
  );
$function$;

-- Equipos de los que soy dueño (principal o adicional): "Eres dueño de…" en el perfil
create or replace function public.mis_equipos_dueno()
returns table (id uuid, name text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with mis as (
    select distinct regexp_replace(p.numero_cedula, '\D', '', 'g') as d, trim(p.numero_cedula) as t
    from public.players p
    where p.user_id = auth.uid() and nullif(trim(coalesce(p.numero_cedula, '')), '') is not null
  )
  select t.id, t.name, t.created_at
  from public.teams t
  left join public.teams_privado k on k.team_id = t.id
  join mis on mis.d <> '' and (
       trim(coalesce(k.representante_cedula, t.representante_cedula, '')) = mis.t
    or regexp_replace(coalesce(k.representante_cedula, t.representante_cedula, ''), '\D', '', 'g') = mis.d
  )
  where auth.uid() is not null
  union
  select t.id, t.name, t.created_at
  from public.equipo_duenos e
  join public.teams t on t.id = e.team_id
  join mis on mis.d = e.cedula
  where auth.uid() is not null;
$function$;

-- Link de registro: ¿esta cédula es de un dueño del equipo? (para desactivar jugadores desde el link)
create or replace function public.es_representante_equipo(p_token text, p_cedula text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_team uuid;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return false; end if;
  select t.id into v_team
  from public.teams t
  left join public.teams_privado k on k.team_id = t.id
  where k.registro_token::text = trim(p_token) or t.registro_token::text = trim(p_token)
  limit 1;
  if v_team is null then return false; end if;
  -- Equipo sin ningún dueño registrado: como antes, se deja pasar
  if public._cedula_principal_equipo(v_team) is null and not exists (select 1 from public.equipo_duenos e where e.team_id = v_team) then
    return true;
  end if;
  return public.es_cedula_duena(v_team, p_cedula);
end;
$function$;

-- Planilla PDF desde el link de registro: cualquier dueño (con su sesión de Golmebol)
create or replace function public.planilla_equipo_representante(p_token text, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_team_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Debes iniciar sesión';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is null then raise exception 'Link inválido'; end if;
  select t.id into v_team_id
  from public.teams t
  left join public.teams_privado k on k.team_id = t.id
  where k.registro_token::text = trim(p_token) or t.registro_token::text = trim(p_token)
  limit 1;
  if v_team_id is null then raise exception 'Link inválido'; end if;

  if public._cedula_principal_equipo(v_team_id) is null and not exists (select 1 from public.equipo_duenos e where e.team_id = v_team_id) then
    raise exception 'Este equipo no tiene un dueño registrado';
  end if;

  v_ok := public.soy_dueno_de_equipo(v_team_id)
       or (v_email like '%@golmebol.com' and public.es_cedula_duena(v_team_id, split_part(v_email, '@', 1)));
  if not v_ok then raise exception 'Solo los dueños del equipo pueden descargar la planilla'; end if;

  return public._planilla_equipo_datos(v_team_id, p_tournament_id);
end;
$function$;

-- Login: un dueño ADICIONAL que todavía no tiene perfil de jugador también puede entrar (se le crea uno mínimo)
create or replace function public.login_buscar_cedula(p_cedula text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ced text := trim(coalesce(p_cedula, ''));
  j   jsonb;
  eq  record;
begin
  if ced = '' then return jsonb_build_object('encontrado', false); end if;

  j := public._login_jugador(ced);

  -- ¿Es dueño (principal) de un equipo sin perfil de jugador? Se le crea uno mínimo.
  if j is null then
    select t.representante_nombre as nombre, coalesce(k.representante_telefono, t.representante_telefono) as telefono into eq
    from public.teams t
    left join public.teams_privado k on k.team_id = t.id
    where coalesce(nullif(trim(k.representante_cedula), ''), nullif(trim(t.representante_cedula), '')) = ced
      and t.representante_nombre is not null
    limit 1;
    if not found then
      -- ¿O dueño adicional?
      select e.nombre, null::text as telefono into eq
      from public.equipo_duenos e
      where e.cedula = regexp_replace(ced, '\D', '', 'g') and nullif(trim(coalesce(e.nombre, '')), '') is not null
      limit 1;
    end if;
    if found then
      insert into public.players (name, telefono, numero_cedula, rol, activo_membresia, primer_ingreso, fecha_registro)
      values (eq.nombre, eq.telefono, ced, 'jugador', true, true, now());
      j := public._login_jugador(ced);
    end if;
  end if;

  if j is null then return jsonb_build_object('encontrado', false); end if;

  return jsonb_build_object(
    'encontrado',               true,
    'id',                       j ->> 'id',
    'tiene_cuenta',             (j ->> 'user_id') is not null,
    'primer_ingreso',           j -> 'primer_ingreso',
    'rol',                      j ->> 'rol',
    'es_arbitro',               coalesce((j ->> 'es_arbitro')::boolean, false),
    'es_arbitro_lider',         coalesce((j ->> 'es_arbitro_lider')::boolean, false),
    'es_profesor',              coalesce((j ->> 'es_profesor')::boolean, false),
    'es_profesor_coordinador',  coalesce((j ->> 'es_profesor_coordinador')::boolean, false),
    'es_encargado_escenario',   coalesce((j ->> 'es_encargado_escenario')::boolean, false),
    'es_acudiente',             coalesce((j ->> 'es_acudiente')::boolean, false),
    'es_jugador_escuela',       coalesce((j ->> 'es_jugador_escuela')::boolean, false),
    'equipo_deseado',           j -> 'equipo_deseado',
    'nombre_corto',             split_part(trim(coalesce(j ->> 'name', '')), ' ', 1)
  );
end;
$function$;

-- Link de finanzas del equipo: entra cualquier dueño con su cédula
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

  -- Cualquier dueño del equipo (principal o adicional) entra con SU cédula
  v_ced_real := regexp_replace(coalesce(public._cedula_principal_equipo(p_team_id), ''), '\D', '', 'g');
  v_ced_in   := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');

  if v_ced_real = '' and not exists (select 1 from public.equipo_duenos e where e.team_id = p_team_id) then
    return jsonb_build_object('ok', false, 'error', 'sin_cedula');
  end if;
  if v_ced_in = '' or not public.es_cedula_duena(p_team_id, v_ced_in) then
    insert into finanzas_accesos (tournament_id, team_id, ok) values (v_t, p_team_id, false);
    return jsonb_build_object('ok', false, 'error', 'incorrecta');
  end if;

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
    'inscritos', (select count(*) from tournament_player_registrations r
                  where r.tournament_id = v_t and r.team_id = p_team_id and r.activo is distinct from false),
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

-- 2) Ver / agregar / quitar dueños --------------------------------------------------------
-- Lista de dueños: [{ cedula, nombre, principal, tiene_cuenta }]. Solo quien puede ver los datos del equipo.
create or replace function public.equipo_duenos_lista(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_ced text; v_nombre text; r jsonb := '[]'::jsonb;
begin
  if not public.puede_ver_datos_equipo(p_team_id) then raise exception 'No autorizado'; end if;
  v_ced := public._cedula_principal_equipo(p_team_id);
  select t.representante_nombre into v_nombre from public.teams t where t.id = p_team_id;
  if v_ced is not null then
    r := r || jsonb_build_array(jsonb_build_object(
      'cedula', v_ced, 'nombre', coalesce(v_nombre, (select p.name from public.players p where trim(p.numero_cedula) = v_ced limit 1)),
      'principal', true,
      'tiene_cuenta', exists (select 1 from public.players p where trim(p.numero_cedula) = v_ced and p.user_id is not null)));
  end if;
  select r || coalesce(jsonb_agg(jsonb_build_object(
      'cedula', e.cedula, 'nombre', coalesce(nullif(trim(e.nombre), ''), (select p.name from public.players p where regexp_replace(p.numero_cedula, '\D', '', 'g') = e.cedula limit 1)),
      'principal', false,
      'tiene_cuenta', exists (select 1 from public.players p where regexp_replace(coalesce(p.numero_cedula, ''), '\D', '', 'g') = e.cedula and p.user_id is not null)
    ) order by e.created_at), '[]'::jsonb)
    into r
  from public.equipo_duenos e where e.team_id = p_team_id;
  return r;
end;
$function$;

-- Agregar un dueño: admin, organizador de un torneo donde juega el equipo, o un dueño del equipo.
create or replace function public.equipo_dueno_agregar(p_team_id uuid, p_cedula text, p_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ced text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_nombre text := nullif(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), '');
begin
  if not public.puede_ver_datos_equipo(p_team_id) then raise exception 'No autorizado'; end if;
  if length(v_ced) < 5 or length(v_ced) > 15 then raise exception 'Escribe una cédula válida (solo números)'; end if;
  if public.es_cedula_duena(p_team_id, v_ced) then raise exception 'Esa persona ya es dueña de este equipo'; end if;
  if (select count(*) from public.equipo_duenos e where e.team_id = p_team_id) >= 6 then
    raise exception 'Un equipo puede tener máximo 7 dueños';
  end if;
  if v_nombre is null then
    select p.name into v_nombre from public.players p where regexp_replace(coalesce(p.numero_cedula, ''), '\D', '', 'g') = v_ced and p.name is not null limit 1;
  end if;
  if v_nombre is null then raise exception 'Esa cédula no está en Golmebol: escribe también su nombre completo'; end if;
  insert into public.equipo_duenos (team_id, cedula, nombre, agregado_por) values (p_team_id, v_ced, left(v_nombre, 80), auth.uid());
  return public.equipo_duenos_lista(p_team_id);
end;
$function$;

-- Quitar un dueño ADICIONAL (el principal se cambia desde los datos del equipo en el panel).
create or replace function public.equipo_dueno_quitar(p_team_id uuid, p_cedula text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ced text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
begin
  if not public.puede_ver_datos_equipo(p_team_id) then raise exception 'No autorizado'; end if;
  delete from public.equipo_duenos e where e.team_id = p_team_id and e.cedula = v_ced;
  if not found then raise exception 'Ese dueño no se puede quitar desde aquí (el principal se cambia en los datos del equipo)'; end if;
  return public.equipo_duenos_lista(p_team_id);
end;
$function$;

revoke all on function public._cedula_principal_equipo(uuid)               from public, anon, authenticated;
revoke all on function public.es_cedula_duena(uuid, text)                  from public, anon, authenticated;
revoke all on function public.soy_dueno_de_equipo(uuid)                    from public, anon;
revoke all on function public.es_representante_de_equipo(uuid)             from public, anon;
revoke all on function public.puede_ver_datos_equipo(uuid)                 from public, anon;
revoke all on function public.mis_equipos_dueno()                          from public, anon;
revoke all on function public.equipo_duenos_lista(uuid)                    from public, anon;
revoke all on function public.equipo_dueno_agregar(uuid, text, text)       from public, anon;
revoke all on function public.equipo_dueno_quitar(uuid, text)              from public, anon;
grant execute on function public.soy_dueno_de_equipo(uuid)                 to authenticated;
grant execute on function public.es_representante_de_equipo(uuid)          to authenticated;
grant execute on function public.puede_ver_datos_equipo(uuid)              to authenticated;
grant execute on function public.mis_equipos_dueno()                       to authenticated;
grant execute on function public.equipo_duenos_lista(uuid)                 to authenticated;
grant execute on function public.equipo_dueno_agregar(uuid, text, text)    to authenticated;
grant execute on function public.equipo_dueno_quitar(uuid, text)           to authenticated;
-- Estas dos se usan desde el link de registro (visitantes sin sesión): mismos permisos de antes
revoke all on function public.es_representante_equipo(text, text) from public;
grant execute on function public.es_representante_equipo(text, text) to anon, authenticated;
revoke all on function public.planilla_equipo_representante(text, uuid) from public, anon;
grant execute on function public.planilla_equipo_representante(text, uuid) to authenticated;
revoke all on function public.login_buscar_cedula(text) from public;
grant execute on function public.login_buscar_cedula(text) to anon, authenticated;

commit;

-- PRUEBA (opcional): con la sesión de un dueño en la app, la página de su equipo muestra "Dueños del equipo".
