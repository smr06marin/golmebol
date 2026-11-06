-- =====================================================================
-- PASO 12A — Solo cuentas CONOCIDAS pueden leer la tabla de jugadores (players)
-- =====================================================================
-- PROBLEMA: la política players_select dejaba leer TODAS las fichas (cédula, fotos de cédula,
-- teléfonos, fecha de nacimiento, tipo de sangre, teléfono del acudiente) a CUALQUIER cuenta real,
-- aunque se hubiera creado en ese momento con un correo inventado (el registro de cuentas está abierto).
--
-- QUÉ HACE: la política sigue pidiendo una cuenta real (no anónima) y ahora además exige que sea una
-- cuenta CONOCIDA: ligada a una ficha de jugador (jugador, árbitro, profesor, acudiente, encargado
-- de escenario...), o con rol de organizador/admin en la plataforma.
-- Una cuenta recién creada con un correo cualquiera deja de ver las fichas.
--
-- NO cambia nada para jugadores, árbitros, profesores, organizadores ni admin que ya entran hoy.
-- Una sola transacción. Se deshace con rollback_seguridad_paso12a.sql.
-- =====================================================================
begin;

-- ¿Esta cuenta es de un jugador/árbitro/profesor/etc., o tiene rol en la plataforma?
-- SECURITY DEFINER para poder mirar players sin que la política se llame a sí misma.
create or replace function public.es_cuenta_conocida()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and (
          exists (select 1 from public.players p where p.user_id = auth.uid())
       or exists (select 1 from public.roles_plataforma r where r.user_id = auth.uid())
       or coalesce(public.es_admin_plataforma(), false)
       or coalesce(public.es_organizador_plataforma(), false)
     );
$function$;
revoke all on function public.es_cuenta_conocida() from public, anon;
grant execute on function public.es_cuenta_conocida() to authenticated;

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select
  using (public.es_cuenta_conocida());

commit;

-- =====================================================================
-- PRUEBAS (cada una por separado)
-- =====================================================================
-- A) Una cuenta real PERO desconocida (correo inventado) ya no ve ninguna ficha (debe dar 0):
--    begin; set local role authenticated;
--    select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated","is_anonymous":false}', true);
--    select count(*) from public.players;
--    rollback;
-- B) Una cuenta de jugador sigue viendo las fichas (debe mostrar: ERROR: RESULTADO: <número grande> filas — el error es a propósito):
--    do $$ declare v uuid; n int;
--    begin
--      select user_id into v from public.players where user_id is not null limit 1;
--      set local role authenticated;
--      perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated', 'is_anonymous', false)::text, true);
--      select count(*) into n from public.players;
--      raise exception 'RESULTADO: % filas', n;
--    end $$;
-- C) Una sesión anónima sigue sin ver nada (debe dar 0):
--    begin; set local role authenticated;
--    select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated","is_anonymous":true}', true);
--    select count(*) from public.players;
--    rollback;
-- D) En la web, entrar con: un jugador, un árbitro, un profesor/acudiente (si tienes), tu cuenta de organizador y el admin.
--    Cada uno debe ver su pantalla de siempre (equipos, rankings, tarjeta, planilla).
-- ROLLBACK: rollback_seguridad_paso12a.sql
