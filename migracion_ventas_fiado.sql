-- ============================================================
-- MIGRACIÓN: Ventas fiadas ("debe")
--
-- Cuando alguien compra algo pero paga después (queda "debiendo"), el
-- encargado necesita anotar quién es y en qué cancha está jugando, para
-- poder cobrarle cuando termine. La venta se registra igual (el producto
-- sale del inventario), pero queda marcada como pago pendiente hasta que
-- alguien la marque como pagada.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_ventas add column if not exists pago_estado text default 'pagado';
alter table escenario_ventas add column if not exists deudor_nombre text;
alter table escenario_ventas add column if not exists deudor_cancha text;
alter table escenario_ventas add column if not exists pagado_at timestamptz;
