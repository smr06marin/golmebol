-- =====================================================================
-- BUSCADOR DE EQUIPOS CON FICHA (para no duplicar equipos entre torneos)
--
-- Qué hace: el organizador, al agregar un equipo a su torneo, puede buscar por
--   · nombre del equipo (sin importar tildes, mayúsculas ni espacios), o
--   · cédula del dueño (número completo)
-- y cada resultado trae una "ficha" para reconocerlo: escudo, ciudad, dueño,
-- cuántos torneos ha jugado, cuál fue el último, cuántos jugadores tiene y
-- cuántos partidos ha jugado.
--
-- Seguridad: la cédula NUNCA sale; solo se devuelve un "sí/no" (por_cedula).
-- Solo pueden usarla el admin, los organizadores y quien tenga un torneo.
-- No cambia ni borra ningún dato. Se puede correr varias veces.
-- =====================================================================

-- Normaliza un nombre de equipo: minúsculas, sin tildes, sin signos, sin espacios dobles
create or replace function public.norm_nombre_equipo(p text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')),
      '[^a-z0-9 ]', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

create or replace function public.buscar_equipos_para_inscribir(p_q text, p_torneo uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_q    text := trim(coalesce(p_q, ''));
  v_n    text := public.norm_nombre_equipo(p_q);
  v_ced  text := regexp_replace(trim(coalesce(p_q, '')), '\D', '', 'g');
  v_es_ced boolean;
  v_p1   text;
  v_res  jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not (
       coalesce(public.es_admin_plataforma(), false)
    or coalesce(public.es_organizador_plataforma(), false)
    or exists (select 1 from public.tournaments t where t.organizador_id = auth.uid())
  ) then
    raise exception 'No autorizado';
  end if;

  -- Una cédula de relleno (0000000, 1111111...) NO identifica a nadie: no se usa para buscar
  v_es_ced := v_q ~ '^[0-9 .,]+$' and length(v_ced) >= 5 and v_ced !~ '^(.)\1*$';
  if not v_es_ced and length(v_n) < 2 then return '[]'::jsonb; end if;
  v_p1 := split_part(v_n, ' ', 1);

  select coalesce(jsonb_agg(f.fila order by f.orden1, f.orden2, f.orden3, f.nombre), '[]'::jsonb)
  into v_res
  from (
    select
      t.name as nombre,
      case when c.por_cedula then 0 when public.norm_nombre_equipo(t.name) = v_n then 1 else 2 end as orden1,
      -coalesce(s.torneos, 0) as orden2,
      0 as orden3,
      jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'city', t.city,
        'logo_url', t.logo_url,
        'representante_nombre', t.representante_nombre,
        'por_cedula', c.por_cedula,
        'nombre_igual', public.norm_nombre_equipo(t.name) = v_n,
        'torneos', coalesce(s.torneos, 0),
        'ultimo_torneo', s.ultimo,
        'jugadores', coalesce(j.jugadores, 0),
        'partidos', coalesce(pj.partidos, 0),
        'en_este_torneo', coalesce(e.inscrito, false),
        'desactivado_en_este_torneo', coalesce(e.desactivado, false)
      ) as fila
    from public.teams t
    left join lateral (
      select v_es_ced and exists (
        select 1 from public.teams_privado k
        where k.team_id = t.id
          and regexp_replace(coalesce(k.representante_cedula, ''), '\D', '', 'g') = v_ced
      ) as por_cedula
    ) c on true
    left join lateral (
      select count(*)::int as torneos,
             (select coalesce(tt.name, '') || coalesce(' ' || tt.season, '')
              from public.tournament_teams x
              join public.tournaments tt on tt.id = x.tournament_id
              where x.team_id = t.id
              order by tt.created_at desc nulls last limit 1) as ultimo
      from public.tournament_teams x2
      where x2.team_id = t.id
    ) s on true
    left join lateral (
      select count(distinct r.player_id)::int as jugadores
      from public.tournament_player_registrations r
      where r.team_id = t.id and coalesce(r.activo, true)
    ) j on true
    left join lateral (
      select count(*)::int as partidos
      from public.matches m
      where m.status = 'finished' and (m.home_team_id = t.id or m.away_team_id = t.id)
    ) pj on true
    left join lateral (
      select bool_or(coalesce(x3.activo, true)) as inscrito,
             bool_and(not coalesce(x3.activo, true)) as desactivado
      from public.tournament_teams x3
      where x3.team_id = t.id and x3.tournament_id = p_torneo
    ) e on true
    where
      case
        when v_es_ced then c.por_cedula
        else (
          public.norm_nombre_equipo(t.name) like '%' || v_n || '%'
          or v_n like '%' || nullif(public.norm_nombre_equipo(t.name), '') || '%'
          or (length(v_p1) >= 4 and split_part(public.norm_nombre_equipo(t.name), ' ', 1) = v_p1)
        )
      end
    order by 2, 3, 4, 1
    limit 8
  ) f;

  return v_res;
end;
$function$;

revoke all on function public.buscar_equipos_para_inscribir(text, uuid) from public, anon;
grant execute on function public.buscar_equipos_para_inscribir(text, uuid) to authenticated;
