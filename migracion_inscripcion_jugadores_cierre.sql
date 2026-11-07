-- =====================================================================
-- INSCRIPCIÓN DE JUGADORES: FECHA DE CIERRE + CUPO CON CANDADO EN EL SERVIDOR
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Se puede correr más de una vez.
--
-- Qué hace:
--  1) Cada torneo puede decir hasta cuándo se inscriben jugadores:
--        'sin_limite'  → como siempre (no cambia nada para los torneos que ya existen)
--        'fecha'       → hasta el día que escriba el organizador (todo ese día, hora de Colombia)
--        'fase_grupos' → hasta que empiecen las eliminatorias (se cierra solo al crear la primera llave)
--  2) El dueño (representante) de un equipo puede inscribir y quitar jugadores desde su perfil,
--     SIN pasarse del «Límite de jugadores por equipo» del torneo y SOLO mientras la inscripción esté abierta.
--     Esto lo vigila la BASE DE DATOS (no solo la pantalla), así que no se puede saltar.
--     También aplica a quien se registra por link. NO aplica al organizador del torneo, al admin ni a quien
--     planilla: ellos pueden dar un cupo extra o corregir una lista cerrada.
--  3) dueno_inscribir_jugador_nuevo(...): el dueño inscribe a una persona NUEVA (pide lo mismo que el link de registro:
--     cédula, nombre, posición, nacimiento, teléfono, ciudad y género; las fotos las sube la pantalla) sin pedirle un link al organizador. Hace las mismas revisiones que el link de registro
--     (sanción, deuda, vetado, ya inscrito, WhatsApp repetido, menor de edad).
--  4) inscripcion_jugadores_estado(torneo, equipo): lo que muestra el perfil del equipo (abierta o cerrada, cupo).
--
-- Los torneos que no configuren nada siguen exactamente igual.
-- ROLLBACK al final del archivo.
-- =====================================================================

-- 1. Configuración del torneo -------------------------------------------
alter table public.tournaments add column if not exists inscripcion_jugadores_modo  text not null default 'sin_limite';
alter table public.tournaments add column if not exists inscripcion_jugadores_hasta date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournaments_inscripcion_jugadores_modo_check') then
    alter table public.tournaments add constraint tournaments_inscripcion_jugadores_modo_check
      check (inscripcion_jugadores_modo in ('sin_limite', 'fecha', 'fase_grupos'));
  end if;
end $$;

-- 2. ¿Está cerrada la inscripción? (null = abierta; si no, el motivo en palabras) -------------
create or replace function public.inscripcion_jugadores_cierre(p_tournament uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_modo  text;
  v_hasta date;
begin
  select t.inscripcion_jugadores_modo, t.inscripcion_jugadores_hasta into v_modo, v_hasta
  from public.tournaments t where t.id = p_tournament;
  if not found then return null; end if;

  if v_modo = 'fecha' and v_hasta is not null and (now() at time zone 'America/Bogota')::date > v_hasta then
    return 'La inscripción de jugadores cerró el ' || to_char(v_hasta, 'DD/MM/YYYY') || '. Si necesitas un cambio, habla con el organizador del torneo.';
  end if;
  if v_modo = 'fase_grupos' and exists (
       select 1 from public.matches m where m.tournament_id = p_tournament and coalesce(m.fase, 'grupo') <> 'grupo') then
    return 'La inscripción de jugadores cerró porque el torneo ya llegó a las eliminatorias. Si necesitas un cambio, habla con el organizador del torneo.';
  end if;
  return null;
end $$;
revoke all on function public.inscripcion_jugadores_cierre(uuid) from public;
grant execute on function public.inscripcion_jugadores_cierre(uuid) to anon, authenticated;

-- 3. Quién puede saltarse el cierre y el cupo (organizador, admin, quien planilla) -------------
create or replace function public.es_staff_inscripcion(p_tournament uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  if coalesce(public.es_admin_plataforma(), false)
     or coalesce(public.es_organizador_plataforma(), false)
     or coalesce(public.es_dueno_torneo(p_tournament), false) then
    return true;
  end if;
  return exists (select 1 from public.matches m
                 where m.tournament_id = p_tournament and coalesce(public.puede_planillar_partido(m.id), false));
end $$;
revoke all on function public.es_staff_inscripcion(uuid) from public;
grant execute on function public.es_staff_inscripcion(uuid) to authenticated;

-- 4. Candado en la tabla de inscripciones -------------------------------------
create or replace function public.tpr_controlar_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activar boolean := false;
  v_quitar  boolean := false;
  v_modo    text;
  v_limite  integer;
  v_motivo  text;
  v_usados  integer;
begin
  if tg_op = 'INSERT' then
    v_activar := coalesce(new.activo, true);
  elsif coalesce(old.activo, true) = false and coalesce(new.activo, true) = true then
    v_activar := true;
  elsif coalesce(old.activo, true) = true and coalesce(new.activo, true) = false then
    v_quitar := true;
  end if;
  if not v_activar and not v_quitar then return new; end if;

  select t.inscripcion_jugadores_modo, t.limite_jugadores_equipo into v_modo, v_limite
  from public.tournaments t where t.id = new.tournament_id;
  -- Torneo sin fecha de cierre y sin cupo: no se revisa nada (todo como antes)
  if coalesce(v_modo, 'sin_limite') = 'sin_limite' and v_limite is null then return new; end if;

  if public.es_staff_inscripcion(new.tournament_id) then return new; end if;

  v_motivo := public.inscripcion_jugadores_cierre(new.tournament_id);
  if v_motivo is not null then raise exception '%', v_motivo; end if;

  if v_activar and v_limite is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.tournament_id::text || ':' || new.team_id::text, 0));
    select count(*) into v_usados
    from public.tournament_player_registrations r
    where r.tournament_id = new.tournament_id and r.team_id = new.team_id
      and r.activo = true and r.player_id <> new.player_id;
    if v_usados >= v_limite then
      raise exception 'El equipo ya llegó al límite de % jugadores de este torneo. Quita a alguien para inscribir a otro, o pídele al organizador un cupo extra.', v_limite;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tpr_controlar_inscripcion on public.tournament_player_registrations;
create trigger tpr_controlar_inscripcion
  before insert or update on public.tournament_player_registrations
  for each row execute function public.tpr_controlar_inscripcion();

-- 5. Estado que muestra el perfil del equipo ----------------------------------
create or replace function public.inscripcion_jugadores_estado(p_tournament uuid, p_team uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_t       record;
  v_motivo  text;
  v_usados  integer := null;
begin
  select t.inscripcion_jugadores_modo as modo, t.inscripcion_jugadores_hasta as hasta, t.limite_jugadores_equipo as limite
    into v_t from public.tournaments t where t.id = p_tournament;
  if not found then return null; end if;
  v_motivo := public.inscripcion_jugadores_cierre(p_tournament);
  if p_team is not null then
    select count(*) into v_usados from public.tournament_player_registrations r
    where r.tournament_id = p_tournament and r.team_id = p_team and r.activo = true;
  end if;
  return jsonb_build_object(
    'modo', coalesce(v_t.modo, 'sin_limite'), 'hasta', v_t.hasta, 'limite', v_t.limite,
    'abierta', v_motivo is null, 'motivo', v_motivo, 'usados', v_usados);
end $$;
revoke all on function public.inscripcion_jugadores_estado(uuid, uuid) from public;
grant execute on function public.inscripcion_jugadores_estado(uuid, uuid) to anon, authenticated;

-- 6. El dueño del equipo inscribe a una persona NUEVA -----------------------------
-- Versión anterior (7 parámetros): se reemplaza por la que pide los mismos datos que el link de registro.
drop function if exists public.dueno_inscribir_jugador_nuevo(uuid, uuid, text, text, text, date, boolean);

create or replace function public.dueno_inscribir_jugador_nuevo(
  p_tournament_id uuid,
  p_team_id uuid,
  p_cedula text,
  p_name text default null,
  p_telefono text default null,
  p_fecha_nacimiento date default null,
  p_autorizacion_menor boolean default false,
  p_city text default null,
  p_genero text default null,
  p_posicion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cedula  text := trim(coalesce(p_cedula, ''));
  v_torneo  tournaments%rowtype;
  v_player  players%rowtype;
  v_creado  boolean := false;
  v_digitos text;
  v_choque  record;
  v_otro    record;
  v_sanc    jsonb;
  v_deuda   jsonb;
  v_motivo  text;
  v_menor   boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribir jugadores'; end if;
  if not coalesce(public.es_representante_de_equipo(p_team_id), false) then
    raise exception 'Solo el dueño del equipo puede inscribir jugadores desde su perfil';
  end if;
  if v_cedula = '' then raise exception 'La cédula es obligatoria'; end if;

  select * into v_torneo from tournaments where id = p_tournament_id;
  if not found then raise exception 'Torneo no encontrado'; end if;
  if not exists (select 1 from tournament_teams where tournament_id = p_tournament_id and team_id = p_team_id) then
    raise exception 'El equipo no pertenece a este torneo';
  end if;

  v_motivo := public.inscripcion_jugadores_cierre(p_tournament_id);
  if v_motivo is not null then raise exception '%', v_motivo; end if;

  select * into v_player from players where numero_cedula = v_cedula limit 1;
  if not found then
    if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'El nombre es obligatorio'; end if;
    if p_fecha_nacimiento is null then raise exception 'La fecha de nacimiento es obligatoria'; end if;
    v_menor := p_fecha_nacimiento > (current_date - interval '18 years')::date;
    if v_menor and not coalesce(p_autorizacion_menor, false) then
      raise exception 'Falta la autorización de un adulto responsable para el jugador menor de edad';
    end if;
    -- Igual que el link de registro: la posición siempre; teléfono, ciudad y género salvo en torneos de registro simple
    if nullif(trim(coalesce(p_posicion, '')), '') is null then raise exception 'Selecciona la posición del jugador'; end if;
    if not coalesce(v_torneo.registro_simple, false) then
      if nullif(trim(coalesce(p_telefono, '')), '') is null then raise exception 'El teléfono es obligatorio'; end if;
      if nullif(trim(coalesce(p_city, '')), '') is null then raise exception 'La ciudad es obligatoria'; end if;
      if nullif(trim(coalesce(p_genero, '')), '') is null then raise exception 'El género es obligatorio'; end if;
    end if;
    if nullif(trim(coalesce(p_telefono, '')), '') is not null then
      v_digitos := right(regexp_replace(p_telefono, '\D', '', 'g'), 10);
      if length(v_digitos) = 10 then
        select id, name into v_choque from players
        where right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = v_digitos
           or right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 10) = v_digitos
        limit 1;
        if found then raise exception 'Ese número de WhatsApp ya está registrado con otro jugador (%).', v_choque.name; end if;
      end if;
    end if;
    insert into players (name, telefono, city, genero, fecha_nacimiento,
                         posicion_futbol5, posicion_futbol7, posicion_futbol11,
                         numero_cedula, activo_membresia, fecha_registro)
    values (trim(p_name), nullif(trim(coalesce(p_telefono, '')), ''),
            nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_genero, '')), ''), p_fecha_nacimiento,
            nullif(trim(p_posicion), ''), nullif(trim(p_posicion), ''), nullif(trim(p_posicion), ''),
            v_cedula, true, now())
    returning * into v_player;
    v_creado := true;
  end if;

  -- Ya inscrito en este torneo (en este u otro equipo)
  select r.team_id, t.name as equipo into v_otro
  from tournament_player_registrations r left join teams t on t.id = r.team_id
  where r.tournament_id = p_tournament_id and r.player_id = v_player.id and r.activo = true limit 1;
  if found then
    if v_otro.team_id = p_team_id then raise exception '% ya está inscrito en este torneo con tu equipo', v_player.name; end if;
    raise exception '% ya está inscrito en este torneo con otro equipo (%)', v_player.name, coalesce(v_otro.equipo, '?');
  end if;

  v_sanc := public.jugador_sancion_activa(v_player.id, p_tournament_id);
  if coalesce((v_sanc ->> 'sancionado')::boolean, false) then raise exception 'Jugador sancionado: no puede inscribirse'; end if;
  v_deuda := public.jugador_tiene_deuda(v_player.id, p_tournament_id);
  if coalesce((v_deuda ->> 'tiene_deuda')::boolean, false) then
    raise exception 'Jugador con deuda pendiente en este organizador: no puede inscribirse';
  end if;

  -- El candado de la tabla revisa el cupo del torneo (y el vetado) al inscribir
  insert into tournament_player_registrations (tournament_id, team_id, player_id, activo, autorizacion_menor)
  values (p_tournament_id, p_team_id, v_player.id, true, coalesce(p_autorizacion_menor, false))
  on conflict (tournament_id, team_id, player_id)
  do update set activo = true, autorizacion_menor = excluded.autorizacion_menor;

  if not exists (select 1 from team_players where team_id = p_team_id and player_id = v_player.id) then
    insert into team_players (team_id, player_id, activo) values (p_team_id, v_player.id, true);
  end if;

  return jsonb_build_object('player_id', v_player.id, 'name', v_player.name, 'creado', v_creado);
end $$;
revoke all on function public.dueno_inscribir_jugador_nuevo(uuid, uuid, text, text, text, date, boolean, text, text, text) from public, anon;
grant execute on function public.dueno_inscribir_jugador_nuevo(uuid, uuid, text, text, text, date, boolean, text, text, text) to authenticated;

-- ROLLBACK (no borra jugadores ni inscripciones):
--   drop trigger if exists tpr_controlar_inscripcion on public.tournament_player_registrations;
--   drop function if exists public.tpr_controlar_inscripcion();
--   drop function if exists public.dueno_inscribir_jugador_nuevo(uuid, uuid, text, text, text, date, boolean, text, text, text);
--   drop function if exists public.inscripcion_jugadores_estado(uuid, uuid);
--   drop function if exists public.es_staff_inscripcion(uuid);
--   drop function if exists public.inscripcion_jugadores_cierre(uuid);
--   alter table public.tournaments drop constraint if exists tournaments_inscripcion_jugadores_modo_check;
--   alter table public.tournaments drop column if exists inscripcion_jugadores_modo, drop column if exists inscripcion_jugadores_hasta;
