-- ============================================================
-- MIGRACIÓN: Método de pago en los pedidos remotos
--
-- El cliente ahora indica si va a pagar en efectivo o por transferencia, y
-- si es en efectivo, con cuánto billete paga — para que el encargado sepa
-- de una vez cuánta devuelta alistar antes de que llegue el pedido.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_pedidos add column if not exists metodo_pago text;
alter table escenario_pedidos add column if not exists paga_con numeric;
alter table escenario_pedidos add column if not exists devuelta numeric;
