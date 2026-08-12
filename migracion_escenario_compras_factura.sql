-- ============================================================
-- MIGRACIÓN: Foto y total de factura + hora de entrada en compras
-- de Escenarios Deportivos (tienda)
--
-- Permite que el encargado adjunte la foto de la factura/recibo y el
-- valor total de la compra, y deja registrada la hora exacta en que
-- los productos entraron al inventario (además de la fecha, que ya
-- existía). Así el informe de reportes puede mostrar la factura y lo
-- que ingresó cada día.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_compras add column if not exists factura_foto_url text;
alter table escenario_compras add column if not exists factura_total numeric;
alter table escenario_compras add column if not exists hora text;

comment on column escenario_compras.factura_foto_url is 'Foto de la factura/recibo de la compra, subida por el encargado';
comment on column escenario_compras.factura_total is 'Valor total de la factura (puede cubrir varios productos; se guarda una vez por compra)';
comment on column escenario_compras.hora is 'Hora en que se registró la entrada del producto al stock (HH:MM)';
