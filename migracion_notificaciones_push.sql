-- ============================================================
-- NOTIFICACIONES PUSH DE LA APP — paso 1: tablas y avisos automáticos
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- Es seguro ejecutarlo más de una vez.
--
-- Qué crea:
--  * push_dispositivos: un renglón por celular con la app instalada
--    (guarda el "token" de Firebase, qué equipos sigue y qué torneos activó).
--    No guarda nombres, cédulas ni correos: es anónimo.
--  * push_cola: lista de avisos por enviar. La llenan solos unos
--    disparadores sobre la tabla matches:
--        - partido nuevo programado
--        - cambio de fecha / hora / cancha de un partido
--        - resultado final (cuando el partido pasa a "finished")
--    (el recordatorio de 1 hora antes lo calcula el envío, ver api/push-enviar.js)
--  * registrar_push / baja_push: funciones con las que la app guarda o
--    quita su celular. Nadie puede leer las tablas desde afuera.
--
-- IMPORTANTE: los disparadores NUNCA rompen el guardado de un partido: si algo
-- fallara al crear el aviso, el partido se guarda igual y el aviso se omite.
--
-- ROLLBACK: al final del archivo (bloque comentado).
-- ============================================================

-- 1. Celulares registrados ------------------------------------
create table if not exists public.push_dispositivos (
  token          text primary key,
  plataforma     text        not null default 'android',
  equipos        uuid[]      not null default '{}',
  torneos        uuid[]      not null default '{}',
  activo         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.push_dispositivos enable row level security;
revoke all on public.push_dispositivos from anon, authenticated;

-- 2. Cola de avisos -------------------------------------------
create table if not exists public.push_cola (
  id         bigserial primary key,
  tipo       text        not null check (tipo in ('nuevo','cambio','resultado','recordatorio')),
  match_id   uuid        not null,
  torneo_id  uuid,
  equipos    uuid[]      not null default '{}',
  titulo     text        not null,
  cuerpo     text        not null,
  clave      text        not null unique,   -- evita avisos repetidos del mismo hecho
  vence_en   timestamptz,                   -- nuevo/cambio: si el partido ya empezó, no se avisa
  creado_en  timestamptz not null default now(),
  enviado_en timestamptz
);
create index if not exists push_cola_pendientes on public.push_cola (id) where enviado_en is null;
alter table public.push_cola enable row level security;
revoke all on public.push_cola from anon, authenticated;

-- 3. Funciones para la app ------------------------------------
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
  insert into public.push_dispositivos as d (token, plataforma, equipos, torneos, activo, actualizado_en)
  values (p_token,
          case when p_plataforma in ('android','ios') then p_plataforma else 'android' end,
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_equipos,'{}')) x limit 300) s),
          (select coalesce(array_agg(x), '{}') from (select distinct unnest(coalesce(p_torneos,'{}')) x limit 100) s),
          true, now())
  on conflict (token) do update
    set plataforma = excluded.plataforma,
        equipos = excluded.equipos,
        torneos = excluded.torneos,
        activo = true,
        actualizado_en = now();
end $$;
revoke all on function public.registrar_push(text, text, uuid[], uuid[]) from public;
grant execute on function public.registrar_push(text, text, uuid[], uuid[]) to anon, authenticated;

create or replace function public.baja_push(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_dispositivos set activo = false, actualizado_en = now() where token = p_token;
$$;
revoke all on function public.baja_push(text) from public;
grant execute on function public.baja_push(text) to anon, authenticated;

-- 4. Texto de fecha en español (hora de Colombia) --------------
create or replace function public.push_fecha_es(p_ts timestamptz)
returns text
language sql
immutable
as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from (p_ts at time zone 'America/Bogota'))::int + 1]
    || ' ' || extract(day from (p_ts at time zone 'America/Bogota'))::int
    || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from (p_ts at time zone 'America/Bogota'))::int]
    || ', ' || lower(to_char(p_ts at time zone 'America/Bogota', 'FMHH12:MI am'));
$$;

-- 5. Disparador sobre matches ----------------------------------
create or replace function public.push_encolar_partido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo   jsonb := to_jsonb(NEW);
  v_viejo   jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  v_local   text;
  v_visit   text;
  v_torneo  text;
  v_lugar   text := nullif(v_nuevo ->> 'location', '');
  v_cuando  text;
  v_pen     text := '';
  v_ids     uuid[] := array[NEW.home_team_id, NEW.away_team_id];
  v_cambio  boolean := false;
begin
  begin
    if NEW.home_team_id is null or NEW.away_team_id is null then return NEW; end if;

    select name into v_local  from public.teams where id = NEW.home_team_id;
    select name into v_visit  from public.teams where id = NEW.away_team_id;
    select name into v_torneo from public.tournaments where id = NEW.tournament_id;
    v_local  := coalesce(v_local, 'Local');
    v_visit  := coalesce(v_visit, 'Visitante');
    v_cuando := case when NEW.played_at is not null then public.push_fecha_es(NEW.played_at) end;

    -- RESULTADO FINAL: el partido acaba de pasar a "finished"
    if NEW.status = 'finished' and (TG_OP = 'INSERT' or OLD.status is distinct from 'finished') then
      if coalesce(v_nuevo ->> 'penales_local', '') <> '' and coalesce(v_nuevo ->> 'penales_visitante', '') <> '' then
        v_pen := ' (pen. ' || (v_nuevo ->> 'penales_local') || '-' || (v_nuevo ->> 'penales_visitante') || ')';
      end if;
      insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave)
      values ('resultado', NEW.id, NEW.tournament_id, v_ids, 'Resultado final',
              v_local || ' ' || coalesce(NEW.home_score, 0) || ' – ' || coalesce(NEW.away_score, 0) || ' ' || v_visit
                || v_pen || case when v_torneo is not null then ' · ' || v_torneo else '' end,
              'res:' || NEW.id)
      on conflict (clave) do nothing;
      return NEW;
    end if;

    if NEW.status = 'finished' or NEW.played_at is null then return NEW; end if;

    -- PARTIDO NUEVO: se crea con fecha, o una fecha se le pone por primera vez
    if TG_OP = 'INSERT' or (v_viejo ->> 'played_at') is null then
      insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave, vence_en)
      values ('nuevo', NEW.id, NEW.tournament_id, v_ids, 'Nuevo partido programado',
              v_local || ' vs ' || v_visit || ' · ' || v_cuando
                || case when v_lugar is not null then ' · ' || v_lugar else '' end
                || case when v_torneo is not null then ' (' || v_torneo || ')' else '' end,
              'nue:' || NEW.id || ':' || extract(epoch from NEW.played_at)::bigint, NEW.played_at)
      on conflict (clave) do nothing;
      return NEW;
    end if;

    -- CAMBIO de fecha, hora o cancha (de un partido que ya tenía fecha)
    v_cambio := NEW.played_at is distinct from OLD.played_at
      or ((v_viejo ->> 'location') is not null and (v_viejo ->> 'location') is distinct from (v_nuevo ->> 'location'))
      or ((v_viejo ->> 'cancha_id') is not null and (v_viejo ->> 'cancha_id') is distinct from (v_nuevo ->> 'cancha_id'));
    if not v_cambio then return NEW; end if;

    -- Si el aviso de "nuevo" todavía no salió (horario de silencio), se le actualiza el texto
    -- en vez de mandar dos avisos seguidos del mismo partido.
    update public.push_cola
       set cuerpo = v_local || ' vs ' || v_visit || ' · ' || v_cuando
                    || case when v_lugar is not null then ' · ' || v_lugar else '' end
                    || case when v_torneo is not null then ' (' || v_torneo || ')' else '' end,
           vence_en = NEW.played_at
     where match_id = NEW.id and tipo = 'nuevo' and enviado_en is null;
    if found then return NEW; end if;

    -- Un cambio que todavía no salió se reemplaza por el más reciente
    delete from public.push_cola where match_id = NEW.id and tipo = 'cambio' and enviado_en is null;
    insert into public.push_cola (tipo, match_id, torneo_id, equipos, titulo, cuerpo, clave, vence_en)
    values ('cambio', NEW.id, NEW.tournament_id, v_ids, 'Cambio en el partido',
            v_local || ' vs ' || v_visit || ' ahora: ' || v_cuando
              || case when v_lugar is not null then ' · ' || v_lugar else '' end,
            'cam:' || NEW.id || ':' || md5(NEW.played_at::text || coalesce(v_nuevo ->> 'location','') || coalesce(v_nuevo ->> 'cancha_id','')),
            NEW.played_at)
    on conflict (clave) do nothing;
  exception when others then
    -- nunca romper el guardado del partido por un aviso
    null;
  end;
  return NEW;
end $$;

drop trigger if exists trg_push_partido on public.matches;
create trigger trg_push_partido
  after insert or update of status, played_at, location, cancha_id on public.matches
  for each row execute function public.push_encolar_partido();

-- ------------------------------------------------------------
-- ROLLBACK (quita todo lo de notificaciones; no toca partidos):
--   drop trigger if exists trg_push_partido on public.matches;
--   drop function if exists public.push_encolar_partido();
--   drop function if exists public.push_fecha_es(timestamptz);
--   drop function if exists public.registrar_push(text, text, uuid[], uuid[]);
--   drop function if exists public.baja_push(text);
--   drop table if exists public.push_cola;
--   drop table if exists public.push_dispositivos;
-- ------------------------------------------------------------
