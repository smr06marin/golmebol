-- ============================================================
-- MIGRACIÓN: Deudas con proveedores en compras de Escenarios Deportivos
--
-- Igual que con las ventas fiadas (migracion_ventas_fiado.sql), cuando el
-- encargado compra mercancía pero no le paga completo al proveedor en el
-- momento, necesita quedar anotado cuánto se debe y poder marcarlo como
-- pagado después.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_compras add column if not exists pago_estado text default 'pagado';
alter table escenario_compras add column if not exists monto_pagado numeric default 0;
alter table escenario_compras add column if not exists pagado_at timestamptz;

comment on column escenario_compras.pago_estado is 'pagado | parcial | pendiente — si esta compra se le pagó completa, parcial o nada al proveedor';
comment on column escenario_compras.monto_pagado is 'Cuánto se le ha pagado al proveedor de esta compra hasta ahora';
comment on column escenario_compras.pagado_at is 'Cuándo quedó saldada por completo la deuda con el proveedor';
