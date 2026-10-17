-- ============================================================
-- LINK DE ÁRBITRO CON VARIOS PARTIDOS (un solo link para todos)
--
-- Hasta ahora "Link árbitro" generaba un link por partido. Esto agrega un
-- link de GRUPO: el organizador escoge varios partidos del MISMO torneo y
-- le manda al árbitro un solo link con todos.
--
-- No cambia nada de lo que ya existe: los links de un partido siguen
-- funcionando igual (generar_link_planilla / ver_partido_por_link), y el
-- guardado de la planilla sigue validando con matches.link_planilla_expira
-- (por eso el link de grupo también deja esa fecha en cada partido).
--
-- Se puede ejecutar varias veces sin problema.
-- ============================================================

alter table public.matches add column if not exists link_planilla_grupo uuid;

create index if not exists matches_link_planilla_grupo_idx
  on public.matches(link_planilla_grupo) where link_planilla_grupo is not null;

-- Genera (o reutiliza) un link de 24h para varios partidos del mismo torneo.
-- p_match_ids[1] es el partido desde el que se tocó "Link árbitro": si ese
-- partido ya tiene un link de grupo vigente, se reutiliza el mismo token y
-- solo se le suman los partidos nuevos (así el link que ya se mandó sigue
-- sirviendo y simplemente aparecen más partidos).
-- Solo el organizador dueño del torneo o un admin principal pueden generarlo.
create or replace function public.generar_link_planilla_grupo(p_match_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_torneos uuid[];
  v_organizador_id uuid;
  v_token uuid;
  v_expira timestamptz;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_match_ids is null or coalesce(array_length(p_match_ids, 1), 0) = 0 then
    raise exception 'Falta escoger los partidos';
  end if;

  -- Solo partidos que existen y todavía no se han jugado
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
  select m.link_planilla_grupo, m.link_planilla_expira into v_token, v_expira
  from matches m
  where m.id = p_match_ids[1]
    and m.link_planilla_grupo is not null
    and m.link_planilla_expira is not null
    and m.link_planilla_expira > now();

  if v_token is null then
    v_token := gen_random_uuid();
    v_expira := now() + interval '24 hours';
  end if;

  update matches set
    link_planilla_grupo = v_token,
    link_planilla_expira = v_expira
  where id = any(v_ids);

  return jsonb_build_object('token', v_token, 'expira', v_expira, 'total', array_length(v_ids, 1));
end;
$$;

revoke all on function public.generar_link_planilla_grupo(uuid[]) from public;
grant execute on function public.generar_link_planilla_grupo(uuid[]) to authenticated;

-- Vista pública (sin login) de los partidos de un link. Sirve tanto para un
-- link de grupo como para uno de un solo partido (el de siempre), así la
-- página /planillar/:token usa una sola llamada para los dos.
create or replace function public.ver_partidos_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  join tournaments t on t.id = m.tournament_id
  left join teams h on h.id = m.home_team_id
  left join teams a on a.id = m.away_team_id
  where m.link_planilla_grupo = p_token or m.link_planilla_token = p_token;

  -- Sin filas, el agregado igual devuelve un objeto (con partidos = null)
  if v_row is null or jsonb_typeof(v_row -> 'partidos') is distinct from 'array' then
    raise exception 'Link inválido';
  end if;

  return v_row;
end;
$$;

grant execute on function public.ver_partidos_por_link(uuid) to anon, authenticated;
