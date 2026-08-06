-- ============================================================
-- MIGRACIÓN: Volver a permitir que cualquier cliente cree su propio
-- pedido remoto (sin necesidad de cuenta ni de ser encargado).
--
-- migracion_rls_seguridad_tanda1.sql activó RLS en escenario_pedidos con
-- políticas que exigen ser encargado del escenario para TODO — incluido el
-- insert. Eso rompió la página de "Pedido a distancia": el texto de esa
-- página dice que el cliente arma su pedido solo desde la cancha, pero con
-- esa política ningún visitante sin sesión de encargado podía insertar su
-- pedido. Esta migración deja el select/update/delete tal cual (solo el
-- encargado los ve y los marca como entregados), y solo abre el insert para
-- que cualquiera pueda crear un pedido nuevo en estado 'pendiente'.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

drop policy if exists "escenario_pedidos_insert_publico" on escenario_pedidos;
drop policy if exists "escenario_pedidos_insert" on escenario_pedidos;

create policy "escenario_pedidos_insert_publico"
on escenario_pedidos for insert
with check (estado = 'pendiente');

-- ============================================================
-- Vista pública de "más vendidos" (sin exponer ventas reales)
--
-- La página pública de pedido necesita mostrar los productos en el mismo
-- orden que la tienda interna (más vendido primero), pero escenario_ventas
-- quedó con RLS solo para encargados — ahí están totales, costos y
-- ganancias, datos que un cliente cualquiera no debería poder leer. Esta
-- vista solo expone la cuenta de unidades vendidas por producto en los
-- últimos 60 días, nada de plata. Al ser una vista (no una tabla con RLS),
-- se puede leer sin necesitar sesión de encargado.
-- ============================================================
create or replace view escenario_ventas_conteo_publico as
select
  v.escenario_id,
  (item->>'productId')::uuid as producto_id,
  sum(coalesce((item->>'cantidad')::int, 0)) as cantidad
from escenario_ventas v, jsonb_array_elements(v.items) as item
where v.fecha >= (current_date - interval '60 days')
group by v.escenario_id, producto_id;

grant select on escenario_ventas_conteo_publico to anon, authenticated;
