-- ============================================================
-- PROTEGER DATOS PRIVADOS DE EQUIPOS Y TORNEOS — PASO 2 de 2 (EL BLOQUEO)
--
-- Correr SOLO cuando:
--   ✓ ya corriste migracion_datos_representante_paso1.sql
--   ✓ ya publicaste la versión nueva de la app (Vercel terminó el despliegue)
--   ✓ probaste, SIN iniciar sesión (ventana privada): la página de un torneo, el link de registro de un
--     equipo, y la entrada por cédula de un dueño de equipo (ver lista abajo)
--
-- Qué hace: el visitante sin sesión (rol "anon") deja de poder leer las columnas privadas:
--   teams: representante_cedula / _telefono / _nombre, registro_token, registro_token_horas, registro_token_generado_en
--   tournaments: link_deudores_token, link_deudores_password
-- Las demás columnas siguen leyéndose igual. Quien inició sesión (rol "authenticated") no cambia.
-- Consecuencia: un visitante sin sesión que pida "select *" de teams o tournaments recibe error — por eso la
-- app ahora usa las vistas teams_publico / tournaments_publico.
--
-- SI ALGO FALLA, para devolverlo todo a como estaba (una línea cada una):
--     grant select on public.teams to anon;
--     grant select on public.tournaments to anon;
--
-- IMPORTANTE para el futuro: si agregas una columna nueva a teams o tournaments que el público deba ver, corre
--     select public.refrescar_permisos_publicos();
-- (si no, los visitantes sin sesión no podrán leer esa columna nueva). Y para que aparezca en las vistas,
-- vuelve a correr el PASO 1.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================

create or replace function public.refrescar_permisos_publicos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute 'revoke select on table public.teams from anon';
  execute format('grant select (%s) on table public.teams to anon', public.columnas_publicas('teams'));
  execute 'revoke select on table public.tournaments from anon';
  execute format('grant select (%s) on table public.tournaments to anon', public.columnas_publicas('tournaments'));
end $$;
revoke all on function public.refrescar_permisos_publicos() from public;

select public.refrescar_permisos_publicos();

-- ── Lista de pruebas SIN iniciar sesión (ventana privada) ───────────────────
--  [ ] /t/<torneo>: carga tabla, equipos, partidos, goleadores
--  [ ] Inicio (portada): torneos, equipos y partidos de hoy cargan
--  [ ] /e/<equipo> y /j/<jugador>: cargan
--  [ ] Link de registro de equipo (/registro/equipo/<token>/<torneo>): muestra el equipo y el torneo; el
--      botón de desactivar jugador con cédula de otra persona dice "solo el dueño"
--  [ ] /jugador/login con la cédula de un dueño de equipo que no es jugador: sigue pasando a "verificar nombre"
--  [ ] Registro de escuela (/registro/escuela/<id>): carga
--  [ ] (comprobación del bloqueo) en la consola del navegador, con la clave pública:
--        await (await fetch(URL_SUPABASE + '/rest/v1/teams?select=representante_cedula&limit=1', {headers:{apikey:ANON_KEY}})).json()
--      debe responder error "permission denied" (antes devolvía cédulas)
