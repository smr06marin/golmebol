-- ============================================================
-- MIGRACIÓN: quitar el código de confirmación por WhatsApp del
-- registro de jugadores, pedir siempre fecha de nacimiento (incluso
-- en registro simple) y guardar la autorización de un adulto
-- responsable cuando el jugador es menor de edad.
--
-- De paso, esta migración también corrige un problema que quedó de
-- una migración anterior (migracion_deuda_inscripcion_organizador.sql):
-- esa migración reescribió por completo la función registrar_equipo()
-- basándose en una versión vieja, y sin querer BORRÓ dos arreglos que
-- ya estaban aplicados:
--   1) el registro "simple" (torneos internacionales) volvió a exigir
--      teléfono/ciudad/género aunque el organizador lo tenga desactivado,
--   2) se perdieron los casteos defensivos (::text) que evitaban el
--      error "operator does not exist: uuid = text" al buscar el
--      equipo/torneo/jugador.
-- Esta migración deja todo eso corregido de nuevo, junto con lo nuevo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- Guarda si el registro de este jugador en este torneo/equipo se hizo
-- con autorización de un adulto responsable (jugador menor de edad).
alter table tournament_player_registrations add column if not exists autorizacion_menor boolean default false;

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
  p_posicion_futbol11 text default null,
  p_autorizacion_menor boolean default false
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

  -- Link vencido (24h desde registro_token_generado_en)
  if v_equipo.registro_token_generado_en is not null
     and v_equipo.registro_token_generado_en < now() - interval '24 hours' then
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
    v_sanc := public.jugador_sancion_activa(v_player.id);
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

  -- Inscripción al torneo
  begin
    insert into tournament_player_registrations (tournament_id, team_id, player_id, activo, autorizacion_menor)
    values (p_tournament_id, v_equipo.id, v_player.id, true, coalesce(p_autorizacion_menor, false));
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
$$;

revoke all on function public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text, boolean) from public;
grant execute on function public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text, boolean) to anon, authenticated;

-- Como el registro ahora siempre puede mandar p_autorizacion_menor, la
-- versión vieja de la función (con 11 parámetros, sin ese último) queda
-- huérfana — se borra para que no queden dos versiones compitiendo.
drop function if exists public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text);
