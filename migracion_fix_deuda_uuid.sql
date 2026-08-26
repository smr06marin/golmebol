-- ============================================================
-- FIX: error "operator does not exist: uuid = text" al registrarse
-- (botón "Registrarme en Golmebol")
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Causa probable: al agregar el segundo parámetro (p_tournament_id) a
-- jugador_tiene_deuda con "create or replace", Postgres NO reemplaza la
-- función vieja de 1 solo parámetro — la deja viva al lado de la nueva
-- (dos funciones con el mismo nombre y distinta firma). Este archivo borra
-- la vieja explícitamente y vuelve a crear todo con casts explícitos a
-- uuid, para no dejar ninguna ambigüedad.
-- ============================================================

drop function if exists public.jugador_tiene_deuda(uuid);

create or replace function public.jugador_tiene_deuda(p_player_id uuid, p_tournament_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_concepto text;
  v_organizador_destino uuid;
begin
  if p_player_id is null then
    return jsonb_build_object('tiene_deuda', false, 'total', 0);
  end if;

  if p_tournament_id is not null then
    select t2.organizador_id into v_organizador_destino
    from tournaments t2
    where t2.id = p_tournament_id;
  end if;

  select coalesce(sum(tf.monto), 0),
         (array_agg(tf.concepto order by tf.created_at desc) filter (where tf.concepto is not null))[1]
    into v_total, v_concepto
  from torneo_finanzas tf
  join tournaments t on t.id = tf.tournament_id
  where tf.player_id = p_player_id
    and tf.tipo = 'deuda_personal'
    and tf.pagado = false
    and (
      p_tournament_id is null
      or (t.organizador_id is null and v_organizador_destino is null)
      or t.organizador_id = v_organizador_destino
    );

  if coalesce(v_total, 0) > 0 then
    return jsonb_build_object(
      'tiene_deuda', true,
      'total', v_total,
      'concepto', coalesce(v_concepto, 'un torneo anterior de este organizador')
    );
  end if;

  return jsonb_build_object('tiene_deuda', false, 'total', 0);
end;
$$;

revoke all on function public.jugador_tiene_deuda(uuid, uuid) from public;
grant execute on function public.jugador_tiene_deuda(uuid, uuid) to anon, authenticated;

-- Se vuelve a crear registrar_equipo también, por si el script anterior se
-- había cortado a mitad de camino y esta parte no llegó a aplicarse.
create or replace function public.registrar_equipo(
  p_token text,
  p_tournament_id uuid,
  p_cedula text,
  p_name text default null,
  p_telefono text default null,
  p_city text default null,
  p_genero text default null,
  p_fecha_nacimiento date default null,
  p_posicion_futbol5 text default null,
  p_posicion_futbol7 text default null,
  p_posicion_futbol11 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
begin
  if v_token is null or v_token = '' then raise exception 'Token inválido'; end if;
  if v_cedula is null or v_cedula = '' then raise exception 'Cédula obligatoria'; end if;
  if p_tournament_id is null then raise exception 'Torneo obligatorio'; end if;

  select * into v_equipo from teams where registro_token = v_token limit 1;
  if not found then raise exception 'Link de registro inválido (equipo)'; end if;

  select * into v_torneo from tournaments where id = p_tournament_id limit 1;
  if not found then raise exception 'Torneo no encontrado'; end if;

  if not exists (
    select 1 from tournament_teams
    where tournament_id = p_tournament_id and team_id = v_equipo.id
  ) then
    raise exception 'El equipo no pertenece a este torneo';
  end if;

  if v_equipo.registro_token_generado_en is not null
     and v_equipo.registro_token_generado_en < now() - interval '24 hours' then
    raise exception 'Link de registro vencido';
  end if;

  select * into v_player from players where numero_cedula = v_cedula limit 1;

  if not found then
    if nullif(trim(p_name), '') is null then raise exception 'El nombre es obligatorio'; end if;
    if nullif(trim(p_telefono), '') is null then raise exception 'El teléfono es obligatorio'; end if;
    if nullif(trim(p_city), '') is null then raise exception 'La ciudad es obligatoria'; end if;
    if nullif(trim(p_genero), '') is null then raise exception 'El género es obligatorio'; end if;
    if p_fecha_nacimiento is null then raise exception 'La fecha de nacimiento es obligatoria'; end if;
    if coalesce(p_posicion_futbol5, '') = ''
       and coalesce(p_posicion_futbol7, '') = ''
       and coalesce(p_posicion_futbol11, '') = '' then
      raise exception 'Selecciona al menos una posición';
    end if;

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

    insert into players (
      name, telefono, city, genero, fecha_nacimiento,
      posicion_futbol5, posicion_futbol7, posicion_futbol11,
      numero_cedula, activo_membresia, fecha_registro
    ) values (
      trim(p_name), trim(p_telefono), trim(p_city), trim(p_genero), p_fecha_nacimiento,
      nullif(p_posicion_futbol5, ''), nullif(p_posicion_futbol7, ''), nullif(p_posicion_futbol11, ''),
      v_cedula, true, now()
    )
    returning * into v_player;

    v_creado := true;
  end if;

  if exists (
    select 1 from tournament_player_registrations
    where tournament_id = p_tournament_id
      and player_id = v_player.id
      and activo = true
  ) then
    raise exception 'Ya estás registrado en este torneo';
  end if;

  v_sanc := public.jugador_sancion_activa(v_player.id);
  if (v_sanc->>'sancionado')::boolean then
    raise exception 'Jugador sancionado: no puede inscribirse';
  end if;

  v_deuda := public.jugador_tiene_deuda(v_player.id, p_tournament_id);
  if (v_deuda->>'tiene_deuda')::boolean then
    raise exception 'Jugador con deuda pendiente en este organizador: no puede inscribirse';
  end if;

  insert into tournament_player_registrations (tournament_id, team_id, player_id, activo)
  values (p_tournament_id, v_equipo.id, v_player.id, true);

  if not exists (
    select 1 from team_players
    where team_id = v_equipo.id and player_id = v_player.id
  ) then
    insert into team_players (team_id, player_id, activo)
    values (v_equipo.id, v_player.id, true);
  end if;

  return jsonb_build_object(
    'player_id', v_player.id,
    'creado', v_creado,
    'name', v_player.name,
    'requiere_cedula', coalesce(v_torneo.requiere_cedula, true),
    'tiene_cedula_frontal', v_player.cedula_frontal_url is not null,
    'tiene_cedula_trasera', v_player.cedula_trasera_url is not null
  );
end;
$$;

revoke all on function public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text) from public;
grant execute on function public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text) to anon, authenticated;
