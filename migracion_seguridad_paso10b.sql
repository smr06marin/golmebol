-- =====================================================================
-- PASO 10B — Links de planilla y reloj: tokens privados + exigir haber entrado con el link
-- =====================================================================
-- CORRER SOLO CUANDO:
--   1) migracion_seguridad_paso10a.sql ya está corrida, y
--   2) el cambio de PlanillarLinkPage.jsx ya está subido y DESPLEGADO, y
--   3) NO HAY PARTIDOS EN VIVO (quien esté planillando con un link abierto antes de este
--      paso tendrá que volver a abrir el link y tocar "Entrar a planillar").
-- QUÉ HACE:
--   * Copia los tokens existentes a la tabla privada (los links ya repartidos SIGUEN FUNCIONANDO).
--   * Borra los tokens de la tabla pública matches.
--     (matches.link_planilla_grupo queda como identificador del grupo, ya NO es secreto.)
--   * Reescribe las funciones de links y de reloj para leer los tokens de la tabla privada.
--   * Para planillar con un link, la sesión tiene que haber "entrado" con ese link
--     (planilla_accesos) y el link tiene que estar dentro de su ventana de tiempo.
--     Cambiado en: puede_planillar_partido, guardar_resultado_partido, guardar_estado_en_vivo,
--     reloj_eventos_del_partido.
--   * Elimina reclamar_planilla_por_link (ya no se usa y creaba "árbitros" con solo el token).
-- Todo en UNA transacción: si algo falla, no queda nada a medias.
-- =====================================================================
begin;

-- 1) Copiar los tokens actuales a la tabla privada (sin pisar lo ya copiado)
insert into public.match_link_tokens (match_id, planilla_token, grupo_token, reloj_token)
select m.id, m.link_planilla_token, m.link_planilla_grupo, m.link_reloj_token
from public.matches m
where m.link_planilla_token is not null or m.link_planilla_grupo is not null or m.link_reloj_token is not null
on conflict (match_id) do update set
  planilla_token = coalesce(public.match_link_tokens.planilla_token, excluded.planilla_token),
  grupo_token    = coalesce(public.match_link_tokens.grupo_token,    excluded.grupo_token),
  reloj_token    = coalesce(public.match_link_tokens.reloj_token,    excluded.reloj_token),
  updated_at     = now();

-- 2) El grupo en matches deja de ser secreto: se le pone un identificador NUEVO por grupo
update public.matches m
set link_planilla_grupo = x.nuevo
from (select g.viejo, gen_random_uuid() as nuevo
      from (select distinct link_planilla_grupo as viejo from public.matches where link_planilla_grupo is not null) g) x
where m.link_planilla_grupo = x.viejo;

-- 3) Borrar los tokens de la tabla pública
update public.matches
set link_planilla_token = null, link_reloj_token = null
where link_planilla_token is not null or link_reloj_token is not null;

-- 4) Funciones de links de planilla ------------------------------------
create or replace function public.generar_link_planilla(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tournament_id uuid;
  v_organizador_id uuid;
  v_token uuid;
  v_expira timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select m.tournament_id, t.organizador_id, m.link_planilla_expira
    into v_tournament_id, v_organizador_id, v_expira
  from matches m
  join tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_tournament_id is null then
    raise exception 'Partido no encontrado';
  end if;

  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  select k.planilla_token into v_token from match_link_tokens k where k.match_id = p_match_id;

  -- Si ya hay un link vigente (no vencido), se reutiliza tal cual
  if v_token is not null and v_expira is not null and v_expira > now() then
    return jsonb_build_object('token', v_token, 'expira', v_expira);
  end if;

  v_token := gen_random_uuid();
  v_expira := now() + interval '24 hours';

  insert into match_link_tokens (match_id, planilla_token)
  values (p_match_id, v_token)
  on conflict (match_id) do update set planilla_token = excluded.planilla_token, updated_at = now();

  update matches set
    link_planilla_expira = v_expira,
    link_arbitro_nombre = null,
    link_arbitro_player_id = null
  where id = p_match_id;

  return jsonb_build_object('token', v_token, 'expira', v_expira);
end;
$function$;

create or replace function public.generar_link_planilla_grupo(p_match_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids uuid[];
  v_torneos uuid[];
  v_organizador_id uuid;
  v_token uuid;
  v_grupo uuid;
  v_expira timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_match_ids is null or coalesce(array_length(p_match_ids, 1), 0) = 0 then
    raise exception 'Falta escoger los partidos';
  end if;

  select coalesce(array_agg(m.id), '{}'), coalesce(array_agg(distinct m.tournament_id), '{}')
    into v_ids, v_torneos
  from matches m
  where m.id = any(p_match_ids) and m.status is distinct from 'finished';

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Partido no encontrado o ya jugado';
  end if;
  if array_length(v_torneos, 1) <> 1 then
    raise exception 'Todos los partidos del link deben ser del mismo torneo';
  end if;

  select organizador_id into v_organizador_id from tournaments where id = v_torneos[1];
  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  -- ¿El partido de origen ya tiene un link de grupo vigente? Se reutiliza.
  select k.grupo_token, m.link_planilla_grupo, m.link_planilla_expira into v_token, v_grupo, v_expira
  from matches m
  join match_link_tokens k on k.match_id = m.id
  where m.id = p_match_ids[1]
    and k.grupo_token is not null
    and m.link_planilla_expira is not null
    and m.link_planilla_expira > now();

  if v_token is null then
    v_token := gen_random_uuid();
    v_grupo := gen_random_uuid();
    v_expira := now() + interval '24 hours';
  end if;
  v_grupo := coalesce(v_grupo, gen_random_uuid());

  insert into match_link_tokens (match_id, grupo_token)
  select unnest(v_ids), v_token
  on conflict (match_id) do update set grupo_token = excluded.grupo_token, updated_at = now();

  update matches set
    link_planilla_grupo = v_grupo,
    link_planilla_expira = v_expira
  where id = any(v_ids);

  return jsonb_build_object('token', v_token, 'expira', v_expira, 'total', array_length(v_ids, 1));
end;
$function$;

create or replace function public.ver_partido_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row jsonb;
begin
  select jsonb_build_object(
    'id', m.id,
    'hora', m.played_at,
    'cancha', m.location,
    'status', m.status,
    'torneo', t.name,
    'modalidad', t.modalidad,
    'home', h.name,
    'home_logo', h.logo_url,
    'away', a.name,
    'away_logo', a.logo_url,
    'vencido', (m.link_planilla_expira is null or m.link_planilla_expira <= now())
  ) into v_row
  from matches m
  join match_link_tokens k on k.match_id = m.id
  join tournaments t on t.id = m.tournament_id
  left join teams h on h.id = m.home_team_id
  left join teams a on a.id = m.away_team_id
  where k.planilla_token = p_token;

  if v_row is null then
    raise exception 'Link inválido';
  end if;

  return v_row;
end;
$function$;

create or replace function public.ver_partidos_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row jsonb;
begin
  select jsonb_build_object(
    'torneo', min(t.name),
    'modalidad', min(t.modalidad),
    'vencido', bool_and(m.link_planilla_expira is null or m.link_planilla_expira <= now()),
    'partidos', jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'hora', m.played_at,
        'cancha', m.location,
        'status', m.status,
        'torneo', t.name,
        'modalidad', t.modalidad,
        'home', h.name,
        'home_logo', h.logo_url,
        'away', a.name,
        'away_logo', a.logo_url,
        'vencido', (m.link_planilla_expira is null or m.link_planilla_expira <= now())
      ) order by m.played_at nulls last, m.id
    )
  ) into v_row
  from matches m
  join match_link_tokens k on k.match_id = m.id
  join tournaments t on t.id = m.tournament_id
  left join teams h on h.id = m.home_team_id
  left join teams a on a.id = m.away_team_id
  where k.grupo_token = p_token or k.planilla_token = p_token;

  if v_row is null or jsonb_typeof(v_row -> 'partidos') is distinct from 'array' then
    raise exception 'Link inválido';
  end if;

  return v_row;
end;
$function$;

-- Entrar con el link (versión definitiva: lee la tabla privada)
create or replace function public.entrar_planilla_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;

  select coalesce(array_agg(m.id), '{}') into v_ids
  from public.match_link_tokens k
  join public.matches m on m.id = k.match_id
  where (k.planilla_token = p_token or k.grupo_token = p_token)
    and m.link_planilla_expira is not null
    and m.link_planilla_expira > now();

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Link inválido o vencido';
  end if;

  delete from public.planilla_accesos where created_at < now() - interval '14 days';

  insert into public.planilla_accesos (user_id, match_id)
  select auth.uid(), unnest(v_ids)
  on conflict do nothing;

  return jsonb_build_object('partidos', to_jsonb(v_ids));
end;
$$;

-- Función vieja: creaba "árbitros" con solo el token; la app ya no la usa
drop function if exists public.reclamar_planilla_por_link(uuid, text);

-- 5) Funciones de reloj ---------------------------------------------------
create or replace function public.generar_link_reloj(p_match_id uuid, p_con_faltas boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tournament_id uuid;
  v_organizador_id uuid;
  v_status text;
  v_token uuid;
  v_expira timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select m.tournament_id, t.organizador_id, m.status, m.link_reloj_expira
    into v_tournament_id, v_organizador_id, v_status, v_expira
  from matches m
  join tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_tournament_id is null then raise exception 'Partido no encontrado'; end if;
  if v_status = 'finished' then raise exception 'Este partido ya se jugó'; end if;
  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  select k.reloj_token into v_token from match_link_tokens k where k.match_id = p_match_id;

  if v_token is null or v_expira is null or v_expira <= now() then
    v_token := gen_random_uuid();
    v_expira := now() + interval '24 hours';
  end if;

  insert into match_link_tokens (match_id, reloj_token)
  values (p_match_id, v_token)
  on conflict (match_id) do update set reloj_token = excluded.reloj_token, updated_at = now();

  update matches set
    link_reloj_expira = v_expira,
    link_reloj_faltas = coalesce(p_con_faltas, false)
  where id = p_match_id;

  return jsonb_build_object('token', v_token, 'expira', v_expira, 'con_faltas', coalesce(p_con_faltas, false));
end;
$function$;

create or replace function public.reloj_anular(p_token uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
begin
  select m2.* into m from matches m2 join match_link_tokens k on k.match_id = m2.id where k.reloj_token = p_token;
  if not found then raise exception 'Link inválido'; end if;
  if m.status = 'finished' then raise exception 'Partido cerrado'; end if;
  update reloj_eventos set anulado = true where id = p_id and match_id = m.id;
  return true;
end;
$function$;

create or replace function public.reloj_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_home text;
  v_away text;
  v_torneo text;
  v_snap jsonb;
  v_gl int := 0;
  v_gv int := 0;
begin
  select m2.* into m from matches m2 join match_link_tokens k on k.match_id = m2.id where k.reloj_token = p_token;
  if not found then raise exception 'Link inválido'; end if;

  select name into v_home from teams where id = m.home_team_id;
  select name into v_away from teams where id = m.away_team_id;
  select name into v_torneo from tournaments where id = m.tournament_id;

  v_snap := m.live_state_rapida;
  if v_snap is not null and jsonb_typeof(v_snap -> 'eventos') = 'array' then
    select count(*) filter (where e ->> 'tipo' = 'goal' and e ->> 'team' = 'local'),
           count(*) filter (where e ->> 'tipo' = 'goal' and e ->> 'team' = 'visitante')
      into v_gl, v_gv
    from jsonb_array_elements(v_snap -> 'eventos') e;
  end if;

  return jsonb_build_object(
    'match_id', m.id,
    'torneo', v_torneo,
    'home', coalesce(v_home, 'Local'),
    'away', coalesce(v_away, 'Visitante'),
    'con_faltas', m.link_reloj_faltas,
    'terminado', m.status = 'finished',
    'vencido', (m.link_reloj_expira is null or m.link_reloj_expira <= now() - interval '36 hours'),
    'hay_reloj', v_snap is not null and (v_snap ->> 'segundos') is not null,
    'segundos', case when v_snap is null then null else (v_snap ->> 'segundos')::int end,
    'corriendo', v_snap is not null and coalesce((v_snap ->> 'corriendo')::boolean, false),
    'periodo', case when v_snap is null then 1 else coalesce((v_snap ->> 'periodo')::int, 1) end,
    'duracion_minutos', case when v_snap is null then null else (v_snap ->> 'duracionMinutos')::int end,
    'actualizado', m.live_state_rapida_updated_at,
    'ahora', now(),
    'goles_local', v_gl,
    'goles_visitante', v_gv
  );
end;
$function$;

create or replace function public.reloj_registrar(p_token uuid, p_id uuid, p_team text, p_tipo text, p_numero text, p_numero2 text, p_minuto text, p_periodo integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_num text := nullif(regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g'), '');
  v_num2 text := nullif(regexp_replace(coalesce(p_numero2, ''), '[^0-9]', '', 'g'), '');
begin
  select m2.* into m from matches m2 join match_link_tokens k on k.match_id = m2.id where k.reloj_token = p_token;
  if not found then raise exception 'Link inválido'; end if;
  if m.link_reloj_expira is null or m.link_reloj_expira <= now() - interval '36 hours' then
    raise exception 'El link venció';
  end if;
  if m.status = 'finished' then raise exception 'Partido cerrado'; end if;
  if p_team not in ('local', 'visitante') then raise exception 'Equipo inválido'; end if;
  if p_tipo not in ('goal', 'yellow_card', 'red_card', 'falta_acum', 'cambio') then raise exception 'Evento inválido'; end if;
  if p_tipo = 'falta_acum' and not m.link_reloj_faltas then raise exception 'Este link no marca faltas'; end if;
  if v_num is null and p_tipo <> 'cambio' then raise exception 'Falta el número'; end if;
  if length(coalesce(v_num, '')) > 3 or length(coalesce(v_num2, '')) > 3 then raise exception 'Número inválido'; end if;

  insert into reloj_eventos (id, match_id, team, tipo, numero, numero2, minuto, periodo)
  values (p_id, m.id, p_team, p_tipo, v_num,
          case when p_tipo = 'cambio' then v_num2 else null end,
          left(coalesce(p_minuto, ''), 8), greatest(1, least(coalesce(p_periodo, 1), 4)))
  on conflict (id) do nothing;

  return true;
end;
$function$;

-- 6) Quién puede planillar: ahora el link exige haber ENTRADO con él
create or replace function public.puede_planillar_partido(p_match_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and exists (
       select 1 from public.matches m
       where m.id = p_match_id
         and (
              coalesce(public.es_dueno_torneo(m.tournament_id), false)
           or coalesce(public.es_organizador_plataforma(), false)
           or (m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours'
               and exists (select 1 from public.planilla_accesos a
                           where a.user_id = auth.uid() and a.match_id = m.id))
           or exists (select 1 from public.players p
                      where p.user_id = auth.uid()
                        and (p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id) or p.es_arbitro_lider is true))
           or (m.status is distinct from 'finished'
               and exists (select 1 from public.players p
                           where p.user_id = auth.uid() and (p.es_arbitro is true or p.rol = 'arbitro')))
         )
     );
$function$;

create or replace function public.guardar_estado_en_vivo(p_match_id uuid, p_tipo text, p_snap jsonb, p_ts timestamp with time zone)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if p_tipo not in ('rapida', 'completa') then raise exception 'Tipo inválido'; end if;

  select * into m from public.matches where id = p_match_id;
  if not found then return false; end if;
  if m.status = 'finished' then return false; end if;   -- partido cerrado: no se toca

  v_ok := coalesce(public.es_dueno_torneo(m.tournament_id), false)
       or coalesce(public.es_organizador_plataforma(), false)
       or (m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours'
           and exists (select 1 from public.planilla_accesos a where a.user_id = auth.uid() and a.match_id = m.id))
       or exists (
            select 1 from public.players p
            where p.user_id = auth.uid()
              and (p.es_arbitro is true or p.rol = 'arbitro' or p.es_arbitro_lider is true
                   or p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id))
          );
  if not coalesce(v_ok, false) then raise exception 'No tienes permiso para planillar este partido'; end if;

  if p_tipo = 'rapida' then
    update public.matches set live_state_rapida = p_snap, live_state_rapida_updated_at = coalesce(p_ts, now()) where id = p_match_id;
  else
    update public.matches set live_state = p_snap, live_state_updated_at = coalesce(p_ts, now()) where id = p_match_id;
  end if;
  return true;
end $function$;

create or replace function public.guardar_resultado_partido(p_match_id uuid, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m        public.matches%rowtype;
  v_ok     boolean := false;
  v_dueno  boolean := false;
  v_link   boolean := false;
  v_asig   boolean := false;
  v_cualq  boolean := false;
  v_sets   text;
  v_json   jsonb;
  v_filas  int;
  v_permitidos constant text[] := array[
    'home_score','away_score','status','tipo_resultado','foto_w_url',
    'penales_local','penales_visitante','penales_ganador',
    'firmas','capitan_local','capitan_visitante',
    'arbitro1','arbitro2','arbitro3','arbitro1_id','arbitro2_id','arbitro3_id',
    'planilla_papel',
    'live_state','live_state_updated_at','live_state_rapida','live_state_rapida_updated_at'];
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then raise exception 'Datos inválidos'; end if;

  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Partido no encontrado'; end if;

  -- El estado solo puede quedar en finalizado (es lo único que escribe la planilla)
  if p_campos ? 'status' and (p_campos ->> 'status') is distinct from 'finished' then
    raise exception 'Estado no permitido';
  end if;

  v_dueno := coalesce(public.es_dueno_torneo(m.tournament_id), false)
          or coalesce(public.es_organizador_plataforma(), false);
  v_link  := m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours'
             and exists (select 1 from public.planilla_accesos a where a.user_id = auth.uid() and a.match_id = m.id);
  select coalesce(bool_or(p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id) or p.es_arbitro_lider is true), false),
         coalesce(bool_or(p.es_arbitro is true or p.rol = 'arbitro'), false)
    into v_asig, v_cualq
    from public.players p where p.user_id = auth.uid();

  if m.status = 'finished' then v_ok := v_dueno or v_link or v_asig;
  else                          v_ok := v_dueno or v_link or v_asig or v_cualq;
  end if;
  if not coalesce(v_ok, false) then raise exception 'No tienes permiso para guardar este partido'; end if;

  -- Solo los campos permitidos que de verdad existen en la tabla (si falta una migración, se omite sin error)
  select jsonb_object_agg(e.key, e.value),
         string_agg(format('%1$I = r.%1$I', e.key), ', ')
    into v_json, v_sets
    from jsonb_each(p_campos) e
    join information_schema.columns c
      on c.table_schema = 'public' and c.table_name = 'matches' and c.column_name = e.key
   where e.key = any (v_permitidos);
  if v_sets is null then return jsonb_build_object('ok', true, 'filas', 0); end if;

  execute format(
    'update public.matches t set %s from (select * from jsonb_populate_record(null::public.matches, $1)) r where t.id = $2', v_sets)
    using v_json, p_match_id;
  get diagnostics v_filas = row_count;

  return jsonb_build_object('ok', v_filas > 0, 'filas', v_filas);
end $function$;

create or replace function public.reloj_eventos_del_partido(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_ok boolean := false;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_res jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into m from matches where id = p_match_id;
  if not found then return '[]'::jsonb; end if;

  v_ok := exists (select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid())
       or v_email in ('golmebol@gmail.com', 'smr06marin@gmail.com')
       or (m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours'
           and exists (select 1 from planilla_accesos a where a.user_id = auth.uid() and a.match_id = m.id))
       or exists (
            select 1 from players p
            where p.user_id = auth.uid()
              and (p.es_arbitro is true or p.rol = 'arbitro' or p.es_arbitro_lider is true
                   or p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id))
          );
  if not v_ok then raise exception 'No tienes permiso para ver este partido'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'team', e.team, 'tipo', e.tipo, 'numero', e.numero, 'numero2', e.numero2,
           'minuto', e.minuto, 'periodo', e.periodo, 'anulado', e.anulado
         ) order by e.creado), '[]'::jsonb)
    into v_res
  from reloj_eventos e where e.match_id = p_match_id;

  return v_res;
end;
$function$;

commit;

-- =====================================================================
-- PRUEBAS
-- =====================================================================
-- A) Ya no hay tokens en matches (debe dar 0 y 0):
--    select count(*) filter (where link_planilla_token is not null) as planilla,
--           count(*) filter (where link_reloj_token is not null) as reloj from public.matches;
-- B) Los tokens quedaron en la tabla privada (debe dar un número, igual o mayor a los links que hayas generado):
--    select count(*) filter (where planilla_token is not null) as planilla,
--           count(*) filter (where grupo_token is not null) as grupo,
--           count(*) filter (where reloj_token is not null) as reloj from public.match_link_tokens;
-- C) Un visitante no puede leer la tabla privada (debe dar ERROR permission denied):
--    begin; set local role anon; select count(*) from public.match_link_tokens; rollback;
-- D) Una sesión anónima que NO entró con el link NO puede planillar (debe dar false):
--    begin; set local role authenticated;
--    select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', true);
--    select public.puede_planillar_partido((select id from public.matches where link_planilla_expira > now() - interval '36 hours' limit 1));
--    rollback;
--    (Si ningún partido tiene link reciente, devuelve vacío: está bien.)
-- E) En la web:
--    1. /admin/calendario: generar un link de planilla de un partido de prueba y uno de reloj; copiarlos.
--    2. Abrir el link de planilla en una ventana privada -> "Entrar a planillar" -> planillar y guardar un gol.
--    3. Abrir el link de reloj en otra ventana privada -> marcar un evento.
--    4. Un link de grupo (varios partidos): abrir y entrar a uno.
--    5. Un link repartido ANTES (si queda alguno vigente): debe seguir abriendo.
-- =====================================================================
-- ROLLBACK: está en el archivo rollback_seguridad_paso10b.sql (devuelve los tokens a matches y
-- restaura las funciones tal como estaban). Úsalo solo si hace falta volver atrás YA.
