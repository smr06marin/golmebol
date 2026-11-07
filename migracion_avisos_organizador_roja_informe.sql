-- =====================================================================
-- AVISOS AL ORGANIZADOR: TARJETA ROJA Y INFORME DEL ÁRBITRO (al instante)
-- Cómo ejecutar: Supabase → SQL Editor → pegar TODO → RUN. Se puede correr más de una vez.
--
-- Qué hace:
--  1) push_dispositivos.usuario_id: cuando un organizador (con sesión iniciada) activa los avisos, su celular
--     queda atado a su usuario. Los hinchas siguen siendo anónimos (usuario_id vacío).
--  2) La cola de avisos acepta dos tipos nuevos: 'roja' e 'informe'.
--  3) Disparador sobre matches: cuando en la planilla (en vivo) aparece una tarjeta ROJA nueva, se crea el aviso.
--     Cada roja avisa UNA sola vez aunque la planilla se guarde muchas veces.
--  4) Disparador sobre match_informes: cuando un árbitro escribe un informe se crea el aviso
--     (los informes de «cierre automático» no avisan: no los escribe un árbitro).
--  5) El envío (api/push-enviar.js) los manda SOLO al dueño del torneo y a cualquier hora.
--  6) El cron «golmebol-push» pasa de cada 5 minutos a cada minuto, para que el aviso llegue casi al instante.
--     (No pide el secreto otra vez: solo cambia la frecuencia del trabajo que ya tienes.)
--
-- Los disparadores NUNCA rompen el guardado de la planilla: si algo fallara al crear el aviso, se omite el aviso.
-- ROLLBACK al final del archivo.
-- =====================================================================

-- 1. Celular atado al usuario ----------------------------------------
alter table public.push_dispositivos add column if not exists usuario_id uuid;
create index if not exists push_dispositivos_usuario on public.push_dispositivos (usuario_id) where usuario_id is not null;

create or replace function public.registrar_push(
  p_token text, p_plataforma text, p_equipos uuid[], p_torneos uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'Token inválido';
  end if;
  insert into public.push_dispositivos as d (token, plataforma, equipos, torneos, activo, actualizado_en, usuario_id)
  values (p_token,
          case when p_plataforma in ('android','ios') then p_plataforma else 'android' end,
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_equipos,'{}')) x limit 300) s),
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_torneos,'{}')) x limit 100) s),
          true, now(), auth.uid())
  on conflict (token) do update
    set plataforma = excluded.plataforma,
        equipos = excluded.equipos,
        torneos = excluded.torneos,
        activo = true,
        actualizado_en = now(),
        usuario_id = excluded.usuario_id;
end $$;
revoke all on function public.registrar_push(text, text, uuid[], uuid[]) from public;
grant execute on function public.registrar_push(text, text, uuid[], uuid[]) to anon, authenticated;

create or replace function public.registrar_push_web(
  p_endpoint text, p_p256dh text, p_auth text, p_equipos uuid[], p_torneos uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or length(p_endpoint) < 20 or length(p_endpoint) > 1000
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'Suscripción inválida';
  end if;
  if p_p256dh is null or length(p_p256dh) not between 20 and 200 or p_auth is null or length(p_auth) not between 8 and 100 then
    raise exception 'Suscripción inválida';
  end if;
  insert into public.push_dispositivos as d (token, plataforma, suscripcion, equipos, torneos, activo, actualizado_en, usuario_id)
  values (p_endpoint, 'web', jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth),
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_equipos,'{}')) x limit 300) s),
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_torneos,'{}')) x limit 100) s),
          true, now(), auth.uid())
  on conflict (token) do update
    set plataforma = 'web',
        suscripcion = excluded.suscripcion,
        equipos = excluded.equipos,
        torneos = excluded.torneos,
        activo = true,
        actualizado_en = now(),
        usuario_id = excluded.usuario_id;
end $$;
revoke all on function public.registrar_push_web(text, text, text, uuid[], uuid[]) from public;
grant execute on function public.registrar_push_web(text, text, text, uuid[], uuid[]) to anon, authenticated;

-- 2. Tipos nuevos en la cola -------------------------------------------
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
  check (tipo in ('nuevo','cambio','resultado','recordatorio','roja','informe'));

-- 3. Tarjeta ROJA en vivo ------------------------------------------------
-- Saca las rojas de la planilla en vivo. completa = jugadoresLocal / jugadoresVisitante con la marca «roja»;
-- rápida = eventos de tipo red_card. Devuelve una lista de { k, lado, numero, nombre, minuto }.
create or replace function public.push_rojas_de(p_snap jsonb, p_tipo text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v   jsonb := p_snap;
  r   jsonb := '[]'::jsonb;
  e   jsonb;
  lado text;
  arr jsonb;
begin
  if v is null then return r; end if;
  if jsonb_typeof(v) = 'string' then
    begin v := (v #>> '{}')::jsonb; exception when others then return r; end;
  end if;
  if jsonb_typeof(v) <> 'object' then return r; end if;

  if p_tipo = 'rapida' then
    arr := case when jsonb_typeof(v -> 'eventos') = 'array' then v -> 'eventos' else '[]'::jsonb end;
    for e in select * from jsonb_array_elements(arr) loop
      if e ->> 'tipo' = 'red_card' then
        r := r || jsonb_build_array(jsonb_build_object(
          'k', coalesce(e ->> 'team', '') || '|' || coalesce(e ->> 'numero', '') || '|' || lower(coalesce(e ->> 'jugadorNombre', '')),
          'lado', coalesce(e ->> 'team', ''), 'numero', coalesce(e ->> 'numero', ''),
          'nombre', coalesce(e ->> 'jugadorNombre', ''), 'minuto', coalesce(e ->> 'minuto', '')));
      end if;
    end loop;
  else
    foreach lado in array array['local', 'visitante'] loop
      arr := case when jsonb_typeof(v -> (case when lado = 'local' then 'jugadoresLocal' else 'jugadoresVisitante' end)) = 'array'
                  then v -> (case when lado = 'local' then 'jugadoresLocal' else 'jugadoresVisitante' end) else '[]'::jsonb end;
      for e in select * from jsonb_array_elements(arr) loop
        if coalesce(e ->> 'roja', '') not in ('', 'false') then
          r := r || jsonb_build_array(jsonb_build_object(
            'k', lado || '|' || coalesce(e ->> 'numero', '') || '|' || lower(coalesce(e ->> 'nombre', '')),
            'lado', lado, 'numero', coalesce(e ->> 'numero', ''), 'nombre', coalesce(e ->> 'nombre', ''),
            'minuto', case when coalesce(e ->> 'roja', '') in ('true') then '' else coalesce(e ->> 'roja', '') end));
        end if;
      end loop;
    end loop;
  end if;
  return r;
end $$;

create or replace function public.push_encolar_roja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n     jsonb := to_jsonb(NEW);
  v_o     jsonb := to_jsonb(OLD);
  v_col   text;
  v_tipo  text;
  v_new   jsonb;
  v_old   jsonb;
  x       jsonb;
  v_local text;
  v_visit text;
  v_equipo text;
  v_quien text;
begin
  begin
    -- Partido que ya estaba terminado y se vuelve a abrir para corregirlo: no son rojas nuevas
    if OLD.status = 'finished' then return NEW; end if;

    foreach v_col in array array['live_state', 'live_state_rapida'] loop
      v_tipo := case when v_col = 'live_state' then 'completa' else 'rapida' end;
      v_new := public.push_rojas_de(v_n -> v_col, v_tipo);
      v_old := public.push_rojas_de(v_o -> v_col, v_tipo);
      -- Solo si hay más rojas que antes (así no se revisa nada en cada guardado normal de la planilla)
      if jsonb_array_length(v_new) <= jsonb_array_length(v_old) then continue; end if;

      if v_local is null then
        select name into v_local from public.teams where id = NEW.home_team_id;
        select name into v_visit from public.teams where id = NEW.away_team_id;
        v_local := coalesce(v_local, 'Local'); v_visit := coalesce(v_visit, 'Visitante');
      end if;

      for x in select * from jsonb_array_elements(v_new) loop
        if exists (select 1 from jsonb_array_elements(v_old) as t(val) where t.val ->> 'k' = x ->> 'k') then continue; end if;
        v_equipo := case when x ->> 'lado' = 'local' then v_local else v_visit end;
        v_quien := coalesce(nullif(trim(x ->> 'nombre'), ''), case when nullif(x ->> 'numero', '') is not null then 'Jugador #' || (x ->> 'numero') else 'Un jugador' end);
        insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
        values ('roja', NEW.id, NEW.tournament_id, '{}', 'Tarjeta roja',
                'Expulsado: ' || v_quien
                  || case when nullif(x ->> 'numero', '') is not null and nullif(trim(x ->> 'nombre'), '') is not null then ' (#' || (x ->> 'numero') || ')' else '' end
                  || ' · ' || v_equipo
                  || case when nullif(x ->> 'minuto', '') is not null then ' · min ' || (x ->> 'minuto') else '' end,
                -- misma roja = mismo aviso, aunque se guarde varias veces o cambie de planilla completa a rápida
                'roj:' || NEW.id || ':' || md5(x ->> 'k'))
        on conflict (clave) do nothing;
      end loop;
    end loop;
  exception when others then
    null; -- nunca romper el guardado de la planilla por un aviso
  end;
  return NEW;
end $$;

drop trigger if exists trg_push_roja on public.matches;
create trigger trg_push_roja
  after update of live_state, live_state_rapida on public.matches
  for each row execute function public.push_encolar_roja();

-- 4. Informe del árbitro ---------------------------------------------------
create or replace function public.push_encolar_informe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_torneo uuid := NEW.tournament_id;
  v_txt    text;
  v_titulo text;
begin
  begin
    -- El cierre automático lo escribe el sistema, no un árbitro
    if lower(coalesce(NEW.creado_por, '')) like '%cierre autom%' then return NEW; end if;
    if v_torneo is null then select tournament_id into v_torneo from public.matches where id = NEW.match_id; end if;
    if v_torneo is null then return NEW; end if;

    v_titulo := case NEW.tipo
      when 'roja'            then 'Informe del árbitro · tarjeta roja'
      when 'terminado_antes' then 'Informe del árbitro · partido terminado antes'
      else 'Informe del árbitro' end;
    v_txt := regexp_replace(coalesce(NEW.descripcion, ''), '\s+', ' ', 'g');
    v_txt := case when length(v_txt) > 140 then left(v_txt, 140) || '…' else v_txt end;

    insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
    values ('informe', NEW.match_id, v_torneo, '{}', v_titulo,
            coalesce(nullif(trim(v_txt), ''), 'El árbitro escribió un informe de este partido'),
            'inf:' || NEW.id)
    on conflict (clave) do nothing;
  exception when others then
    null; -- nunca romper el guardado del informe por un aviso
  end;
  return NEW;
end $$;

drop trigger if exists trg_push_informe on public.match_informes;
create trigger trg_push_informe
  after insert on public.match_informes
  for each row execute function public.push_encolar_informe();

-- 5. Que el envío corra cada minuto (antes cada 5) --------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'golmebol-push' limit 1), schedule := '* * * * *');
  end if;
exception when others then
  raise notice 'No se pudo cambiar el cron (revisa que exista el trabajo golmebol-push): %', sqlerrm;
end $$;

-- Para ver que quedó cada minuto:  select jobname, schedule from cron.job;
-- Para dejarlo otra vez cada 5 min: select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'golmebol-push'), schedule := '*/5 * * * *');

-- ROLLBACK (quita solo esto; no toca partidos ni informes):
--   drop trigger if exists trg_push_roja on public.matches;
--   drop trigger if exists trg_push_informe on public.match_informes;
--   drop function if exists public.push_encolar_roja();
--   drop function if exists public.push_encolar_informe();
--   drop function if exists public.push_rojas_de(jsonb, text);
--   delete from public.push_cola where tipo in ('roja','informe');
--   (las funciones registrar_push / registrar_push_web pueden quedarse: solo guardan además el usuario)
