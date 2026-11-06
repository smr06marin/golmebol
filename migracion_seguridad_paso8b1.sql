-- =====================================================================
-- PASO 8B-1 — Predix de los jugadores: PREDICCIONES y DUELOS
-- =====================================================================
-- ANTES (según tu auditoría): cualquiera, incluso sin cuenta, podía crear o
-- editar predicciones de CUALQUIER jugador y ponerles los puntos que quisiera,
-- o declararse en modo "pago" sin tener suscripción.
-- AHORA:
--   * Leer sigue público (rankings y desglose lo necesitan).
--   * Solo una cuenta real puede crear/editar SU PROPIA predicción, y el
--     servidor decide los puntos, si está resuelta y el modo (demo/pago):
--     lo que mande el celular en esos campos se ignora.
--   * Solo el personal de planilla del partido puede resolver puntos
--     (resolverPrediccionesPartido sigue funcionando igual).
--   * Duelos: el servidor valida retador, retado, modo, estado y las
--     transiciones (solo el retado acepta/rechaza, solo el retador cancela).
-- NO cambia ningún dato existente. NO requiere cambio de código en la app.
-- Requiere los pasos 1 a 8A. Aplicar fuera de partidos en vivo si se puede.
-- NO toca posturas ni cruces (eso es 8B-2).
-- =====================================================================
begin;

-- 1) Modo que corresponde a un jugador en un torneo (misma regla que la app:
--    suscripción activa, no vencida, de ese torneo o completa).
create or replace function public.predix_modo_de(p_player uuid, p_tournament uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
    select 1 from public.predix_suscripciones s
    where s.player_id = p_player
      and s.estado = 'activa'
      and s.fecha_fin >= (now() at time zone 'utc')::date
      and (s.tournament_id = p_tournament or s.tournament_id is null)
  ) then 'pago' else 'demo' end;
$$;
revoke all on function public.predix_modo_de(uuid, uuid) from public;
grant execute on function public.predix_modo_de(uuid, uuid) to authenticated;

-- 2) PREDICCIONES: reglas
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'predicciones' loop
    execute format('drop policy %I on public.predicciones', r.policyname);
  end loop;
end $$;

alter table public.predicciones enable row level security;

create policy gm_pred_select on public.predicciones
  for select to anon, authenticated using (true);

create policy gm_pred_insert on public.predicciones
  for insert to authenticated
  with check (public.es_cuenta_real() and public.es_mi_jugador(player_id));

-- La autorización fina (de quién es la fila, qué campos cambian) la hace el trigger.
create policy gm_pred_update on public.predicciones
  for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy gm_pred_delete on public.predicciones
  for delete to authenticated
  using (public.es_admin_plataforma() or public.es_organizador_plataforma());

-- 3) PREDICCIONES: trigger de guardia
create or replace function public.trg_predicciones_guardia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_tid uuid;
  v_es_arbitro boolean;
begin
  if coalesce(public.es_admin_plataforma(), false) then
    return new;
  end if;

  select m.status, m.tournament_id into v_status, v_tid from public.matches m where m.id = new.match_id;
  if not found then
    raise exception 'El partido no existe';
  end if;

  -- (a) Jugador sobre SU propia predicción
  if public.es_mi_jugador(new.player_id) then
    if v_status = 'finished' then
      raise exception 'El partido ya terminó: no se puede cambiar la predicción';
    end if;
    if tg_op = 'INSERT' then
      new.puntos_ganados := 0;
      new.resuelta := false;
    else
      if new.player_id <> old.player_id or new.match_id <> old.match_id then
        raise exception 'No se puede cambiar de jugador ni de partido';
      end if;
      if coalesce(old.resuelta, false) then
        raise exception 'La predicción ya fue resuelta';
      end if;
      new.puntos_ganados := old.puntos_ganados;
      new.resuelta := old.resuelta;
    end if;
    new.modo := public.predix_modo_de(new.player_id, v_tid);
    return new;
  end if;

  -- (b) Fila de otro jugador: solo el personal de planilla puede RESOLVER puntos
  if tg_op = 'INSERT' then
    raise exception 'No puedes crear la predicción de otro jugador';
  end if;

  select exists (select 1 from public.players p
                 where p.user_id = auth.uid() and (p.es_arbitro is true or p.rol = 'arbitro'))
    into v_es_arbitro;

  if not (public.puede_planillar_partido(new.match_id) or (v_status = 'finished' and v_es_arbitro)) then
    raise exception 'No tienes permiso para resolver esta predicción';
  end if;

  if (new.player_id, new.match_id, new.ganador, new.goles_home, new.goles_away, new.goleador_id, new.modo)
     is distinct from
     (old.player_id, old.match_id, old.ganador, old.goles_home, old.goles_away, old.goleador_id, old.modo) then
    raise exception 'Solo se pueden resolver los puntos de la predicción';
  end if;
  return new;
end;
$$;

drop trigger if exists gm_predicciones_guardia on public.predicciones;
create trigger gm_predicciones_guardia
  before insert or update on public.predicciones
  for each row execute function public.trg_predicciones_guardia();

-- 4) DUELOS: reglas
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'predix_duelos' loop
    execute format('drop policy %I on public.predix_duelos', r.policyname);
  end loop;
end $$;

alter table public.predix_duelos enable row level security;

create policy gm_duelos_select on public.predix_duelos
  for select to anon, authenticated using (true);

create policy gm_duelos_insert on public.predix_duelos
  for insert to authenticated
  with check (public.es_cuenta_real() and auth.uid() = retador_user_id and public.es_mi_jugador(retador_id));

create policy gm_duelos_update on public.predix_duelos
  for update to authenticated
  using (auth.uid() = retador_user_id or auth.uid() = retado_user_id or public.es_admin_plataforma())
  with check (auth.uid() = retador_user_id or auth.uid() = retado_user_id or public.es_admin_plataforma());

-- (AdminJugadoresPage borra duelos de un jugador al eliminarlo)
create policy gm_duelos_delete on public.predix_duelos
  for delete to authenticated
  using (public.es_admin_plataforma() or public.es_organizador_plataforma());

-- 5) DUELOS: trigger de guardia
create or replace function public.trg_duelos_guardia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_tid uuid;
  v_uid_retado uuid;
  v_nom_retador text;
  v_nom_retado text;
begin
  if coalesce(public.es_admin_plataforma(), false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select m.status, m.tournament_id into v_status, v_tid from public.matches m where m.id = new.match_id;
    if not found then raise exception 'El partido no existe'; end if;
    if v_status = 'finished' then raise exception 'El partido ya terminó'; end if;
    if new.retador_id = new.retado_id then raise exception 'No puedes retarte a ti mismo'; end if;
    if new.monto is null or new.monto <= 0 then raise exception 'Monto inválido'; end if;

    select p.name into v_nom_retador from public.players p where p.id = new.retador_id;
    select p.user_id, p.name into v_uid_retado, v_nom_retado from public.players p where p.id = new.retado_id;
    if not found then raise exception 'El rival no existe'; end if;

    new.tournament_id := v_tid;
    new.retado_user_id := v_uid_retado;
    new.retador_nombre := coalesce(v_nom_retador, new.retador_nombre);
    new.retado_nombre := coalesce(v_nom_retado, new.retado_nombre);
    new.modo := public.predix_modo_de(new.retador_id, v_tid);
    if public.predix_modo_de(new.retado_id, v_tid) <> new.modo then
      raise exception 'Tú y tu rival deben estar en el mismo modo (demo o pago)';
    end if;
    new.estado := 'pendiente';
    new.respondido_at := null;
    return new;
  end if;

  -- UPDATE: nada de los datos del duelo cambia; solo el estado, y con reglas
  if (new.match_id, new.tournament_id, new.retador_id, new.retador_user_id, new.retador_nombre, new.retador_equipo,
      new.retado_id, new.retado_user_id, new.retado_nombre, new.monto, new.modo)
     is distinct from
     (old.match_id, old.tournament_id, old.retador_id, old.retador_user_id, old.retador_nombre, old.retador_equipo,
      old.retado_id, old.retado_user_id, old.retado_nombre, old.monto, old.modo) then
    raise exception 'Los datos del duelo no se pueden cambiar';
  end if;

  if new.estado is not distinct from old.estado then
    if new.respondido_at is distinct from old.respondido_at then
      raise exception 'Cambio no permitido';
    end if;
    return new;
  end if;

  if old.estado <> 'pendiente' then
    raise exception 'Este duelo ya fue respondido';
  end if;

  select m.status into v_status from public.matches m where m.id = new.match_id;
  if v_status = 'finished' then raise exception 'El partido ya terminó'; end if;

  if new.estado in ('aceptado', 'rechazado') then
    if auth.uid() is distinct from old.retado_user_id then
      raise exception 'Solo el retado puede aceptar o rechazar';
    end if;
  elsif new.estado = 'cancelado' then
    if auth.uid() is distinct from old.retador_user_id then
      raise exception 'Solo quien retó puede cancelar';
    end if;
  else
    raise exception 'Estado no permitido';
  end if;
  return new;
end;
$$;

drop trigger if exists gm_duelos_guardia on public.predix_duelos;
create trigger gm_duelos_guardia
  before insert or update on public.predix_duelos
  for each row execute function public.trg_duelos_guardia();

commit;

-- =====================================================================
-- PRUEBAS
-- =====================================================================
-- A) Un visitante sin cuenta NO puede cambiar puntos (debe devolver 0 filas):
--    begin;
--    set local role anon;
--    update public.predicciones set puntos_ganados = 999
--      where id = (select id from public.predicciones limit 1) returning id;
--    rollback;
-- B) Debe haber 4 reglas en predicciones y 4 en predix_duelos:
--    select tablename, policyname, cmd from pg_policies
--    where tablename in ('predicciones','predix_duelos') order by 1, 3;
-- C) En la web, como jugador real: predecir un partido pendiente, editarla,
--    retar a un rival del mismo modo, aceptar/rechazar un reto, cancelar uno enviado.
-- D) En la planilla, terminar un partido de prueba que tenga predicciones:
--    los jugadores deben quedar con sus puntos (resuelta) como siempre.
--
-- =====================================================================
-- ROLLBACK (deja predicciones y duelos como estaban)
-- =====================================================================
-- begin;
-- drop trigger if exists gm_predicciones_guardia on public.predicciones;
-- drop trigger if exists gm_duelos_guardia on public.predix_duelos;
-- drop function if exists public.trg_predicciones_guardia();
-- drop function if exists public.trg_duelos_guardia();
-- do $$ declare r record; begin
--   for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('predicciones','predix_duelos') loop
--     execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop; end $$;
-- create policy jugador_ve_sus_predicciones on public.predicciones for select using (true);
-- create policy jugador_inserta_predicciones on public.predicciones for insert with check (true);
-- create policy jugador_actualiza_predicciones on public.predicciones for update using (true);
-- create policy predix_duelos_select on public.predix_duelos for select using (true);
-- create policy predix_duelos_insert on public.predix_duelos for insert with check (auth.uid() = retador_user_id);
-- create policy predix_duelos_update on public.predix_duelos for update using (auth.uid() = retador_user_id or auth.uid() = retado_user_id);
-- commit;
