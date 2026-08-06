-- ============================================================
-- MIGRACIÓN: categoría de producto (Inventario / Punto de venta de Escenarios)
--
-- Para poder mostrar el catálogo de la tienda organizado por categorías
-- (Bebidas, Papas, Dulces, etc.) en la página de ventas.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_productos add column if not exists categoria text;
