-- ============================================================
-- MODO RELOJ: el árbitro registra goles, tarjetas, cambios (y faltas) desde
-- el navegador de un smartwatch, con un link aparte solo para el reloj.
--
-- Cómo funciona:
--   · El organizador genera el "Link reloj" de un partido (con o sin faltas).
--   · El reloj abre /reloj/<token> (sin login, sin app). Cada toque queda en la
--     tabla reloj_eventos con un id único (si la señal falla, el reloj reenvía
--     el mismo id y no se duplica).
--   · La planilla del partido lee esa tabla y mete los eventos en el partido
--     (goles, amarillas, rojas, faltas) como si los hubiera tocado el árbitro.
--     Los cambios se guardan en reloj_eventos y se ven en la planilla.
--
-- No cambia nada de lo que ya existe. Se puede ejecutar varias veces.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================

alter table public.matches add column if not exists link_reloj_token uuid;
alter table public.matches add column if not exists link_reloj_expira timestamptz;
alter table public.matches add column if not exists link_reloj_faltas boolean not null default false;

create index if not exists matches_link_reloj_token_idx
  on public.matches(link_reloj_token) where link_reloj_token is not null;

create table if not exists public.reloj_eventos (
  id uuid primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  team text not null check (team in ('local', 'visitante')),
  tipo text not null check (tipo in ('goal', 'yellow_card', 'red_card', 'falta_acum', 'cambio')),
  numero text,
  numero2 text,            -- solo en cambios: número del que ENTRA (numero = el que sale)
  minuto text,
  periodo int not null default 1,
  anulado boolean not null default false,
  creado timestamptz not null default now()
);

create index if not exists reloj_eventos_match_idx on public.reloj_eventos(match_id, creado);

-- Solo se usa a través de las funciones de abajo (con permiso controlado).
alter table public.reloj_eventos enable row level security;

-- ── Genera (o reutiliza) el link reloj de un partido ────────────────────
-- Solo el organizador dueño del torneo o un admin principal. Si ya hay uno
-- vigente se reutiliza el mismo token (el link que ya se instaló en el reloj
-- sigue sirviendo) y solo se actualiza si se marcan faltas o no.
create or replace function public.generar_link_reloj(p_match_id uuid, p_con_faltas boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_organizador_id uuid;
  v_status text;
  v_token uuid;
  v_expira timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select m.tournament_id, t.organizador_id, m.status, m.link_reloj_token, m.link_reloj_expira
    into v_tournament_id, v_organizador_id, v_status, v_token, v_expira
  from matches m
  join tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_tournament_id is null then raise exception 'Partido no encontrado'; end if;
  if v_status = 'finished' then raise exception 'Este partido ya se jugó'; end if;
  if v_organizador_id is distinct from auth.uid()
     and v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'No autorizado';
  end if;

  if v_token is null or v_expira is null or v_expira <= now() then
    v_token := gen_random_uuid();
    v_expira := now() + interval '24 hours';
  end if;

  update matches set
    link_reloj_token = v_token,
    link_reloj_expira = v_expira,
    link_reloj_faltas = coalesce(p_con_faltas, false)
  where id = p_match_id;

  return jsonb_build_object('token', v_token, 'expira', v_expira, 'con_faltas', coalesce(p_con_faltas, false));
end;
$$;

revoke all on function public.generar_link_reloj(uuid, boolean) from public, anon;
grant execute on function public.generar_link_reloj(uuid, boolean) to authenticated;

-- ── Lo que ve el reloj: equipos, reloj de la planilla y marcador ────────
-- Público (sin login): lo único que se sabe es el token del link.
create or replace function public.reloj_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_home text;
  v_away text;
  v_torneo text;
  v_snap jsonb;
  v_gl int := 0;
  v_gv int := 0;
begin
  select * into m from matches where link_reloj_token = p_token;
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
$$;

revoke all on function public.reloj_info(uuid) from public;
grant execute on function public.reloj_info(uuid) to anon, authenticated;

-- ── El reloj manda un evento ────────────────────────────────────────────
-- p_id lo inventa el reloj: si manda el mismo evento dos veces (mala señal)
-- no se duplica.
create or replace function public.reloj_registrar(
  p_token uuid, p_id uuid, p_team text, p_tipo text,
  p_numero text, p_numero2 text, p_minuto text, p_periodo int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_num text := nullif(regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g'), '');
  v_num2 text := nullif(regexp_replace(coalesce(p_numero2, ''), '[^0-9]', '', 'g'), '');
begin
  select * into m from matches where link_reloj_token = p_token;
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
$$;

revoke all on function public.reloj_registrar(uuid, uuid, text, text, text, text, text, int) from public;
grant execute on function public.reloj_registrar(uuid, uuid, text, text, text, text, text, int) to anon, authenticated;

-- ── Deshacer (el último evento) ─────────────────────────────────────────
create or replace function public.reloj_anular(p_token uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from matches where link_reloj_token = p_token;
  if not found then raise exception 'Link inválido'; end if;
  if m.status = 'finished' then raise exception 'Partido cerrado'; end if;
  update reloj_eventos set anulado = true where id = p_id and match_id = m.id;
  return true;
end;
$$;

revoke all on function public.reloj_anular(uuid, uuid) from public;
grant execute on function public.reloj_anular(uuid, uuid) to anon, authenticated;

-- ── La planilla lee los eventos del reloj ───────────────────────────────
-- Mismo permiso que guardar_estado_en_vivo: dueño/admin del torneo, árbitro,
-- o quien entró con el link de planillar (vigente o vencido hace < 36 h).
create or replace function public.reloj_eventos_del_partido(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
       or (m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours')
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
$$;

revoke all on function public.reloj_eventos_del_partido(uuid) from public, anon;
grant execute on function public.reloj_eventos_del_partido(uuid) to authenticated;
