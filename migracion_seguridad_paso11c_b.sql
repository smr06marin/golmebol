-- =====================================================================
-- PASO 11C-B — Vaciar cédula/teléfono/token de la tabla pública "teams" y usar solo la privada
-- =====================================================================
-- CORRER SOLO CUANDO:
--   1) migracion_seguridad_paso11c_a.sql ya está corrida y probada, y
--   2) los cambios de la app (equiposPrivado.js y las 7 pantallas) ya están SUBIDOS Y DESPLEGADOS.
--      (Una persona con la app abierta desde antes verá vacíos esos datos hasta que recargue.)
--
-- QUÉ HACE:
--   1) Confirma que la copia privada está completa (si falta algo, se detiene y no cambia nada).
--   2) El trigger de teams pasa a "modo B": cuando la app guarda cédula/teléfono/token, lo manda a
--      la tabla privada y deja vacía la columna pública. Un valor en blanco NUNCA borra el dato guardado.
--   3) Vacía las 3 columnas en teams.
--   4) Reescribe las 8 funciones que leían esas columnas para que lean la tabla privada.
--   5) Crea buscar_dueno_equipo_por_cedula (solo organizadores/admin), para el autocompletado.
-- Una sola transacción: si algo falla, no queda nada a medias.
-- =====================================================================
begin;

-- 0) Seguridad: la columna del token debe poder quedar vacía
alter table public.teams alter column registro_token drop not null;

-- 1) Verificar que la copia privada está completa
do $$
declare v_falta int;
begin
  select count(*) into v_falta
  from public.teams t
  left join public.teams_privado k on k.team_id = t.id
  where k.team_id is null
     or (t.representante_cedula  is not null and k.representante_cedula  is distinct from t.representante_cedula)
     or (t.representante_telefono is not null and k.representante_telefono is distinct from t.representante_telefono)
     or (t.registro_token        is not null and k.registro_token        is distinct from t.registro_token);
  if v_falta > 0 then
    raise exception 'La copia privada no está completa (% equipos). No se cambió nada. Corre primero el paso 11C-A.', v_falta;
  end if;
end $$;

-- 2) Trigger en modo B
create or replace function public.teams_sync_privado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.teams_privado (team_id) values (new.id) on conflict (team_id) do nothing;

  if nullif(btrim(coalesce(new.representante_cedula, '')), '') is not null then
    update public.teams_privado set representante_cedula = btrim(new.representante_cedula), updated_at = now() where team_id = new.id;
  end if;
  if nullif(btrim(coalesce(new.representante_telefono, '')), '') is not null then
    update public.teams_privado set representante_telefono = btrim(new.representante_telefono), updated_at = now() where team_id = new.id;
  end if;
  if new.registro_token is not null then
    update public.teams_privado set registro_token = new.registro_token, updated_at = now() where team_id = new.id;
  end if;

  new.representante_cedula   := null;
  new.representante_telefono := null;
  new.registro_token         := null;
  return new;
end;
$function$;
revoke all on function public.teams_sync_privado() from public, anon, authenticated;

-- 3) Vaciar las columnas públicas (el trigger no interfiere: ya está todo copiado)
update public.teams
set representante_cedula = null, representante_telefono = null, registro_token = null
where representante_cedula is not null or representante_telefono is not null or registro_token is not null;

-- 4) Funciones que leían esas columnas ---------------------------------

create or replace function public.es_representante_de_equipo(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.teams_privado k
       join public.players p on p.user_id = auth.uid()
       where k.team_id = p_team
         and nullif(trim(k.representante_cedula), '') is not null
         and trim(p.numero_cedula) = trim(k.representante_cedula)
     );
$function$;

create or replace function public.es_representante_equipo(p_token text, p_cedula text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v teams_privado%rowtype;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return false; end if;
  select * into v from teams_privado where registro_token::text = trim(p_token) limit 1;
  if not found then return false; end if;
  if nullif(trim(coalesce(v.representante_cedula, '')), '') is null then return true; end if;
  return trim(v.representante_cedula) = trim(coalesce(p_cedula, ''));
end;
$function$;

create or replace function public.info_registro_equipo(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v teams%rowtype; k teams_privado%rowtype;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return null; end if;
  select * into k from teams_privado where registro_token::text = trim(p_token) limit 1;
  if not found then return null; end if;
  select * into v from teams where id = k.team_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'logo_url', v.logo_url,
    'representante_nombre', v.representante_nombre,
    'registro_token_horas', v.registro_token_horas,
    'registro_token_generado_en', v.registro_token_generado_en,
    'tiene_representante', nullif(trim(coalesce(k.representante_cedula, '')), '') is not null
  );
end;
$function$;

create or replace function public.dueno_equipo_por_cedula(p_cedula text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v record;
begin
  if nullif(trim(coalesce(p_cedula, '')), '') is null then return null; end if;
  select t.name, t.representante_nombre, k.representante_telefono into v
  from teams_privado k
  join teams t on t.id = k.team_id
  where k.representante_cedula = trim(p_cedula) and t.representante_nombre is not null
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object('name', v.name, 'representante_nombre', v.representante_nombre, 'representante_telefono', v.representante_telefono);
end;
$function$;

-- Autocompletado del organizador: dueño de OTRO equipo con esa cédula (solo organizadores y admin)
create or replace function public.buscar_dueno_equipo_por_cedula(p_cedula text, p_excluir uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v record;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not (
       coalesce(public.es_admin_plataforma(), false)
    or coalesce(public.es_organizador_plataforma(), false)
    or exists (select 1 from public.tournaments t where t.organizador_id = auth.uid())
  ) then
    raise exception 'No autorizado';
  end if;
  if nullif(trim(coalesce(p_cedula, '')), '') is null then return null; end if;
  select t.representante_nombre, k.representante_telefono into v
  from public.teams_privado k
  join public.teams t on t.id = k.team_id
  where k.representante_cedula = trim(p_cedula)
    and t.representante_nombre is not null
    and (p_excluir is null or t.id <> p_excluir)
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object('representante_nombre', v.representante_nombre, 'representante_telefono', v.representante_telefono);
end;
$function$;
revoke all on function public.buscar_dueno_equipo_por_cedula(text, uuid) from public, anon;
grant execute on function public.buscar_dueno_equipo_por_cedula(text, uuid) to authenticated;

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

  -- ¿Es dueño (representante) de un equipo sin perfil de jugador? Se le crea uno mínimo.
  if j is null then
    select t.representante_nombre, k.representante_telefono into eq
    from public.teams_privado k
    join public.teams t on t.id = k.team_id
    where k.representante_cedula = ced and t.representante_nombre is not null
    limit 1;
    if found then
      insert into public.players (name, telefono, numero_cedula, rol, activo_membresia, primer_ingreso, fecha_registro)
      values (eq.representante_nombre, eq.representante_telefono, ced, 'jugador', true, true, now());
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

create or replace function public.finanzas_accesos_resumen(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      'tiene_cedula', regexp_replace(coalesce(kp.representante_cedula, ''), '\D', '', 'g') <> '',
      'ingresos', coalesce(ac.ingresos, 0),
      'primero', ac.primero,
      'ultimo', ac.ultimo,
      'fallidos_24h', coalesce(ac.fallidos, 0),
      'recientes', coalesce(ac.recientes, '[]'::jsonb)
    ) order by t.name)
    from tournament_teams tt
    join teams t on t.id = tt.team_id
    left join teams_privado kp on kp.team_id = t.id
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
$function$;

-- finanzas_equipo_ver: SOLO cambia de dónde sale la cédula real del representante
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

  select representante_cedula into v_ced_real from teams_privado where team_id = p_team_id;
  v_ced_real := regexp_replace(coalesce(v_ced_real, ''), '\D', '', 'g');
  v_ced_in   := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');

  if v_ced_real = '' then
    return jsonb_build_object('ok', false, 'error', 'sin_cedula');
  end if;
  if v_ced_in = '' or v_ced_in <> v_ced_real then
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

create or replace function public.planilla_equipo_representante(p_token text, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_team_id uuid;
  v_ced text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Debes iniciar sesión';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is null then raise exception 'Link inválido'; end if;
  select k.team_id, k.representante_cedula into v_team_id, v_ced
  from teams_privado k where k.registro_token::text = trim(p_token) limit 1;
  if v_team_id is null then raise exception 'Link inválido'; end if;

  v_ced := nullif(trim(coalesce(v_ced, '')), '');
  if v_ced is null then raise exception 'Este equipo no tiene un dueño registrado'; end if;

  v_ok := v_email = lower(v_ced) || '@golmebol.com'
       or exists (select 1 from players p where p.user_id = auth.uid() and trim(coalesce(p.numero_cedula, '')) = v_ced);
  if not v_ok then raise exception 'Solo el dueño del equipo puede descargar la planilla'; end if;

  return public._planilla_equipo_datos(v_team_id, p_tournament_id);
end;
$function$;

-- registrar_equipo: SOLO cambia la búsqueda del equipo por token y el chequeo de vencimiento
create or replace function public.registrar_equipo(
  p_token text, p_tournament_id uuid, p_cedula text,
  p_name text default null, p_telefono text default null, p_city text default null,
  p_genero text default null, p_fecha_nacimiento date default null,
  p_posicion_futbol5 text default null, p_posicion_futbol7 text default null,
  p_posicion_futbol11 text default null, p_autorizacion_menor boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token   text := trim(p_token);
  v_cedula  text := trim(p_cedula);
  v_equipo  teams%rowtype;
  v_torneo  tournaments%rowtype;
  v_player  players%rowtype;
  v_creado  boolean := false;
  v_digitos text;
  v_choque  record;
  v_deuda   jsonb;
  v_sanc    jsonb;
  v_es_menor boolean;
  v_team_id uuid;
begin
  if v_token is null or v_token = '' then raise exception 'Token inválido'; end if;
  if v_cedula is null or v_cedula = '' then raise exception 'Cédula obligatoria'; end if;
  if p_tournament_id is null then raise exception 'Torneo obligatorio'; end if;

  -- Equipo del link (el token ahora vive en la tabla privada)
  begin
    select k.team_id into v_team_id from teams_privado k where k.registro_token::text = v_token limit 1;
    if v_team_id is not null then
      select * into v_equipo from teams where id = v_team_id;
    end if;
  exception when others then
    raise exception 'Paso "buscar equipo": %', sqlerrm;
  end;
  if v_equipo.id is null then raise exception 'Link de registro inválido (equipo)'; end if;

  -- Torneo abierto / existente
  begin
    select * into v_torneo from tournaments where id = p_tournament_id limit 1;
  exception when others then
    raise exception 'Paso "buscar torneo": %', sqlerrm;
  end;
  if not found then raise exception 'Torneo no encontrado'; end if;

  -- Equipo debe estar inscrito en ese torneo (cast defensivo)
  begin
    if not exists (
      select 1 from tournament_teams
      where tournament_id::text = p_tournament_id::text and team_id::text = v_equipo.id::text
    ) then
      raise exception 'El equipo no pertenece a este torneo';
    end if;
  exception when others then
    if sqlerrm like 'El equipo no pertenece%' then raise; end if;
    raise exception 'Paso "verificar equipo en torneo": %', sqlerrm;
  end;

  -- Link vencido (según registro_token_horas del equipo — 1, 2 o 3 días
  -- elegidos al compartirlo; si no hay nada guardado, se asume 24h)
  if v_equipo.registro_token_generado_en is not null
     and v_equipo.registro_token_generado_en < now() - (coalesce(v_equipo.registro_token_horas, 24) || ' hours')::interval then
    raise exception 'Link de registro vencido';
  end if;

  -- Buscar o crear jugador
  begin
    select * into v_player from players where numero_cedula = v_cedula limit 1;
  exception when others then
    raise exception 'Paso "buscar jugador por documento": %', sqlerrm;
  end;

  if not found then
    -- Obligatorios SIEMPRE, sea registro simple o completo.
    if nullif(trim(p_name), '') is null then raise exception 'El nombre es obligatorio'; end if;
    if coalesce(p_posicion_futbol5, '') = ''
       and coalesce(p_posicion_futbol7, '') = ''
       and coalesce(p_posicion_futbol11, '') = '' then
      raise exception 'Selecciona al menos una posición';
    end if;
    if p_fecha_nacimiento is null then raise exception 'La fecha de nacimiento es obligatoria'; end if;

    -- Menor de edad: hace falta la autorización de un adulto responsable.
    v_es_menor := p_fecha_nacimiento > (current_date - interval '18 years')::date;
    if v_es_menor and not coalesce(p_autorizacion_menor, false) then
      raise exception 'Falta la autorización de un adulto responsable para el jugador menor de edad';
    end if;

    -- Registro simple (torneos internacionales/de paso): sin teléfono,
    -- ciudad ni género obligatorios.
    if not coalesce(v_torneo.registro_simple, false) then
      if nullif(trim(p_telefono), '') is null then raise exception 'El teléfono es obligatorio'; end if;
      if nullif(trim(p_city), '') is null then raise exception 'La ciudad es obligatoria'; end if;
      if nullif(trim(p_genero), '') is null then raise exception 'El género es obligatorio'; end if;
    end if;

    -- WhatsApp único (últimos 10 dígitos) — solo si vino teléfono
    if nullif(trim(coalesce(p_telefono, '')), '') is not null then
      begin
        v_digitos := right(regexp_replace(p_telefono, '\D', '', 'g'), 10);
        if length(v_digitos) = 10 then
          select id, name into v_choque
          from players
          where right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = v_digitos
             or right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 10) = v_digitos
          limit 1;
          if found then
            raise exception 'Ese número de WhatsApp ya está registrado con otro jugador (%).', v_choque.name;
          end if;
        end if;
      exception when others then
        if sqlerrm like 'Ese número de WhatsApp%' then raise; end if;
        raise exception 'Paso "verificar whatsapp duplicado": %', sqlerrm;
      end;
    end if;

    begin
      insert into players (
        name, telefono, city, genero, fecha_nacimiento,
        posicion_futbol5, posicion_futbol7, posicion_futbol11,
        numero_cedula, activo_membresia, fecha_registro
      ) values (
        trim(p_name),
        nullif(trim(coalesce(p_telefono, '')), ''),
        nullif(trim(coalesce(p_city, '')), ''),
        nullif(trim(coalesce(p_genero, '')), ''),
        p_fecha_nacimiento,
        nullif(p_posicion_futbol5, ''), nullif(p_posicion_futbol7, ''), nullif(p_posicion_futbol11, ''),
        v_cedula, true, now()
      )
      returning * into v_player;
    exception when others then
      raise exception 'Paso "insertar jugador nuevo": %', sqlerrm;
    end;

    v_creado := true;
  end if;

  -- Ya en este torneo (cast defensivo)
  begin
    if exists (
      select 1 from tournament_player_registrations
      where tournament_id::text = p_tournament_id::text
        and player_id::text = v_player.id::text
        and activo = true
    ) then
      raise exception 'Ya estás registrado en este torneo';
    end if;
  exception when others then
    if sqlerrm like 'Ya estás registrado%' then raise; end if;
    raise exception 'Paso "verificar ya inscrito": %', sqlerrm;
  end;

  -- Sanción / deuda bloquean inscripción
  begin
    v_sanc := public.jugador_sancion_activa(v_player.id, p_tournament_id);
    if (v_sanc->>'sancionado')::boolean then
      raise exception 'Jugador sancionado: no puede inscribirse';
    end if;
  exception when others then
    if sqlerrm like 'Jugador sancionado%' then raise; end if;
    raise exception 'Paso "verificar sanción": %', sqlerrm;
  end;

  begin
    v_deuda := public.jugador_tiene_deuda(v_player.id, p_tournament_id);
    if (v_deuda->>'tiene_deuda')::boolean then
      raise exception 'Jugador con deuda pendiente en este organizador: no puede inscribirse';
    end if;
  exception when others then
    if sqlerrm like 'Jugador con deuda%' then raise; end if;
    raise exception 'Paso "verificar deuda": %', sqlerrm;
  end;

  -- Inscripción al torneo — UPSERT: si ya existía una fila (activa o no)
  -- para este torneo+equipo+jugador (por ejemplo porque antes lo sacaron
  -- del equipo, lo que solo pone activo=false sin borrar la fila), la
  -- reactiva en vez de chocar contra la restricción única con un error feo.
  begin
    insert into tournament_player_registrations (tournament_id, team_id, player_id, activo, autorizacion_menor)
    values (p_tournament_id, v_equipo.id, v_player.id, true, coalesce(p_autorizacion_menor, false))
    on conflict (tournament_id, team_id, player_id)
    do update set activo = true, autorizacion_menor = excluded.autorizacion_menor;
  exception when others then
    raise exception 'Paso "inscribir en torneo": %', sqlerrm;
  end;

  -- Relación base equipo ↔ jugador (cast defensivo)
  begin
    if not exists (
      select 1 from team_players
      where team_id::text = v_equipo.id::text and player_id::text = v_player.id::text
    ) then
      insert into team_players (team_id, player_id, activo)
      values (v_equipo.id, v_player.id, true);
    end if;
  exception when others then
    raise exception 'Paso "vincular jugador al equipo": %', sqlerrm;
  end;

  return jsonb_build_object(
    'player_id', v_player.id,
    'creado', v_creado,
    'name', v_player.name,
    'requiere_cedula', coalesce(v_torneo.requiere_cedula, true),
    'registro_simple', coalesce(v_torneo.registro_simple, false),
    'tiene_cedula_frontal', v_player.cedula_frontal_url is not null,
    'tiene_cedula_trasera', v_player.cedula_trasera_url is not null
  );
end;
$function$;

commit;

-- =====================================================================
-- PRUEBAS (cada una por separado)
-- =====================================================================
-- A) Ya no hay datos privados en teams (debe dar 0, 0, 0):
--    select count(*) filter (where representante_cedula is not null) as cedulas,
--           count(*) filter (where representante_telefono is not null) as telefonos,
--           count(*) filter (where registro_token is not null) as tokens
--    from public.teams;
-- B) Siguen en la tabla privada (números mayores que 0):
--    select count(*) filter (where representante_cedula is not null) as cedulas,
--           count(*) filter (where representante_telefono is not null) as telefonos,
--           count(*) filter (where registro_token is not null) as tokens
--    from public.teams_privado;
-- C) Un visitante y una sesión anónima NO ven la cédula de nadie (ya no existe en teams; debe dar 0):
--    begin; set local role anon; select count(*) from public.teams where representante_cedula is not null; rollback;
-- D) Guardar un equipo sigue funcionando y la cédula NO queda en teams (debe mostrar: ERROR: RESULTADO: cedula_en_teams=<NULL> privada=999 —
--    el error es a propósito, deshace la prueba):
--    do $$ declare v_id uuid; a text; b text;
--    begin
--      select id into v_id from public.teams limit 1;
--      update public.teams set representante_cedula = '999' where id = v_id;
--      select representante_cedula into a from public.teams where id = v_id;
--      select representante_cedula into b from public.teams_privado where team_id = v_id;
--      raise exception 'RESULTADO: cedula_en_teams=% privada=%', coalesce(a, '<NULL>'), b;
--    end $$;
-- E) El login sigue encontrando cédulas (con una cédula inexistente debe dar {"encontrado": false}):
--    begin; set local role anon; select public.login_buscar_cedula('0000000001'); rollback;
-- F) En la web (lo que no puede fallar):
--    1. Login de un jugador/dueño con su cédula: reconocida y sigue el flujo.
--    2. Admin > Equipos > editar un equipo: la cédula y el teléfono del dueño se ven; guardar sin tocarlos no los borra.
--    3. Admin > detalle de un equipo: se ve "Dueño: ... · cédula" y el botón de link de registro funciona.
--    4. Torneo > equipos > "Enviar link de registro": copiar el link y abrirlo en ventana privada; debe cargar el registro del equipo.
--    5. Un link de registro repartido ANTES sigue abriendo.
--    6. Link de finanzas de equipos: escoger equipo y entrar con la cédula del representante.
--    7. Home del dueño de un equipo: sigue viendo "sus" equipos.
-- ROLLBACK: rollback_seguridad_paso11c_b.sql
