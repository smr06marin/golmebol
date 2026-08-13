-- Guarda un "stock inicial" fijo por producto (la cantidad que había cuando
-- se empezó a llevar el registro), para poder mostrar en Inventario:
-- stock inicial + lo que ha ido entrando (compras) - lo que se ha ido
-- vendiendo = stock actual.
alter table escenario_productos add column if not exists stock_inicial integer default 0;

-- Para los productos que ya existen, se toma la cantidad que tienen hoy
-- como su punto de partida (de ahí para adelante ya queda el historial).
update escenario_productos set stock_inicial = cantidad;
