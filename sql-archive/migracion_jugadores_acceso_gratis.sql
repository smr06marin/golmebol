-- ============================================================
-- Acceso gratis para todos los jugadores.
--
-- Qué hace:
-- 1) Activa a TODOS los jugadores que estaban pendientes de
--    activación manual (activo_membresia = false), para que
--    puedan entrar ya mismo.
-- 2) Le quita la fecha de vencimiento a cualquiera que la tuviera
--    vencida, para que nadie quede bloqueado por eso tampoco.
-- 3) Agrega la columna `fecha_registro` (si no existía) para
--    saber desde cuándo entró cada jugador — la vamos a necesitar
--    más adelante para las reglas de suscripción/premios.
--    Si la tabla ya tenía `created_at`, se usa ese valor como
--    fecha de registro para los jugadores que ya existían.
--
-- Es seguro ejecutarlo más de una vez.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================

-- Paso 1: agregar fecha_registro si no existe
alter table players add column if not exists fecha_registro timestamptz default now();

-- Paso 2: rellenar fecha_registro para los que no la tengan, usando
-- created_at si existe esa columna (envuelto por si no existe).
do $$
begin
  update players set fecha_registro = created_at
  where fecha_registro is null and created_at is not null;
exception when undefined_column then
  update players set fecha_registro = now() where fecha_registro is null;
end $$;

-- Paso 3: activar a todos los jugadores pendientes
update players
set activo_membresia = true
where activo_membresia is distinct from true;

-- Paso 4: quitar vencimientos que estén bloqueando el acceso
update players
set fecha_vencimiento = null
where fecha_vencimiento is not null and fecha_vencimiento < now();
