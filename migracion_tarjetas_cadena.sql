-- ════════════════════════════════════════════════════════════════════════════════════════════
-- TARJETAS — REGLA NUEVA (reemplaza la anterior; incluye todo lo de migracion_desbloqueo_tarjetas.sql)
--
--  · Todos empiezan con INICIACIÓN I.
--  · Con 3 de los 5 logros de una tarjeta se desbloquea la SIGUIENTE
--      Iniciación I → Iniciación II → … → Iniciación V → Competidor I → … → Leyenda V.
--  · El PREMIO de una tarjeta se gana al romper LOS 5 logros de esa tarjeta, y se reclama dentro de
--    los 3 días (72 h) siguientes (desde la pestaña de su tarjeta, mandando el pantallazo por el chat).
--  · Una tarjeta desbloqueada ya no se pierde (aunque después se rompa una racha).
--  · Las tarjetas especiales (las que se crean aparte con sponsor) siguen como antes: se desbloquean con
--    sus propios logros.
--
-- Correr en Supabase → SQL Editor. Se puede volver a correr sin problema.
-- Al final recalcula a los jugadores que ya tienen logros (sin mandar avisos de todo eso).
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Columnas ---------------------------------------------------------------------------------------
alter table public.player_card_level_progress add column if not exists premio_reclamado_en timestamptz;
alter table public.player_card_level_progress add column if not exists premio_entregado_en timestamptz;
alter table public.player_card_level_progress add column if not exists fecha_completa timestamptz; -- cuando rompió los 5 logros

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'cards' and column_name = 'da_premio') then
    alter table public.cards add column da_premio boolean not null default true;
  end if;
end $$;

-- Tarjetas de la cadena principal (en este orden): Iniciación, Competidor, Élite, Leyenda
create or replace function public.es_tarjeta_cadena(p_card_id uuid)
returns boolean language sql immutable as $$
  select p_card_id::text in ('11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002',
                             '11111111-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000004')
$$;

-- La tarjeta con la que todos empiezan (Iniciación I)
create or replace function public.es_tarjeta_inicial(p_card_level_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.card_levels cl
    where cl.id = p_card_level_id and cl.card_id::text = '11111111-0000-0000-0000-000000000001'
      and cl.subnivel = (select min(subnivel) from public.card_levels where card_id::text = '11111111-0000-0000-0000-000000000001')
  )
$$;

-- 2. verificar_logros con la regla nueva --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verificar_logros(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_cache     player_stats_cache%ROWTYPE;
  v_pos       text;
  ach         RECORD;
  v_valor     numeric;
  v_completado boolean;
  v_logros_completados integer;
  v_total     integer;
  nivel       RECORD;
  ya_desbloqueada boolean;
  v_desbloq   boolean;
  v_completa  boolean;
  v_sigue     boolean := true;   -- cadena principal: ¿la tarjeta anterior ya abre la siguiente?
begin
  -- Traer cache
  SELECT * INTO v_cache FROM player_stats_cache WHERE player_id = p_player_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Posición del jugador
  SELECT CASE
    WHEN posicion_futbol5 = 'Portero' OR posicion_futbol7 = 'Portero' OR posicion_futbol11 = 'Portero' THEN 'arquero'
    WHEN posicion_futbol5 IN ('Cierre') OR posicion_futbol7 IN ('Defensa central','Lateral derecho','Lateral izquierdo') OR posicion_futbol11 IN ('Defensa central','Lateral derecho','Lateral izquierdo','Mediocampista defensivo') THEN 'defensa'
    ELSE 'campo'
  END INTO v_pos FROM players WHERE id = p_player_id;

  -- Recorrer todos los logros aplicables al jugador
  FOR ach IN
    SELECT a.*, cl.id as cl_id, cl.logros_requeridos
    FROM achievements a
    JOIN card_levels cl ON cl.id = a.card_level_id
    WHERE a.tipo = 'universal' OR a.tipo = v_pos
    ORDER BY cl.id, a.orden
  LOOP
    v_valor := CASE ach.stat_key
      WHEN 'pj'                     THEN v_cache.pj
      WHEN 'victorias'              THEN v_cache.victorias
      WHEN 'goles'                  THEN v_cache.goles
      WHEN 'dobletes'               THEN v_cache.dobletes
      WHEN 'hat_tricks'             THEN v_cache.hat_tricks
      WHEN 'racha_goles_actual'     THEN v_cache.racha_goles_actual
      WHEN 'racha_victorias_actual' THEN v_cache.racha_victorias_actual
      WHEN 'arcos_cero'             THEN v_cache.arcos_cero
      WHEN 'partidos_sin_tarjetas'  THEN v_cache.partidos_sin_tarjetas
      WHEN 'campeonatos'            THEN v_cache.campeonatos
      WHEN 'mejor_arquero_count'    THEN v_cache.mejor_arquero_count
      WHEN 'valla_menos_vencida_count' THEN v_cache.valla_menos_vencida_count
      WHEN 'goleador_torneo_count'  THEN v_cache.goleador_torneo_count
      ELSE 0
    END;

    v_completado := v_valor >= ach.meta;

    INSERT INTO player_achievement_progress (player_id, achievement_id, completado, fecha_completado)
    VALUES (p_player_id, ach.id, v_completado, CASE WHEN v_completado THEN now() ELSE NULL END)
    ON CONFLICT (player_id, achievement_id) DO UPDATE SET
      completado       = EXCLUDED.completado,
      fecha_completado = CASE WHEN EXCLUDED.completado AND player_achievement_progress.fecha_completado IS NULL
                              THEN now() ELSE player_achievement_progress.fecha_completado END;
  END LOOP;

  -- Desbloqueo de tarjetas: cadena principal en orden (Iniciación I…V, Competidor I…V, Élite…, Leyenda…),
  -- después las especiales.
  FOR nivel IN
    SELECT cl.*, public.es_tarjeta_cadena(cl.card_id) AS cadena
    FROM card_levels cl JOIN cards c ON c.id = cl.card_id
    ORDER BY public.es_tarjeta_cadena(cl.card_id) DESC, c.orden, cl.card_id, cl.subnivel
  LOOP
    SELECT COUNT(*) FILTER (WHERE pap.completado), COUNT(*)
      INTO v_logros_completados, v_total
    FROM achievements a
    LEFT JOIN player_achievement_progress pap ON pap.achievement_id = a.id AND pap.player_id = p_player_id
    WHERE a.card_level_id = nivel.id
      AND (a.tipo = 'universal' OR a.tipo = v_pos);

    SELECT desbloqueada INTO ya_desbloqueada
    FROM player_card_level_progress
    WHERE player_id = p_player_id AND card_level_id = nivel.id;

    IF nivel.cadena THEN
      v_desbloq := v_sigue OR COALESCE(ya_desbloqueada, false);            -- la primera siempre; una vez abierta no se pierde
      v_sigue   := v_desbloq AND v_logros_completados >= COALESCE(nivel.logros_requeridos, 3);  -- 3 de 5 abren la siguiente
    ELSE
      v_desbloq := COALESCE(ya_desbloqueada, false) OR v_logros_completados >= COALESCE(nivel.logros_requeridos, 3);
    END IF;
    v_completa := v_desbloq AND v_total > 0 AND v_logros_completados >= v_total;   -- los 5: premio

    INSERT INTO player_card_level_progress (player_id, card_level_id, logros_completados, desbloqueada, fecha_desbloqueada, fecha_completa)
    VALUES (p_player_id, nivel.id, v_logros_completados, v_desbloq,
            CASE WHEN v_desbloq THEN now() ELSE NULL END,
            CASE WHEN v_completa THEN now() ELSE NULL END)
    ON CONFLICT (player_id, card_level_id) DO UPDATE SET
      logros_completados = EXCLUDED.logros_completados,
      desbloqueada       = EXCLUDED.desbloqueada OR player_card_level_progress.desbloqueada,
      fecha_desbloqueada = COALESCE(player_card_level_progress.fecha_desbloqueada,
                                    CASE WHEN EXCLUDED.desbloqueada THEN now() END),
      fecha_completa     = COALESCE(player_card_level_progress.fecha_completa, EXCLUDED.fecha_completa);

    -- Notificación cuando se desbloquea por primera vez (la inicial no cuenta)
    IF v_desbloq AND (ya_desbloqueada IS NULL OR ya_desbloqueada = false) AND NOT public.es_tarjeta_inicial(nivel.id) THEN
      INSERT INTO player_notifications (player_id, tipo, titulo, mensaje, data)
      VALUES (
        p_player_id, 'subnivel_desbloqueado',
        '¡Nueva tarjeta desbloqueada! 🎉',
        'Has desbloqueado ' || nivel.nombre,
        jsonb_build_object('card_level_id', nivel.id, 'card_design_id', nivel.card_design_id)
      );
    END IF;
  END LOOP;
end;
$$;

-- 2b. El jugador pide recalcular SUS tarjetas (la app lo llama sola si ve que ya rompió los logros pero la
--     tarjeta todavía no aparece desbloqueada, para no esperar al próximo partido)
create or replace function public.recalcular_mis_tarjetas(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.es_mi_jugador(p_player_id) or public.es_admin_plataforma()) then return; end if;
  begin
    perform public.recalcular_player_stats(p_player_id);
  exception when undefined_function then null;
  end;
  perform public.verificar_logros(p_player_id);
end $$;
revoke all on function public.recalcular_mis_tarjetas(uuid) from public;
grant execute on function public.recalcular_mis_tarjetas(uuid) to authenticated;

-- 3. El jugador reclama su premio: solo con los 5 logros rotos y dentro de 3 días -------------------------
create or replace function public.reclamar_premio_tarjeta(p_player_id uuid, p_card_level_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completa  timestamptz;
  v_reclamado timestamptz;
  v_premio    boolean;
begin
  if not (public.es_mi_jugador(p_player_id) or public.es_admin_plataforma()) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  select pr.fecha_completa, pr.premio_reclamado_en, coalesce(c.da_premio, true)
    into v_completa, v_reclamado, v_premio
  from public.player_card_level_progress pr
  join public.card_levels cl on cl.id = pr.card_level_id
  join public.cards c on c.id = cl.card_id
  where pr.player_id = p_player_id and pr.card_level_id::text = p_card_level_id;

  if not found or v_completa is null then return jsonb_build_object('ok', false, 'motivo', 'no_completa'); end if;
  if not v_premio then return jsonb_build_object('ok', false, 'motivo', 'sin_premio'); end if;
  if v_reclamado is not null then return jsonb_build_object('ok', true, 'reclamado_en', v_reclamado); end if;
  if v_completa < now() - interval '3 days' then return jsonb_build_object('ok', false, 'motivo', 'vencido'); end if;

  update public.player_card_level_progress
     set premio_reclamado_en = now()
   where player_id = p_player_id and card_level_id::text = p_card_level_id;
  return jsonb_build_object('ok', true, 'reclamado_en', now());
end $$;
revoke all on function public.reclamar_premio_tarjeta(uuid, text) from public;
grant execute on function public.reclamar_premio_tarjeta(uuid, text) to authenticated;

-- 4. Pestaña "Desbloqueos" del administrador ------------------------------------------------------------
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
      select greatest(pr.fecha_desbloqueada, coalesce(pr.fecha_completa, pr.fecha_desbloqueada)) as fecha,
        jsonb_build_object(
          'player_id', p.id, 'jugador', p.name, 'foto', coalesce(p.photo_face_url, p.photo_url),
          'card_level_id', cl.id::text, 'nivel', cl.nombre, 'subnivel', cl.subnivel,
          'card_id', c.id::text, 'tarjeta', c.nombre, 'orden', c.orden, 'da_premio', coalesce(c.da_premio, true),
          'fecha', pr.fecha_desbloqueada, 'completa', pr.fecha_completa, 'logros', pr.logros_completados,
          'reclamado', pr.premio_reclamado_en, 'entregado', pr.premio_entregado_en
        ) as fila
      from public.player_card_level_progress pr
      join public.players p on p.id = pr.player_id
      join public.card_levels cl on cl.id = pr.card_level_id
      join public.cards c on c.id = cl.card_id
      where pr.desbloqueada
        -- Iniciación I la tienen todos (no es un desbloqueo): sale solo si ya rompió sus 5 logros (premio)
        and (not public.es_tarjeta_inicial(cl.id) or pr.fecha_completa is not null)
    ) t
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_desbloqueos_tarjetas() from public;
grant execute on function public.admin_desbloqueos_tarjetas() to authenticated;

-- Número rojo del menú: desbloqueos o tarjetas completas desde la última visita + premios reclamados sin entregar
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
    and (
      (pr.fecha_desbloqueada > coalesce(p_desde, 'epoch'::timestamptz) and not public.es_tarjeta_inicial(cl.id))
      or pr.fecha_completa > coalesce(p_desde, 'epoch'::timestamptz)
      or (coalesce(c.da_premio, true) and pr.premio_reclamado_en is not null and pr.premio_entregado_en is null)
    );
  return coalesce(n, 0);
end $$;
revoke all on function public.admin_desbloqueos_pendientes(timestamptz) from public;
grant execute on function public.admin_desbloqueos_pendientes(timestamptz) to authenticated;

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

-- 5. Aviso al celular de los administradores ------------------------------------------------------------
alter table public.push_cola alter column match_id drop not null;
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
  v_nuevo_desbloqueo boolean;
  v_nueva_completa   boolean;
begin
  begin
    if current_setting('golmebol.sin_avisos', true) = '1' then return NEW; end if; -- recálculo masivo: sin avisos
    v_nuevo_desbloqueo := coalesce(NEW.desbloqueada, false)
                          and (TG_OP = 'INSERT' or not coalesce(OLD.desbloqueada, false))
                          and not public.es_tarjeta_inicial(NEW.card_level_id);
    v_nueva_completa   := NEW.fecha_completa is not null and (TG_OP = 'INSERT' or OLD.fecha_completa is null);
    if not (v_nuevo_desbloqueo or v_nueva_completa) then return NEW; end if;

    select p.name into v_jugador from public.players p where p.id = NEW.player_id;
    select c.nombre || ' · ' || cl.nombre, coalesce(c.da_premio, true) into v_nivel, v_premio
    from public.card_levels cl join public.cards c on c.id = cl.card_id where cl.id = NEW.card_level_id;

    if v_nuevo_desbloqueo then
      insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
      values ('tarjeta', null, null, '{}', '🎉 ' || coalesce(v_jugador, 'Un jugador') || ' desbloqueó una tarjeta',
              coalesce(v_nivel, 'Tarjeta'), 'tar:' || NEW.player_id || ':' || NEW.card_level_id)
      on conflict (clave) do nothing;
    end if;
    if v_nueva_completa and v_premio then
      insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
      values ('tarjeta', null, null, '{}', '🎁 ' || coalesce(v_jugador, 'Un jugador') || ' rompió los 5 logros',
              coalesce(v_nivel, 'Tarjeta') || ' · ganó el premio: tiene 3 días para reclamarlo',
              'tarc:' || NEW.player_id || ':' || NEW.card_level_id)
      on conflict (clave) do nothing;
    end if;
  exception when others then
    null; -- nunca romper el desbloqueo por un aviso
  end;
  return NEW;
end $$;

drop trigger if exists trg_push_tarjeta on public.player_card_level_progress;
create trigger trg_push_tarjeta
  after insert or update of desbloqueada, fecha_completa on public.player_card_level_progress
  for each row execute function public.push_encolar_tarjeta();

-- 6. Ponerse al día con la regla nueva (sin avisos) ---------------------------------------------------------
-- Solo jugadores que ya tienen algún logro roto; los demás quedan con Iniciación I apenas jueguen su próximo partido
-- (la app ya les muestra Iniciación I como suya desde el principio).
do $$
declare r record;
begin
  perform set_config('golmebol.sin_avisos', '1', true);
  for r in select distinct player_id from public.player_achievement_progress where completado loop
    perform public.verificar_logros(r.player_id);
  end loop;
end $$;

-- Revisar (opcional): cuántos jugadores hay en cada tarjeta
-- select c.nombre, cl.nombre, count(*) from public.player_card_level_progress pr
-- join public.card_levels cl on cl.id = pr.card_level_id join public.cards c on c.id = cl.card_id
-- where pr.desbloqueada group by 1, 2, c.orden, cl.subnivel order by c.orden, cl.subnivel;
