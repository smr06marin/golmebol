-- ============================================================
-- MIGRACIÓN: Link temporal (24h) para que un árbitro sin cuenta
-- entre directo a planillar un partido puntual.
-- Cómo ejecutar: Supabase → SQL Editor → RUN.
-- Es idempotente (add column if not exists / create or replace).
--
-- FLUJO:
--   1) El organizador, desde /admin/calendario, genera el link para
--      UN partido puntual (botón "Link árbitro" en cada partido).
--      generar_link_planilla() valida que sea el dueño del torneo,
--      crea un token + vencimiento a 24h, y los devuelve.
--   2) El organizador le envía ese link al árbitro (WhatsApp, etc).
--   3) El árbitro abre el link (público, sin login): la página
--      /planillar/:token llama a ver_partido_por_link() para
--      mostrarle bien grande y claro qué partido es (torneo, hora,
--      cancha, equipos) antes de nada.
--   4) El árbitro escribe su nombre y confirma: la página hace un
--      login anónimo (supabase.auth.signInAnonymously — requiere
--      tenerlo habilitado en Authentication → Settings del proyecto)
--      y llama a reclamar_planilla_por_link(), que valida el token
--      de nuevo, crea (o reutiliza) un "players" ligado a esa sesión
--      anónima con el nombre escrito, y deja registrado en el
--      partido quién lo va a planillar.
--   5) La página abre la Planilla Rápida (PlanillaRapida.jsx) ya
--      cargada con ese partido — el guardado en sí no cambia en
--      nada, sigue siendo exactamente el mismo código/flujo que ya
--      usa un árbitro con cuenta real.
--
-- OJO — requisito manual en el dashboard de Supabase:
--   Authentication → Settings → "Allow anonymous sign-ins" debe
--   estar ACTIVADO, si no el paso 4 falla.
-- ============================================================

alter table matches add column if not exists link_planilla_token uuid;
alter table matches add column if not exists link_planilla_expira timestamptz;
alter table matches add column if not exists link_arbitro_nombre text;
alter table matches add column if not exists link_arbitro_player_id uuid references players(id);

create unique index if not exists matches_link_planilla_token_idx
  on matches(link_planilla_token) where link_planilla_token is not null;

-- Genera (o reutiliza, si el anterior sigue vigente) un link de 24h para
-- que un árbitro sin cuenta entre a planillar este partido puntual. Solo
-- el organizador dueño del torneo o un admin principal pueden generarlo.
--
-- OJO: NO usa un helper es_dueno_torneo() de una migración de RLS aparte
-- (esa sigue sin aplicarse en este proyecto) — el chequeo va inline acá,
-- con el mismo patrón (organizador_id = auth.uid() o email admin) que ya
-- usa tournaments_bloquear_organizador_no_principal() en
-- migracion_asignar_organizador.sql, que sí está aplicada.
create or replace function public.generar_link_planilla(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_organizador_id uuid;
  v_token uuid;
  v_expira timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select m.tournament_id, t.organizador_id, m.link_planilla_token, m.link_planilla_expira
    into v_tournament_id, v_organizador_id, v_token, v_expira
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

  -- Si ya hay un link vigente (no vencido), se reutiliza tal cual en vez
  -- de generar uno nuevo — así un doble clic no invalida un link que ya
  -- se le mandó al árbitro.
  if v_token is not null and v_expira is not null and v_expira > now() then
    return jsonb_build_object('token', v_token, 'expira', v_expira);
  end if;

  v_token := gen_random_uuid();
  v_expira := now() + interval '24 hours';

  update matches set
    link_planilla_token = v_token,
    link_planilla_expira = v_expira,
    link_arbitro_nombre = null,
    link_arbitro_player_id = null
  where id = p_match_id;

  return jsonb_build_object('token', v_token, 'expira', v_expira);
end;
$$;

revoke all on function public.generar_link_planilla(uuid) from public;
grant execute on function public.generar_link_planilla(uuid) to authenticated;

-- Vista previa pública (sin login) de qué partido es un link — solo lo
-- necesario para que el árbitro confirme que es el suyo antes de entrar.
create or replace function public.ver_partido_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  join tournaments t on t.id = m.tournament_id
  left join teams h on h.id = m.home_team_id
  left join teams a on a.id = m.away_team_id
  where m.link_planilla_token = p_token;

  if v_row is null then
    raise exception 'Link inválido';
  end if;

  return v_row;
end;
$$;

grant execute on function public.ver_partido_por_link(uuid) to anon, authenticated;

-- El árbitro confirma su nombre y "reclama" el partido: crea (o reutiliza,
-- si ya había entrado antes con esta misma sesión anónima) un player
-- ligado a auth.uid(), y deja su nombre marcado en el partido. Devuelve el
-- match_id para que la página abra la Planilla Rápida.
create or replace function public.reclamar_planilla_por_link(p_token uuid, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_expira timestamptz;
  v_player_id uuid;
  v_uid uuid := auth.uid();
  v_cedula text := 'LINK-' || substr(p_token::text, 1, 8);
begin
  if v_uid is null then
    raise exception 'Sesión inválida';
  end if;
  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Falta el nombre del árbitro';
  end if;

  select id, link_planilla_expira into v_match_id, v_expira
  from matches where link_planilla_token = p_token;

  if v_match_id is null then
    raise exception 'Link inválido';
  end if;
  if v_expira is null or v_expira <= now() then
    raise exception 'Este link ya venció';
  end if;

  -- Se busca primero por la cédula sintética (fija por token, no por sesión):
  -- si el árbitro recarga la página o vuelve a entrar, cada intento crea una
  -- sesión anónima NUEVA (user_id distinto), y buscar solo por user_id hacía
  -- que intentara insertar otra vez la misma cédula y chocara con el unique
  -- index (idx_players_numero_cedula_unico). Buscando por cédula se reutiliza
  -- siempre el mismo jugador sin importar cuántas veces entre.
  select id into v_player_id from players where numero_cedula = v_cedula;

  if v_player_id is null then
    insert into players (user_id, name, numero_cedula, rol, es_arbitro, activo_membresia, primer_ingreso)
    values (v_uid, trim(p_nombre), v_cedula, 'arbitro', true, true, false)
    returning id into v_player_id;
  else
    update players set name = trim(p_nombre), user_id = v_uid where id = v_player_id;
  end if;

  update matches set
    link_arbitro_nombre = trim(p_nombre),
    link_arbitro_player_id = v_player_id
  where id = v_match_id;

  return jsonb_build_object('match_id', v_match_id);
end;
$$;

grant execute on function public.reclamar_planilla_por_link(uuid, text) to authenticated;
