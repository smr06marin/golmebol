-- ============================================================
-- LOGIN SEGURO — PASO 2 (bloqueo)
-- EJECUTAR SOLO DESPUÉS de: paso 1 corrido + código nuevo desplegado
-- en Vercel + login probado sin sesión (ver instrucciones en el chat).
--
-- Qué hace: quita a las personas SIN sesión (anon) cualquier permiso
-- de escribir en `players` (hoy conservan INSERT/UPDATE; la protección
-- de filas las frena, pero es mejor que ni siquiera tengan el permiso).
-- ============================================================

revoke all privileges on table public.players from anon;

-- Verificación: debe dar 0 filas
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'players' and grantee = 'anon';

-- ROLLBACK (solo si algo se rompe):
-- grant insert, update on public.players to anon;
