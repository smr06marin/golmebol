-- ============================================================
-- MIGRACIÓN: Devoluciones de venta
--
-- Cuando alguien compra algo y después lo devuelve, el encargado necesita
-- poder deshacer esa venta: que la plata deje de contar como ingreso y que
-- el producto vuelva al inventario. En vez de borrar la venta (se pierde el
-- registro de lo que pasó), queda marcada como 'devuelta' — sigue existiendo
-- para el historial, pero no cuenta en caja, reportes, cierre ni en el
-- ranking de más vendidos.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_ventas add column if not exists estado text default 'completada';
alter table escenario_ventas add column if not exists devuelta_at timestamptz;

-- La vista pública de "más vendidos" (usada en /pedir) tampoco debe contar
-- productos que terminaron devueltos.
create or replace view escenario_ventas_conteo_publico as
select
  v.escenario_id,
  (item->>'productId')::uuid as producto_id,
  sum(coalesce((item->>'cantidad')::int, 0)) as cantidad
from escenario_ventas v, jsonb_array_elements(v.items) as item
where v.fecha >= (current_date - interval '60 days')
  and v.estado = 'completada'
group by v.escenario_id, producto_id;
