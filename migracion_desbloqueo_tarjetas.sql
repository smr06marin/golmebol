-- ════════════════════════════════════════════════════════════════════════════════════════════
-- DESBLOQUEO DE TARJETAS: pestaña del administrador + premio que el jugador reclama en 3 días
--
-- Qué hace:
--  1. Guarda en cada tarjeta desbloqueada si el jugador ya RECLAMÓ el premio y si ya se le ENTREGÓ.
--  2. Cada tarjeta (Iniciación, Competidor, Élite, Leyenda, y las especiales) dice si da premio o no
--     (cards.da_premio). Al crear esta columna, Iniciación queda SIN premio (como ya estaba en la app);
--     las demás CON premio. Se cambia desde la pestaña "Desbloqueos" del administrador.
--  3. reclamar_premio_tarjeta: el jugador reclama el premio desde su tarjeta, solo dentro de los
--     3 días (72 horas) desde que la desbloqueó.
--  4. admin_desbloqueos_tarjetas / admin_marcar_premio_tarjeta / admin_tarjeta_da_premio: lo que usa la
--     pestaña "Desbloqueos" (solo el administrador de la plataforma).
--  5. Aviso al celular de los administradores apenas alguien desbloquea una tarjeta (cola de avisos
--     push, tipo 'tarjeta'; sale a cualquier hora).
--
-- Correr UNA vez en Supabase → SQL Editor. Se puede volver a correr sin problema.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Premio reclamado / entregado ---------------------------------------------------------------
alter table public.player_card_level_progress add column if not exists premio_reclamado_en timestamptz;
alter table public.player_card_level_progress add column if not exists premio_entregado_en timestamptz;

-- 2. ¿La tarjeta da premio? ----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'cards' and column_name = 'da_premio') then
    alter table public.cards add column da_premio boolean not null default true;
    update public.cards set da_premio = false where id::text = '11111111-0000-0000-0000-000000000001'; -- Iniciación
  end if;
end $$;

-- 3. El jugador reclama su premio (dentro de 3 días) ----------------------------------------------
create or replace function public.reclamar_premio_tarjeta(p_player_id uuid, p_card_level_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha     timestamptz;
  v_desbloq   boolean;
  v_reclamado timestamptz;
  v_premio    boolean;
begin
  if not (public.es_mi_jugador(p_player_id) or public.es_admin_plataforma()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  select pr.fecha_desbloqueada, pr.desbloqueada, pr.premio_reclamado_en, coalesce(c.da_premio, true)
    into v_fecha, v_desbloq, v_reclamado, v_premio
  from public.player_card_level_progress pr
  join public.card_levels cl on cl.id = pr.card_level_id
  join public.cards c on c.id = cl.card_id
  where pr.player_id = p_player_id and pr.card_level_id::text = p_card_level_id;

  if not found or not coalesce(v_desbloq, false) then return jsonb_build_object('ok', false, 'motivo', 'no_desbloqueada'); end if;
  if not v_premio then return jsonb_build_object('ok', false, 'motivo', 'sin_premio'); end if;
  if v_reclamado is not null then return jsonb_build_object('ok', true, 'reclamado_en', v_reclamado); end if;
  if v_fecha is null or v_fecha < now() - interval '3 days' then return jsonb_build_object('ok', false, 'motivo', 'vencido'); end if;

  update public.player_card_level_progress
     set premio_reclamado_en = now()
   where player_id = p_player_id and card_level_id::text = p_card_level_id;
  return jsonb_build_object('ok', true, 'reclamado_en', now());
end $$;
revoke all on function public.reclamar_premio_tarjeta(uuid, text) from public;
grant execute on function public.reclamar_premio_tarjeta(uuid, text) to authenticated;

-- 4. Pestaña "Desbloqueos" del administrador -------------------------------------------------------
create or replace function public.admin_desbloqueos_tarjetas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo el administrador puede ver los desbloqueos' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(t.fila order by t.fecha desc nulls last)
    from (
      select pr.fecha_desbloqueada as fecha,
        jsonb_build_object(
          'player_id', p.id, 'jugador', p.name, 'foto', coalesce(p.photo_face_url, p.photo_url),
          'card_level_id', cl.id::text, 'nivel', cl.nombre, 'subnivel', cl.subnivel,
          'card_id', c.id::text, 'tarjeta', c.nombre, 'orden', c.orden, 'da_premio', coalesce(c.da_premio, true),
          'fecha', pr.fecha_desbloqueada, 'reclamado', pr.premio_reclamado_en, 'entregado', pr.premio_entregado_en
        ) as fila
      from public.player_card_level_progress pr
      join public.players p on p.id = pr.player_id
      join public.card_levels cl on cl.id = pr.card_level_id
      join public.cards c on c.id = cl.card_id
      where pr.desbloqueada
    ) t
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_desbloqueos_tarjetas() from public;
grant execute on function public.admin_desbloqueos_tarjetas() to authenticated;

-- Número rojo del menú: desbloqueos desde la última visita + premios reclamados sin entregar (liviano: solo un número)
create or replace function public.admin_desbloqueos_pendientes(p_desde timestamptz)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.es_admin_plataforma() then return 0; end if;
  select count(*) into n
  from public.player_card_level_progress pr
  join public.card_levels cl on cl.id = pr.card_level_id
  join public.cards c on c.id = cl.card_id
  where pr.desbloqueada
    and (pr.fecha_desbloqueada > coalesce(p_desde, 'epoch'::timestamptz)
         or (coalesce(c.da_premio, true) and pr.premio_reclamado_en is not null and pr.premio_entregado_en is null));
  return coalesce(n, 0);
end $$;
revoke all on function public.admin_desbloqueos_pendientes(timestamptz) from public;
grant execute on function public.admin_desbloqueos_pendientes(timestamptz) to authenticated;

-- Marcar (o desmarcar) premio entregado
create or replace function public.admin_marcar_premio_tarjeta(p_player_id uuid, p_card_level_id text, p_entregado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  update public.player_card_level_progress
     set premio_entregado_en = case when p_entregado then now() else null end
   where player_id = p_player_id and card_level_id::text = p_card_level_id;
end $$;
revoke all on function public.admin_marcar_premio_tarjeta(uuid, text, boolean) from public;
grant execute on function public.admin_marcar_premio_tarjeta(uuid, text, boolean) to authenticated;

-- Prender / apagar el premio de una tarjeta
create or replace function public.admin_tarjeta_da_premio(p_card_id text, p_da_premio boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  update public.cards set da_premio = p_da_premio where id::text = p_card_id;
end $$;
revoke all on function public.admin_tarjeta_da_premio(text, boolean) from public;
grant execute on function public.admin_tarjeta_da_premio(text, boolean) to authenticated;

-- 5. Aviso al celular de los administradores ----------------------------------------------------------
alter table public.push_cola alter column match_id drop not null;  -- el aviso de tarjeta no es de un partido
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
  check (tipo in ('nuevo','cambio','resultado','recordatorio','roja','informe','cobro','tarjeta'));

create or replace function public.push_encolar_tarjeta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador text;
  v_nivel   text;
  v_premio  boolean;
begin
  begin
    if not coalesce(NEW.desbloqueada, false) then return NEW; end if;
    if TG_OP = 'UPDATE' and coalesce(OLD.desbloqueada, false) then return NEW; end if; -- ya estaba desbloqueada
    select p.name into v_jugador from public.players p where p.id = NEW.player_id;
    select c.nombre || ' · ' || cl.nombre, coalesce(c.da_premio, true) into v_nivel, v_premio
    from public.card_levels cl join public.cards c on c.id = cl.card_id where cl.id = NEW.card_level_id;
    insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
    values ('tarjeta', null, null, '{}',
            '🎉 ' || coalesce(v_jugador, 'Un jugador') || ' desbloqueó una tarjeta',
            coalesce(v_nivel, 'Tarjeta') || case when v_premio then ' · tiene 3 días para reclamar el premio' else '' end,
            'tar:' || NEW.player_id || ':' || NEW.card_level_id)
    on conflict (clave) do nothing;
  exception when others then
    null; -- nunca romper el desbloqueo por un aviso
  end;
  return NEW;
end $$;

drop trigger if exists trg_push_tarjeta on public.player_card_level_progress;
create trigger trg_push_tarjeta
  after insert or update of desbloqueada on public.player_card_level_progress
  for each row execute function public.push_encolar_tarjeta();

-- ---------------------------------------------------------------------------------
-- ROLLBACK (si algo sale mal):
--   drop trigger if exists trg_push_tarjeta on public.player_card_level_progress;
--   drop function if exists public.push_encolar_tarjeta();
--   drop function if exists public.admin_tarjeta_da_premio(text, boolean);
--   drop function if exists public.admin_marcar_premio_tarjeta(uuid, text, boolean);
--   drop function if exists public.admin_desbloqueos_pendientes(timestamptz);
--   drop function if exists public.admin_desbloqueos_tarjetas();
--   drop function if exists public.reclamar_premio_tarjeta(uuid, text);
