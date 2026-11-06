-- =====================================================================
-- ROLLBACK DEL PASO 11C-B — vuelve al funcionamiento anterior
-- =====================================================================
-- Devuelve cédula, teléfono y token a las columnas de teams (otra vez visibles para cualquier sesión),
-- pone el trigger en modo A (solo copia) y restaura las 9 funciones como estaban.
-- Úsalo SOLO si el 11C-B causó un problema y hace falta volver atrás YA.
-- La tabla teams_privado se deja (no estorba).
-- =====================================================================
begin;

drop trigger if exists teams_sync_privado_trg on public.teams;

update public.teams t
set representante_cedula   = k.representante_cedula,
    representante_telefono = k.representante_telefono,
    registro_token         = k.registro_token
from public.teams_privado k
where k.team_id = t.id;

-- Trigger de vuelta al modo A (solo copia, no vacía nada)
create or replace function public.teams_sync_privado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.teams_privado (team_id) values (new.id) on conflict (team_id) do nothing;

  if tg_op = 'INSERT' then
    update public.teams_privado set
      representante_cedula   = new.representante_cedula,
      representante_telefono = new.representante_telefono,
      registro_token         = new.registro_token,
      updated_at = now()
    where team_id = new.id;
  else
    if new.representante_cedula is distinct from old.representante_cedula then
      update public.teams_privado set representante_cedula = new.representante_cedula, updated_at = now() where team_id = new.id;
    end if;
    if new.representante_telefono is distinct from old.representante_telefono then
      update public.teams_privado set representante_telefono = new.representante_telefono, updated_at = now() where team_id = new.id;
    end if;
    if new.registro_token is distinct from old.registro_token then
      update public.teams_privado set registro_token = new.registro_token, updated_at = now() where team_id = new.id;
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.teams_sync_privado() from public, anon, authenticated;

create trigger teams_sync_privado_trg
  before insert or update on public.teams
  for each row execute function public.teams_sync_privado();

drop function if exists public.buscar_dueno_equipo_por_cedula(text, uuid);

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
       from public.teams t
       join public.players p on p.user_id = auth.uid()
       where t.id = p_team
         and nullif(trim(t.representante_cedula), '') is not null
         and trim(p.numero_cedula) = trim(t.representante_cedula)
     );
$function$;

create or replace function public.es_representante_equipo(p_token text, p_cedula text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v teams%rowtype;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return false; end if;
  select * into v from teams where registro_token::text = trim(p_token) limit 1;
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
declare v teams%rowtype;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then return null; end if;
  select * into v from teams where registro_token::text = trim(p_token) limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'logo_url', v.logo_url,
    'representante_nombre', v.representante_nombre,
    'registro_token_horas', v.registro_token_horas,
    'registro_token_generado_en', v.registro_token_generado_en,
    'tiene_representante', nullif(trim(coalesce(v.representante_cedula, '')), '') is not null
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
  select name, representante_nombre, representante_telefono into v
  from teams
  where representante_cedula = trim(p_cedula) and representante_nombre is not null
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object('name', v.name, 'representante_nombre', v.representante_nombre, 'representante_telefono', v.representante_telefono);
end;
$function$;

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

  if j is null then
    select representante_nombre, representante_telefono into eq
    from public.teams
    where representante_cedula = ced and representante_nombre is not null
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
$function$;

create or replace function public.planilla_equipo_representante(p_token text, p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_team teams%rowtype;
  v_ced text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Debes iniciar sesión';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is null then raise exception 'Link inválido'; end if;
  select * into v_team from teams where registro_token::text = trim(p_token) limit 1;
  if not found then raise exception 'Link inválido'; end if;

  v_ced := nullif(trim(coalesce(v_team.representante_cedula, '')), '');
  if v_ced is null then raise exception 'Este equipo no tiene un dueño registrado'; end if;

  v_ok := v_email = lower(v_ced) || '@golmebol.com'
       or exists (select 1 from players p where p.user_id = auth.uid() and trim(coalesce(p.numero_cedula, '')) = v_ced);
  if not v_ok then raise exception 'Solo el dueño del equipo puede descargar la planilla'; end if;

  return public._planilla_equipo_datos(v_team.id, p_tournament_id);
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
begin
  if v_token is null or v_token = '' then raise exception 'Token inválido'; end if;
  if v_cedula is null or v_cedula = '' then raise exception 'Cédula obligatoria'; end if;
  if p_tournament_id is null then raise exception 'Torneo obligatorio'; end if;

  -- Equipo del link (cast defensivo: teams.registro_token puede estar
  -- creado como uuid en la base, no como texto).
  begin
    select * into v_equipo from teams where registro_token::text = v_token limit 1;
  exception when others then
    raise exception 'Paso "buscar equipo": %', sqlerrm;
  end;
  if not found then raise exception 'Link de registro inválido (equipo)'; end if;

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
