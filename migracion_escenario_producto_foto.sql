-- ============================================================
-- MIGRACIÓN: foto de producto en vez de emoji (Inventario de Escenarios)
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_productos add column if not exists foto_url text;
