-- ============================================================
-- ARREGLO: el árbitro le da "Guardar resultado" a la planilla y el partido sigue "pendiente"
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
--
-- Causa: la tabla de partidos (matches) solo deja MODIFICAR al dueño/admin del torneo. Cuando un árbitro
-- (con cuenta o con link) guarda el resultado, la base descarta el cambio SIN dar error: la planilla cree
-- que guardó, pero el partido no pasa a "finalizado" y no cambia el marcador.
--
-- Qué hace: crea guardar_resultado_partido(partido, campos) con permiso controlado. Solo acepta los campos
-- que escribe la planilla (marcador, estado finalizado, penales, firmas, capitanes, árbitros, foto, tipo de
-- resultado, avance en vivo). Cualquier otro campo se ignora. Si el partido ya estaba finalizado, solo lo
-- puede reeditar el dueño/organizador/admin, un árbitro asignado/coordinador, o quien tenga el link vigente.
-- Para un partido sin finalizar: dueño/organizador/admin, cualquier árbitro con cuenta, o quien entró con
-- el link de planillar (vigente o vencido hace menos de 36 h).
-- ============================================================

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
  if not v_ok then raise exception 'No tienes permiso para guardar este partido'; end if;

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
