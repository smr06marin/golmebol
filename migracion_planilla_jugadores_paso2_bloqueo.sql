-- ============================================================
-- PLANILLA SEGURA — PASO 2 (bloqueo a sesiones anónimas)
-- EJECUTAR SOLO DESPUÉS de: paso 1 corrido + código nuevo desplegado
-- en Vercel + planilla por LINK probada (ver pasos en el chat).
--
-- Qué hace: la tabla `players` deja de ser legible para las sesiones
-- anónimas (las que se crean al abrir un link de planilla, y que cualquiera
-- en internet puede crear). Cuentas reales: sin cambios.
-- ============================================================

drop policy if exists "players_select" on public.players;

create policy "players_select"
on public.players for select
using (
  auth.uid() is not null
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- ROLLBACK (solo si algo se rompe): vuelve a dejar leer a todos los que tengan sesión
-- drop policy if exists "players_select" on public.players;
-- create policy "players_select" on public.players for select using (true);
