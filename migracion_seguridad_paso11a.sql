-- =====================================================================
-- PASO 11A — Cerrar funciones internas y quitar datos que la app no usa
-- =====================================================================
-- Por qué hace falta: en Supabase, "revoke ... from public" NO alcanza. Las funciones nuevas
-- reciben EXECUTE para anon y authenticated por separado, así que hay que quitarlo explícito.
--
-- QUÉ HACE (no requiere cambios en la app):
--   1) _login_jugador: devolvía la FILA COMPLETA del jugador a cualquiera que escribiera una
--      cédula. Es interna (la usan login_buscar_cedula y login_verificar_nombre, que son SECURITY
--      DEFINER y siguen funcionando). Se cierra a anon y authenticated.
--   2) refrescar_permisos_publicos: cambia permisos de tablas (DDL). Interna, la app no la llama.
--      Se cierra a anon y authenticated. (Tú la sigues pudiendo correr desde el SQL Editor.)
--   3) recalcular_player_stats y verificar_logros: la app no las llama; las usan los triggers por
--      dentro. Se cierran a anon (visitante sin sesión).
--   4) buscar_jugador_por_cedula: deja de devolver telefono y whatsapp (la pantalla de registro
--      del equipo no los usa). Todo lo demás queda igual.
-- Una sola transacción.
-- =====================================================================
begin;

revoke all on function public._login_jugador(text) from public, anon, authenticated;
revoke all on function public.refrescar_permisos_publicos() from public, anon, authenticated;
revoke all on function public.recalcular_player_stats(uuid) from public, anon;
revoke all on function public.verificar_logros(uuid) from public, anon;

create or replace function public.buscar_jugador_por_cedula(p_cedula text, p_tournament_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cedula text := trim(p_cedula);
  v_p      players%rowtype;
  v_ya     record;
begin
  if v_cedula is null or v_cedula = '' then
    raise exception 'Cédula vacía';
  end if;

  select * into v_p from players where numero_cedula = v_cedula limit 1;
  if not found then
    return jsonb_build_object('encontrado', false);
  end if;

  -- ¿Ya inscrito en este torneo?
  if p_tournament_id is not null then
    select r.id, t.name as equipo_nombre
      into v_ya
    from tournament_player_registrations r
    left join teams t on t.id = r.team_id
    where r.tournament_id = p_tournament_id
      and r.player_id = v_p.id
      and r.activo = true
    limit 1;
  end if;

  return jsonb_build_object(
    'encontrado', true,
    'id', v_p.id,
    'name', v_p.name,
    'numero_cedula', v_p.numero_cedula,
    'city', v_p.city,
    'photo_url', v_p.photo_url,
    'photo_face_url', v_p.photo_face_url,
    'es_arbitro', coalesce(v_p.es_arbitro, false) or v_p.rol = 'arbitro',
    'rol', v_p.rol,
    -- No devolvemos teléfonos ni las URLs de cédula (datos personales).
    'tiene_cedula_frontal', v_p.cedula_frontal_url is not null,
    'tiene_cedula_trasera', v_p.cedula_trasera_url is not null,
    'ya_en_torneo', v_ya.id is not null,
    'equipo_en_torneo', v_ya.equipo_nombre
  );
end;
$function$;

commit;

-- =====================================================================
-- PRUEBAS (cada una por separado)
-- =====================================================================
-- A) Permisos (debe dar false en todas las columnas):
--    select has_function_privilege('anon','public._login_jugador(text)','execute') as login_anon,
--           has_function_privilege('authenticated','public._login_jugador(text)','execute') as login_auth,
--           has_function_privilege('anon','public.refrescar_permisos_publicos()','execute') as refr_anon,
--           has_function_privilege('authenticated','public.refrescar_permisos_publicos()','execute') as refr_auth,
--           has_function_privilege('anon','public.recalcular_player_stats(uuid)','execute') as stats_anon,
--           has_function_privilege('anon','public.verificar_logros(uuid)','execute') as logros_anon;
-- B) Un visitante ya no puede leer la fila completa (debe dar ERROR permission denied for function _login_jugador):
--    begin; set local role anon; select public._login_jugador('1'); rollback;
-- C) El login SIGUE funcionando (debe dar 'encontrado': false, sin error, con una cédula inexistente):
--    begin; set local role anon; select public.login_buscar_cedula('0000000001'); rollback;
-- D) La búsqueda de registro SIGUE funcionando y ya no trae teléfono (debe dar 'encontrado': false, sin error):
--    begin; set local role anon; select public.buscar_jugador_por_cedula('0000000001', null); rollback;
-- E) En la web (los dos son los que NO pueden fallar):
--    1. Pantalla de login de jugador: escribir una cédula real -> debe reconocerla y seguir el flujo normal.
--    2. Link de registro de equipo: escribir la cédula de un jugador ya existente -> debe mostrar sus datos
--       (nombre, foto, ciudad) y dejar inscribirlo.
-- ROLLBACK: rollback_seguridad_paso11a.sql
