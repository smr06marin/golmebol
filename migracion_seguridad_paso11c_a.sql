-- =====================================================================
-- PASO 11C-A — Datos privados de equipos: tabla privada + sincronización + funciones de lectura
-- =====================================================================
-- PROBLEMA: teams.representante_cedula, teams.representante_telefono y teams.registro_token los
-- puede leer CUALQUIER sesión (incluida una anónima). La cédula del representante además funciona
-- como "clave" del link de finanzas y del login.
--
-- ESTA FASE (A) NO CAMBIA NADA VISIBLE. Solo prepara:
--   1) Tabla privada teams_privado (nadie la lee desde fuera) con una copia de esos 3 datos.
--   2) Un trigger que mantiene la copia al día cada vez que se guarda un equipo.
--      (Las columnas de teams siguen llenas por ahora: la app actual sigue funcionando igual.)
--   3) Funciones nuevas para que organizador/admin/dueño LEAN esos datos de forma controlada.
-- La fase B (después de subir los cambios de la app) vacía las columnas de teams.
-- Una sola transacción. Se puede correr en cualquier momento.
-- =====================================================================
begin;

-- 1) Tabla privada ----------------------------------------------------
create table if not exists public.teams_privado (
  team_id                uuid primary key,
  representante_cedula   text,
  representante_telefono text,
  registro_token         uuid,
  updated_at             timestamptz not null default now()
);
create unique index if not exists teams_privado_registro_token_uk
  on public.teams_privado (registro_token) where registro_token is not null;
create index if not exists teams_privado_cedula_idx
  on public.teams_privado (representante_cedula) where representante_cedula is not null;

alter table public.teams_privado enable row level security;
revoke all on table public.teams_privado from public, anon, authenticated;

-- Copia de lo que ya existe
insert into public.teams_privado (team_id, representante_cedula, representante_telefono, registro_token)
select id, representante_cedula, representante_telefono, registro_token
from public.teams
on conflict (team_id) do update set
  representante_cedula   = coalesce(public.teams_privado.representante_cedula, excluded.representante_cedula),
  representante_telefono = coalesce(public.teams_privado.representante_telefono, excluded.representante_telefono),
  registro_token         = coalesce(public.teams_privado.registro_token, excluded.registro_token);

-- 2) Sincronización (modo A: solo copia, no vacía nada) ---------------
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

drop trigger if exists teams_sync_privado_trg on public.teams;
create trigger teams_sync_privado_trg
  before insert or update on public.teams
  for each row execute function public.teams_sync_privado();

create or replace function public.teams_borrar_privado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.teams_privado where team_id = old.id;
  return old;
end;
$function$;
revoke all on function public.teams_borrar_privado() from public, anon, authenticated;

drop trigger if exists teams_borrar_privado_trg on public.teams;
create trigger teams_borrar_privado_trg
  after delete on public.teams
  for each row execute function public.teams_borrar_privado();

-- 3) Funciones de lectura controlada ----------------------------------

-- ¿Quién puede ver los datos privados de un equipo?
-- Admin, staff de la escuela, organizador de un torneo donde está el equipo, o el propio dueño.
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
    or exists (
         select 1
         from public.teams_privado k
         join public.players p on p.numero_cedula = k.representante_cedula
         where k.team_id = p_team
           and nullif(trim(coalesce(k.representante_cedula, '')), '') is not null
           and p.user_id = auth.uid()
       )
  );
$function$;

-- Datos privados de UN equipo (cédula, teléfono y token de registro del dueño)
create or replace function public.equipo_datos_privados(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  if not public.puede_ver_datos_equipo(p_team_id) then
    raise exception 'No autorizado';
  end if;
  select jsonb_build_object(
           'representante_cedula',   k.representante_cedula,
           'representante_telefono', k.representante_telefono,
           'registro_token',         k.registro_token)
    into v
  from public.teams_privado k
  where k.team_id = p_team_id;
  return coalesce(v, jsonb_build_object('representante_cedula', null, 'representante_telefono', null, 'registro_token', null));
end;
$function$;

-- Tokens de registro de todos los equipos de UN torneo (para armar los links de registro)
create or replace function public.registro_tokens_torneo(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  select organizador_id into v_org from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Torneo no encontrado';
  end if;
  if v_org is distinct from auth.uid() and not coalesce(public.es_admin_plataforma(), false) then
    raise exception 'No autorizado';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('team_id', tt.team_id, 'registro_token', k.registro_token))
    from public.tournament_teams tt
    left join public.teams_privado k on k.team_id = tt.team_id
    where tt.tournament_id = p_tournament_id
  ), '[]'::jsonb);
end;
$function$;

-- Equipos de los que soy dueño (por mi cédula)
create or replace function public.mis_equipos_dueno()
returns table (id uuid, name text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.id, t.name, t.created_at
  from public.teams t
  join public.teams_privado k on k.team_id = t.id
  where auth.uid() is not null
    and nullif(trim(coalesce(k.representante_cedula, '')), '') is not null
    and k.representante_cedula in (
      select p.numero_cedula from public.players p
      where p.user_id = auth.uid() and p.numero_cedula is not null
    );
$function$;

-- ¿Soy dueño de este equipo?
create or replace function public.soy_dueno_de_equipo(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.teams_privado k
    join public.players p on p.numero_cedula = k.representante_cedula
    where k.team_id = p_team_id
      and nullif(trim(coalesce(k.representante_cedula, '')), '') is not null
      and p.user_id = auth.uid()
  );
$function$;

revoke all on function public.puede_ver_datos_equipo(uuid)   from public, anon;
revoke all on function public.equipo_datos_privados(uuid)    from public, anon;
revoke all on function public.registro_tokens_torneo(uuid)   from public, anon;
revoke all on function public.mis_equipos_dueno()            from public, anon;
revoke all on function public.soy_dueno_de_equipo(uuid)      from public, anon;
grant execute on function public.puede_ver_datos_equipo(uuid)   to authenticated;
grant execute on function public.equipo_datos_privados(uuid)    to authenticated;
grant execute on function public.registro_tokens_torneo(uuid)   to authenticated;
grant execute on function public.mis_equipos_dueno()            to authenticated;
grant execute on function public.soy_dueno_de_equipo(uuid)      to authenticated;

commit;

-- =====================================================================
-- PRUEBAS (cada una por separado)
-- =====================================================================
-- A) La copia está completa (las dos columnas deben dar el mismo número en cada fila):
--    select (select count(*) from public.teams where representante_cedula is not null) as cedulas_en_teams,
--           (select count(*) from public.teams_privado where representante_cedula is not null) as cedulas_en_privado,
--           (select count(*) from public.teams where registro_token is not null) as tokens_en_teams,
--           (select count(*) from public.teams_privado where registro_token is not null) as tokens_en_privado;
-- B) Nadie de fuera lee la tabla (las dos deben dar ERROR permission denied):
--    begin; set local role anon; select count(*) from public.teams_privado; rollback;
--    begin; set local role authenticated; select count(*) from public.teams_privado; rollback;
-- C) Un visitante sin sesión no puede llamar la función (debe dar ERROR permission denied for function):
--    begin; set local role anon; select public.equipo_datos_privados('00000000-0000-0000-0000-000000000000'); rollback;
-- D) Una sesión anónima cualquiera NO puede ver los datos de un equipo (debe dar ERROR No autorizado):
--    begin; set local role authenticated;
--    select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);
--    select public.equipo_datos_privados((select id from public.teams limit 1));
--    rollback;
-- E) La sincronización funciona (debe mostrar: ERROR: RESULTADO: 3000000000 — el error es a propósito,
--    deshace el cambio de prueba y no queda nada modificado):
--    do $$ declare v_id uuid; v text;
--    begin
--      select id into v_id from public.teams limit 1;
--      update public.teams set representante_telefono = '3000000000' where id = v_id;
--      select representante_telefono into v from public.teams_privado where team_id = v_id;
--      raise exception 'RESULTADO: %', v;
--    end $$;
-- F) En la web: guardar un cambio cualquiera en un equipo y confirmar que todo sigue igual.
-- ROLLBACK: rollback_seguridad_paso11c_a.sql
