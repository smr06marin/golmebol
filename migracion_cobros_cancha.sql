-- =====================================================================
-- COBROS EN CANCHA — FOTO DE TRANSFERENCIAS + CUADRE AUTOMÁTICO POR CANCHA
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Se puede correr más de una vez.
--
-- Solo para torneos con finanzas_config.cobro_en_cancha = true (los de Golmebol, donde el árbitro recoge la plata).
--  1) Tabla cobros_cancha con DOS tipos de fila:
--       · 'transferencia': el árbitro toma la foto del comprobante y escribe el monto (botón arriba de la planilla).
--       · 'tarjeta': se crea sola cuando el árbitro desbloquea a un jugador (DEBE TARJETA). No hay que hacer nada más.
--     El arbitraje NO se registra: se calcula solo (cada equipo paga el valor del torneo; en un W paga uno solo).
--  2) Fotos en un bucket PRIVADO «comprobantes» (las ve el dueño del torneo, el administrador y los árbitros del partido).
--  3) registrar_transferencia(): guarda la foto + monto y avisa (push) al dueño con cancha y partido.
--  4) anular_cobro_cancha(): deshacer una transferencia registrada por error.
--  5) desbloquear_tarjetas_en_planilla(): vuelve a ser la de siempre (2 parámetros) y además deja la tarjeta anotada.
--  6) El dueño puede marcar cada transferencia como «revisada».
-- Si ya habías corrido la versión anterior de este archivo, esta la reemplaza (borra su tabla de prueba).
-- ROLLBACK al final del archivo.
-- =====================================================================

-- 0. Limpiar la versión anterior (si existe) ---------------------------------
do $$
begin
  if to_regclass('public.cobros_cancha') is not null then
    execute 'drop trigger if exists trg_push_cobro on public.cobros_cancha';
  end if;
end $$;
drop function if exists public.push_encolar_cobro();
drop function if exists public.registrar_cobro_arbitraje(uuid, uuid, text, numeric, text);
drop function if exists public.desbloquear_tarjetas_en_planilla(uuid, uuid, text, numeric, text);
drop table if exists public.cobros_cancha cascade;

-- 1. Tabla -------------------------------------------------------------
create table public.cobros_cancha (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null,
  match_id            uuid not null,
  tipo                text not null check (tipo in ('transferencia', 'tarjeta')),
  monto               numeric not null default 0 check (monto >= 0),
  detalle             text,                       -- tarjeta: «Amarilla · Nombre» · transferencia: nota opcional
  team_id             uuid,                       -- tarjeta: equipo del jugador
  player_id           uuid,                       -- tarjeta: jugador desbloqueado
  comprobante_path    text,                       -- transferencia: foto en el bucket «comprobantes»
  cobrado_por_user    uuid default auth.uid(),
  cobrado_por_player  uuid,
  cobrado_por_nombre  text,
  cobrado_at          timestamptz not null default now(),
  anulado             boolean not null default false,
  anulado_at          timestamptz,
  revisado            boolean not null default false,
  revisado_at         timestamptz
);
create index cobros_cancha_match on public.cobros_cancha (match_id);
create index cobros_cancha_torneo_fecha on public.cobros_cancha (tournament_id, cobrado_at desc);

alter table public.cobros_cancha enable row level security;

-- ¿Quien llama puede cobrar en este partido? (mismas reglas que desbloquear tarjetas: árbitro asignado, árbitro
-- líder, árbitro de la plataforma mientras no se cierre, dueño del torneo u organizador)
create or replace function public.puede_cobrar_en_cancha(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (
           coalesce(public.es_dueno_torneo(m.tournament_id), false)
        or coalesce(public.es_organizador_plataforma(), false)
        or exists (select 1 from public.players p
                   where p.user_id = auth.uid()
                     and (p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id) or p.es_arbitro_lider is true))
        or (m.status is distinct from 'finished'
            and exists (select 1 from public.players p
                        where p.user_id = auth.uid() and (p.es_arbitro is true or p.rol = 'arbitro')))
      )
  );
$$;
revoke all on function public.puede_cobrar_en_cancha(uuid) from public, anon;
grant execute on function public.puede_cobrar_en_cancha(uuid) to authenticated;

drop policy if exists gm_cobros_select on public.cobros_cancha;
create policy gm_cobros_select on public.cobros_cancha for select to authenticated
  using (
       coalesce(public.es_dueno_torneo(tournament_id), false)
    or coalesce(public.es_organizador_plataforma(), false)
    or coalesce(public.es_admin_plataforma(), false)
    or cobrado_por_user = auth.uid()
    or public.puede_cobrar_en_cancha(match_id)      -- los árbitros del partido ven el cuadre completo de su cancha
  );
-- el dueño marca «revisado» desde su pantalla (el resto solo se escribe por las funciones)
drop policy if exists gm_cobros_update_dueno on public.cobros_cancha;
create policy gm_cobros_update_dueno on public.cobros_cancha for update to authenticated
  using (coalesce(public.es_dueno_torneo(tournament_id), false) or coalesce(public.es_organizador_plataforma(), false) or coalesce(public.es_admin_plataforma(), false))
  with check (coalesce(public.es_dueno_torneo(tournament_id), false) or coalesce(public.es_organizador_plataforma(), false) or coalesce(public.es_admin_plataforma(), false));

-- 2. Fotos de comprobantes (bucket privado) ---------------------------------
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false)
on conflict (id) do update set public = false;

drop policy if exists gm_comprobantes_insert on storage.objects;
create policy gm_comprobantes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and public.puede_cobrar_en_cancha(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists gm_comprobantes_select on storage.objects;
create policy gm_comprobantes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
         owner = auth.uid()
      or coalesce(public.es_dueno_torneo(((storage.foldername(name))[1])::uuid), false)
      or coalesce(public.es_organizador_plataforma(), false)
      or coalesce(public.es_admin_plataforma(), false)
      or public.puede_cobrar_en_cancha(((storage.foldername(name))[2])::uuid)
    )
  );

-- 3. Registrar una transferencia (foto + monto) --------------------------------
create or replace function public.registrar_transferencia(
  p_match_id uuid, p_monto numeric, p_comprobante_path text, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m        public.matches%rowtype;
  v_config jsonb;
  v_nombre text;
  v_pid    uuid;
  v_id     uuid;
begin
  if not public.puede_cobrar_en_cancha(p_match_id) then
    raise exception 'No tienes permiso para registrar cobros en este partido';
  end if;
  select * into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Partido no encontrado'; end if;
  select coalesce(finanzas_config, '{}'::jsonb) into v_config from public.tournaments where id = m.tournament_id;
  if coalesce(v_config ->> 'cobro_en_cancha', 'false') <> 'true' then
    raise exception 'Este torneo no cobra en la cancha';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 100000000 then raise exception 'Escribe cuánto fue la transferencia'; end if;
  -- la foto tiene que estar en la carpeta de ESTE torneo y ESTE partido
  if coalesce(p_comprobante_path, '') = '' or p_comprobante_path not like m.tournament_id::text || '/' || m.id::text || '/%' then
    raise exception 'Falta la foto del comprobante';
  end if;

  select id, name into v_pid, v_nombre from public.players where user_id = auth.uid() limit 1;

  insert into public.cobros_cancha (tournament_id, match_id, tipo, monto, detalle, comprobante_path, cobrado_por_player, cobrado_por_nombre)
  values (m.tournament_id, p_match_id, 'transferencia', p_monto, nullif(trim(coalesce(p_nota, '')), ''), p_comprobante_path, v_pid, coalesce(v_nombre, 'Árbitro'))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$function$;
revoke all on function public.registrar_transferencia(uuid, numeric, text, text) from public, anon;
grant execute on function public.registrar_transferencia(uuid, numeric, text, text) to authenticated;

-- 4. Deshacer una transferencia (quien la registró, o el dueño / organizador) ----------
create or replace function public.anular_cobro_cancha(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.cobros_cancha%rowtype;
begin
  select * into c from public.cobros_cancha where id = p_id;
  if c.id is null or c.anulado then raise exception 'Ese registro no existe o ya está deshecho'; end if;
  if c.tipo <> 'transferencia' then raise exception 'Solo se pueden deshacer transferencias'; end if;
  if not (
       c.cobrado_por_user = auth.uid()
    or coalesce(public.es_dueno_torneo(c.tournament_id), false)
    or coalesce(public.es_organizador_plataforma(), false)
    or coalesce(public.es_admin_plataforma(), false)
  ) then
    raise exception 'No puedes deshacer este registro';
  end if;
  update public.cobros_cancha set anulado = true, anulado_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.anular_cobro_cancha(uuid) from public, anon;
grant execute on function public.anular_cobro_cancha(uuid) to authenticated;


-- 5. Desbloquear tarjetas (la de siempre) + anota la tarjeta cobrada -----------------
drop function if exists public.desbloquear_tarjetas_en_planilla(uuid, uuid);
create or replace function public.desbloquear_tarjetas_en_planilla(p_match_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tid      uuid;
  v_home     uuid;
  v_away     uuid;
  v_config   jsonb;
  v_nombre   text;
  v_team     uuid;
  v_vs       text;
  v_total    numeric := 0;
  v_tipos    text[] := '{}';
  v_pid      uuid;
  v_quien    text;
begin
  -- SOLO el árbitro que entró con su PROPIO usuario (asignado al partido, árbitro líder o árbitro de la plataforma),
  -- el dueño del torneo o el organizador de la plataforma. Quien planilla con un LINK (sin usuario) NO puede.
  if auth.uid() is null or not public.puede_cobrar_en_cancha(p_match_id) then
    raise exception 'No tienes permiso para desbloquear jugadores en este partido';
  end if;

  select m.tournament_id, m.home_team_id, m.away_team_id
    into v_tid, v_home, v_away
  from matches m where m.id = p_match_id;
  if v_tid is null then
    raise exception 'Partido no encontrado';
  end if;

  select coalesce(t.finanzas_config, '{}'::jsonb) into v_config from tournaments t where t.id = v_tid;

  -- El jugador tiene que ser de uno de los dos equipos de este partido
  select s.team_id into v_team
  from player_match_stats s
  where s.tournament_id = v_tid and s.player_id = p_player_id and s.team_id in (v_home, v_away)
  order by (s.yellow_cards > 0 or s.blue_cards > 0 or s.red_cards > 0) desc
  limit 1;
  if v_team is null then
    raise exception 'Ese jugador no es de uno de los equipos de este partido';
  end if;

  select name into v_nombre from players where id = p_player_id;
  select coalesce(h.name, '?') || ' vs ' || coalesce(a.name, '?') into v_vs
  from matches m left join teams h on h.id = m.home_team_id left join teams a on a.id = m.away_team_id
  where m.id = p_match_id;

  -- Monto: por cada partido con tarjetas sin pagar se cobra la más cara de ese partido
  select coalesce(sum(greatest(
           case when s.yellow_cards > 0 and not s.yellow_paid then coalesce((v_config->>'precio_amarilla')::numeric, 0) else 0 end,
           case when s.blue_cards   > 0 and not s.blue_paid   then coalesce((v_config->>'precio_azul')::numeric, 0)     else 0 end,
           case when s.red_cards    > 0 and not s.red_paid    then coalesce((v_config->>'precio_roja')::numeric, 0)     else 0 end
         )), 0)
    into v_total
  from player_match_stats s
  where s.tournament_id = v_tid and s.player_id = p_player_id;

  if exists (select 1 from player_match_stats where tournament_id = v_tid and player_id = p_player_id and yellow_cards > 0 and not yellow_paid) then
    update player_match_stats set yellow_paid = true where tournament_id = v_tid and player_id = p_player_id and yellow_cards > 0;
    v_tipos := array_append(v_tipos, 'Amarilla');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tid and player_id = p_player_id and blue_cards > 0 and not blue_paid) then
    update player_match_stats set blue_paid = true where tournament_id = v_tid and player_id = p_player_id and blue_cards > 0;
    v_tipos := array_append(v_tipos, 'Azul');
  end if;
  if exists (select 1 from player_match_stats where tournament_id = v_tid and player_id = p_player_id and red_cards > 0 and not red_paid) then
    update player_match_stats set red_paid = true where tournament_id = v_tid and player_id = p_player_id and red_cards > 0;
    v_tipos := array_append(v_tipos, 'Roja');
  end if;

  if array_length(v_tipos, 1) is null then
    raise exception 'Este jugador ya no tiene tarjetas pendientes';
  end if;

  insert into torneo_finanzas (tournament_id, team_id, player_id, tipo, monto, pagado, concepto, tarjetas_pagadas)
  values (v_tid, v_team, p_player_id, 'pago_tarjetas', v_total, true,
    'Tarjeta(s) de ' || coalesce(v_nombre, 'jugador') || ' — cobrada por el árbitro en la planilla (' || v_vs || ')',
    array_length(v_tipos, 1));

  -- Torneos que cobran en la cancha: queda anotada la tarjeta cobrada (suma al cuadre de la cancha, automático)
  if coalesce(v_config ->> 'cobro_en_cancha', 'false') = 'true' then
    select id, name into v_pid, v_quien from players where user_id = auth.uid() limit 1;
    insert into cobros_cancha (tournament_id, match_id, tipo, team_id, player_id, detalle, monto, cobrado_por_player, cobrado_por_nombre)
    values (v_tid, p_match_id, 'tarjeta', v_team, p_player_id,
            array_to_string(v_tipos, ' + ') || ' · ' || coalesce(v_nombre, 'jugador'), v_total, v_pid, coalesce(v_quien, 'Árbitro'));
  end if;

  return jsonb_build_object('ok', true, 'total', v_total, 'tipos', to_jsonb(v_tipos));
end;
$function$;
revoke all on function public.desbloquear_tarjetas_en_planilla(uuid, uuid) from public, anon;
grant execute on function public.desbloquear_tarjetas_en_planilla(uuid, uuid) to authenticated;

-- 6. Aviso al dueño cuando un cobro llega por TRANSFERENCIA ---------------------------------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.push_cola'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%recordatorio%'
  loop
    execute format('alter table public.push_cola drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.push_cola add constraint push_cola_tipo_check
  check (tipo in ('nuevo','cambio','resultado','recordatorio','roja','informe','cobro'));

create or replace function public.push_encolar_cobro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vs      text;
  v_cancha  text;
begin
  begin
    if NEW.anulado or NEW.tipo <> 'transferencia' then return NEW; end if;
    select coalesce(h.name, '?') || ' vs ' || coalesce(a.name, '?'), nullif(trim(coalesce(m.location, '')), '')
      into v_vs, v_cancha
    from public.matches m left join public.teams h on h.id = m.home_team_id left join public.teams a on a.id = m.away_team_id
    where m.id = NEW.match_id;
    insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
    values ('cobro', NEW.match_id, NEW.tournament_id, '{}',
            'Transferencia de $' || to_char(NEW.monto, 'FM999G999G999') || ' · ' || coalesce(v_cancha, 'sin cancha'),
            coalesce(v_vs, '') || ' · la recibió ' || coalesce(NEW.cobrado_por_nombre, 'el árbitro'),
            'cob:' || NEW.id)
    on conflict (clave) do nothing;
  exception when others then
    null; -- nunca romper el registro por un aviso
  end;
  return NEW;
end $$;

drop trigger if exists trg_push_cobro on public.cobros_cancha;
create trigger trg_push_cobro
  after insert on public.cobros_cancha
  for each row execute function public.push_encolar_cobro();

-- ---------------------------------------------------------------------------------
-- ROLLBACK (si algo sale mal):
--   drop trigger if exists trg_push_cobro on public.cobros_cancha;
--   drop function if exists public.push_encolar_cobro();
--   drop function if exists public.registrar_transferencia(uuid, numeric, text, text);
--   drop function if exists public.anular_cobro_cancha(uuid);
--   drop table if exists public.cobros_cancha;
--   drop function if exists public.puede_cobrar_en_cancha(uuid);
--   (desbloquear_tarjetas_en_planilla ya quedó con sus 2 parámetros; para volver a la original exacta, correr de nuevo
--    migracion_arbitro_desbloquea_tarjetas.sql)
-- ---------------------------------------------------------------------------------
