-- ============================================================
-- RESET DE LA TIENDA A CERO — Escenarios Deportivos
--
-- Borra el historial de ventas, compras, gastos, conteos de stock y la
-- base de caja, y deja el stock de cada producto en 0.
--
-- Se mantienen intactos: productos (nombre, foto, categoría, precio de
-- compra, precio de venta, stock mínimo) y todo lo de Canchas (reservas,
-- horarios fijos).
--
-- ⚠️ ESTO ES IRREVERSIBLE. Antes de correrlo, asegúrate de tener el id
-- correcto de tu escenario.
-- ============================================================

-- 1) Corre esto primero solo, y copia el "id" de tu escenario:
select id, name from escenarios;

-- 2) Reemplaza 'PEGA-AQUI-EL-ID' por ese id en TODAS las líneas de abajo
--    (son varias), y luego corre todo este bloque junto:

delete from escenario_ventas         where escenario_id = 'PEGA-AQUI-EL-ID';
delete from escenario_compras        where escenario_id = 'PEGA-AQUI-EL-ID';
delete from escenario_gastos         where escenario_id = 'PEGA-AQUI-EL-ID';
delete from escenario_conteos_stock  where escenario_id = 'PEGA-AQUI-EL-ID';
delete from escenario_base_caja      where escenario_id = 'PEGA-AQUI-EL-ID';

update escenario_productos
set cantidad = 0, stock_inicial = 0
where escenario_id = 'PEGA-AQUI-EL-ID';
