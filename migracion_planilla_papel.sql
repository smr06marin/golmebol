-- ============================================================
-- DOS PLANILLAS: FÚTBOL DE SALÓN (la profesional, completa) y FÚTBOL 11 (la hoja de papel, sencilla)
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- Qué hace:
--  1) matches.planilla_tipo ('salon' | 'futbol11' | vacío): lo que el coordinador eligió para ese partido.
--     Vacío = "automático": las cuentas de árbitro y el coordinador ven Fútbol de salón;
--     admin, organizadores y el link ven Fútbol 11.
--  2) matches.planilla_papel (jsonb): los datos propios de la hoja de Fútbol 11 (árbitro central y asistentes,
--     DT, #carnés, capitán, respuestas Sí/No, informe arbitral y penales). Su sola presencia también sirve para
--     saber que un partido ya jugado se llenó con la hoja de Fútbol 11.
--  3) marcar_planilla_tipo(partido, 'salon' | 'futbol11'): guarda la elección con permiso controlado (dueño del
--     torneo, organizador/admin de la plataforma o árbitro líder con la sesión iniciada). Solo toca esa columna.
--  4) guardar_resultado_partido: misma función de siempre, solo se agrega 'planilla_papel' a la lista de
--     campos que la planilla puede guardar. Todo lo demás (permisos, validaciones) queda IGUAL.
-- ============================================================

alter table public.matches add column if not exists planilla_tipo text;
alter table public.matches add column if not exists planilla_papel jsonb;

create or replace function public.marcar_planilla_tipo(p_match_id uuid, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m public.matches%rowtype;
begin
  if p_tipo is not null and p_tipo not in ('salon', 'futbol11') then
    raise exception 'Tipo de planilla inválido';
  end if;
  select * into m from public.matches where id = p_match_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if not public.puede_asignar_arbitros(m.tournament_id) then
    raise exception 'No tienes permiso para cambiar este partido';
  end if;
  update public.matches set planilla_tipo = p_tipo where id = p_match_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.marcar_planilla_tipo(uuid, text) from public, anon;
grant execute on function public.marcar_planilla_tipo(uuid, text) to authenticated;

-- ── guardar_resultado_partido: idéntica a la anterior + 'planilla_papel' en los campos permitidos ──
create or replace function public.guardar_resultado_partido(p_match_id uuid, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_link  := m.link_planilla_expira is not null and m.link_planilla_expira > now() - interval '36 hours';
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
end $$;

revoke all on function public.guardar_resultado_partido(uuid, jsonb) from public, anon;
grant execute on function public.guardar_resultado_partido(uuid, jsonb) to authenticated;
