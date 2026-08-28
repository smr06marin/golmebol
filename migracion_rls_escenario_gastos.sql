-- ============================================================
-- FIX: "new row violates row-level security policy for table
-- escenario_gastos" al registrar un gasto
--
-- El error "function public.es_encargado_escenario(uuid) does not
-- exist" confirma que la migración que crea esa función
-- (migracion_rls_seguridad_tanda1.sql) todavía no se corrió en esta
-- base de datos — por eso no se puede usar acá. En algún momento se
-- activó RLS (seguridad por fila) en escenario_gastos sin ninguna
-- política (a mano, o desde el aviso de seguridad de Supabase), y sin
-- política ninguna, TODO insert queda bloqueado por defecto — de ahí
-- el error original.
--
-- El control de acceso de este módulo (Escenarios) ya se hace en la
-- app (se revisa quién es encargado antes de dejar entrar a la
-- pantalla) — igual que en escenario_ventas y escenario_compras, que
-- hoy NO tienen RLS activado. Esta migración deja escenario_gastos
-- igual que esas dos: RLS desactivado, tal como estaba pensada
-- originalmente en migracion_escenario_gastos.sql.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

drop policy if exists "escenario_gastos_select" on escenario_gastos;
drop policy if exists "escenario_gastos_insert" on escenario_gastos;
drop policy if exists "escenario_gastos_update" on escenario_gastos;
drop policy if exists "escenario_gastos_delete" on escenario_gastos;

alter table escenario_gastos disable row level security;
