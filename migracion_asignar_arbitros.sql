-- ============================================================
-- ARREGLO: el coordinador de árbitros asigna los árbitros, le da "Listo" y no queda guardado
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- Causa: la seguridad de la tabla de partidos (matches) solo deja MODIFICAR un partido al dueño del
-- torneo o al admin. El coordinador (árbitro líder) no está en esa lista: su "Listo" no daba error
-- pero la base no guardaba nada, y el partido volvía a salir "Sin árbitro".
--
-- Qué hace: crea dos funciones con permiso controlado (NO se abre la tabla de partidos):
--   asignar_arbitros_partido(partido, principal, asistente1, asistente2)
--       guarda los 3 árbitros y le manda una notificación a cada árbitro NUEVO del partido
--       ("Nuevo partido asignado: A vs B · fecha").
--   marcar_sin_planillador(partido, true/false)
--       guarda la casilla "Sin planillador".
-- Quién puede usarlas: el dueño del torneo, un organizador/admin de la plataforma o un árbitro líder
-- con la sesión iniciada. Solo tocan esas columnas: no pueden cambiar marcadores ni nada más.
-- ============================================================

create or replace function public.puede_asignar_arbitros(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and (
       public.es_dueno_torneo(p_tournament_id)
       or public.es_organizador_plataforma()
       or exists (
         select 1 from public.players p
         where p.user_id = auth.uid() and p.es_arbitro_lider is true
       )
     );
$$;

create or replace function public.asignar_arbitros_partido(
  p_match_id uuid, p_arbitro1 uuid, p_arbitro2 uuid, p_arbitro3 uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m          public.matches%rowtype;
  v_antes    text[];
  v_nuevo    uuid;
  v_local    text;
  v_visita   text;
  v_cuando   text;
  v_avisados int := 0;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if not public.puede_asignar_arbitros(m.tournament_id) then
    raise exception 'No tienes permiso para asignar árbitros en este partido';
  end if;

  v_antes := array_remove(array[m.arbitro1_id::text, m.arbitro2_id::text, m.arbitro3_id::text], null);

  update public.matches
     set arbitro1_id = p_arbitro1, arbitro2_id = p_arbitro2, arbitro3_id = p_arbitro3
   where id = p_match_id;

  select name into v_local  from public.teams where id = m.home_team_id;
  select name into v_visita from public.teams where id = m.away_team_id;
  v_cuando := case when m.played_at is null then ''
                   else ' · ' || to_char(m.played_at at time zone 'America/Bogota', 'DD/MM HH24:MI') end;

  -- Aviso a cada árbitro que acaba de quedar asignado (no a los que ya estaban).
  -- Si el aviso falla por lo que sea, la asignación igual queda guardada.
  for v_nuevo in
    select distinct x from unnest(array[p_arbitro1, p_arbitro2, p_arbitro3]) as x
    where x is not null and not (x::text = any (v_antes))
  loop
    begin
      insert into public.notificaciones (player_id, titulo, mensaje, tipo, referencia_id)
      values (v_nuevo, 'Nuevo partido asignado',
              coalesce(v_local, '?') || ' vs ' || coalesce(v_visita, '?') || v_cuando,
              'asignacion', m.id);
      v_avisados := v_avisados + 1;
    exception when others then
      null;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'avisados', v_avisados);
end $$;

create or replace function public.marcar_sin_planillador(p_match_id uuid, p_valor boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if not public.puede_asignar_arbitros(m.tournament_id) then
    raise exception 'No tienes permiso para cambiar este partido';
  end if;
  update public.matches set sin_planillador = coalesce(p_valor, false) where id = p_match_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.puede_asignar_arbitros(uuid) from public, anon;
revoke all on function public.asignar_arbitros_partido(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.marcar_sin_planillador(uuid, boolean) from public, anon;
grant execute on function public.puede_asignar_arbitros(uuid) to authenticated;
grant execute on function public.asignar_arbitros_partido(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.marcar_sin_planillador(uuid, boolean) to authenticated;
